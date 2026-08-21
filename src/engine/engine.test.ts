import { describe, expect, it } from 'vitest';
import { expectedEnergy } from './energy';
import { plan } from './index';
import { rankTasks, scoreTask } from './scoring';
import type { EngineState, EngineTask, EnergyLevel } from './types';

const day = '2026-08-19';
function task(patch: Partial<EngineTask> = {}): EngineTask {
  return { id: patch.id ?? 'task', goal_id: null, title: 'A task', estimate_mins: 30, cognitive_load: 2, due: null, unblocks: false, reschedule_count: 0, status: 'open', created_at: '2026-08-01T00:00:00Z', ...patch };
}
function state(patch: Partial<EngineState> = {}): EngineState { return { tasks: [], sessions: [], daySignals: [], observations: [], weights: {}, ...patch }; }
function points(patch: Partial<EngineTask>, energy: EnergyLevel = 'normal') { return scoreTask(task(patch), state(), day, energy).score; }

describe('task scoring', () => {
  it('covers every urgency branch exactly', () => {
    expect(points({ due: '2026-08-18' })).toBe(51);
    expect(points({ due: day })).toBe(46);
    expect(points({ due: '2026-08-20' })).toBe(30);
    expect(points({ due: '2026-08-24' })).toBe(17);
    expect(points({ due: '2026-08-27' })).toBe(6);
  });

  it('adds leverage for unblocking and goal attachment', () => {
    expect(points({ unblocks: true })).toBe(24);
    expect(points({ goal_id: 'goal' })).toBe(14);
    expect(points({ unblocks: true, goal_id: 'goal' })).toBe(32);
  });

  it('fits cognitive load to low, normal, and high energy', () => {
    expect(points({ cognitive_load: 1 }, 'low')).toBe(27);
    expect(points({ cognitive_load: 3 }, 'low')).toBe(9);
    expect(points({ cognitive_load: 1 }, 'normal')).toBe(9);
    expect(points({ cognitive_load: 3 }, 'normal')).toBe(3);
    expect(points({ cognitive_load: 1 }, 'high')).toBe(7);
    expect(points({ cognitive_load: 3 }, 'high')).toBe(21);
  });

  it('covers both staleness branches', () => {
    expect(points({ reschedule_count: 0 })).toBe(6);
    expect(points({ reschedule_count: 1 })).toBe(14);
    expect(points({ reschedule_count: 2 })).toBe(22);
    expect(points({ reschedule_count: 3 })).toBe(32);
    expect(points({ reschedule_count: 8 })).toBe(32);
  });

  it('demotes by exactly 200 and applies bounded user weights', () => {
    const candidate = task({ id: 'demoted', due: day });
    expect(scoreTask(candidate, state({ demotedTaskIds: ['demoted'] }), day, 'normal').score).toBe(-154);
    expect(scoreTask(candidate, state({ weights: { urgency: 2 } }), day, 'normal').score).toBe(66);
    expect(scoreTask(candidate, state({ weights: { urgency: 0.1 } }), day, 'normal').score).toBe(26);
  });

  it('breaks ties by earlier creation time', () => {
    const ranked = rankTasks(state({ tasks: [task({ id: 'later', created_at: '2026-08-02T00:00:00Z' }), task({ id: 'earlier', created_at: '2026-08-01T00:00:00Z' })] }), day, 'normal');
    expect(ranked.map((item) => item.task.id)).toEqual(['earlier', 'later']);
  });
});

describe('expected energy', () => {
  it('uses a stated override before sleep', () => {
    const result = expectedEnergy(state({ daySignals: [{ day, sleep_mins: 120, energy_stated: 'high' }] }), day);
    expect(result).toMatchObject({ level: 'high', source: 'stated' });
  });

  it('uses the normal default when sleep is absent', () => {
    expect(expectedEnergy(state(), day)).toMatchObject({ level: 'normal', source: 'default', sleepMins: null });
  });

  it('labels borrowed low, normal, and high calls plainly', () => {
    for (const [minutes, level] of [[359, 'low'], [400, 'normal'], [421, 'high']] as const) {
      const result = expectedEnergy(state({ daySignals: [{ day, sleep_mins: minutes, energy_stated: null }] }), day);
      expect(result).toMatchObject({ level, source: 'borrowed', personal: false });
      expect(result.reasoning).toContain('borrowed');
      expect(result.reasoning).toContain('15 days');
    }
  });

  it('uses personal thresholds after five nights', () => {
    const previous = ['2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18'].map((night) => ({ day: night, sleep_mins: 480, energy_stated: null }));
    const result = expectedEnergy(state({ daySignals: [...previous, { day, sleep_mins: 300, energy_stated: null }] }), day);
    expect(result).toMatchObject({ level: 'low', source: 'personal', personal: true });
  });

  it('softens low calls after three corrections', () => {
    const result = expectedEnergy(state({ daySignals: [{ day, sleep_mins: 300, energy_stated: null }], observations: [{ key: 'short_nights', numeric_value: null, evidence_count: 3 }] }), day);
    expect(result.level).toBe('normal');
    expect(result.reasoning).toContain('corrected');
  });
});

describe('daily plan', () => {
  it('selects one main win, two secondary tasks, and exact block sizes', () => {
    const tasks = [task({ id: 'today', due: day }), task({ id: 'tomorrow', due: '2026-08-20' }), task({ id: 'week', due: '2026-08-23' }), task({ id: 'later', due: null })];
    const low = plan(state({ tasks, daySignals: [{ day, sleep_mins: 300, energy_stated: null }] }), day);
    const normal = plan(state({ tasks }), day);
    const high = plan(state({ tasks, daySignals: [{ day, sleep_mins: 500, energy_stated: null }] }), day);
    expect(low.blockMins).toBe(30);
    expect(normal.blockMins).toBe(45);
    expect(high.blockMins).toBe(60);
    expect(normal.mainWin?.id).toBe('today');
    expect(normal.alsoToday.map((item) => item.id)).toEqual(['tomorrow', 'week']);
  });

  it('builds reasoning from the two strongest fired reasons', () => {
    const result = plan(state({ tasks: [task({ due: day, unblocks: true, goal_id: 'goal' })] }), day);
    expect(result.reasoning).toBe('Because it’s due today, and other work is waiting behind it — so I put it first and set your block to 45 minutes.');
  });

  it('never returns an empty explanation', () => {
    expect(plan(state(), day).reasoning).toBe('You’re clear today — there isn’t an open task to rank.');
  });

  it('never resurfaces a rejected task even when it is the only candidate', () => {
    const result = plan(state({ tasks: [task({ id: 'rejected', due: day })], demotedTaskIds: ['rejected'] }), day);
    expect(result.mainWin).toBeNull();
  });
});
