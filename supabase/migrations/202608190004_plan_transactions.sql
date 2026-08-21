create or replace function public.log_day_plan(p_day date, p_entries jsonb, p_engine_version int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  entry jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) > 4 then raise exception 'invalid_entries'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || p_day::text, 0));
  for entry in select value from jsonb_array_elements(p_entries)
  loop
    if entry ->> 'type' not in ('main_win', 'energy', 'block_size') then raise exception 'invalid_recommendation_type'; end if;
    if not exists (
      select 1 from public.recommendations
      where user_id = owner_id and day = p_day and type = entry ->> 'type'
        and payload = entry -> 'payload' and reasoning = entry ->> 'reasoning'
    ) then
      insert into public.recommendations (user_id, day, type, payload, reasoning, engine_version)
      values (owner_id, p_day, entry ->> 'type', entry -> 'payload', entry ->> 'reasoning', p_engine_version);
    end if;
  end loop;
end;
$$;

create or replace function public.close_day(
  p_day date,
  p_mood text,
  p_planned_count int,
  p_completed_count int,
  p_checked_item_ids jsonb,
  p_tomorrow_task_id uuid,
  p_engine_version int
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  item text;
  rolled int;
  tomorrow_title text;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_mood not in ('bad', 'okay', 'good', 'great') then raise exception 'invalid_mood'; end if;
  if jsonb_typeof(p_checked_item_ids) <> 'array' then raise exception 'invalid_routine_checks'; end if;

  for item in select jsonb_array_elements_text(p_checked_item_ids)
  loop
    insert into public.routine_checks (user_id, item_id, day)
    select owner_id, id, p_day from public.routine_items where id = item::uuid and user_id = owner_id and active
    on conflict do nothing;
  end loop;

  update public.tasks set due = p_day + 1, reschedule_count = reschedule_count + 1
  where user_id = owner_id and status = 'open' and due = p_day;
  get diagnostics rolled = row_count;

  insert into public.day_signals (user_id, day, mood, planned_count, completed_count)
  values (owner_id, p_day, p_mood, greatest(0, p_planned_count), greatest(0, p_completed_count))
  on conflict (user_id, day) do update
    set mood = excluded.mood, planned_count = excluded.planned_count, completed_count = excluded.completed_count;

  select title into tomorrow_title from public.tasks where id = p_tomorrow_task_id and user_id = owner_id and status = 'open';
  insert into public.recommendations (user_id, day, type, payload, reasoning, engine_version)
  values (
    owner_id,
    p_day,
    'night_rollover',
    jsonb_build_object('rolledCount', rolled, 'tomorrowTaskId', p_tomorrow_task_id),
    case when tomorrow_title is not null then 'Tomorrow starts with ' || tomorrow_title || '.' else 'Tomorrow is clear.' end,
    p_engine_version
  );
  return rolled;
end;
$$;

grant execute on function public.log_day_plan(date, jsonb, int) to authenticated;
grant execute on function public.close_day(date, text, int, int, jsonb, uuid, int) to authenticated;
