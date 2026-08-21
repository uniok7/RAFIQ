export type ParsedGoal = { title: string; why: string };
export type ParsedTask = { title: string; goal: string; estimate: number; load: 1 | 2 | 3; due: string | null };
export type ParsedPlan = { goals: ParsedGoal[]; tasks: ParsedTask[] };

export function normalizeParsedPlan(value: unknown): ParsedPlan {
  const raw = value as { goals?: unknown[]; tasks?: unknown[] };
  if (!Array.isArray(raw?.goals) || !Array.isArray(raw.tasks)) throw new Error('invalid_plan');
  return {
    goals: raw.goals.slice(0, 4).map((item) => {
      const goal = item as Record<string, unknown>;
      return { title: String(goal.title ?? '').trim(), why: String(goal.why ?? '').trim() };
    }).filter((goal) => goal.title),
    tasks: raw.tasks.slice(0, 10).map((item) => {
      const task = item as Record<string, unknown>;
      const load = Math.min(3, Math.max(1, Number(task.load) || 2)) as 1 | 2 | 3;
      return { title: String(task.title ?? '').trim(), goal: String(task.goal ?? '').trim(), estimate: Math.max(5, Number(task.estimate) || 30), load, due: typeof task.due === 'string' ? task.due : null };
    }).filter((task) => task.title),
  };
}
