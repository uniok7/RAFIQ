create table public.user_entitlements (
  user_id uuid primary key references auth.users on delete cascade,
  active boolean not null default false,
  trial_started_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;
create policy "own entitlement read" on public.user_entitlements for select using (auth.uid() = user_id);
grant select on public.user_entitlements to authenticated;
revoke insert, update, delete on public.recommendations from authenticated;

create or replace function public.lock_trial_start()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.onboarded_at is null and new.onboarded_at is not null then
    insert into public.user_entitlements (user_id, active, trial_started_at)
    values (new.id, false, now())
    on conflict (user_id) do update
      set trial_started_at = coalesce(public.user_entitlements.trial_started_at, excluded.trial_started_at);
  end if;
  return new;
end;
$$;

create trigger lock_trial_start_after_onboarding
  after update of onboarded_at on public.profiles
  for each row execute procedure public.lock_trial_start();

revoke all on function public.lock_trial_start() from public, anon, authenticated;

insert into public.user_entitlements (user_id, active, trial_started_at)
select id, false, least(onboarded_at, now()) from public.profiles where onboarded_at is not null
on conflict (user_id) do update set trial_started_at = coalesce(public.user_entitlements.trial_started_at, excluded.trial_started_at);

create or replace function public.can_create_recommendations()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select onboarded_at is null and not exists (select 1 from public.user_entitlements where user_id = auth.uid()) from public.profiles where id = auth.uid()), false)
    or coalesce((select trial_started_at > now() - interval '7 days' from public.user_entitlements where user_id = auth.uid()), false)
    or coalesce((select active and (expires_at is null or expires_at > now()) from public.user_entitlements where user_id = auth.uid()), false);
$$;

revoke all on function public.can_create_recommendations() from public, anon;
grant execute on function public.can_create_recommendations() to authenticated;

create or replace function public.accept_day_plan(p_day date, p_main_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.recommendations
    where user_id = owner_id and day = p_day and type = 'main_win' and payload ->> 'taskId' = p_main_task_id::text
  ) then raise exception 'plan_not_found'; end if;
  update public.recommendations set accepted = true
  where user_id = owner_id and day = p_day and type in ('energy', 'block_size', 'main_win') and correction_type is null;
end;
$$;

revoke all on function public.accept_day_plan(date, uuid) from public, anon;
grant execute on function public.accept_day_plan(date, uuid) to authenticated;

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
  if not public.can_create_recommendations() then raise exception 'subscription_required'; end if;
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

revoke all on function public.log_day_plan(date, jsonb, int) from public, anon;
grant execute on function public.log_day_plan(date, jsonb, int) to authenticated;
