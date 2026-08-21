import type { EnergyLevel, EngineState, EngineTask, RankedTask, ScoreReason, WeightKey } from './types';

function dateDistance(from: string, to: string) { return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000); }
function multiplier(state: EngineState, key: WeightKey) { return Math.min(1.5, Math.max(0.5, state.weights[key] ?? 1)); }

export function scoreTask(task: EngineTask, state: EngineState, day: string, energy: EnergyLevel): RankedTask {
  const reasons: ScoreReason[] = [];
  let score = 0;
  const add = (key: string, label: string, base: number, weight: WeightKey) => {
    const points = Math.round(base * multiplier(state, weight) * 100) / 100;
    score += points;
    if (points > 0) reasons.push({ key, label, points });
  };

  if (task.due) {
    const distance = dateDistance(day, task.due);
    if (distance < 0) add('overdue', 'it’s overdue', 45, 'urgency');
    else if (distance === 0) add('due_today', 'it’s due today', 40, 'urgency');
    else if (distance === 1) add('due_tomorrow', 'it’s due tomorrow', 24, 'urgency');
    else if (distance <= 7) add('due_week', 'it’s due this week', 11, 'urgency');
  }
  if (task.unblocks) add('unblocks', 'other work is waiting behind it', 18, 'unblocks');
  if (task.goal_id) add('goal', 'it moves an active goal forward', 8, 'goal');

  if (energy === 'low') add('load_fit', 'it fits a lower-energy day', (4 - task.cognitive_load) * 9, 'load_fit');
  else if (energy === 'high') add('load_fit', 'it uses the focus you have today', task.cognitive_load * 7, 'load_fit');
  else add('load_fit', 'its load fits a normal-energy day', (4 - task.cognitive_load) * 3, 'load_fit');

  if (task.reschedule_count >= 3) add('stale', `it’s been moved ${task.reschedule_count} times`, 26, 'staleness');
  else if (task.reschedule_count > 0) add('rescheduled', task.reschedule_count === 1 ? 'it was moved once' : `it was moved ${task.reschedule_count} times`, task.reschedule_count * 8, 'staleness');
  if (state.demotedTaskIds?.includes(task.id)) score -= 200;
  return { task, score, reasons: reasons.sort((a, b) => b.points - a.points) };
}

export function rankTasks(state: EngineState, day: string, energy: EnergyLevel) {
  return state.tasks.filter((task) => task.status === 'open').map((task) => scoreTask(task, state, day, energy)).sort((a, b) => b.score - a.score || new Date(a.task.created_at).getTime() - new Date(b.task.created_at).getTime());
}
