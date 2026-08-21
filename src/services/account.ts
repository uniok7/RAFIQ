import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';

import { localDay } from '@/src/lib/dates';
import { supabase } from '@/src/lib/supabase';
import { resetTelemetry } from '@/src/services/telemetry';
import { useCorrectionStore } from '@/src/stores/correction-store';
import { useDayStore } from '@/src/stores/day-store';
import { useOnboardingStore } from '@/src/stores/onboarding-store';
import { useTaskStore } from '@/src/stores/task-store';
import { useTimerStore } from '@/src/stores/timer-store';

const exportTables = ['profiles', 'goals', 'tasks', 'sessions', 'day_signals', 'recommendations', 'observations', 'routine_items', 'routine_checks', 'user_entitlements'] as const;

async function allRows(table: (typeof exportTables)[number]) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function exportAccountData(email?: string) {
  const entries = await Promise.all(exportTables.map(async (table) => [table, await allRows(table)] as const));
  const file = new File(Paths.cache, `one-thing-export-${localDay()}.json`);
  file.write(JSON.stringify({ exported_at: new Date().toISOString(), data: Object.fromEntries(entries) }, null, 2));
  if (await MailComposer.isAvailableAsync()) {
    await MailComposer.composeAsync({
      recipients: email ? [email] : [],
      subject: 'Your One Thing data export',
      body: 'Your complete One Thing JSON export is attached. It was created on this device.',
      attachments: [file.uri],
    });
  } else if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export your One Thing data' });
  } else throw new Error('export_share_unavailable');
}

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('account', { method: 'DELETE' });
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
  await clearLocalAccountState();
}

export async function clearLocalAccountState() {
  await useTimerStore.getState().stop().catch(() => undefined);
  useTimerStore.getState().returnToTask();
  resetTelemetry();
  await AsyncStorage.clear();
  useTaskStore.setState({ tasks: [], queue: [], syncing: false });
  useDayStore.setState({ signals: {} });
  useCorrectionStore.setState({ days: {} });
  useOnboardingStore.getState().reset();
}
