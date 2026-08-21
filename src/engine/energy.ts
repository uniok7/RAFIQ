import type { EnergyResult, EngineState } from './types';

function mean(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
export function formatMinutes(minutes: number) { return `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}m`; }

export function expectedEnergy(state: EngineState, day: string): EnergyResult {
  const today = state.daySignals.find((signal) => signal.day === day);
  if (today?.energy_stated) return { level: today.energy_stated, source: 'stated', personal: true, reasoning: `You said your energy is ${today.energy_stated}, so I’m using that instead of guessing.`, sleepMins: today.sleep_mins };
  if (today?.sleep_mins == null) return { level: 'normal', source: 'default', personal: false, reasoning: 'No sleep data today, so I’m using a normal-energy default.', sleepMins: null };

  const cutoff = new Date(`${day}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  const nights = state.daySignals.filter((signal) => signal.sleep_mins != null && signal.day >= cutoff.toISOString().slice(0, 10) && signal.day <= day).map((signal) => signal.sleep_mins!);
  const personal = nights.length >= 5;
  const average = personal ? mean(nights) : 400;
  const softened = state.observations.some((observation) => observation.key === 'short_nights' && observation.evidence_count >= 3 && !observation.dismissed_at);
  const low = today.sleep_mins < (personal ? average - 55 : 360);
  const high = today.sleep_mins > (personal ? average + 45 : 420);
  const level = low && !softened ? 'low' : high ? 'high' : 'normal';
  const slept = formatMinutes(today.sleep_mins);

  if (low && softened) return { level, source: personal ? 'personal' : 'borrowed', personal, sleepMins: today.sleep_mins, reasoning: `${slept}. That would normally lower today’s load, but you’ve corrected that call three times, so I’m leaving it normal.` };
  if (!personal) {
    const prior = level === 'low' ? 'A borrowed guide says most people run lower under 6 hours' : level === 'high' ? 'I’m using a borrowed 7-hour high-energy threshold for now' : 'I’m using a borrowed population range for now';
    return { level, source: 'borrowed', personal: false, sleepMins: today.sleep_mins, reasoning: `${slept}. ${prior} — I’ll swap this for your own numbers once I have 15 days.` };
  }
  const comparison = level === 'low' ? 'well below' : level === 'high' ? 'well above' : 'close to';
  return { level, source: 'personal', personal: true, sleepMins: today.sleep_mins, reasoning: `${slept}. That’s ${comparison} your recent ${formatMinutes(average)} average.` };
}
