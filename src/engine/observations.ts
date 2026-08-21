type ObservationTask = { title: string; status: string; reschedule_count: number; created_at: string };
type ObservationSession = { day: string; planned_mins: number; actual_mins: number | null; completed: boolean };
type ObservationDay = { day: string; sleep_mins: number | null; planned_count: number; completed_count: number };

export type ObservationInput = { tasks: ObservationTask[]; sessions: ObservationSession[]; daySignals: ObservationDay[]; energyCorrectionCount: number };
export type ObservationDraft = { key: 'estimate_multiplier' | 'sleep_effect' | 'avoidance' | 'short_nights'; label: string; value: string; numericValue: number | null; evidenceCount: number; confidence: 'early' | 'solid'; source: 'inferred' | 'corrected' };

function mean(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }

export function evidenceDays(input: ObservationInput) {
  return new Set([...input.daySignals.map((item) => item.day), ...input.sessions.map((item) => item.day)]).size;
}

export function computeObservations(input: ObservationInput): ObservationDraft[] {
  const output: ObservationDraft[] = [];
  const days = evidenceDays(input);
  const completed = input.sessions.filter((session) => session.completed && session.actual_mins != null && session.planned_mins > 0);
  if (days >= 15 && completed.length >= 5) {
    const ratio = mean(completed.map((session) => session.actual_mins! / session.planned_mins));
    if (ratio < 0.85 || ratio > 1.15) output.push({ key: 'estimate_multiplier', label: 'Time estimates', value: `When you say 30 minutes, it usually takes ${Math.round(30 * ratio)}.`, numericValue: ratio, evidenceCount: completed.length, confidence: completed.length < 12 ? 'early' : 'solid', source: 'inferred' });
  }

  const sleepDays = input.daySignals.filter((signal) => signal.sleep_mins != null && signal.planned_count > 0);
  const rested = sleepDays.filter((signal) => signal.sleep_mins! >= 420);
  const short = sleepDays.filter((signal) => signal.sleep_mins! < 420);
  if (sleepDays.length >= 15 && rested.length >= 4 && short.length >= 4) {
    const restedRate = mean(rested.map((signal) => signal.completed_count / signal.planned_count));
    const shortRate = mean(short.map((signal) => signal.completed_count / signal.planned_count));
    if (shortRate > 0) {
      const effect = ((restedRate - shortRate) / shortRate) * 100;
      if (Math.abs(effect) >= 12) output.push({ key: 'sleep_effect', label: 'Sleep and follow-through', value: `On 7+ hours you finish ${Math.round(Math.abs(effect))}% ${effect >= 0 ? 'more' : 'less'} of what you planned.`, numericValue: effect, evidenceCount: sleepDays.length, confidence: 'solid', source: 'inferred' });
    }
  }

  const avoided = input.tasks.filter((task) => task.status === 'open' && task.reschedule_count >= 3).sort((a, b) => b.reschedule_count - a.reschedule_count || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  if (avoided) output.push({ key: 'avoidance', label: 'A task may be stuck', value: `“${avoided.title}” has moved ${avoided.reschedule_count} times. Is it actually a 10-minute job, or is something blocking it?`, numericValue: avoided.reschedule_count, evidenceCount: avoided.reschedule_count, confidence: 'solid', source: 'inferred' });
  if (input.energyCorrectionCount >= 3) output.push({ key: 'short_nights', label: 'Sleep correction', value: `You’ve corrected me ${input.energyCorrectionCount} times on this. I’ve stopped lowering your load automatically.`, numericValue: input.energyCorrectionCount, evidenceCount: input.energyCorrectionCount, confidence: 'solid', source: 'corrected' });
  return output;
}
