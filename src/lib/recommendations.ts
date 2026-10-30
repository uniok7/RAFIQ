// §5.5 / DoD: every recommendation SHOWN must have a `recommendations` row with
// its reasoning string. Deduped per (day, type) so one render == one row.
import { ENGINE_VERSION } from '@/engine';
import { supabase } from './supabase';

const shown = new Set<string>(); // in-memory guard against double-insert per session

export async function recordRecommendation(opts: {
  userId: string;
  day: string;
  type: 'main_win' | 'energy' | 'block_size' | 'night_rollover' | 'tired';
  payload: Record<string, unknown>;
  reasoning: string;
}): Promise<void> {
  const guard = `${opts.day}:${opts.type}:${JSON.stringify(opts.payload)}`;
  if (shown.has(guard)) return;
  shown.add(guard);
  await supabase.from('recommendations').insert({
    user_id: opts.userId,
    day: opts.day,
    type: opts.type,
    payload: opts.payload,
    reasoning: opts.reasoning,
    engine_version: ENGINE_VERSION,
  });
}

/**
 * §8.4: distinct DAYS on which the user corrected the energy call (wrong_inference).
 * Counting days, not rows, keeps multiple app-opens in one day from inflating the count.
 */
export async function energyCorrectionCount(userId: string): Promise<number> {
  const { data } = await supabase
    .from('recommendations')
    .select('day')
    .eq('user_id', userId)
    .eq('type', 'energy')
    .eq('correction_type', 'wrong_inference');
  return new Set((data ?? []).map((r: { day: string }) => r.day)).size;
}

/** Record the user's response to a shown recommendation (accept / correct). §7. */
export async function recordCorrection(opts: {
  userId: string;
  day: string;
  type: string;
  accepted: boolean;
  correctedTo?: Record<string, unknown>;
  correctionType?: 'wrong_fact' | 'wrong_inference' | 'wrong_priority' | 'wrong_entirely';
}): Promise<void> {
  await supabase
    .from('recommendations')
    .update({
      accepted: opts.accepted,
      corrected_to: opts.correctedTo ?? null,
      correction_type: opts.correctionType ?? null,
    })
    .eq('user_id', opts.userId)
    .eq('day', opts.day)
    .eq('type', opts.type);
}
