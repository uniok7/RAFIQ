export type EnergyLevel = 'low' | 'normal' | 'high';
export type Mood = 'bad' | 'okay' | 'good' | 'great';
export type TaskStatus = 'open' | 'done' | 'dropped';

export type Task = {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  estimate_mins: number;
  cognitive_load: 1 | 2 | 3;
  due: string | null;
  unblocks: boolean;
  reschedule_count: number;
  status: TaskStatus;
  done_at: string | null;
  created_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  why: string | null;
  horizon_days: number;
  status: 'active' | 'done' | 'dropped';
  created_at: string;
};

export type Session = {
  id: string;
  user_id: string;
  task_id: string | null;
  day: string;
  planned_mins: number;
  actual_mins: number | null;
  interruptions: number;
  completed: boolean;
  started_at: string | null;
  ended_at: string | null;
};

export type DaySignal = {
  user_id: string;
  day: string;
  sleep_mins: number | null;
  sleep_source: 'healthkit' | 'health_connect' | 'manual' | null;
  energy_stated: EnergyLevel | null;
  mood: Mood | null;
  planned_count: number;
  completed_count: number;
};

export type Observation = {
  id: string;
  user_id: string;
  key: 'estimate_multiplier' | 'sleep_effect' | 'avoidance' | 'short_nights';
  label: string;
  value: string;
  numeric_value: number | null;
  evidence_count: number;
  confidence: 'early' | 'solid';
  source: 'inferred' | 'corrected' | 'stated';
  dismissed_at: string | null;
  updated_at: string;
};
