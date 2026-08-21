import { supabase } from '@/src/lib/supabase';
import type { Session } from '@/src/types/domain';

export async function saveSession(session: Session): Promise<void> {
  const { error } = await supabase.from('sessions').upsert(session);
  if (error) throw error;
}
