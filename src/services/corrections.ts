import { supabase } from '@/src/lib/supabase';

export type CorrectionType = 'wrong_fact' | 'wrong_inference' | 'wrong_priority' | 'wrong_entirely';

export async function correctLatest(input: { day: string; recommendationType: 'energy' | 'main_win' | 'block_size'; correctionType: CorrectionType; correctedTo: Record<string, unknown>; taskId?: string; payloadContains?: Record<string, unknown>; replacementTaskId?: string | null }) {
  let query = supabase.from('recommendations').select('id').eq('day', input.day).eq('type', input.recommendationType).order('created_at', { ascending: false }).limit(1);
  if (input.taskId) query = query.contains('payload', { taskId: input.taskId });
  if (input.payloadContains) query = query.contains('payload', input.payloadContains);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('recommendation_not_found');
  const { error: correctionError } = await supabase.rpc('correct_recommendation', { p_recommendation_id: data.id, p_correction_type: input.correctionType, p_corrected_to: input.correctedTo, p_replacement_task_id: input.replacementTaskId ?? null });
  if (correctionError) throw correctionError;
}

export async function acceptDayPlan(day: string, mainTaskId: string) {
  const { error } = await supabase.rpc('accept_day_plan', { p_day: day, p_main_task_id: mainTaskId });
  if (error) throw error;
}
