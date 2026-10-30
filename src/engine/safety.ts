// §12 Safety rails — non-negotiable. Pure + tested. The app must NEVER state a nutrient
// deficiency, name/dose a supplement, show calories, or set intake/weight targets. These
// helpers keep food commentary to two food-only sentences and gate it off when unsafe.
import type { Meal, Rating } from './types';
import { dayDiff } from './util';

interface MealRatings {
  protein: Rating | null;
  veg: Rating | null;
  fibre: Rating | null;
}

const GROUP_LABEL: Record<keyof MealRatings, string> = {
  protein: 'protein',
  veg: 'vegetables',
  fibre: 'fibre',
};

// Food suggestions per gap — foods, never supplements (§12).
const FIX: Record<keyof MealRatings, string> = {
  protein: 'eggs, beans or fish',
  veg: 'something green',
  fibre: 'lentils, beans, oats or fruit',
};

/** Two sentences max: what's covered, what's missing, and a FOOD fix. Never numbers (§7). */
export function foodReply(r: MealRatings): string {
  const groups = Object.keys(GROUP_LABEL) as (keyof MealRatings)[];
  const covered = groups.filter((g) => r[g] === 'ok' || r[g] === 'good');
  const missing = groups.filter((g) => r[g] === 'none' || r[g] === 'low');

  if (missing.length === 0) {
    return covered.length ? 'That covers the main groups — nicely balanced.' : 'Logged.';
  }

  const coveredPart = covered.length ? `${cap(GROUP_LABEL[covered[0]])}'s covered. ` : '';
  const missingPart = missing
    .map((g) => (r[g] === 'none' ? `no ${GROUP_LABEL[g]}` : `low ${GROUP_LABEL[g]}`))
    .join(' and ');
  const fixPart = missing.map((g) => FIX[g]).join(', or ');
  return `${coveredPart}Today's gap is ${missingPart}. Add ${fixPart} later and you've closed it.`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * §7 daily gap check (shown at 18:00, only with 2+ meals). Aggregates the day's meals:
 * a group is covered if ANY meal rated it ok/good. Returns null when nothing's missing.
 */
export function dailyGap(dayMeals: Meal[]): string | null {
  if (dayMeals.length < 2) return null;
  const groups: (keyof MealRatings)[] = ['protein', 'veg', 'fibre'];
  const missing = groups.filter(
    (g) => !dayMeals.some((m) => m[g] === 'ok' || m[g] === 'good'),
  );
  if (missing.length === 0) return null;
  const names = missing.map((g) => GROUP_LABEL[g]).join(' and ');
  const fixes = missing.map((g) => FIX[g]).join(', or ');
  return `${cap(names)} are the gaps today. Something with ${fixes} at dinner closes ${missing.length > 1 ? 'both' : 'it'}.`;
}

/**
 * §12 disordered-eating guard: zero or one meal logged on each of the last 3 consecutive
 * days → disable food commentary permanently (keep logging silently). Ship with the feature.
 */
export function disorderedEatingGuard(meals: Meal[], day: string): boolean {
  for (let k = 0; k < 3; k++) {
    const d = new Date(Date.parse(day) - k * 86400000).toISOString().slice(0, 10);
    const count = meals.filter((m) => m.day === d).length;
    if (count > 1) return false; // a day with 2+ meals breaks the streak
  }
  return true;
}

// §12 red-flag escalation: fatigue alongside any of these → drop productivity framing,
// say once plainly to see a doctor, then stop. Detection is deliberately broad.
const RED_FLAGS = [
  'chest pain',
  'chest tight',
  'short of breath',
  'shortness of breath',
  'breathless',
  "can't breathe",
  'faint',
  'fainted',
  'passing out',
  'passed out',
  'dizzy spells',
  'losing weight',
  'lost weight',
  'sudden weight',
  'weeks', // "tired for weeks" / "three weeks" — persistence
];

export function isRedFlag(text: string): boolean {
  const t = text.toLowerCase();
  return RED_FLAGS.some((f) => t.includes(f));
}

export const RED_FLAG_MESSAGE =
  "This has gone past what I should be weighing in on — it's worth seeing a doctor about. I'll leave it there.";
