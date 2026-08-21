export type EnergyLevel = 'low' | 'normal' | 'high';
export type EnergySource = 'stated' | 'default' | 'borrowed' | 'personal';

export type EngineTask = {
  id: string;
  goal_id: string | null;
  title: string;
  estimate_mins: number;
  cognitive_load: 1 | 2 | 3;
  due: string | null;
  unblocks: boolean;
  reschedule_count: number;
  status: 'open' | 'done' | 'dropped';
  created_at: string;
};

export type EngineSession = { planned_mins: number; actual_mins: number | null; completed: boolean; day: string };
export type EngineDaySignal = { day: string; sleep_mins: number | null; energy_stated: EnergyLevel | null };
export type EngineObservation = { key: string; numeric_value: number | null; evidence_count: number; dismissed_at?: string | null };
export type WeightKey = 'urgency' | 'unblocks' | 'goal' | 'load_fit' | 'staleness';

export type EngineState = {
  tasks: EngineTask[];
  sessions: EngineSession[];
  daySignals: EngineDaySignal[];
  observations: EngineObservation[];
  weights: Partial<Record<WeightKey, number>>;
  demotedTaskIds?: string[];
};

export type EnergyResult = { level: EnergyLevel; source: EnergySource; personal: boolean; reasoning: string; sleepMins: number | null };
export type ScoreReason = { key: string; label: string; points: number };
export type RankedTask = { task: EngineTask; score: number; reasons: ScoreReason[] };
export type DayPlan = { energy: EnergyResult; mainWin: EngineTask | null; alsoToday: EngineTask[]; blockMins: 30 | 45 | 60; reasoning: string; ranked: RankedTask[] };
