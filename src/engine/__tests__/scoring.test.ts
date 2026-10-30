import { describe, expect, it } from 'vitest';
import { rankTasks, scoreTask } from '../scoring';
import { task } from './factories';

const DAY = '2026-08-19';
const s = (t: ReturnType<typeof task>, energy: any = 'normal', w = {}, demoted: string[] = []) =>
  scoreTask(t, energy, w, demoted, DAY).score;

describe('scoreTask urgency (§5.3)', () => {
  it('overdue +45', () => {
    expect(s(task({ due: '2026-08-10', cognitive_load: 3 }))).toBe(45 + (4 - 3) * 3);
  });
  it('due today +40', () => {
    expect(s(task({ due: DAY, cognitive_load: 3 }))).toBe(40 + (4 - 3) * 3);
  });
  it('due tomorrow +24', () => {
    expect(s(task({ due: '2026-08-20', cognitive_load: 3 }))).toBe(24 + 3);
  });
  it('due this week +11', () => {
    expect(s(task({ due: '2026-08-24', cognitive_load: 3 }))).toBe(11 + 3);
  });
  it('due far out: no urgency', () => {
    expect(s(task({ due: '2026-12-01', cognitive_load: 3 }))).toBe(3);
  });
  it('no due date: no urgency', () => {
    expect(s(task({ due: null, cognitive_load: 3 }))).toBe(3);
  });
});

describe('scoreTask leverage + load fit', () => {
  it('unblocks +18, has_goal +8', () => {
    expect(s(task({ unblocks: true, goal_id: 'g1', cognitive_load: 3 }))).toBe(18 + 8 + 3);
  });
  it('load fit low: (4-load)*9', () => {
    expect(s(task({ cognitive_load: 1 }), 'low')).toBe((4 - 1) * 9);
  });
  it('load fit high: load*7', () => {
    expect(s(task({ cognitive_load: 3 }), 'high')).toBe(3 * 7);
  });
  it('load fit normal: (4-load)*3', () => {
    expect(s(task({ cognitive_load: 2 }), 'normal')).toBe((4 - 2) * 3);
  });
});

describe('scoreTask staleness + demotion', () => {
  it('reschedule_count >= 3 -> +26', () => {
    expect(s(task({ reschedule_count: 3, cognitive_load: 3 }))).toBe(26 + 3);
  });
  it('reschedule_count < 3 -> count*8', () => {
    expect(s(task({ reschedule_count: 2, cognitive_load: 3 }))).toBe(16 + 3);
  });
  it('demoted -> -200', () => {
    expect(s(task({ id: 'x', cognitive_load: 3 }), 'normal', {}, ['x'])).toBe(-200 + 3);
  });
});

describe('load_fit weight (§5.6)', () => {
  it('multiplier scales the load-fit component only', () => {
    const base = s(task({ cognitive_load: 1 }), 'low', {});
    const up = s(task({ cognitive_load: 1 }), 'low', { load_fit: 1.5 });
    expect(base).toBe(27);
    expect(up).toBe(27 * 1.5);
  });
});

describe('rankTasks', () => {
  it('drops non-open tasks and sorts by score', () => {
    const ranked = rankTasks(
      [
        task({ id: 'a', due: DAY }), // due today +40
        task({ id: 'b', due: null }), // 0-ish
        task({ id: 'c', status: 'done', due: DAY }), // filtered out
      ],
      'normal',
      {},
      [],
      DAY,
    );
    expect(ranked.map((r) => r.task.id)).toEqual(['a', 'b']);
  });

  it('breaks ties by earlier created_at', () => {
    const ranked = rankTasks(
      [
        task({ id: 'late', created_at: '2026-02-01T00:00:00Z' }),
        task({ id: 'early', created_at: '2026-01-01T00:00:00Z' }),
      ],
      'normal',
      {},
      [],
      DAY,
    );
    expect(ranked[0].task.id).toBe('early');
  });
});
