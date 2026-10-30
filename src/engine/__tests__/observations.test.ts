import { describe, expect, it } from 'vitest';
import {
  computeObservations,
  daysOfData,
  patternCounter,
  patternsUnlocked,
} from '../observations';
import type { DaySignal } from '../types';
import { session, signal, state, task } from './factories';

function days(specs: Array<Partial<DaySignal>>): DaySignal[] {
  return specs.map((sp, i) => {
    const d = new Date(Date.UTC(2026, 7, 5 + i)).toISOString().slice(0, 10);
    return signal({ day: d, ...sp });
  });
}

describe('estimate_multiplier (§8.1)', () => {
  it('null under 5 completed sessions', () => {
    const st = state({ sessions: [session(), session(), session(), session()] });
    expect(computeObservations(st).find((o) => o.key === 'estimate_multiplier')).toBeUndefined();
  });
  it('fires when ratio is outside 0.85–1.15', () => {
    const sessions = Array.from({ length: 6 }, (_, i) =>
      session({ id: `s${i}`, planned_mins: 30, actual_mins: 47 }),
    );
    const obs = computeObservations(state({ sessions }));
    const m = obs.find((o) => o.key === 'estimate_multiplier')!;
    expect(m.value).toContain('47');
    expect(m.confidence).toBe('early'); // < 12 sessions
    expect(m.numeric_value).toBeCloseTo(1.567, 2);
  });
  it('silent when ratio within tolerance', () => {
    const sessions = Array.from({ length: 6 }, (_, i) =>
      session({ id: `s${i}`, planned_mins: 30, actual_mins: 31 }),
    );
    expect(
      computeObservations(state({ sessions })).find((o) => o.key === 'estimate_multiplier'),
    ).toBeUndefined();
  });
});

describe('15-day gate (§8 hard rule)', () => {
  it('sleep_effect suppressed below 15 days even with a real effect', () => {
    const st = state({
      daySignals: days([
        { sleep_mins: 480, planned_count: 4, completed_count: 4 },
        { sleep_mins: 480, planned_count: 4, completed_count: 4 },
        { sleep_mins: 480, planned_count: 4, completed_count: 4 },
        { sleep_mins: 480, planned_count: 4, completed_count: 4 },
        { sleep_mins: 360, planned_count: 4, completed_count: 1 },
        { sleep_mins: 360, planned_count: 4, completed_count: 1 },
        { sleep_mins: 360, planned_count: 4, completed_count: 1 },
        { sleep_mins: 360, planned_count: 4, completed_count: 1 },
      ]),
    });
    expect(daysOfData(st)).toBe(8);
    expect(patternsUnlocked(st)).toBe(false);
    expect(patternCounter(st)).toBe('Patterns need 15 days. Day 8 of 15.');
    expect(computeObservations(st).find((o) => o.key === 'sleep_effect')).toBeUndefined();
  });

  it('sleep_effect fires at 15+ days with 4 per bucket and >=12% effect', () => {
    const highDays = Array.from({ length: 8 }, () => ({
      sleep_mins: 480,
      planned_count: 4,
      completed_count: 4,
    }));
    const lowDays = Array.from({ length: 7 }, () => ({
      sleep_mins: 360,
      planned_count: 4,
      completed_count: 2,
    }));
    const st = state({ daySignals: days([...highDays, ...lowDays]) });
    expect(daysOfData(st)).toBe(15);
    const eff = computeObservations(st).find((o) => o.key === 'sleep_effect')!;
    expect(eff.value).toContain('%');
    expect(eff.numeric_value).toBeCloseTo(1.0, 2); // (1.0 - 0.5)/0.5
  });
});

describe('avoidance (§8.3) and short_nights (§8.4)', () => {
  it('avoidance fires for an open task rescheduled 3+ times', () => {
    const st = state({ tasks: [task({ title: 'Qawafal photos', reschedule_count: 3 })] });
    const a = computeObservations(st).find((o) => o.key === 'avoidance')!;
    expect(a.value).toContain('Qawafal photos');
  });
  it('short_nights fires at 3+ energy corrections, source=corrected', () => {
    const s = computeObservations(state(), { energyCorrectionCount: 3 }).find(
      (o) => o.key === 'short_nights',
    )!;
    expect(s.source).toBe('corrected');
  });
  it('short_nights silent under 3', () => {
    expect(
      computeObservations(state(), { energyCorrectionCount: 2 }).find(
        (o) => o.key === 'short_nights',
      ),
    ).toBeUndefined();
  });
});
