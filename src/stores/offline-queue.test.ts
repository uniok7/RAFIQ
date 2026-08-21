import { describe, expect, it } from 'vitest';
import { enqueueLatest, mergeRemoteTasks, type QueueItem } from './offline-queue';
import type { Task } from '../types/domain';

function task(id: string, title: string, userId = 'a'): Task {
  return { id, user_id: userId, goal_id: null, title, estimate_mins: 30, cognitive_load: 2, due: null, unblocks: false, reschedule_count: 0, status: 'open', done_at: null, created_at: '2026-08-19T00:00:00.000Z' };
}

describe('offline task queue', () => {
  it('keeps only the latest offline write for each task', () => {
    const first = enqueueLatest([], task('1', 'First'), 'q1', '2026-08-19T00:00:00.000Z');
    const latest = enqueueLatest(first, task('1', 'Edited offline'), 'q2', '2026-08-19T00:01:00.000Z');
    expect(latest).toHaveLength(1);
    expect(latest[0].task.title).toBe('Edited offline');
  });

  it('does not overwrite queued local work during remote hydration', () => {
    const localPending = task('1', 'Edited while offline');
    const queue: QueueItem[] = [{ id: 'q1', userId: 'a', task: localPending, queuedAt: '2026-08-19T00:01:00.000Z' }];
    const merged = mergeRemoteTasks([localPending, task('b1', 'Other account', 'b')], [task('1', 'Stale server'), task('2', 'Remote only')], queue, 'a');
    expect(merged.find((item) => item.id === '1')?.title).toBe('Edited while offline');
    expect(merged.map((item) => item.id)).toEqual(['b1', '2', '1']);
  });
});
