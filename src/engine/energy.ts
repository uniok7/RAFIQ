// §5.1 Expected energy. Pure.
import type { Energy, DaySignal, EnergyResult, Observation } from './types';
import { dayDiff, formatDuration, mean } from './util';

export const BORROWED_AVG_MINS = 400; // ~6h40m borrowed population prior

/** Softened once the user has corrected the low-energy call 3+ times (§9 short_nights). */
function isSoftened(observations: Observation[]): boolean {
  return observations.some((o) => o.key === 'short_nights' && !o.dismissed_at);
}

const LADDER: Energy[] = ['low', 'normal', 'high'];
function shift(e: Energy, dir: -1 | 1): Energy {
  const i = Math.max(0, Math.min(2, LADDER.indexOf(e) + dir));
  return LADDER[i];
}

export function computeEnergy(
  daySignals: DaySignal[],
  day: string,
  observations: Observation[] = [],
): EnergyResult {
  const today = daySignals.find((d) => d.day === day);

  // 1. Explicit user override wins.
  if (today?.energy_stated) {
    return {
      energy: today.energy_stated,
      source: 'stated',
      reasoning: `You told me you're ${today.energy_stated} today.`,
      sleepMins: today.sleep_mins ?? null,
      personal: false,
    };
  }

  // 2. No sleep data -> normal/default.
  const sleep = today?.sleep_mins ?? null;
  if (sleep == null) {
    return {
      energy: 'normal',
      source: 'default',
      reasoning: "No sleep data yet, so I'm assuming a normal day.",
      sleepMins: null,
      personal: false,
    };
  }

  // 3. Personal baseline from the prior 30 days that have sleep data.
  // Today itself is excluded — we compare today's sleep *against* the baseline.
  const nights = daySignals
    .filter((d) => d.sleep_mins != null)
    .filter((d) => {
      const diff = dayDiff(d.day, day); // days from d.day to today; 1..30 = prior month
      return diff >= 1 && diff <= 30;
    })
    .map((d) => d.sleep_mins as number);

  const personal = nights.length >= 5;
  const avg = personal ? mean(nights) : BORROWED_AVG_MINS;

  const softened = isSoftened(observations);
  const lowThreshold = personal ? avg - 55 : 360;
  const highThreshold = personal ? avg + 45 : 420;

  let energy: EnergyResult['energy'];
  if (sleep < lowThreshold && !softened) energy = 'low';
  else if (sleep > highThreshold) energy = 'high';
  else energy = 'normal';
  const baseEnergy = energy; // duration-based call, before the quality shift

  // §5.1 sleep-quality shift, applied on top of the duration-based call.
  const quality = today?.sleep_quality ?? null;
  let qualityNote = '';
  if (quality === 'broken') {
    const before = energy;
    energy = shift(energy, -1);
    if (energy !== before) qualityNote = ' Sleep was broken, so I nudged it down.';
  } else if (quality === 'solid' && sleep >= 360) {
    const before = energy;
    energy = shift(energy, 1);
    if (energy !== before) qualityNote = ' Sleep was solid, so I nudged it up.';
  }

  const slept = formatDuration(sleep);
  let reasoning: string;
  if (personal) {
    if (baseEnergy === 'low') {
      reasoning = `${slept} — below your usual ${formatDuration(Math.round(avg))}, so I'm easing off today.`;
    } else if (baseEnergy === 'high') {
      reasoning = `${slept} — above your usual ${formatDuration(Math.round(avg))}, so I'll push a little harder.`;
    } else {
      reasoning = `${slept} — right around your usual, so a normal day.`;
    }
  } else {
    // Borrowed prior: never present it as a personal finding.
    if (baseEnergy === 'low') {
      reasoning = `${slept}. Most people run lower under 6 hours — I'll swap this for your own numbers once I have 15 days.`;
    } else if (baseEnergy === 'high') {
      reasoning = `${slept}. That's a full night for most people — I'll swap this for your own numbers once I have 15 days.`;
    } else {
      reasoning = `${slept}. Using a general baseline for now — I'll swap it for your own numbers once I have 15 days.`;
    }
  }

  return {
    energy,
    source: personal ? 'personal' : 'borrowed',
    reasoning: reasoning + qualityNote,
    sleepMins: sleep,
    personal,
  };
}
