create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  work_start smallint default 9 check (work_start between 0 and 23),
  work_end smallint default 18 check (work_end between 0 and 23),
  morning_hour smallint default 7 check (morning_hour between 0 and 23),
  night_hour smallint default 21 check (night_hour between 0 and 23),
  timezone text default 'UTC',
  engine_weights jsonb default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  why text,
  horizon_days int default 90,
  status text default 'active' check (status in ('active', 'done', 'dropped')),
  created_at timestamptz default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  goal_id uuid references public.goals on delete set null,
  title text not null,
  estimate_mins int default 30 check (estimate_mins > 0),
  cognitive_load smallint default 2 check (cognitive_load between 1 and 3),
  due date,
  unblocks boolean default false,
  reschedule_count int default 0 check (reschedule_count >= 0),
  status text default 'open' check (status in ('open', 'done', 'dropped')),
  done_at date,
  created_at timestamptz default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  task_id uuid references public.tasks on delete cascade,
  day date not null,
  planned_mins int not null check (planned_mins > 0),
  actual_mins int check (actual_mins >= 0),
  interruptions int default 0 check (interruptions >= 0),
  completed boolean default false,
  started_at timestamptz,
  ended_at timestamptz
);

create table public.day_signals (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  sleep_mins int check (sleep_mins >= 0),
  sleep_source text check (sleep_source is null or sleep_source in ('healthkit', 'health_connect', 'manual')),
  energy_stated text check (energy_stated is null or energy_stated in ('low', 'normal', 'high')),
  mood text check (mood is null or mood in ('bad', 'okay', 'good', 'great')),
  planned_count int default 0 check (planned_count >= 0),
  completed_count int default 0 check (completed_count >= 0),
  primary key (user_id, day)
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  type text not null check (type in ('main_win', 'energy', 'block_size', 'night_rollover')),
  payload jsonb not null,
  reasoning text not null,
  accepted boolean,
  corrected_to jsonb,
  correction_type text check (correction_type is null or correction_type in ('wrong_fact', 'wrong_inference', 'wrong_priority', 'wrong_entirely')),
  engine_version int not null,
  created_at timestamptz default now()
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  key text not null check (key in ('estimate_multiplier', 'sleep_effect', 'avoidance', 'short_nights')),
  label text not null,
  value text not null,
  numeric_value numeric,
  evidence_count int default 1 check (evidence_count >= 1),
  confidence text default 'early' check (confidence in ('early', 'solid')),
  source text not null check (source in ('inferred', 'corrected', 'stated')),
  dismissed_at timestamptz,
  updated_at timestamptz default now(),
  unique (user_id, key)
);

create table public.routine_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text not null,
  sort_order int default 0,
  active boolean default true
);

create table public.routine_checks (
  user_id uuid not null references auth.users on delete cascade,
  item_id uuid not null references public.routine_items on delete cascade,
  day date not null,
  primary key (user_id, item_id, day)
);

create table public.population_priors (
  key text primary key,
  value numeric not null,
  n int not null default 0,
  updated_at timestamptz default now()
);

create index goals_user_status_idx on public.goals (user_id, status);
create index tasks_user_status_due_idx on public.tasks (user_id, status, due);
create index sessions_user_day_idx on public.sessions (user_id, day);
create index recommendations_user_day_idx on public.recommendations (user_id, day);
create index observations_user_active_idx on public.observations (user_id, dismissed_at);

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.sessions enable row level security;
alter table public.day_signals enable row level security;
alter table public.recommendations enable row level security;
alter table public.observations enable row level security;
alter table public.routine_items enable row level security;
alter table public.routine_checks enable row level security;
alter table public.population_priors enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sessions" on public.sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own day signals" on public.day_signals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recommendations" on public.recommendations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own observations" on public.observations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own routine items" on public.routine_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own routine checks" on public.routine_checks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Population priors intentionally have no client policy. Only trusted server code can read or write them.

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.profiles, public.goals, public.tasks, public.sessions,
  public.day_signals, public.recommendations, public.observations, public.routine_items, public.routine_checks
  to authenticated;
