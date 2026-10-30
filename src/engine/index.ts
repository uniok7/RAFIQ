// Public surface of the decision engine. Pure — no React/Supabase/network imports.
export * from './types';
export { plan } from './plan';
export { computeEnergy, BORROWED_AVG_MINS } from './energy';
export { rankTasks, scoreTask } from './scoring';
export { blockMins, recalibratedEstimate, BREAK_MINS } from './block';
export { buildReasoning, topReasons } from './reasoning';
export { nudgeLoadWeight, WEIGHT_MIN, WEIGHT_MAX, WEIGHT_STEP } from './weights';
export {
  computeObservations,
  patternsUnlocked,
  patternCounter,
  daysOfData,
  PATTERN_MIN_DAYS,
} from './observations';
export { tiredLadder } from './tired';
export { foodReply, dailyGap, disorderedEatingGuard, isRedFlag, RED_FLAG_MESSAGE } from './safety';
export {
  foodNudges,
  ateToday,
  hoursSinceLastMeal,
  mealTimingObservation,
  FOOD_PATTERN_MIN_DAYS,
} from './food';
export { dayDiff, formatDuration, mean } from './util';
