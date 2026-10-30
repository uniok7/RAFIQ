// §9 routine items + nightly checks. Small, online-first (not offline-critical).
import { supabase } from './supabase';

export interface RoutineItem {
  id: string;
  label: string;
  sort_order: number;
  active: boolean;
}

export async function fetchRoutine(): Promise<RoutineItem[]> {
  const { data } = await supabase
    .from('routine_items')
    .select('id,label,sort_order,active')
    .eq('active', true)
    .order('sort_order');
  return (data as RoutineItem[]) ?? [];
}

export async function addRoutineItem(userId: string, label: string, sortOrder: number): Promise<void> {
  await supabase.from('routine_items').insert({ user_id: userId, label, sort_order: sortOrder });
}

export async function removeRoutineItem(id: string): Promise<void> {
  // Soft-delete: keep historical checks intact, drop it from the list.
  await supabase.from('routine_items').update({ active: false }).eq('id', id);
}

export async function fetchChecks(day: string): Promise<Set<string>> {
  const { data } = await supabase.from('routine_checks').select('item_id').eq('day', day);
  return new Set((data ?? []).map((r: { item_id: string }) => r.item_id));
}

export async function setCheck(
  userId: string,
  itemId: string,
  day: string,
  checked: boolean,
): Promise<void> {
  if (checked) {
    await supabase.from('routine_checks').upsert({ user_id: userId, item_id: itemId, day });
  } else {
    await supabase.from('routine_checks').delete().eq('user_id', userId).eq('item_id', itemId).eq('day', day);
  }
}
