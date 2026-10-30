import { describe, expect, it } from 'vitest';
import { tiredLadder } from '../tired';
import type { DaySignal } from '../types';
import { meal, signal, state } from './factories';

const DAY = '2026-08-19';
// Local-time ISO (no 'Z') so getHours() is timezone-independent in tests.
const at = (hhmm: string) => `${DAY}T${hhmm}:00`;

// A day with adequate sleep so rule 1 never fires unless we want it to.
const okSleep = (over: Partial<DaySignal> = {}) => signal({ day: DAY, sleep_mins: 450, ...over });

describe('tiredLadder (§6) — stops at first firing rule', () => {
  it('rule 1: short last night', () => {
    const r = tiredLadder(state({ daySignals: [signal({ day: DAY, sleep_mins: 300 })] }), DAY, { now: at('14:00') });
    expect(r.rule).toBe(1);
    expect(r.sentence).toMatch(/short night/);
  });

  it('rule 2: nothing logged past 13:00', () => {
    const r = tiredLadder(state({ daySignals: [okSleep()], meals: [] }), DAY, { now: at('14:00') });
    expect(r.rule).toBe(2);
  });

  it('rule 3: 5+ hours since last food', () => {
    const meals = [meal({ logged_at: at('08:00'), day: DAY })];
    const r = tiredLadder(state({ daySignals: [okSleep()], meals }), DAY, { now: at('14:00') });
    expect(r.rule).toBe(3);
  });

  it('rule 4: 90+ min unbroken session', () => {
    const meals = [meal({ logged_at: at('13:30'), day: DAY })];
    const r = tiredLadder(state({ daySignals: [okSleep()], meals }), DAY, { now: at('14:00'), currentSessionMins: 100 });
    expect(r.rule).toBe(4);
  });

  it('rule 5: nothing else, before 16:00 and outside the dip', () => {
    const meals = [meal({ logged_at: at('09:00'), day: DAY })];
    const r = tiredLadder(state({ daySignals: [okSleep()], meals }), DAY, { now: at('10:00') });
    expect(r.rule).toBe(5);
  });

  it('rule 6: afternoon dip window wins over rule 5', () => {
    const meals = [meal({ logged_at: at('13:30'), day: DAY })];
    const r = tiredLadder(state({ daySignals: [okSleep()], meals }), DAY, { now: at('14:00') });
    expect(r.rule).toBe(6);
    expect(r.sentence).toMatch(/afternoon dip/);
  });

  it('rule 7: persistent tiredness with adequate sleep names doctor tests only', () => {
    const priors: DaySignal[] = [0, 1, 2, 3, 4, 5].map((k) => {
      const d = new Date(Date.parse(DAY) - k * 86400000).toISOString().slice(0, 10);
      return signal({ day: d, sleep_mins: 450, tired_reports: 1 });
    });
    const meals = [meal({ logged_at: at('16:30'), day: DAY })];
    const r = tiredLadder(state({ daySignals: priors, meals }), DAY, { now: at('17:00') });
    expect(r.rule).toBe(7);
    expect(r.sentence).toMatch(/blood test/);
    expect(r.sentence).toMatch(/iron, B12, thyroid and vitamin D/);
  });

  it('null fallback: nothing fires, honest sentence', () => {
    const meals = [meal({ logged_at: at('16:30'), day: DAY })];
    const r = tiredLadder(state({ daySignals: [okSleep()], meals }), DAY, { now: at('17:00') });
    expect(r.rule).toBeNull();
    expect(r.sentence).toBe("Nothing in your data explains this one.");
  });
});
