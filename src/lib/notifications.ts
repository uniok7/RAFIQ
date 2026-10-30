// §10 Notifications: local only, hard cap 3/day. No streaks, no re-engagement.
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Reschedule the day's fixed notifications. Cancels first so the 3/day cap holds. */
export async function scheduleDaily(opts: {
  morningHour: number;
  nightHour: number;
  mainWinTitle: string;
  doneRatio?: string;
}): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Morning: main win in the body so it's useful without opening the app (§10).
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Today', body: `Main win: ${opts.mainWinTitle}` },
    trigger: { hour: opts.morningHour, minute: 0, repeats: true },
  });

  // Night: close the day, with the done ratio.
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Close the day?', body: opts.doneRatio ?? '' },
    trigger: { hour: opts.nightHour, minute: 0, repeats: true },
  });
}

/** Break-over: fires once, when the break timer ends (the 3rd of the daily cap). */
export async function scheduleBreakOver(inSeconds: number, taskTitle: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: "Break's over.", body: `Back to ${taskTitle}.` },
    trigger: { seconds: Math.max(1, Math.round(inSeconds)) },
  });
}
