import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Calendar from 'expo-calendar';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/src/components/button';
import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/hooks/use-auth';
import { useEntitlement } from '@/src/hooks/use-entitlement';
import { clearLocalAccountState, exportAccountData, deleteAccount } from '@/src/services/account';
import { supabase } from '@/src/lib/supabase';
import { readLastNightSleep } from '@/src/native/health';
import { useDayStore } from '@/src/stores/day-store';
import { captureError } from '@/src/services/telemetry';
import { colors, radius, spacing } from '@/src/theme/tokens';
import type { Observation } from '@/src/types/domain';

type ProfileSettings = { work_start: number; work_end: number; morning_hour: number; night_hour: number };

export default function YouScreen() {
  const { user } = useAuth();
  const access = useEntitlement(user?.id);
  const client = useQueryClient();
  const setSleep = useDayStore((state) => state.setSleep);
  const [hours, setHours] = useState<ProfileSettings>({ work_start: 9, work_end: 18, morning_hour: 7, night_hour: 21 });
  const [routine, setRoutine] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'export' | 'delete' | 'save' | null>(null);
  const profile = useQuery({
    queryKey: ['profile-settings', user?.id], enabled: Boolean(user),
    queryFn: async () => { const { data, error } = await supabase.from('profiles').select('work_start, work_end, morning_hour, night_hour').eq('id', user!.id).single(); if (error) throw error; return data as ProfileSettings; },
  });
  const observations = useQuery({
    queryKey: ['you-observations', user?.id], enabled: Boolean(user),
    queryFn: async () => { const { data, error } = await supabase.from('observations').select('*').eq('user_id', user!.id).is('dismissed_at', null).order('updated_at', { ascending: false }); if (error) throw error; return (data ?? []) as Observation[]; },
  });
  const routines = useQuery({
    queryKey: ['routine-items', user?.id], enabled: Boolean(user),
    queryFn: async () => { const { data, error } = await supabase.from('routine_items').select('*').eq('user_id', user!.id).eq('active', true).order('sort_order'); if (error) throw error; return data ?? []; },
  });
  const permissions = useQuery({
    queryKey: ['permission-status', user?.id], enabled: Boolean(user),
    queryFn: async () => {
      const calendar = await Calendar.getCalendarPermissionsAsync();
      const { data } = await supabase.from('day_signals').select('sleep_source').eq('user_id', user!.id).not('sleep_source', 'is', null).order('day', { ascending: false }).limit(1).maybeSingle();
      return { calendar: calendar.granted ? 'Connected' : 'Not connected', health: data?.sleep_source === 'healthkit' || data?.sleep_source === 'health_connect' ? 'Connected' : 'Not connected or no data' };
    },
  });
  const corrections = useQuery({
    queryKey: ['correction-count', user?.id], enabled: Boolean(user),
    queryFn: async () => { const { count, error } = await supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).not('correction_type', 'is', null); if (error) throw error; return count ?? 0; },
  });

  useEffect(() => { if (profile.data) setHours(profile.data); }, [profile.data]);

  async function saveHours() {
    if (!user) return;
    setBusy('save'); setMessage('');
    const { error } = await supabase.from('profiles').update(hours).eq('id', user.id);
    setBusy(null); setMessage(error ? 'Hours could not be saved.' : 'Hours saved.');
  }
  async function addRoutine() {
    if (!user || !routine.trim()) return;
    const { error } = await supabase.from('routine_items').insert({ user_id: user.id, label: routine.trim(), sort_order: routines.data?.length ?? 0 });
    if (!error) { setRoutine(''); await routines.refetch(); }
  }
  async function dismissObservation(id: string) {
    await supabase.from('observations').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
    await observations.refetch();
  }
  async function connectCalendar() { await Calendar.requestCalendarPermissionsAsync(); await permissions.refetch(); }
  async function connectHealth() {
    if (!user) return;
    const result = await readLastNightSleep();
    if (result.ok) { await setSleep(user.id, result.minutes, result.source); setMessage('Health sleep is connected.'); }
    else setMessage(result.reason === 'no_data' ? 'Health access is set, but last night had no sleep sample.' : 'Health access was unavailable or not granted. Manual sleep still works.');
    await permissions.refetch();
  }
  async function exportData() {
    setBusy('export'); setMessage('');
    try { await exportAccountData(user?.email); setMessage('Your JSON export is ready in the mail or share sheet.'); }
    catch (error) { captureError(error); setMessage('The export could not be opened on this device.'); }
    finally { setBusy(null); }
  }
  function confirmDelete() {
    Alert.alert('Delete your account?', 'This permanently deletes your login and all One Thing data. It cannot be undone.', [{ text: 'Keep account' }, { text: 'Delete permanently', style: 'destructive', onPress: () => void removeAccount() }]);
  }
  async function removeAccount() {
    setBusy('delete'); setMessage('');
    try { await deleteAccount(); router.replace('/onboarding'); }
    catch (error) { captureError(error); setMessage('Deletion did not complete. Your account is still intact.'); setBusy(null); }
  }
  async function signOut() { await supabase.auth.signOut(); await clearLocalAccountState(); client.clear(); }

  return (
    <Screen eyebrow="Your controls" title="You">
      <View style={styles.card}><Text style={styles.label}>SIGNED IN AS</Text><Text style={styles.email}>{user?.email}</Text><Text style={styles.meta}>{access.active ? 'Pro active' : access.expired ? 'Free reader · trial ended' : `Free trial · ${access.daysLeft} days left`}</Text>{!access.active ? <Button variant="secondary" onPress={() => router.push('/paywall')}>See Pro</Button> : null}</View>

      <Text style={styles.section}>WHAT I HAVE LEARNED</Text>
      {observations.data?.length ? observations.data.map((item) => <View key={item.id} style={styles.card}><Text style={styles.cardTitle}>{item.label}</Text><Text style={styles.body}>{item.value}</Text><Text style={styles.meta}>{item.evidence_count} evidence · {item.source === 'corrected' ? 'you corrected me' : item.source === 'stated' ? 'you told me' : 'I noticed'} · {item.confidence}</Text><Button variant="ghost" onPress={() => void dismissObservation(item.id)}>Remove this observation</Button></View>) : <View style={styles.card}><Text style={styles.body}>No active observations yet. Inferred patterns wait for the evidence gate.</Text></View>}
      <Text style={styles.correctionCount}>{corrections.data ?? 0} corrections have shaped the decision record.</Text>

      <Text style={styles.section}>CONNECTIONS</Text>
      <View style={styles.card}><SettingRow label="Calendar" value={permissions.data?.calendar ?? 'Checking…'} onPress={() => void connectCalendar()} /><SettingRow label="Sleep health" value={permissions.data?.health ?? 'Checking…'} onPress={() => void connectHealth()} /></View>

      <Text style={styles.section}>DAY BOUNDARIES</Text>
      <View style={styles.card}>{(['work_start', 'work_end', 'morning_hour', 'night_hour'] as const).map((key) => <View key={key} style={styles.hourRow}><Text style={styles.hourLabel}>{key.replace('_', ' ')}</Text><View style={styles.hourControls}><Pressable accessibilityLabel={`Earlier ${key}`} onPress={() => setHours((current) => ({ ...current, [key]: (current[key] + 23) % 24 }))} style={styles.hourButton}><Text style={styles.hourButtonText}>−</Text></Pressable><Text style={styles.hour}>{String(hours[key]).padStart(2, '0')}:00</Text><Pressable accessibilityLabel={`Later ${key}`} onPress={() => setHours((current) => ({ ...current, [key]: (current[key] + 1) % 24 }))} style={styles.hourButton}><Text style={styles.hourButtonText}>+</Text></Pressable></View></View>)}<Button loading={busy === 'save'} onPress={() => void saveHours()}>Save hours</Button></View>

      <Text style={styles.section}>NIGHT ROUTINE</Text>
      <View style={styles.card}>{routines.data?.map((item) => <View key={item.id} style={styles.routineRow}><Text style={styles.routineText}>{item.label}</Text><Pressable accessibilityLabel={`Remove ${item.label}`} onPress={async () => { await supabase.from('routine_items').update({ active: false }).eq('id', item.id); await routines.refetch(); }}><Text style={styles.remove}>Remove</Text></Pressable></View>)}<TextInput accessibilityLabel="New routine item" onChangeText={setRoutine} placeholder="Read, stretch, prep tomorrow…" placeholderTextColor={colors.muted} style={styles.input} value={routine} /><Button disabled={!routine.trim()} variant="secondary" onPress={() => void addRoutine()}>Add routine item</Button></View>

      <Text style={styles.section}>PRIVACY & DATA</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>Your data stays yours.</Text><Text style={styles.body}>No ads and no sale of personal data. Raw health records never leave the health store; only sleep duration is saved. Free text goes to Anthropic only when you ask for parsing or an AI action. RevenueCat receives the app user ID and purchase state. Sentry and PostHog receive allowlisted technical events—never task text, prompts, health values, email, or touch recordings.</Text></View>
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      <Button loading={busy === 'export'} variant="secondary" onPress={() => void exportData()}>Email my JSON export</Button>
      <Button variant="secondary" onPress={() => void signOut()}>Sign out</Button>
      <Button loading={busy === 'delete'} variant="danger" onPress={confirmDelete}>Delete account and data</Button>
    </Screen>
  );
}

function SettingRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.settingRow}><View><Text style={styles.settingLabel}>{label}</Text><Text style={styles.meta}>{value}</Text></View><Text style={styles.change}>Change</Text></Pressable>; }

const styles = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.sm }, label: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, email: { color: colors.ink, fontSize: 18, fontWeight: '800' }, section: { color: colors.moss, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginTop: spacing.lg, marginBottom: spacing.sm }, cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' }, body: { color: colors.muted, fontSize: 15, lineHeight: 23 }, meta: { color: colors.muted, fontSize: 11, lineHeight: 17 }, correctionCount: { color: colors.muted, fontSize: 12, marginBottom: spacing.sm },
  settingRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line }, settingLabel: { color: colors.ink, fontSize: 15, fontWeight: '800' }, change: { color: colors.moss, fontSize: 12, fontWeight: '900' },
  hourRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, hourLabel: { color: colors.ink, fontSize: 14, fontWeight: '700', textTransform: 'capitalize' }, hourControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, hourButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, hourButtonText: { color: colors.ink, fontSize: 20 }, hour: { color: colors.ink, width: 48, textAlign: 'center', fontVariant: ['tabular-nums'], fontWeight: '800' },
  routineRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line }, routineText: { color: colors.ink, fontSize: 14, fontWeight: '700', flex: 1 }, remove: { color: colors.danger, fontSize: 12, fontWeight: '800' }, input: { minHeight: 52, color: colors.ink, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, fontSize: 15 }, message: { color: colors.danger, fontSize: 13, lineHeight: 20, marginVertical: spacing.sm },
});
