-- Rafiq additions (supersedes One Thing): sleep quality, tired ladder, food logging,
-- and the disordered-eating commentary guard.

-- profiles: the §12 food-commentary guard flag.
alter table profiles add column if not exists food_commentary_enabled boolean default true;

-- day_signals: sleep quality + per-day tired report count (§5.1, §6).
alter table day_signals add column if not exists sleep_quality text;   -- broken | poor | ok | solid
alter table day_signals add column if not exists tired_reports int default 0;

-- meals (§7). Coarse ratings only — no numbers, ever.
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  logged_at timestamptz default now(),
  slot text,                    -- breakfast | lunch | dinner | snack
  raw_text text not null,
  items jsonb,
  protein text, veg text, fibre text,   -- none | low | ok | good | unknown
  carb_type text                -- refined | whole | mixed | none
);

-- tired_events (§6): which ladder rule fired and what the user did.
create table if not exists tired_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  at timestamptz default now(),
  trigger text,                 -- reset | break | chat | abandoned
  explanation_rule int,         -- 1..7
  action_taken text             -- shorten | stop | push
);

alter table meals        enable row level security;
alter table tired_events enable row level security;

create policy "own rows" on meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on tired_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
