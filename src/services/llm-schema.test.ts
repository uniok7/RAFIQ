import { describe, expect, it } from 'vitest';
import { normalizeParsedPlan } from './llm-schema';

describe('onboarding parse schema', () => {
  it('caps output and clamps unsafe numeric values', () => {
    const plan = normalizeParsedPlan({
      goals: Array.from({ length: 6 }, (_, index) => ({ title: `Goal ${index}`, why: 'Because' })),
      tasks: Array.from({ length: 12 }, (_, index) => ({ title: `Do ${index}`, goal: 'Goal 0', estimate: index === 0 ? -4 : 30, load: index === 1 ? 9 : 2, due: null })),
    });
    expect(plan.goals).toHaveLength(4);
    expect(plan.tasks).toHaveLength(10);
    expect(plan.tasks[0].estimate).toBe(5);
    expect(plan.tasks[1].load).toBe(3);
  });

  it('rejects responses that cannot become an editable plan', () => {
    expect(() => normalizeParsedPlan({ say: 'not a plan' })).toThrow('invalid_plan');
  });
});
