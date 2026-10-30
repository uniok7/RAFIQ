// Client-side wrapper for the /llm Edge Function. The key lives ONLY server-side (§6).
import { supabase } from './supabase';

type Job = 'A' | 'B' | 'C' | 'D';

export async function callLLM<T>(job: Job, input: unknown, fallback: T): Promise<T> {
  const { data, error } = await supabase.functions.invoke('llm', {
    body: { job, input },
  });
  if (error || !data?.result) return fallback;
  return data.result as T;
}

export interface OnboardingParse {
  goals: { title: string; why: string }[];
  tasks: { title: string; goal: string; estimate: number; load: number; due: string | null }[];
}

export function parseOnboarding(paragraph: string) {
  return callLLM<OnboardingParse>('A', { paragraph }, { goals: [], tasks: [] });
}

export interface NLResult {
  say: string;
  action: 'none' | 'add_task' | 'complete' | 'set_energy' | 'defer' | 'shorten' | 'log_meal' | 'tired';
  task?: Record<string, unknown>;
  taskId?: string;
  energy?: 'low' | 'normal' | 'high';
  minutes?: number;
  mealText?: string;
}

export function interpret(sentence: string, state: unknown) {
  return callLLM<NLResult>(
    'B',
    { sentence, state },
    { say: "That didn't go through. Say it again?", action: 'none' },
  );
}

export function weeklySummary(week: unknown) {
  return callLLM<{ text: string }>('C', week, { text: '' });
}

export interface MealParse {
  items: string[];
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  protein: string | null;
  veg: string | null;
  fibre: string | null;
  carb_type: 'refined' | 'whole' | 'mixed' | 'none' | null;
  missing: string[];
}

export function parseMeal(rawText: string, time: string) {
  return callLLM<MealParse>(
    'D',
    { raw_text: rawText, time },
    { items: [], slot: null, protein: null, veg: null, fibre: null, carb_type: null, missing: [] },
  );
}
