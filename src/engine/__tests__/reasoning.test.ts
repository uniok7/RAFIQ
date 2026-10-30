import { describe, expect, it } from 'vitest';
import { buildReasoning } from '../reasoning';
import type { ScoreReason } from '../types';

const r = (code: any, points: number, text: string): ScoreReason => ({ code, points, text });

describe('buildReasoning (§5.5)', () => {
  it('never empty when nothing fired', () => {
    expect(buildReasoning([], 30)).toBe(
      "Nothing's competing with it today — so I set your block to 30 minutes.",
    );
  });

  it('single reason', () => {
    const out = buildReasoning([r('due_today', 40, "it's due today")], 45);
    expect(out).toBe("Because **it's due today** — so I put it first and set your block to 45 minutes.");
  });

  it('top two by points, in order', () => {
    const out = buildReasoning(
      [
        r('has_goal', 8, 'it moves a goal forward'),
        r('due_today', 40, "it's due today"),
        r('unblocks', 18, 'other work is waiting behind it'),
      ],
      30,
    );
    expect(out).toBe(
      "Because **it's due today**, and **other work is waiting behind it** — so I put it first and set your block to 30 minutes.",
    );
  });

  it('ignores negative (demoted) reasons', () => {
    const out = buildReasoning([r('demoted', -200, 'moved off top')], 45);
    expect(out).toMatch(/Nothing's competing/);
  });
});
