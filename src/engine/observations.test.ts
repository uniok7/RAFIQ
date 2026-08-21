import { describe, expect, it } from 'vitest';
import { computeObservations, evidenceDays, type ObservationInput } from './observations';

function input(patch: Partial<ObservationInput> = {}): ObservationInput { return { tasks: [], sessions: [], daySignals: [], energyCorrectionCount: 0, ...patch }; }
function days(count: number) { return Array.from({ length: count }, (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`); }

describe('observation memory', () => {
  it('shows a counter gate rather than pattern claims before 15 days', () => {
    const sample = input({ sessions: days(5).map((day) => ({ day, planned_mins: 30, actual_mins: 60, completed: true })) });
    expect(evidenceDays(sample)).toBe(5);
    expect(computeObservations(sample).filter((item) => item.key === 'estimate_multiplier')).toHaveLength(0);
  });

  it('computes estimate multiplier after the gate with early confidence under 12 sessions', () => {
    const sample = input({ daySignals: days(15).map((day) => ({ day, sleep_mins: null, planned_count: 0, completed_count: 0 })), sessions: days(5).map((day) => ({ day, planned_mins: 30, actual_mins: 47, completed: true })) });
    const observation = computeObservations(sample).find((item) => item.key === 'estimate_multiplier');
    expect(observation?.value).toBe('When you say 30 minutes, it usually takes 47.');
    expect(observation?.confidence).toBe('early');
    expect(observation?.evidenceCount).toBe(5);
  });

  it('requires 15 sleep days, four per bucket, and a 12% visible effect', () => {
    const signals = days(15).map((day, index) => ({ day, sleep_mins: index < 8 ? 450 : 390, planned_count: 10, completed_count: index < 8 ? 8 : 5 }));
    const observation = computeObservations(input({ daySignals: signals })).find((item) => item.key === 'sleep_effect');
    expect(observation?.value).toContain('60% more');
    expect(observation?.evidenceCount).toBe(15);
  });

  it('does not claim a sleep effect without four nights in both buckets', () => {
    const signals = days(15).map((day, index) => ({ day, sleep_mins: index < 12 ? 450 : 390, planned_count: 10, completed_count: index < 12 ? 8 : 5 }));
    expect(computeObservations(input({ daySignals: signals })).some((item) => item.key === 'sleep_effect')).toBe(false);
  });

  it('surfaces direct avoidance and correction evidence without pretending it is a statistical pattern', () => {
    const observations = computeObservations(input({ tasks: [{ title: 'Qawafal photos', status: 'open', reschedule_count: 3, created_at: '2026-08-01' }], energyCorrectionCount: 3 }));
    expect(observations.find((item) => item.key === 'avoidance')?.value).toContain('moved 3 times');
    expect(observations.find((item) => item.key === 'short_nights')?.source).toBe('corrected');
  });
});
