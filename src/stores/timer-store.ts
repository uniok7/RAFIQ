import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { localDay } from '@/src/lib/dates';
import { cancelNotification, scheduleBreakOver } from '@/src/services/notifications';
import { saveSession } from '@/src/services/sessions';
import type { Session, Task } from '@/src/types/domain';

export type TimerPhase = 'idle' | 'work' | 'break' | 'return';

type TimerState = {
  phase: TimerPhase;
  sessionId: string | null;
  userId: string | null;
  taskId: string | null;
  taskTitle: string | null;
  plannedMins: number;
  startedAt: string | null;
  workEndsAt: string | null;
  breakEndsAt: string | null;
  interruptions: number;
  notificationId: string | null;
  start: (task: Task, userId: string, plannedMins: number) => Promise<void>;
  interrupt: () => void;
  tick: (now?: Date) => Promise<void>;
  finishWork: (now?: Date) => Promise<void>;
  stop: (now?: Date) => Promise<void>;
  returnToTask: () => void;
};

const empty = { phase: 'idle' as const, sessionId: null, userId: null, taskId: null, taskTitle: null, plannedMins: 45, startedAt: null, workEndsAt: null, breakEndsAt: null, interruptions: 0, notificationId: null };

function actualMinutes(startedAt: string | null, now: Date) {
  if (!startedAt) return 0;
  return Math.max(1, Math.round((now.getTime() - new Date(startedAt).getTime()) / 60_000));
}

function toSession(state: TimerState, now: Date, completed: boolean): Session | null {
  if (!state.sessionId || !state.userId || !state.startedAt) return null;
  return { id: state.sessionId, user_id: state.userId, task_id: state.taskId, day: localDay(new Date(state.startedAt)), planned_mins: state.plannedMins, actual_mins: actualMinutes(state.startedAt, now), interruptions: state.interruptions, completed, started_at: state.startedAt, ended_at: now.toISOString() };
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      ...empty,
      start: async (task, userId, plannedMins) => {
        const now = new Date();
        const sessionId = Crypto.randomUUID();
        const workEnds = new Date(now.getTime() + plannedMins * 60_000);
        const breakEnds = new Date(workEnds.getTime() + 5 * 60_000);
        const notificationId = await scheduleBreakOver(task.title, breakEnds, sessionId);
        set({ phase: 'work', sessionId, userId, taskId: task.id, taskTitle: task.title, plannedMins, startedAt: now.toISOString(), workEndsAt: workEnds.toISOString(), breakEndsAt: breakEnds.toISOString(), interruptions: 0, notificationId });
        await saveSession({ id: sessionId, user_id: userId, task_id: task.id, day: localDay(now), planned_mins: plannedMins, actual_mins: null, interruptions: 0, completed: false, started_at: now.toISOString(), ended_at: null });
      },
      interrupt: () => set((state) => ({ interruptions: state.interruptions + 1 })),
      tick: async (now = new Date()) => {
        const state = get();
        if (state.phase === 'work' && state.workEndsAt && now >= new Date(state.workEndsAt)) await get().finishWork(new Date(state.workEndsAt));
        else if (state.phase === 'break' && state.breakEndsAt && now >= new Date(state.breakEndsAt)) set({ phase: 'return' });
      },
      finishWork: async (now = new Date()) => {
        const state = get();
        if (state.phase !== 'work') return;
        const breakEnds = new Date(now.getTime() + 5 * 60_000);
        await cancelNotification(state.notificationId);
        const notificationId = state.taskTitle && state.sessionId ? await scheduleBreakOver(state.taskTitle, breakEnds, state.sessionId) : null;
        const session = toSession(state, now, true);
        set({ phase: 'break', workEndsAt: now.toISOString(), breakEndsAt: breakEnds.toISOString(), notificationId });
        if (session) await saveSession(session);
      },
      stop: async (now = new Date()) => {
        const state = get();
        const session = toSession(state, now, false);
        await cancelNotification(state.notificationId);
        set(empty);
        if (session) await saveSession(session);
      },
      returnToTask: () => set(empty),
    }),
    { name: 'one-thing-timer-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
