// Offline-first local store (§2). Reads/writes work offline; writes queue and
// sync on reconnect. Last-write-wins — server is the source of truth after sync.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  DaySignal,
  EngineState,
  EngineWeights,
  Meal,
  Observation,
  Task,
} from '@/engine';
import { disorderedEatingGuard } from '@/engine';
import { supabase } from '@/lib/supabase';

// Client-generated id so offline-created rows have a stable key (not security-sensitive).
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type QueueOp =
  | { table: 'tasks'; type: 'upsert'; row: Partial<Task> & { id: string } }
  | { table: 'day_signals'; type: 'upsert'; row: Partial<DaySignal> & { day: string } }
  | { table: 'meals'; type: 'upsert'; row: Partial<Meal> & { id: string } };

interface LocalState {
  userId: string | null;
  tasks: Task[];
  daySignals: DaySignal[];
  observations: Observation[];
  meals: Meal[];
  weights: EngineWeights;
  foodCommentaryEnabled: boolean; // §12 guard
  demotedTaskIds: string[];
  queue: QueueOp[];
  online: boolean;

  setUser: (id: string | null) => void;
  addTask: (t: Partial<Task>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  completeTask: (id: string) => void;
  addMeal: (m: Partial<Meal>) => Meal;
  demoteToday: (id: string) => void;
  engineState: () => EngineState;
  enqueue: (op: QueueOp) => void;
  sync: () => Promise<void>;
}

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

export const useLocal = create<LocalState>()(
  persist(
    (set, get) => ({
      userId: null,
      tasks: [],
      daySignals: [],
      observations: [],
      meals: [],
      weights: {},
      foodCommentaryEnabled: true,
      demotedTaskIds: [],
      queue: [],
      online: true,

      setUser: (id) => set({ userId: id }),

      addTask: (t) => {
        const task: Task = {
          id: t.id ?? uuid(),
          goal_id: t.goal_id ?? null,
          title: t.title ?? 'Untitled',
          estimate_mins: t.estimate_mins ?? 30,
          cognitive_load: t.cognitive_load ?? 2,
          due: t.due ?? null,
          unblocks: t.unblocks ?? false,
          reschedule_count: t.reschedule_count ?? 0,
          status: t.status ?? 'open',
          created_at: t.created_at ?? nowIso(),
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        get().enqueue({ table: 'tasks', type: 'upsert', row: { ...task, user_id: get().userId } as any });
        return task;
      },

      updateTask: (id, patch) => {
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
        get().enqueue({ table: 'tasks', type: 'upsert', row: { id, ...patch } });
      },

      completeTask: (id) => get().updateTask(id, { status: 'done', /* done_at set server-side too */ }),

      addMeal: (m) => {
        const meal: Meal = {
          id: m.id ?? uuid(),
          day: m.day ?? today(),
          logged_at: m.logged_at ?? nowIso(),
          slot: m.slot ?? null,
          raw_text: m.raw_text ?? '',
          protein: m.protein ?? null,
          veg: m.veg ?? null,
          fibre: m.fibre ?? null,
          carb_type: m.carb_type ?? null,
        };
        const meals = [...get().meals, meal];
        set({ meals });
        get().enqueue({ table: 'meals', type: 'upsert', row: { ...meal, user_id: get().userId } as any });

        // §12: disordered-eating guard — 0–1 meals for 3 straight days disables commentary,
        // permanently, keeping logging silent. Ship with the feature.
        if (get().foodCommentaryEnabled && disorderedEatingGuard(meals, today())) {
          set({ foodCommentaryEnabled: false });
          const uid = get().userId;
          if (uid) void supabase.from('profiles').update({ food_commentary_enabled: false }).eq('id', uid);
        }
        return meal;
      },

      demoteToday: (id) =>
        set((s) => ({
          demotedTaskIds: s.demotedTaskIds.includes(id)
            ? s.demotedTaskIds
            : [...s.demotedTaskIds, id],
        })),

      engineState: () => {
        const s = get();
        return {
          tasks: s.tasks,
          sessions: [], // sessions live server-side; hydrated on sync for observations
          daySignals: s.daySignals,
          observations: s.observations,
          meals: s.meals,
          weights: s.weights,
          demotedTaskIds: s.demotedTaskIds,
        };
      },

      enqueue: (op) => {
        set((s) => ({ queue: [...s.queue, op] }));
        // Fire-and-forget flush; safe to call repeatedly.
        void get().sync();
      },

      sync: async () => {
        const { queue, userId } = get();
        if (!userId || queue.length === 0) return;
        const remaining: QueueOp[] = [];
        for (const op of queue) {
          const { error } = await supabase
            .from(op.table)
            .upsert({ ...op.row, user_id: userId } as any);
          if (error) remaining.push(op); // keep it, retry next reconnect
        }
        set({ queue: remaining, online: remaining.length === 0 });

        // Pull fresh server rows (last-write-wins reconciliation).
        if (remaining.length === 0) {
          const [{ data: tasks }, { data: signals }, { data: obs }, { data: meals }, { data: profile }] =
            await Promise.all([
              supabase.from('tasks').select('*').eq('user_id', userId),
              supabase.from('day_signals').select('*').eq('user_id', userId),
              supabase.from('observations').select('*').eq('user_id', userId),
              supabase.from('meals').select('*').eq('user_id', userId),
              supabase.from('profiles').select('food_commentary_enabled').eq('id', userId).single(),
            ]);
          set({
            tasks: (tasks as Task[]) ?? get().tasks,
            daySignals: (signals as DaySignal[]) ?? get().daySignals,
            observations: (obs as Observation[]) ?? get().observations,
            meals: (meals as Meal[]) ?? get().meals,
            foodCommentaryEnabled: profile?.food_commentary_enabled ?? get().foodCommentaryEnabled,
          });
        }
      },
    }),
    {
      name: 'one-thing-local',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        tasks: s.tasks,
        daySignals: s.daySignals,
        observations: s.observations,
        meals: s.meals,
        weights: s.weights,
        foodCommentaryEnabled: s.foodCommentaryEnabled,
        demotedTaskIds: s.demotedTaskIds,
        queue: s.queue,
        userId: s.userId,
      }),
    },
  ),
);

export { today };
