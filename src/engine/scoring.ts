// §5.3 Task scoring. Pure. Numbers are exact from the spec — do not "tidy" them.
import type {
  EngineWeights,
  Energy,
  RankedTask,
  ScoreReason,
  Task,
} from './types';
import { dayDiff } from './util';

// Points for each urgency bucket (mutually exclusive), highest applicable wins.
function urgencyReason(task: Task, day: string): ScoreReason | null {
  if (!task.due) return null;
  const diff = dayDiff(day, task.due); // days from today to due; <0 = overdue
  if (diff < 0) return { code: 'overdue', points: 45, text: "it's overdue" };
  if (diff === 0) return { code: 'due_today', points: 40, text: "it's due today" };
  if (diff === 1) return { code: 'due_tomorrow', points: 24, text: "it's due tomorrow" };
  if (diff <= 7) return { code: 'due_this_week', points: 11, text: "it's due this week" };
  return null;
}

function loadFitPoints(load: number, energy: Energy): number {
  if (energy === 'low') return (4 - load) * 9;
  if (energy === 'high') return load * 7;
  return (4 - load) * 3; // normal
}

export function scoreTask(
  task: Task,
  energy: Energy,
  weights: EngineWeights,
  demotedTaskIds: string[],
  day: string,
): RankedTask {
  const reasons: ScoreReason[] = [];
  let score = 0;

  // urgency
  const urg = urgencyReason(task, day);
  if (urg) {
    score += urg.points;
    reasons.push(urg);
  }

  // leverage
  if (task.unblocks) {
    const r: ScoreReason = { code: 'unblocks', points: 18, text: 'other work is waiting behind it' };
    score += r.points;
    reasons.push(r);
  }
  if (task.goal_id) {
    const r: ScoreReason = { code: 'has_goal', points: 8, text: 'it moves a goal forward' };
    score += r.points;
    reasons.push(r);
  }

  // load fit (adaptable weight, §5.6). Not shown as a narrative reason.
  const loadWeight = weights.load_fit ?? 1;
  score += loadFitPoints(task.cognitive_load, energy) * loadWeight;

  // staleness
  if (task.reschedule_count >= 3) {
    const r: ScoreReason = {
      code: 'stale',
      points: 26,
      text: "you've pushed it back several times",
    };
    score += r.points;
    reasons.push(r);
  } else {
    score += task.reschedule_count * 8;
  }

  // demoted today by the user (§5.3 / wrong_priority correction)
  if (demotedTaskIds.includes(task.id)) {
    score -= 200;
    reasons.push({ code: 'demoted', points: -200, text: 'you moved it off the top' });
  }

  return { task, score, reasons };
}

/** Rank open tasks. Ties broken by earlier created_at (§5.3). */
export function rankTasks(
  tasks: Task[],
  energy: Energy,
  weights: EngineWeights,
  demotedTaskIds: string[],
  day: string,
): RankedTask[] {
  return tasks
    .filter((t) => t.status === 'open')
    .map((t) => scoreTask(t, energy, weights, demotedTaskIds, day))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.task.created_at.localeCompare(b.task.created_at);
    });
}
