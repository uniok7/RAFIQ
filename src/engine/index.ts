import { expectedEnergy } from './energy';
import { rankTasks } from './scoring';
import type { DayPlan, EngineState } from './types';

export const ENGINE_VERSION = 1;

export function plan(state: EngineState, day: string): DayPlan {
  const energy = expectedEnergy(state, day);
  const ranked = rankTasks(state, day, energy.level).filter((item) => !state.demotedTaskIds?.includes(item.task.id));
  const main = ranked[0] ?? null;
  const blockMins = energy.level === 'low' ? 30 : energy.level === 'high' ? 60 : 45;
  const top = main?.reasons.slice(0, 2).map((reason) => reason.label) ?? [];
  const reasoning = !main
    ? 'You’re clear today — there isn’t an open task to rank.'
    : top.length === 0
      ? 'Nothing’s competing with it today.'
      : `Because ${top.join(', and ')} — so I put it first and set your block to ${blockMins} minutes.`;
  return { energy, mainWin: main?.task ?? null, alsoToday: ranked.slice(1, 3).map((item) => item.task), blockMins, reasoning, ranked };
}

export type * from './types';
