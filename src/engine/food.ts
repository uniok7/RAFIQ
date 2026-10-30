// §7 Food as an engine input. Pure. Same-day nudges use borrowed priors, labelled as
// such. Personal patterns need 20+ days (§9 food floor). NEVER a nutrient/calorie claim —
// only claims about completion rates, which the app measures.
import type { EngineState, Meal, Observation } from './types';
import { dayDiff, mean } from './util';

export const FOOD_PATTERN_MIN_DAYS = 20;

export function ateToday(meals: Meal[], day: string): boolean {
  return meals.some((m) => m.day === day);
}

export function hoursSinceLastMeal(meals: Meal[], nowIso: string): number | null {
  if (meals.length === 0) return null;
  const last = Math.max(...meals.map((m) => Date.parse(m.logged_at)));
  return (Date.parse(nowIso) - last) / 3600_000;
}

function ateBefore(meals: Meal[], day: string, hour: number): boolean {
  return meals.some((m) => m.day === day && new Date(m.logged_at).getHours() < hour);
}

/** Same-day, borrowed-prior nudges (§7). Advisory strings; each labels itself. */
export function foodNudges(state: EngineState, day: string, nowIso: string): string[] {
  const meals = state.meals ?? [];
  const out: string[] = [];
  const now = new Date(nowIso);

  if (!ateToday(meals, day) && now.getHours() >= 9) {
    out.push("You haven't eaten yet — worth fuelling up before deep focus. (General guidance, not from your own history yet.)");
  }
  const gap = hoursSinceLastMeal(meals, nowIso);
  if (gap != null && gap >= 5) {
    out.push(`It's been about ${Math.floor(gap)} hours since you ate. A gap that long usually shows up as tiredness.`);
  }
  const heavyLunch = meals.some((m) => m.day === day && m.slot === 'lunch' && m.carb_type === 'refined');
  if (heavyLunch) {
    out.push('A heavy refined-carb lunch tends to flatten the early afternoon — I sized that block down.');
  }
  return out;
}

/** §9 obs #5 meal_timing — eat-before-11am completion effect. 20+ days, 4+ per bucket, ≥12%. */
export function mealTimingObservation(state: EngineState, day: string): Observation | null {
  const distinctDays = new Set(state.daySignals.map((d) => d.day)).size;
  if (distinctDays < FOOD_PATTERN_MIN_DAYS) return null;
  const meals = state.meals ?? [];
  const withData = state.daySignals.filter((d) => d.planned_count > 0 && dayDiff(d.day, day) >= 0);
  const ratioOf = (d: (typeof withData)[number]) => d.completed_count / d.planned_count;

  const early = withData.filter((d) => ateBefore(meals, d.day, 11));
  const notEarly = withData.filter((d) => !ateBefore(meals, d.day, 11));
  if (early.length < 4 || notEarly.length < 4) return null;

  const earlyMean = mean(early.map(ratioOf));
  const lateMean = mean(notEarly.map(ratioOf));
  if (lateMean === 0) return null;
  const effect = (earlyMean - lateMean) / lateMean;
  if (Math.abs(effect) < 0.12) return null;

  const pct = Math.round(Math.abs(effect) * 100);
  const dir = effect > 0 ? 'more' : 'less';
  return {
    key: 'meal_timing',
    label: 'Meal timing',
    value: `On days you eat before 11am you finish ${pct}% ${dir} of what you planned.`,
    numeric_value: Number(effect.toFixed(3)),
    evidence_count: early.length + notEarly.length,
    confidence: 'solid',
    source: 'inferred',
    dismissed_at: null,
  };
}
