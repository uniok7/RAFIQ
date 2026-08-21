import type { Task } from '@/src/types/domain';

export type QueueItem = { id: string; userId: string; task: Task; queuedAt: string };

export function enqueueLatest(queue: QueueItem[], task: Task, id: string, queuedAt: string): QueueItem[] {
  return [...queue.filter((item) => item.task.id !== task.id), { id, userId: task.user_id, task, queuedAt }];
}

export function mergeRemoteTasks(local: Task[], remote: Task[], queue: QueueItem[], userId: string): Task[] {
  const queuedIds = new Set(queue.map((item) => item.task.id));
  const localPending = local.filter((task) => task.user_id === userId && queuedIds.has(task.id));
  const otherUsers = local.filter((task) => task.user_id !== userId);
  const acceptedRemote = remote.filter((task) => !queuedIds.has(task.id));
  return [...otherUsers, ...acceptedRemote, ...localPending];
}
