import { describe, expect, it } from 'vitest';
import { computeEnergy } from '../energy';
import type { Observation } from '../types';
import { nights, signal } from './factories';

const DAY = '2026-08-19';

describe('computeEnergy (§5.2)', () => {
  it('uses stated energy when present, source=stated', () => {
    const r = computeEnergy([signal({ day: DAY, energy_stated: 'high', sleep_mins: 200 })], DAY);
    expect(r.energy).toBe('high');
    expect(r.source).toBe('stated');
  });

  it('no sleep data -> normal, source=default', () => {
    const r = computeEnergy([signal({ day: DAY, sleep_mins: null })], DAY);
    expect(r.energy).toBe('normal');
    expect(r.source).toBe('default');
  });

  describe('borrowed prior path (<5 nights)', () => {
    it('low under 360', () => {
      const r = computeEnergy([signal({ day: DAY, sleep_mins: 312 })], DAY);
      expect(r.energy).toBe('low');
      expect(r.source).toBe('borrowed');
      expect(r.personal).toBe(false);
      // must label the prior as borrowed, not personal
      expect(r.reasoning).toMatch(/15 days/);
    });
    it('high over 420', () => {
      const r = computeEnergy([signal({ day: DAY, sleep_mins: 480 })], DAY);
      expect(r.energy).toBe('high');
      expect(r.source).toBe('borrowed');
    });
    it('normal between 360 and 420', () => {
      const r = computeEnergy([signal({ day: DAY, sleep_mins: 400 })], DAY);
      expect(r.energy).toBe('normal');
    });
  });

  describe('personal path (>=5 nights)', () => {
    // 6 nights averaging 450 -> low threshold 395, high threshold 495
    const base = nights(6, 450);
    it('low below avg-55', () => {
      const today = signal({ day: DAY, sleep_mins: 390 });
      const r = computeEnergy([today, ...base.slice(1)], DAY);
      expect(r.personal).toBe(true);
      expect(r.energy).toBe('low');
      expect(r.source).toBe('personal');
    });
    it('high above avg+45', () => {
      const today = signal({ day: DAY, sleep_mins: 500 });
      const r = computeEnergy([today, ...base.slice(1)], DAY);
      expect(r.energy).toBe('high');
    });
    it('normal in the band', () => {
      const today = signal({ day: DAY, sleep_mins: 450 });
      const r = computeEnergy([today, ...base.slice(1)], DAY);
      expect(r.energy).toBe('normal');
    });
  });

  describe('sleep-quality shift (§5.1)', () => {
    it("'broken' shifts a normal call down to low", () => {
      const r = computeEnergy([signal({ day: DAY, sleep_mins: 400, sleep_quality: 'broken' })], DAY);
      expect(r.energy).toBe('low'); // 400 -> normal (borrowed), broken -> low
      expect(r.reasoning).toMatch(/broken/);
    });
    it("'solid' with 6h+ shifts a normal call up to high", () => {
      const r = computeEnergy([signal({ day: DAY, sleep_mins: 400, sleep_quality: 'solid' })], DAY);
      expect(r.energy).toBe('high');
      expect(r.reasoning).toMatch(/solid/);
    });
    it("'solid' under 6h does NOT shift up", () => {
      const r = computeEnergy([signal({ day: DAY, sleep_mins: 340, sleep_quality: 'solid' })], DAY);
      expect(r.energy).toBe('low'); // 340 < 360 -> low, no upward shift under 6h
    });
    it('shift is clamped at the ends', () => {
      const r = computeEnergy([signal({ day: DAY, sleep_mins: 300, sleep_quality: 'broken' })], DAY);
      expect(r.energy).toBe('low'); // already low, stays low
    });
  });

  it('softened: 3+ energy corrections suppress a low call', () => {
    const obs: Observation[] = [
      {
        key: 'short_nights',
        label: 'Energy',
        value: 'x',
        numeric_value: 3,
        evidence_count: 3,
        confidence: 'solid',
        source: 'corrected',
        dismissed_at: null,
      },
    ];
    const r = computeEnergy([signal({ day: DAY, sleep_mins: 300 })], DAY, obs);
    expect(r.energy).toBe('normal'); // would be 'low' without softening
  });
});
