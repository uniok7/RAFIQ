import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { localDay } from '@/src/lib/dates';

const STORAGE_KEY = 'one-thing-scheduled-notifications-v1';
const CHANNEL = 'one-thing';

type Scheduled = { id: string; day: string; kind: 'morning' | 'break' | 'night'; reference?: string };

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

async function records(): Promise<Scheduled[]> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (!value) return [];
  try { return JSON.parse(value) as Scheduled[]; } catch { return []; }
}

async function save(value: Scheduled[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'One Thing', importance: Notifications.AndroidImportance.DEFAULT });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleCappedNotification(input: { kind: Scheduled['kind']; date: Date; title: string; body: string; reference?: string; data?: Record<string, string> }): Promise<string | null> {
  if (!(await ensureNotificationPermission())) return null;
  const day = localDay(input.date);
  let scheduled = (await records()).filter((item) => item.day >= localDay());
  const duplicate = scheduled.find((item) => item.kind === input.kind && item.reference === input.reference);
  if (duplicate) {
    await Notifications.cancelScheduledNotificationAsync(duplicate.id);
    scheduled = scheduled.filter((item) => item.id !== duplicate.id);
  }
  if (scheduled.filter((item) => item.day === day).length >= 3) return null;
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: input.title, body: input.body, data: input.data },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: input.date, channelId: CHANNEL },
  });
  await save([...scheduled, { id, day, kind: input.kind, reference: input.reference }]);
  return id;
}

export async function scheduleBreakOver(taskTitle: string, date: Date, sessionId: string) {
  return scheduleCappedNotification({ kind: 'break', date, reference: sessionId, title: 'Break’s over', body: `Back to ${taskTitle}.`, data: { url: '/timer', sessionId } });
}

function atHour(day: string, hour: number) {
  return new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);
}

export async function scheduleDailyPlanNotifications(input: { day: string; morningHour: number; nightHour: number; mainTitle: string; completedCount: number; plannedCount: number }) {
  const now = new Date();
  const morning = atHour(input.day, input.morningHour);
  const night = atHour(input.day, input.nightHour);
  if (morning > now) await scheduleCappedNotification({ kind: 'morning', date: morning, reference: input.day, title: 'Your one thing', body: input.mainTitle, data: { url: '/' } });
  if (night > now) await scheduleCappedNotification({ kind: 'night', date: night, reference: input.day, title: 'Close the day', body: `${input.completedCount}/${input.plannedCount} planned tasks done.`, data: { url: '/night-review' } });
}

export async function cancelNotification(id: string | null) {
  if (!id) return;
  await Notifications.cancelScheduledNotificationAsync(id);
  await save((await records()).filter((item) => item.id !== id));
}
