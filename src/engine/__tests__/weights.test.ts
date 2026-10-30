import { describe, expect, it } from 'vitest';
import { nudgeLoadWeight, WEIGHT_MAX, WEIGHT_MIN } from '../weights';

describe('nudgeLoadWeight (§5.6)', () => {
  it('no change when loads match', () => {
    expect(nudgeLoadWeight({}, 2, 2)).toEqual({});
  });
  it('nudges up +0.05 when user picks heavier load', () => {
    expect(nudgeLoadWeight({}, 1, 3).load_fit).toBeCloseTo(1.05);
  });
  it('nudges down when user picks lighter load', () => {
    expect(nudgeLoadWeight({}, 3, 1).load_fit).toBeCloseTo(0.95);
  });
  it('clamps to [0.5, 1.5]', () => {
    expect(nudgeLoadWeight({ load_fit: WEIGHT_MAX }, 1, 3).load_fit).toBe(WEIGHT_MAX);
    expect(nudgeLoadWeight({ load_fit: WEIGHT_MIN }, 3, 1).load_fit).toBe(WEIGHT_MIN);
  });
});
