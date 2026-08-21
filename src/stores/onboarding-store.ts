import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ParsedPlan } from '@/src/services/llm';

export type OnboardingStage = 'question' | 'parsing' | 'edit' | 'calendar' | 'health' | 'hours';

type OnboardingState = {
  stage: OnboardingStage;
  raw: string;
  bottomUp: boolean;
  parsed: ParsedPlan | null;
  completedUserId: string | null;
  askNinetyDayOn: string | null;
  setStage: (stage: OnboardingStage) => void;
  setRaw: (raw: string) => void;
  setBottomUp: (value: boolean) => void;
  setParsed: (plan: ParsedPlan) => void;
  complete: (userId: string, askNinetyDayOn?: string | null) => void;
  reset: () => void;
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      stage: 'question', raw: '', bottomUp: false, parsed: null, completedUserId: null, askNinetyDayOn: null,
      setStage: (stage) => set({ stage }),
      setRaw: (raw) => set({ raw }),
      setBottomUp: (bottomUp) => set({ bottomUp, raw: '', parsed: null }),
      setParsed: (parsed) => set({ parsed, stage: 'edit' }),
      complete: (completedUserId, askNinetyDayOn = null) => set({ completedUserId, askNinetyDayOn }),
      reset: () => set({ stage: 'question', raw: '', bottomUp: false, parsed: null, completedUserId: null, askNinetyDayOn: null }),
    }),
    { name: 'one-thing-onboarding-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
