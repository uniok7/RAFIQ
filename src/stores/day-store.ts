import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { localDay } from '@/src/lib/dates';
import { supabase } from '@/src/lib/supabase';
import type { DaySignal } from '@/src/types/domain';

type DayState = {
  signals: Record<string, DaySignal>;
  setSleep: (userId: string, minutes: number, source: NonNullable<DaySignal['sleep_source']>, day?: string) => Promise<void>;
  setEnergy: (userId: string, energy: NonNullable<DaySignal['energy_stated']>, day?: string) => Promise<void>;
  hydrateRemote: (userId: string, day?: string) => Promise<void>;
};

function key(userId: string, day: string) { return `${userId}:${day}`; }

export const useDayStore = create<DayState>()(
  persist(
    (set, get) => ({
      signals: {},
      setSleep: async (userId, minutes, source, day = localDay()) => {
        const existing = get().signals[key(userId, day)];
        const signal: DaySignal = existing ?? { user_id: userId, day, sleep_mins: null, sleep_source: null, energy_stated: null, mood: null, planned_count: 0, completed_count: 0 };
        const next = { ...signal, sleep_mins: minutes, sleep_source: source };
        set((state) => ({ signals: { ...state.signals, [key(userId, day)]: next } }));
        await supabase.from('day_signals').upsert(next);
      },
      setEnergy: async (userId, energy_stated, day = localDay()) => {
        const existing = get().signals[key(userId, day)];
        const signal: DaySignal = existing ?? { user_id: userId, day, sleep_mins: null, sleep_source: null, energy_stated: null, mood: null, planned_count: 0, completed_count: 0 };
        const next = { ...signal, energy_stated };
        set((state) => ({ signals: { ...state.signals, [key(userId, day)]: next } }));
        await supabase.from('day_signals').upsert(next);
      },
      hydrateRemote: async (userId, day = localDay()) => {
        const { data } = await supabase.from('day_signals').select('*').eq('user_id', userId).eq('day', day).maybeSingle();
        if (data) set((state) => ({ signals: { ...state.signals, [key(userId, day)]: data as DaySignal } }));
      },
    }),
    { name: 'one-thing-day-signals-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export function daySignalKey(userId: string, day = localDay()) { return key(userId, day); }
