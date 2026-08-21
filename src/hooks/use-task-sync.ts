import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import { useTaskStore } from '@/src/stores/task-store';
import type { Task } from '@/src/types/domain';

export function useTaskSync(userId?: string) {
  const hydrated = useTaskStore((state) => state.hydrated);
  const replaceRemote = useTaskStore((state) => state.replaceRemote);
  const adoptGuestTasks = useTaskStore((state) => state.adoptGuestTasks);
  const sync = useTaskStore((state) => state.sync);
  const pendingCount = useTaskStore((state) => userId ? state.queue.filter((item) => item.userId === userId).length : 0);

  const query = useQuery({
    queryKey: ['tasks', userId],
    enabled: Boolean(userId && hydrated),
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId!).order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  useEffect(() => {
    if (!userId || !hydrated) return;
    adoptGuestTasks(userId);
    void sync(userId);
    return NetInfo.addEventListener((state) => {
      if (state.isConnected) void sync(userId);
    });
  }, [adoptGuestTasks, hydrated, sync, userId]);

  useEffect(() => {
    if (userId && hydrated && pendingCount) void sync(userId);
  }, [hydrated, pendingCount, sync, userId]);

  useEffect(() => {
    if (query.data && userId) replaceRemote(query.data, userId);
  }, [query.data, replaceRemote, userId]);

  return query;
}
