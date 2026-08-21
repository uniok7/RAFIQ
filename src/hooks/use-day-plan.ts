import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ENGINE_VERSION, plan, type DayPlan, type EngineState } from '@/src/engine';
import { localDay } from '@/src/lib/dates';
import { supabase } from '@/src/lib/supabase';
import { daySignalKey, useDayStore } from '@/src/stores/day-store';
import { useTaskStore } from '@/src/stores/task-store';
import { useCorrectionStore } from '@/src/stores/correction-store';
import type { DaySignal, Observation, Session, Task } from '@/src/types/domain';

export function useDayPlan(userId?: string, day = localDay()) {
  const tasks = useTaskStore((state) => state.tasks);
  const localSignal = useDayStore((state) => userId ? state.signals[daySignalKey(userId, day)] : undefined);
  const localCorrections = useCorrectionStore((state) => state.days[day]);
  const [readyPlan, setReadyPlan] = useState<DayPlan | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  const context = useQuery({
    queryKey: ['engine-context', userId, day],
    enabled: Boolean(userId),
    queryFn: async () => {
      const start = new Date(`${day}T12:00:00`);
      start.setDate(start.getDate() - 29);
      const [signals, observations, sessions, profile, rejected] = await Promise.all([
        supabase.from('day_signals').select('*').eq('user_id', userId!).gte('day', localDay(start)).lte('day', day),
        supabase.from('observations').select('*').eq('user_id', userId!).is('dismissed_at', null),
        supabase.from('sessions').select('*').eq('user_id', userId!).gte('day', localDay(start)).lte('day', day),
        supabase.from('profiles').select('engine_weights').eq('id', userId!).single(),
        supabase.from('recommendations').select('payload').eq('user_id', userId!).eq('day', day).eq('type', 'main_win').eq('correction_type', 'wrong_priority'),
      ]);
      const error = signals.error ?? observations.error ?? sessions.error ?? profile.error ?? rejected.error;
      if (error) throw error;
      return { daySignals: (signals.data ?? []) as DaySignal[], observations: (observations.data ?? []) as Observation[], sessions: (sessions.data ?? []) as Session[], weights: (profile.data?.engine_weights ?? {}) as EngineState['weights'], rejectedTaskIds: (rejected.data ?? []).map((item) => String((item.payload as { taskId?: string }).taskId ?? '')).filter(Boolean) };
    },
  });

  const candidate = useMemo(() => {
    if (!userId || !context.data) return null;
    const remoteSignals = context.data.daySignals.filter((signal) => signal.day !== day);
    const daySignals = localSignal ? [...remoteSignals, localSignal] : context.data.daySignals;
    return plan({
      tasks: tasks.filter((task) => task.user_id === userId) as Task[],
      sessions: context.data.sessions,
      daySignals,
      observations: context.data.observations,
      weights: context.data.weights,
      demotedTaskIds: [...new Set([...context.data.rejectedTaskIds, ...(localCorrections?.demotedTaskIds ?? [])])],
    }, day);
  }, [context.data, day, localCorrections?.demotedTaskIds, localSignal, tasks, userId]);

  const entries = useMemo(() => {
    if (!candidate) return null;
    const output: { type: string; payload: Record<string, unknown>; reasoning: string }[] = [
      { type: 'energy', payload: { level: candidate.energy.level, source: candidate.energy.source, sleepMins: candidate.energy.sleepMins }, reasoning: candidate.energy.reasoning },
      { type: 'block_size', payload: { minutes: candidate.blockMins }, reasoning: `A ${candidate.blockMins}-minute block fits ${candidate.energy.level} energy.` },
    ];
    if (candidate.mainWin) output.push({ type: 'main_win', payload: { taskId: candidate.mainWin.id, alsoTodayIds: candidate.alsoToday.map((task) => task.id), score: candidate.ranked[0]?.score }, reasoning: candidate.reasoning });
    return output;
  }, [candidate]);
  const signature = entries ? JSON.stringify(entries) : '';

  useEffect(() => {
    if (!candidate || !entries || !userId) return;
    let active = true;
    setReadyPlan(null);
    setLogError(null);
    void supabase.rpc('log_day_plan', { p_day: day, p_entries: entries, p_engine_version: ENGINE_VERSION }).then(({ error }) => {
      if (!active) return;
      if (error) setLogError(error.message);
      else setReadyPlan(candidate);
    });
    return () => { active = false; };
  }, [candidate, day, entries, signature, userId]);

  const estimateMultiplier = context.data?.observations.find((observation) => observation.key === 'estimate_multiplier')?.numeric_value ?? null;
  return { plan: readyPlan, preparing: context.isLoading || Boolean(candidate && !readyPlan && !logError), error: context.error instanceof Error ? context.error.message : logError, refresh: context.refetch, estimateMultiplier };
}
