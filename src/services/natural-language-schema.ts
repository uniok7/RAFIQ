export type NaturalActionName = 'none' | 'add_task' | 'complete' | 'set_energy' | 'defer' | 'shorten';
export type NaturalAction = {
  say: string;
  action: NaturalActionName;
  task: { title?: string; estimate?: number; load?: 1 | 2 | 3; due?: string | null; status?: 'dropped' };
  taskId: string;
  energy: 'low' | 'normal' | 'high';
  minutes: number;
};

const actions = new Set<NaturalActionName>(['none', 'add_task', 'complete', 'set_energy', 'defer', 'shorten']);

export function normalizeNaturalAction(value: unknown): NaturalAction {
  if (!value || typeof value !== 'object') throw new Error('invalid_action');
  const raw = value as Record<string, unknown>;
  const action = String(raw.action ?? 'none') as NaturalActionName;
  if (!actions.has(action)) throw new Error('invalid_action');
  const rawTask = raw.task && typeof raw.task === 'object' ? raw.task as Record<string, unknown> : {};
  const load = Math.min(3, Math.max(1, Number(rawTask.load) || 2)) as 1 | 2 | 3;
  const energy = ['low', 'normal', 'high'].includes(String(raw.energy)) ? raw.energy as NaturalAction['energy'] : 'normal';
  return {
    say: String(raw.say ?? '').trim().slice(0, 400),
    action,
    task: { title: rawTask.title ? String(rawTask.title).trim() : undefined, estimate: rawTask.estimate ? Math.max(5, Number(rawTask.estimate)) : undefined, load, due: typeof rawTask.due === 'string' ? rawTask.due : null, status: rawTask.status === 'dropped' ? 'dropped' : undefined },
    taskId: String(raw.taskId ?? ''),
    energy,
    minutes: Math.min(60, Math.max(5, Number(raw.minutes) || 30)),
  };
}
