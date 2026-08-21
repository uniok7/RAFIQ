import { describe, expect, it } from 'vitest';
import { normalizeNaturalAction } from './natural-language-schema';

describe('natural-language action schema', () => {
  it('normalizes bounded local actions', () => {
    expect(normalizeNaturalAction({ say: 'Done.', action: 'shorten', minutes: 200, energy: 'unknown', task: { load: 9 } })).toMatchObject({ action: 'shorten', minutes: 60, energy: 'normal', task: { load: 3 } });
  });
  it('allows a dead task to be dropped through the fixed complete action', () => {
    expect(normalizeNaturalAction({ action: 'complete', taskId: '1', task: { status: 'dropped' } }).task.status).toBe('dropped');
  });
  it('rejects invented actions', () => {
    expect(() => normalizeNaturalAction({ action: 'rank_tasks' })).toThrow('invalid_action');
  });
});
