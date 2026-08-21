import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { localDay } from '@/src/lib/dates';
import { supabase } from '@/src/lib/supabase';
import { scheduleDailyPlanNotifications } from '@/src/services/notifications';

export function useDailyNotifications(input: { userId?: string; mainTitle?: string; completedCount: number; plannedCount: number }) {
  const profile = useQuery({
    queryKey: ['notification-hours', input.userId], enabled: Boolean(input.userId),
    queryFn: async () => { const { data, error } = await supabase.from('profiles').select('morning_hour, night_hour').eq('id', input.userId!).single(); if (error) throw error; return data; },
  });
  useEffect(() => {
    if (!input.mainTitle || !profile.data) return;
    void scheduleDailyPlanNotifications({ day: localDay(), morningHour: profile.data.morning_hour, nightHour: profile.data.night_hour, mainTitle: input.mainTitle, completedCount: input.completedCount, plannedCount: input.plannedCount });
  }, [input.completedCount, input.mainTitle, input.plannedCount, profile.data]);
}
