import { describe, expect, it } from 'vitest';
import { foodNudges, mealTimingObservation } from '../food';
import type { DaySignal, Meal } from '../types';
import { meal, signal, state } from './factories';

const DAY = '2026-08-19';
const at = (hhmm: string) => `${DAY}T${hhmm}:00`;

describe('foodNudges (§7, borrowed priors)', () => {
  it('warns when nothing eaten yet', () => {
    const out = foodNudges(state({ meals: [] }), DAY, at('10:00'));
    expect(out.join(' ')).toMatch(/haven't eaten/);
  });
  it('flags a 5h+ gap', () => {
    const out = foodNudges(state({ meals: [meal({ day: DAY, logged_at: at('08:00') })] }), DAY, at('14:00'));
    expect(out.join(' ')).toMatch(/hours since you ate/);
  });
  it('flags a heavy refined-carb lunch', () => {
    const meals: Meal[] = [meal({ day: DAY, slot: 'lunch', carb_type: 'refined', logged_at: at('12:30') })];
    const out = foodNudges(state({ meals }), DAY, at('13:00'));
    expect(out.join(' ')).toMatch(/refined-carb lunch/);
  });
  it('never mentions calories or nutrients as levels', () => {
    const out = foodNudges(state({ meals: [] }), DAY, at('10:00')).join(' ').toLowerCase();
    expect(out).not.toMatch(/calorie|deficien|supplement|mg\b/);
  });
});

describe('mealTimingObservation (§9 #5, 20-day floor)', () => {
  function build(days: number) {
    const daySignals: DaySignal[] = [];
    const meals: Meal[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10);
      const early = i < Math.ceil(days / 2);
      daySignals.push(signal({ day: d, planned_count: 4, completed_count: early ? 4 : 2 }));
      if (early) meals.push(meal({ id: `m${i}`, day: d, logged_at: `${d}T08:00:00` }));
    }
    const ref = daySignals[daySignals.length - 1].day;
    return { st: state({ daySignals, meals }), ref };
  }

  it('null below 20 days', () => {
    const { st, ref } = build(19);
    expect(mealTimingObservation(st, ref)).toBeNull();
  });

  it('fires at 20+ days with a real effect', () => {
    const { st, ref } = build(20);
    const o = mealTimingObservation(st, ref)!;
    expect(o.key).toBe('meal_timing');
    expect(o.value).toMatch(/before 11am/);
    expect(o.value).toMatch(/%/);
  });
});
