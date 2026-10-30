// §6 The tired ladder. Pure, deterministic — NO LLM. Checks rules in order, stops at
// the first that fires, returns ONE sentence. Never lists causes. Rule 7 is the only
// place nutrients are named, and only as things a doctor tests.
import type { DaySignal, EngineState, Meal, TiredContext, TiredResult } from './types';
import { dayDiff, mean } from './util';

const SHORT_MARGIN = 45; // a "short night" is this many minutes under the personal average
const BORROWED_SHORT = 360; // absolute short-night threshold before we have a personal avg

function priorNights(daySignals: DaySignal[], day: string): number[] {
  return daySignals
    .filter((d) => d.sleep_mins != null && dayDiff(d.day, day) >= 1 && dayDiff(d.day, day) <= 30)
    .map((d) => d.sleep_mins as number);
}

/** Was a given night short? Uses the personal avg if we have ≥5 prior nights, else 360m. */
function shortThreshold(daySignals: DaySignal[], day: string): number {
  const nights = priorNights(daySignals, day);
  return nights.length >= 5 ? mean(nights) - SHORT_MARGIN : BORROWED_SHORT;
}

function lastFoodAt(meals: Meal[]): number | null {
  if (meals.length === 0) return null;
  return Math.max(...meals.map((m) => Date.parse(m.logged_at)));
}

export function tiredLadder(state: EngineState, day: string, ctx: TiredContext): TiredResult {
  const now = new Date(ctx.now);
  const hour = now.getHours();
  const mins = hour * 60 + now.getMinutes();
  const meals = state.meals ?? [];
  const mealsToday = meals.filter((m) => m.day === day);
  const threshold = shortThreshold(state.daySignals, day);

  // Rule 1 — short sleep (immediate, complete explanation).
  const todaySig = state.daySignals.find((d) => d.day === day);
  const lastNight = todaySig?.sleep_mins ?? null;
  const last3 = [0, 1, 2]
    .map((k) => {
      const d = new Date(Date.parse(day) - k * 86400000).toISOString().slice(0, 10);
      return state.daySignals.find((s) => s.day === d)?.sleep_mins ?? null;
    })
    .filter((v): v is number => v != null);
  const threeShort = last3.length === 3 && last3.every((v) => v < threshold);
  if ((lastNight != null && lastNight < threshold) || threeShort) {
    return { rule: 1, sentence: "You're on your third short night. That's the whole explanation — nothing's wrong with you." };
  }

  // Rule 2 — nothing logged and past 13:00.
  if (mealsToday.length === 0 && mins >= 13 * 60) {
    return { rule: 2, sentence: "You haven't logged anything since yesterday. Eat first, then decide if you're still tired." };
  }

  // Rule 3 — 5+ hours since last logged food.
  const last = lastFoodAt(meals);
  if (last != null && now.getTime() - last >= 5 * 3600_000) {
    return { rule: 3, sentence: 'Five hours since you ate. Try that before anything else.' };
  }

  // Rule 4 — 90+ min unbroken session.
  if ((ctx.currentSessionMins ?? 0) >= 90) {
    return { rule: 4, sentence: "You've been at it 100 minutes without stopping. Take 15." };
  }

  // Rule 5 — nothing else fired, before 16:00 (excluding the afternoon-dip window so
  // rule 6 stays reachable; the spec table lists 5 before 6 but 13:00–15:30 ⊂ "before 16:00").
  const inDip = mins >= 13 * 60 && mins <= 15 * 60 + 30;
  if (mins < 16 * 60 && !inDip) {
    return { rule: 5, sentence: 'Nothing obvious in your data. Water, and get outside for ten minutes.' };
  }

  // Rule 6 — the afternoon dip.
  if (inDip) {
    return { rule: 6, sentence: 'This is your normal afternoon dip. It passes in about 40 minutes — do something light until then.' };
  }

  // Rule 7 — persistent tiredness *with adequate sleep* → route to a doctor, once.
  if (tiredWithAdequateSleep(state, day, threshold)) {
    return {
      rule: 7,
      sentence:
        "You've told me you're tired 6 times in two weeks, and most of those nights you slept fine. That's worth a blood test rather than a guess from me — iron, B12, thyroid and vitamin D are the usual first checks.",
    };
  }

  // Nothing fired — more trustworthy than a manufactured cause (§6).
  return { rule: null, sentence: "Nothing in your data explains this one." };
}

function tiredWithAdequateSleep(state: EngineState, day: string, threshold: number): boolean {
  const window = state.daySignals.filter((d) => dayDiff(d.day, day) >= 0 && dayDiff(d.day, day) <= 14);
  const reports = window.reduce((s, d) => s + (d.tired_reports ?? 0), 0);
  if (reports < 5) return false;
  const withSleep = window.filter((d) => d.sleep_mins != null);
  if (withSleep.length === 0) return false;
  const adequate = withSleep.filter((d) => (d.sleep_mins as number) >= threshold).length;
  return adequate / withSleep.length >= 0.5; // "most of those nights slept fine"
}
