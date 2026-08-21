import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type DayCorrections = { demotedTaskIds: string[]; blockMins: number | null };
type CorrectionState = {
  days: Record<string, DayCorrections>;
  demote: (day: string, taskId: string) => void;
  setBlockMins: (day: string, minutes: number) => void;
};

const blank = (): DayCorrections => ({ demotedTaskIds: [], blockMins: null });

export const useCorrectionStore = create<CorrectionState>()(
  persist(
    (set) => ({
      days: {},
      demote: (day, taskId) => set((state) => {
        const current = state.days[day] ?? blank();
        return { days: { ...state.days, [day]: { ...current, demotedTaskIds: [...new Set([...current.demotedTaskIds, taskId])] } } };
      }),
      setBlockMins: (day, blockMins) => set((state) => ({ days: { ...state.days, [day]: { ...(state.days[day] ?? blank()), blockMins } } })),
    }),
    { name: 'one-thing-corrections-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
