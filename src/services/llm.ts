import { supabase } from '@/src/lib/supabase';
import { normalizeParsedPlan, type ParsedPlan } from '@/src/services/llm-schema';
import { normalizeNaturalAction, type NaturalAction } from '@/src/services/natural-language-schema';
export type { ParsedGoal, ParsedTask, ParsedPlan } from '@/src/services/llm-schema';

export async function parseOnboarding(input: string): Promise<ParsedPlan> {
  const { data, error } = await supabase.functions.invoke('llm', { body: { job: 'onboarding_parse', input } });
  if (error || !data?.data) throw error ?? new Error('parse_failed');
  return normalizeParsedPlan(data.data);
}

export async function interpretNaturalLanguage(input: string, compactState: unknown): Promise<NaturalAction> {
  const { data, error } = await supabase.functions.invoke('llm', { body: { job: 'natural_language', input: { sentence: input, state: compactState } } });
  if (error || !data?.data) throw error ?? new Error('action_failed');
  return normalizeNaturalAction(data.data);
}

export async function weeklySummary(compactEvidence: unknown): Promise<string> {
  const { data, error } = await supabase.functions.invoke('llm', { body: { job: 'weekly_summary', input: compactEvidence } });
  if (error || typeof data?.data?.summary !== 'string') throw error ?? new Error('summary_failed');
  return data.data.summary.trim().slice(0, 600);
}
