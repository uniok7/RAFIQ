import { describe, expect, it } from 'vitest';
import { plan } from '../plan';
import { signal, state, task } from './factories';

const DAY = '2026-08-19';

describe('plan (§5.1 integration)', () => {
  it('picks the highest-scoring task as main win, next two as also-today', () => {
    const st = state({
      tasks: [
        task({ id: 'top', due: DAY, unblocks: true }),
        task({ id: 'mid', due: '2026-08-20' }),
        task({ id: 'low', due: '2026-08-24' }),
        task({ id: 'none', due: null }),
      ],
      daySignals: [signal({ day: DAY })], // no sleep -> normal
    });
    const p = plan(st, DAY);
    expect(p.mainWin?.id).toBe('top');
    expect(p.alsoToday.map((t) => t.id)).toEqual(['mid', 'low']);
    expect(p.blockMins).toBe(45);
    expect(p.reasoning).toContain('due today');
    expect(p.ranked.length).toBe(4);
  });

  it('demoted task never becomes main win or also-today', () => {
    const st = state({
      tasks: [task({ id: 'top', due: DAY }), task({ id: 'next', due: '2026-08-20' })],
      demotedTaskIds: ['top'],
      daySignals: [signal({ day: DAY })],
    });
    const p = plan(st, DAY);
    expect(p.mainWin?.id).toBe('next');
    expect(p.alsoToday.find((t) => t.id === 'top')).toBeUndefined();
  });

  it('no open tasks -> null main win, empty reasoning', () => {
    const p = plan(state({ tasks: [task({ status: 'done' })] }), DAY);
    expect(p.mainWin).toBeNull();
    expect(p.reasoning).toBe('');
  });

  it('low energy shrinks the block to 30', () => {
    const st = state({
      tasks: [task({ id: 'a', due: DAY })],
      daySignals: [signal({ day: DAY, sleep_mins: 300 })], // borrowed low
    });
    const p = plan(st, DAY);
    expect(p.energy).toBe('low');
    expect(p.blockMins).toBe(30);
    expect(p.energySource).toBe('borrowed');
  });
});
