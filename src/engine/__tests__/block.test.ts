import { describe, expect, it } from 'vitest';
import { blockMins, BREAK_MINS, recalibratedEstimate } from '../block';
import type { Observation } from '../types';

describe('blockMins (§5.4)', () => {
  it('low=30 normal=45 high=60, break always 5', () => {
    expect(blockMins('low')).toBe(30);
    expect(blockMins('normal')).toBe(45);
    expect(blockMins('high')).toBe(60);
    expect(BREAK_MINS).toBe(5);
  });
});

describe('recalibratedEstimate', () => {
  const mult = (v: number): Observation => ({
    key: 'estimate_multiplier',
    label: 'Time estimates',
    value: 'x',
    numeric_value: v,
    evidence_count: 6,
    confidence: 'early',
    source: 'inferred',
    dismissed_at: null,
  });
  it('null when no multiplier observation', () => {
    expect(recalibratedEstimate(30, [])).toBeNull();
  });
  it('scales the stated estimate', () => {
    expect(recalibratedEstimate(30, [mult(1.5)])).toBe(45);
  });
  it('ignores dismissed observations', () => {
    expect(recalibratedEstimate(30, [{ ...mult(1.5), dismissed_at: '2026-08-01' }])).toBeNull();
  });
});
