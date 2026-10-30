// §5.1 Entry point. Pure — the whole engine composed here.
import { blockMins, BREAK_MINS } from './block';
import { computeEnergy } from './energy';
import { buildReasoning } from './reasoning';
import { rankTasks } from './scoring';
import type { DayPlan, EngineState } from './types';

export function plan(state: EngineState, day: string): DayPlan {
  const demoted = state.demotedTaskIds ?? [];
  const energy = computeEnergy(state.daySignals, day, state.observations);
  const ranked = rankTasks(state.tasks, energy.energy, state.weights, demoted, day);
  const block = blockMins(energy.energy);

  // Demoted tasks stay in `ranked` for transparency but are never recommended.
  const eligible = ranked.filter((r) => !demoted.includes(r.task.id));
  const mainRanked = eligible[0] ?? null;
  const mainWin = mainRanked?.task ?? null;
  const alsoToday = eligible.slice(1, 3).map((r) => r.task);

  const reasoning = mainRanked
    ? buildReasoning(mainRanked.reasons, block)
    : '';

  return {
    energy: energy.energy,
    energySource: energy.source,
    energyReasoning: energy.reasoning,
    mainWin,
    alsoToday,
    blockMins: block,
    breakMins: BREAK_MINS,
    reasoning,
    ranked,
  };
}
