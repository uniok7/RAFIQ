import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { supabase } from '@/src/lib/supabase';
import { enqueueLatest, mergeRemoteTasks, type QueueItem } from '@/src/stores/offline-queue';
import type { Task } from '@/src/types/domain';

type AddTaskInput = Pick<Task, 'title'> & Partial<Pick<Task, 'goal_id' | 'estimate_mins' | 'cognitive_load' | 'due' | 'unblocks'>>;

type TaskState = {
  tasks: Task[];
  queue: QueueItem[];
  syncing: boolean;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  addTask: (input: AddTaskInput, userId?: string) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  completeTask: (id: string) => void;
  dropTask: (id: string) => void;
  replaceRemote: (tasks: Task[], userId: string) => void;
  adoptGuestTasks: (userId: string) => void;
  sync: (userId?: string) => Promise<void>;
};

const GUEST_ID = 'guest';

function enqueue(queue: QueueItem[], task: Task): QueueItem[] {
  return enqueueLatest(queue, task, Crypto.randomUUID(), new Date().toISOString());
}

function forDatabase(task: Task) {
  return {
    id: task.id,
    user_id: task.user_id,
    goal_id: task.goal_id,
    title: task.title,
    estimate_mins: task.estimate_mins,
    cognitive_load: task.cognitive_load,
    due: task.due,
    unblocks: task.unblocks,
    reschedule_count: task.reschedule_count,
    status: task.status,
    done_at: task.done_at,
    created_at: task.created_at,
  };
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      queue: [],
      syncing: false,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      addTask: (input, userId = GUEST_ID) => {
        const task: Task = {
          id: Crypto.randomUUID(),
          user_id: userId,
          goal_id: input.goal_id ?? null,
          title: input.title.trim(),
          estimate_mins: input.estimate_mins ?? 30,
          cognitive_load: input.cognitive_load ?? 2,
          due: input.due ?? null,
          unblocks: input.unblocks ?? false,
          reschedule_count: 0,
          status: 'open',
          done_at: null,
          created_at: new Date().toISOString(),
        };
        set((state) => ({ tasks: [...state.tasks, task], queue: enqueue(state.queue, task) }));
        return task;
      },
      updateTask: (id, patch) =>
        set((state) => {
          const current = state.tasks.find((task) => task.id === id);
          if (!current) return state;
          const task = { ...current, ...patch };
          return {
            tasks: state.tasks.map((item) => (item.id === id ? task : item)),
            queue: enqueue(state.queue, task),
          };
        }),
      completeTask: (id) => get().updateTask(id, { status: 'done', done_at: new Date().toISOString().slice(0, 10) }),
      dropTask: (id) => get().updateTask(id, { status: 'dropped' }),
      replaceRemote: (remoteTasks, userId) =>
        set((state) => {
          return { tasks: mergeRemoteTasks(state.tasks, remoteTasks, state.queue, userId) };
        }),
      adoptGuestTasks: (userId) =>
        set((state) => {
          const guestIds = new Set(state.tasks.filter((task) => task.user_id === GUEST_ID).map((task) => task.id));
          return {
            tasks: state.tasks.map((task) => task.user_id === GUEST_ID ? { ...task, user_id: userId } : task),
            queue: state.queue.map((item) => guestIds.has(item.task.id) ? { ...item, userId, task: { ...item.task, user_id: userId } } : item),
          };
        }),
      sync: async (userId) => {
        if (!userId || get().syncing) return;
        const network = await NetInfo.fetch();
        if (!network.isConnected) return;
        set({ syncing: true });
        try {
          const pending = get().queue.filter((item) => item.userId === userId);
          for (const item of pending) {
            const { error } = await supabase.from('tasks').upsert(forDatabase(item.task));
            if (error) throw error;
            set((state) => ({ queue: state.queue.filter((queued) => queued.id !== item.id) }));
          }
          const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: true });
          if (error) throw error;
          get().replaceRemote((data ?? []) as Task[], userId);
        } finally {
          set({ syncing: false });
        }
      },
    }),
    {
      name: 'one-thing-task-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ tasks, queue }) => ({ tasks, queue }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
