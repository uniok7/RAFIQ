// Pure domain types for the decision engine.
// NOTHING in src/engine may import from React, Supabase, or the network.

export type Energy = 'low' | 'normal' | 'high';
export type EnergySource = 'stated' | 'default' | 'personal' | 'borrowed';
export type CognitiveLoad = 1 | 2 | 3; // 1 light, 2 normal, 3 deep focus
export type SleepQuality = 'broken' | 'poor' | 'ok' | 'solid';
export type Rating = 'none' | 'low' | 'ok' | 'good' | 'unknown';

export interface Task {
  id: string;
  goal_id: string | null;
  title: string;
  estimate_mins: number;
  cognitive_load: CognitiveLoad;
  due: string | null; // ISO date 'YYYY-MM-DD'
  unblocks: boolean;
  reschedule_count: number;
  status: 'open' | 'done' | 'dropped';
  created_at: string; // ISO timestamp
}

export interface Session {
  id: string;
  task_id: string | null;
  day: string; // 'YYYY-MM-DD'
  planned_mins: number;
  actual_mins: number | null;
  completed: boolean;
}

export interface DaySignal {
  day: string; // 'YYYY-MM-DD'
  sleep_mins: number | null;
  sleep_quality: SleepQuality | null; // §5.1 quality shift
  sleep_source: 'healthkit' | 'health_connect' | 'manual' | null;
  energy_stated: Energy | null;
  mood: 'bad' | 'okay' | 'good' | 'great' | null;
  tired_reports: number; // §6, count in the day
  planned_count: number;
  completed_count: number;
}

// A logged meal (§7). Ratings are coarse buckets — never numbers.
export interface Meal {
  id: string;
  day: string; // 'YYYY-MM-DD'
  logged_at: string; // ISO timestamp
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  raw_text: string;
  protein: Rating | null;
  veg: Rating | null;
  fibre: Rating | null;
  carb_type: 'refined' | 'whole' | 'mixed' | 'none' | null;
}

// Mirrors the `observations` table rows the engine reads.
export interface Observation {
  key: 'estimate_multiplier' | 'sleep_effect' | 'avoidance' | 'short_nights' | 'meal_timing';
  label: string;
  value: string;
  numeric_value: number | null;
  evidence_count: number;
  confidence: 'early' | 'solid';
  source: 'inferred' | 'corrected' | 'stated';
  dismissed_at: string | null;
}

// Per-user multipliers stored in profiles.engine_weights. Absent keys default to 1.
export interface EngineWeights {
  [key: string]: number;
}

export interface EngineState {
  tasks: Task[];
  sessions: Session[];
  daySignals: DaySignal[];
  observations: Observation[];
  weights: EngineWeights;
  meals?: Meal[]; // §7 food-as-input; optional so pre-food callers still typecheck
  // Task ids the user demoted *today* (wrong_priority correction). §5.3.
  demotedTaskIds?: string[];
}

export interface RankedTask {
  task: Task;
  score: number;
  reasons: ScoreReason[];
}

// A reason that fired during scoring, ordered by the points it contributed.
export interface ScoreReason {
  code: ReasonCode;
  points: number;
  text: string; // human phrase, e.g. "due today"
}

export type ReasonCode =
  | 'overdue'
  | 'due_today'
  | 'due_tomorrow'
  | 'due_this_week'
  | 'unblocks'
  | 'has_goal'
  | 'load_fit'
  | 'stale'
  | 'demoted';

export interface EnergyResult {
  energy: Energy;
  source: EnergySource;
  reasoning: string;
  sleepMins: number | null;
  personal: boolean;
}

export interface DayPlan {
  energy: Energy;
  energySource: EnergySource;
  energyReasoning: string;
  mainWin: Task | null;
  alsoToday: Task[]; // at most 2
  blockMins: number;
  breakMins: number; // always 5, §5.4
  reasoning: string; // the sentence shown under the main win, §5.5
  ranked: RankedTask[];
}

// §6 tired ladder. Runtime context the caller supplies (the engine stays pure).
export interface TiredContext {
  now: string; // ISO timestamp "the moment the ladder runs"
  currentSessionMins?: number; // length of an in-progress unbroken session, if any
}

export interface TiredResult {
  rule: number | null; // 1..7, or null when nothing fired
  sentence: string;
}

export const ENGINE_VERSION = 1;
