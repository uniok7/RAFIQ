import { describe, expect, it } from 'vitest';

import { trialState } from './access';

const start = Date.parse('2026-08-01T00:00:00Z');

describe('seven-day creation access', () => {
  it('starts without requiring a card and reports day one', () => {
    expect(trialState(new Date(start).toISOString(), false, start)).toEqual({ canCreate: true, day: 1, daysLeft: 7, expired: false });
  });

  it('moves to reader mode at the exact start of day eight', () => {
    expect(trialState(new Date(start).toISOString(), false, start + 7 * 86_400_000)).toEqual({ canCreate: false, day: 8, daysLeft: 0, expired: true });
  });

  it('keeps creation enabled for an active entitlement', () => {
    expect(trialState(new Date(start).toISOString(), true, start + 40 * 86_400_000).canCreate).toBe(true);
  });
});
