create or replace function public.correct_recommendation(
  p_recommendation_id uuid,
  p_correction_type text,
  p_corrected_to jsonb,
  p_replacement_task_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  recommendation public.recommendations%rowtype;
  suggested_load int;
  replacement_load int;
  current_weight numeric;
  next_weight numeric;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_correction_type not in ('wrong_fact', 'wrong_inference', 'wrong_priority', 'wrong_entirely') then raise exception 'invalid_correction_type'; end if;
  select * into recommendation from public.recommendations where id = p_recommendation_id and user_id = owner_id for update;
  if not found then raise exception 'recommendation_not_found'; end if;
  update public.recommendations set accepted = false, corrected_to = p_corrected_to, correction_type = p_correction_type where id = recommendation.id;

  if p_correction_type = 'wrong_priority' and recommendation.type = 'main_win' and p_replacement_task_id is not null then
    select cognitive_load into suggested_load from public.tasks where id = (recommendation.payload ->> 'taskId')::uuid and user_id = owner_id;
    select cognitive_load into replacement_load from public.tasks where id = p_replacement_task_id and user_id = owner_id;
    if suggested_load is not null and replacement_load is not null and suggested_load <> replacement_load then
      select coalesce((engine_weights ->> 'load_fit')::numeric, 1) into current_weight from public.profiles where id = owner_id for update;
      next_weight := least(1.5, greatest(0.5, current_weight + case when replacement_load < suggested_load then 0.05 else -0.05 end));
      update public.profiles set engine_weights = jsonb_set(engine_weights, '{load_fit}', to_jsonb(next_weight), true) where id = owner_id;
    end if;
  end if;
end;
$$;

create or replace function public.recompute_observations_for(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  data_days int;
  estimate_n int;
  estimate_ratio numeric;
  sleep_n int;
  rested_n int;
  short_n int;
  rested_rate numeric;
  short_rate numeric;
  sleep_effect numeric;
  avoided_title text;
  avoided_count int;
  correction_count int;
begin
  select count(distinct day) into data_days from (
    select day from public.day_signals where user_id = p_user_id
    union all select day from public.sessions where user_id = p_user_id
  ) evidence;

  select count(*), avg(actual_mins::numeric / nullif(planned_mins, 0)) into estimate_n, estimate_ratio
  from public.sessions where user_id = p_user_id and completed and actual_mins is not null and planned_mins > 0;
  if data_days >= 15 and estimate_n >= 5 and (estimate_ratio < 0.85 or estimate_ratio > 1.15) then
    insert into public.observations (user_id, key, label, value, numeric_value, evidence_count, confidence, source)
    values (p_user_id, 'estimate_multiplier', 'Time estimates', 'When you say 30 minutes, it usually takes ' || round(30 * estimate_ratio)::int || '.', estimate_ratio, estimate_n, case when estimate_n < 12 then 'early' else 'solid' end, 'inferred')
    on conflict (user_id, key) do update set value = excluded.value, numeric_value = excluded.numeric_value, evidence_count = excluded.evidence_count, confidence = excluded.confidence, updated_at = now()
    where public.observations.dismissed_at is null;
  else
    delete from public.observations where user_id = p_user_id and key = 'estimate_multiplier' and dismissed_at is null;
  end if;

  select
    count(*) filter (where sleep_mins is not null and planned_count > 0),
    count(*) filter (where sleep_mins >= 420 and planned_count > 0),
    count(*) filter (where sleep_mins < 420 and sleep_mins is not null and planned_count > 0),
    avg(completed_count::numeric / nullif(planned_count, 0)) filter (where sleep_mins >= 420 and planned_count > 0),
    avg(completed_count::numeric / nullif(planned_count, 0)) filter (where sleep_mins < 420 and sleep_mins is not null and planned_count > 0)
  into sleep_n, rested_n, short_n, rested_rate, short_rate
  from public.day_signals where user_id = p_user_id;
  if sleep_n >= 15 and rested_n >= 4 and short_n >= 4 and short_rate > 0 then
    sleep_effect := ((rested_rate - short_rate) / short_rate) * 100;
  else sleep_effect := null;
  end if;
  if sleep_effect is not null and abs(sleep_effect) >= 12 then
    insert into public.observations (user_id, key, label, value, numeric_value, evidence_count, confidence, source)
    values (p_user_id, 'sleep_effect', 'Sleep and follow-through', 'On 7+ hours you finish ' || round(abs(sleep_effect))::int || '% ' || case when sleep_effect >= 0 then 'more' else 'less' end || ' of what you planned.', sleep_effect, sleep_n, 'solid', 'inferred')
    on conflict (user_id, key) do update set value = excluded.value, numeric_value = excluded.numeric_value, evidence_count = excluded.evidence_count, confidence = excluded.confidence, updated_at = now()
    where public.observations.dismissed_at is null;
  else
    delete from public.observations where user_id = p_user_id and key = 'sleep_effect' and dismissed_at is null;
  end if;

  select title, reschedule_count into avoided_title, avoided_count from public.tasks
  where user_id = p_user_id and status = 'open' and reschedule_count >= 3
  order by reschedule_count desc, created_at asc limit 1;
  if avoided_title is not null then
    insert into public.observations (user_id, key, label, value, numeric_value, evidence_count, confidence, source)
    values (p_user_id, 'avoidance', 'A task may be stuck', '“' || avoided_title || '” has moved ' || avoided_count || ' times. Is it actually a 10-minute job, or is something blocking it?', avoided_count, avoided_count, 'solid', 'inferred')
    on conflict (user_id, key) do update set value = excluded.value, numeric_value = excluded.numeric_value, evidence_count = excluded.evidence_count, updated_at = now()
    where public.observations.dismissed_at is null;
  else
    delete from public.observations where user_id = p_user_id and key = 'avoidance' and dismissed_at is null;
  end if;

  select count(*) into correction_count from public.recommendations where user_id = p_user_id and type = 'energy' and correction_type = 'wrong_inference';
  if correction_count >= 3 then
    insert into public.observations (user_id, key, label, value, numeric_value, evidence_count, confidence, source)
    values (p_user_id, 'short_nights', 'Sleep correction', 'You’ve corrected me ' || correction_count || ' times on this. I’ve stopped lowering your load automatically.', correction_count, correction_count, 'solid', 'corrected')
    on conflict (user_id, key) do update set value = excluded.value, numeric_value = excluded.numeric_value, evidence_count = excluded.evidence_count, updated_at = now()
    where public.observations.dismissed_at is null;
  end if;
end;
$$;

create or replace function public.recompute_observations_after_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mood is not null then perform public.recompute_observations_for(new.user_id); end if;
  return new;
end;
$$;

create trigger recompute_observations_on_night_review
  after insert or update of mood on public.day_signals
  for each row execute procedure public.recompute_observations_after_review();

grant execute on function public.correct_recommendation(uuid, text, jsonb, uuid) to authenticated;
revoke all on function public.recompute_observations_for(uuid) from public, anon, authenticated;
