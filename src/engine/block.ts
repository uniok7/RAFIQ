// §5.4 Block size. Pure.
import type { Energy, Observation } from './types';

export const BREAK_MINS = 5; // always 5 (§5.4)

export function blockMins(energy: Energy): number {
  if (energy === 'low') return 30;
  if (energy === 'high') return 60;
  return 45; // normal
}

/**
 * §5.4: if an estimate_multiplier observation exists, expose the recalibrated
 * estimate to show *next to* the stated one — never silently replace it.
 * Returns null when there's no multiplier so callers show only the stated value.
 */
export function recalibratedEstimate(
  statedMins: number,
  observations: Observation[],
): number | null {
  const obs = observations.find((o) => o.key === 'estimate_multiplier' && !o.dismissed_at);
  if (!obs || obs.numeric_value == null) return null;
  return Math.round(statedMins * obs.numeric_value);
}
