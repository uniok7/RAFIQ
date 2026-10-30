-- One Thing — core schema (§3). Every user table has RLS enabled with an
-- own-rows-only policy keyed on auth.uid().

-- ============ core ============
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  work_start smallint default 9,     -- local hour
  work_end   smallint default 18,
  morning_hour smallint default 7,
  night_hour   smallint default 21,
  timezone text default 'UTC',
  engine_weights jsonb default '{}'::jsonb,  -- per-user overrides, §5.6
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  why text,                      -- the raw sentence from onboarding
  horizon_days int default 90,
  status text default 'active',  -- active | done | dropped
  created_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  goal_id uuid references goals on delete set null,
  title text not null,
  estimate_mins int default 30,
  cognitive_load smallint default 2,   -- 1 light, 2 normal, 3 deep focus
  due date,
  unblocks boolean default false,      -- other work is waiting behind it
  reschedule_count int default 0,
  status text default 'open',          -- open | done | dropped
  done_at date,
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  task_id uuid references tasks on delete cascade,
  day date not null,
  planned_mins int not null,
  actual_mins int,
  interruptions int default 0,
  completed boolean default false,
  started_at timestamptz,
  ended_at timestamptz
);

create table day_signals (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  sleep_mins int,
  sleep_source text,          -- healthkit | health_connect | manual
  energy_stated text,         -- low | normal | high  (user override)
  mood text,                  -- bad | okay | good | great
  planned_count int default 0,
  completed_count int default 0,
  primary key (user_id, day)
);

-- ============ intelligence ============
create table recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  type text not null,          -- main_win | energy | block_size | night_rollover
  payload jsonb not null,      -- what was recommended
  reasoning text not null,     -- the sentence shown to the user
  accepted boolean,
  corrected_to jsonb,
  correction_type text,        -- wrong_fact | wrong_inference | wrong_priority | wrong_entirely
  engine_version int not null,
  created_at timestamptz default now()
);

create table observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  key text not null,           -- estimate_multiplier | sleep_effect | avoidance | short_nights
  label text not null,
  value text not null,         -- the sentence shown on the You screen
  numeric_value numeric,
  evidence_count int default 1,
  confidence text default 'early',  -- early | solid
  source text not null,        -- inferred | corrected | stated
  dismissed_at timestamptz,
  updated_at timestamptz default now(),
  unique (user_id, key)
);

create table routine_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text not null,
  sort_order int default 0,
  active boolean default true
);

create table routine_checks (
  user_id uuid not null references auth.users on delete cascade,
  item_id uuid not null references routine_items on delete cascade,
  day date not null,
  primary key (user_id, item_id, day)
);

-- token spend ledger for the LLM proxy rate limit (§6, §12). Server-writable only.
create table llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  job text not null,            -- A | B | C
  input_tokens int default 0,
  output_tokens int default 0,
  created_at timestamptz default now()
);

-- ============ future-proofing, empty for now ============
create table population_priors (
  key text primary key,
  value numeric not null,
  n int not null default 0,
  updated_at timestamptz default now()
);

-- ============ RLS ============ (§3 pattern, applied to every user table)
alter table profiles         enable row level security;
alter table goals            enable row level security;
alter table tasks            enable row level security;
alter table sessions         enable row level security;
alter table day_signals      enable row level security;
alter table recommendations  enable row level security;
alter table observations     enable row level security;
alter table routine_items    enable row level security;
alter table routine_checks   enable row level security;
alter table llm_usage        enable row level security;

-- profiles keys on id (which IS auth.uid()); all others on user_id.
create policy "own rows" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own rows" on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on day_signals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on recommendations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on observations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on routine_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on routine_checks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- llm_usage: readable by owner, but only the service role writes it (no insert/update policy).
create policy "own rows read" on llm_usage
  for select using (auth.uid() = user_id);

-- population_priors is global read-only reference data; no RLS, service-role writes.

-- ============ account deletion (§4) ============
-- Cascades every user table via the FK on delete cascade above. Auth user is
-- revoked from the Edge Function using the service role (auth.admin.deleteUser).
