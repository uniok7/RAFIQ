// §5.6 Weight adaptation. Pure.
import type { EngineWeights } from './types';

export const WEIGHT_STEP = 0.05;
export const WEIGHT_MIN = 0.5;
export const WEIGHT_MAX = 1.5;

function clamp(v: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, v));
}

/**
 * User demoted the suggested main win and picked a replacement. If the
 * replacement's cognitive load differs from what was suggested, nudge the
 * load_fit multiplier 0.05 toward the user's revealed preference. Call this
 * only once a systematic difference is observed (§5.6). Returns new weights.
 */
export function nudgeLoadWeight(
  weights: EngineWeights,
  suggestedLoad: number,
  chosenLoad: number,
): EngineWeights {
  if (chosenLoad === suggestedLoad) return weights;
  const current = weights.load_fit ?? 1;
  const dir = chosenLoad > suggestedLoad ? 1 : -1;
  return { ...weights, load_fit: clamp(current + dir * WEIGHT_STEP) };
}
