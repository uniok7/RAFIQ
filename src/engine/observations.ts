// §9 Observations (the memory layer). Pure. Computed nightly, upserted on (user_id, key).
import { mealTimingObservation } from './food';
import type { EngineState, Observation } from './types';
import { mean } from './util';

export const PATTERN_MIN_DAYS = 15; // §8 hard rule
export const SLEEP_7H_MINS = 420;

/** Distinct days we have any signal for. */
export function daysOfData(state: EngineState): number {
  return new Set(state.daySignals.map((d) => d.day)).size;
}

/** §8 hard rule: below 15 days, show the counter, not a pattern claim. */
export function patternsUnlocked(state: EngineState): boolean {
  return daysOfData(state) >= PATTERN_MIN_DAYS;
}

export function patternCounter(state: EngineState): string {
  return `Patterns need ${PATTERN_MIN_DAYS} days. Day ${daysOfData(state)} of ${PATTERN_MIN_DAYS}.`;
}

function estimateMultiplier(state: EngineState): Observation | null {
  const done = state.sessions.filter(
    (s) => s.completed && s.actual_mins != null && s.planned_mins > 0,
  );
  if (done.length < 5) return null; // §8 rule 1: needs 5+
  const ratio = mean(done.map((s) => (s.actual_mins as number) / s.planned_mins));
  if (ratio >= 0.85 && ratio <= 1.15) return null; // within tolerance, no claim
  const actualFor30 = Math.round(30 * ratio);
  return {
    key: 'estimate_multiplier',
    label: 'Time estimates',
    value: `When you say 30 minutes, it usually takes ${actualFor30}.`,
    numeric_value: Number(ratio.toFixed(3)),
    evidence_count: done.length,
    confidence: done.length < 12 ? 'early' : 'solid', // §8 rule 1
    source: 'inferred',
    dismissed_at: null,
  };
}

function sleepEffect(state: EngineState): Observation | null {
  if (daysOfData(state) < PATTERN_MIN_DAYS) return null; // §8 rule 2: 15+ days
  const withData = state.daySignals.filter(
    (d) => d.sleep_mins != null && d.planned_count > 0,
  );
  const ratioOf = (d: (typeof withData)[number]) => d.completed_count / d.planned_count;
  const high = withData.filter((d) => (d.sleep_mins as number) >= SLEEP_7H_MINS);
  const low = withData.filter((d) => (d.sleep_mins as number) < SLEEP_7H_MINS);
  if (high.length < 4 || low.length < 4) return null; // at least 4 in each bucket

  const highMean = mean(high.map(ratioOf));
  const lowMean = mean(low.map(ratioOf));
  if (lowMean === 0) return null;
  const effect = (highMean - lowMean) / lowMean;
  if (Math.abs(effect) < 0.12) return null; // effect >= 12%

  const pct = Math.round(Math.abs(effect) * 100);
  const dir = effect > 0 ? 'more' : 'less';
  return {
    key: 'sleep_effect',
    label: 'Sleep',
    value: `On 7+ hours you finish ${pct}% ${dir} of what you planned.`,
    numeric_value: Number(effect.toFixed(3)),
    evidence_count: high.length + low.length,
    confidence: 'solid',
    source: 'inferred',
    dismissed_at: null,
  };
}

function avoidance(state: EngineState): Observation | null {
  const stuck = state.tasks
    .filter((t) => t.status === 'open' && t.reschedule_count >= 3)
    .sort((a, b) => b.reschedule_count - a.reschedule_count)[0];
  if (!stuck) return null;
  return {
    key: 'avoidance',
    label: 'Stuck task',
    value: `'${stuck.title}' has moved ${stuck.reschedule_count} times. Is it actually a 10-minute job, or is something blocking it?`,
    numeric_value: stuck.reschedule_count,
    evidence_count: stuck.reschedule_count,
    confidence: 'solid',
    source: 'inferred',
    dismissed_at: null,
  };
}

function shortNights(energyCorrectionCount: number): Observation | null {
  if (energyCorrectionCount < 3) return null; // §8 rule 4: 3+ corrections
  return {
    key: 'short_nights',
    label: 'Energy',
    value: "You've corrected me three times on this. I've stopped lowering your load automatically.",
    numeric_value: energyCorrectionCount,
    evidence_count: energyCorrectionCount,
    confidence: 'solid',
    source: 'corrected',
    dismissed_at: null,
  };
}

/**
 * Recompute the full observation set. energyCorrectionCount comes from the count
 * of wrong_inference energy corrections (recommendations table), passed in by the
 * caller since the engine never touches the DB.
 */
export function computeObservations(
  state: EngineState,
  opts: { energyCorrectionCount?: number; day?: string } = {},
): Observation[] {
  // meal_timing filters relative to a reference day; default to the latest signal day.
  const day =
    opts.day ?? state.daySignals.map((d) => d.day).sort().slice(-1)[0] ?? '1970-01-01';
  const out: (Observation | null)[] = [
    estimateMultiplier(state),
    sleepEffect(state),
    avoidance(state),
    shortNights(opts.energyCorrectionCount ?? 0),
    mealTimingObservation(state, day),
  ];
  return out.filter((o): o is Observation => o != null);
}
