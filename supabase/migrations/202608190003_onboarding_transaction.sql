create or replace function public.save_onboarding_plan(p_goals jsonb, p_tasks jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  goal jsonb;
  task jsonb;
  matched_goal uuid;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_goals) <> 'array' or jsonb_array_length(p_goals) > 4 then raise exception 'invalid_goals'; end if;
  if jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) > 10 then raise exception 'invalid_tasks'; end if;

  for goal in select value from jsonb_array_elements(p_goals)
  loop
    if length(trim(goal ->> 'title')) > 0 then
      insert into public.goals (user_id, title, why)
      values (owner_id, trim(goal ->> 'title'), nullif(trim(goal ->> 'why'), ''));
    end if;
  end loop;

  for task in select value from jsonb_array_elements(p_tasks)
  loop
    matched_goal := null;
    if length(trim(coalesce(task ->> 'goal', ''))) > 0 then
      select id into matched_goal from public.goals
      where user_id = owner_id and lower(title) = lower(trim(task ->> 'goal'))
      order by created_at desc limit 1;
    end if;
    if length(trim(task ->> 'title')) > 0 then
      insert into public.tasks (user_id, goal_id, title, estimate_mins, cognitive_load, due)
      values (
        owner_id,
        matched_goal,
        trim(task ->> 'title'),
        greatest(5, coalesce((task ->> 'estimate')::int, 30)),
        least(3, greatest(1, coalesce((task ->> 'load')::int, 2))),
        case when task ->> 'due' ~ '^\d{4}-\d{2}-\d{2}$' then (task ->> 'due')::date else null end
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.save_onboarding_plan(jsonb, jsonb) to authenticated;
