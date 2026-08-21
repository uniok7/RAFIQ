create table public.llm_daily_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  calls int not null default 0 check (calls between 0 and 60),
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.llm_daily_usage enable row level security;
revoke all on public.llm_daily_usage from anon, authenticated;

create or replace function public.consume_llm_call()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare next_calls int;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  insert into public.llm_daily_usage (user_id, day, calls)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update
    set calls = public.llm_daily_usage.calls + 1, updated_at = now()
    where public.llm_daily_usage.calls < 60
  returning calls into next_calls;
  if next_calls is null then raise exception 'daily_llm_limit_reached'; end if;
  return next_calls;
end;
$$;

create or replace function public.record_llm_tokens(p_input int, p_output int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  update public.llm_daily_usage
    set input_tokens = input_tokens + greatest(p_input, 0),
        output_tokens = output_tokens + greatest(p_output, 0),
        updated_at = now()
    where user_id = auth.uid() and day = current_date;
end;
$$;

grant execute on function public.consume_llm_call() to authenticated;
grant execute on function public.record_llm_tokens(int, int) to authenticated;
