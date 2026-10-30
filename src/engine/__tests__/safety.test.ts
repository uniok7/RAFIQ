import { describe, expect, it } from 'vitest';
import { dailyGap, disorderedEatingGuard, foodReply, isRedFlag } from '../safety';
import { meal } from './factories';

describe('foodReply (§7/§12) — two sentences, no numbers ever', () => {
  it('names covered + missing groups and suggests foods', () => {
    const out = foodReply({ protein: 'good', veg: 'none', fibre: 'low' });
    expect(out).toMatch(/protein/i);
    expect(out).toMatch(/vegetables/);
    expect(out).toMatch(/fibre/);
  });
  it('never emits calories, percentages, supplements, or milligrams', () => {
    const out = foodReply({ protein: 'low', veg: 'none', fibre: 'none' }).toLowerCase();
    expect(out).not.toMatch(/calorie|%|\bmg\b|supplement|vitamin|deficien|\d/);
  });
  it('balanced plate → positive, no gap language', () => {
    const out = foodReply({ protein: 'good', veg: 'good', fibre: 'ok' });
    expect(out).not.toMatch(/gap/i);
  });
});

describe('disorderedEatingGuard (§12) — ship with the feature', () => {
  const DAY = '2026-08-19';
  const dayMinus = (k: number) => new Date(Date.parse(DAY) - k * 86400000).toISOString().slice(0, 10);

  it('fires when 0–1 meals on each of 3 consecutive days', () => {
    const meals = [meal({ id: 'a', day: dayMinus(0) }), meal({ id: 'b', day: dayMinus(2) })];
    expect(disorderedEatingGuard(meals, DAY)).toBe(true);
  });
  it('does NOT fire if any of the 3 days had 2+ meals', () => {
    const meals = [meal({ id: 'a', day: DAY }), meal({ id: 'b', day: DAY })];
    expect(disorderedEatingGuard(meals, DAY)).toBe(false);
  });
});

describe('dailyGap (§7) — needs 2+ meals, aggregates coverage', () => {
  it('null under 2 meals', () => {
    expect(dailyGap([meal({ veg: 'none', fibre: 'none' })])).toBeNull();
  });
  it('reports groups no meal covered', () => {
    const meals = [
      meal({ id: 'a', protein: 'good', veg: 'none', fibre: 'none' }),
      meal({ id: 'b', protein: 'ok', veg: 'none', fibre: 'low' }),
    ];
    const out = dailyGap(meals)!;
    expect(out).toMatch(/vegetables/i);
    expect(out).toMatch(/fibre/i);
    expect(out).not.toMatch(/\d|calorie|%/);
  });
  it('null when everything is covered across the day', () => {
    const meals = [meal({ id: 'a', protein: 'good', veg: 'good', fibre: 'ok' }), meal({ id: 'b' })];
    expect(dailyGap(meals)).toBeNull();
  });
});

describe('isRedFlag (§12)', () => {
  it('detects chest pain / breathlessness / fainting / weight change / weeks', () => {
    expect(isRedFlag('tired and some chest pain')).toBe(true);
    expect(isRedFlag('exhausted and short of breath')).toBe(true);
    expect(isRedFlag('keep fainting')).toBe(true);
    expect(isRedFlag("I've been losing weight without trying")).toBe(true);
    expect(isRedFlag('tired for three weeks now')).toBe(true);
  });
  it('ordinary tiredness is not a red flag', () => {
    expect(isRedFlag('just a bit tired today')).toBe(false);
  });
});
