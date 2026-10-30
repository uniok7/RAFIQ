// Tiny builders so tests read as intent, not boilerplate.
import type { DaySignal, EngineState, Meal, Session, Task } from '../types';

export function meal(over: Partial<Meal> = {}): Meal {
  return {
    id: over.id ?? 'm1',
    day: '2026-08-19',
    logged_at: '2026-08-19T08:00:00.000Z',
    slot: 'breakfast',
    raw_text: 'eggs',
    protein: 'good',
    veg: 'none',
    fibre: 'low',
    carb_type: 'whole',
    ...over,
  };
}

export function task(over: Partial<Task> = {}): Task {
  return {
    id: over.id ?? 't1',
    goal_id: null,
    title: 'A task',
    estimate_mins: 30,
    cognitive_load: 2,
    due: null,
    unblocks: false,
    reschedule_count: 0,
    status: 'open',
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

export function signal(over: Partial<DaySignal> = {}): DaySignal {
  return {
    day: '2026-08-19',
    sleep_mins: null,
    sleep_quality: null,
    sleep_source: null,
    energy_stated: null,
    mood: null,
    tired_reports: 0,
    planned_count: 0,
    completed_count: 0,
    ...over,
  };
}

export function session(over: Partial<Session> = {}): Session {
  return {
    id: over.id ?? 's1',
    task_id: 't1',
    day: '2026-08-19',
    planned_mins: 30,
    actual_mins: 30,
    completed: true,
    ...over,
  };
}

export function state(over: Partial<EngineState> = {}): EngineState {
  return {
    tasks: [],
    sessions: [],
    daySignals: [],
    observations: [],
    weights: {},
    demotedTaskIds: [],
    ...over,
  };
}

/** N nights ending at `end`, each with the given sleep minutes. */
export function nights(count: number, sleepMins: number, end = '2026-08-19'): DaySignal[] {
  const base = Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10));
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base - i * 86400000).toISOString().slice(0, 10);
    return signal({ day: d, sleep_mins: sleepMins, sleep_source: 'manual' });
  });
}
