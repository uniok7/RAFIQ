import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/src/components/button';
import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/hooks/use-auth';
import { readLastNightSleep } from '@/src/native/health';
import { daySignalKey, useDayStore } from '@/src/stores/day-store';
import { localDay } from '@/src/lib/dates';
import { correctLatest } from '@/src/services/corrections';
import { colors, radius, spacing } from '@/src/theme/tokens';

const reasons = { unsupported: 'Health sleep data is not available on this platform.', unavailable: 'Health Connect is unavailable or needs an update.', permission_denied: 'Sleep permission was not granted. Manual entry still works.', no_data: 'No usable sleep was found for last night. You can enter it below.', read_failed: 'The sleep read did not go through. Manual entry still works.' } as const;

export default function SleepScreen() {
  const { user } = useAuth();
  const setSleep = useDayStore((state) => state.setSleep);
  const existing = useDayStore((state) => user ? state.signals[daySignalKey(user.id)] : undefined);
  const [hours, setHours] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function save(minutes: number, source: 'healthkit' | 'health_connect' | 'manual') {
    if (!user) return;
    const correctedFact = source === 'manual' && existing?.sleep_mins != null && existing.sleep_mins !== minutes;
    await setSleep(user.id, minutes, source);
    if (correctedFact) void correctLatest({ day: localDay(), recommendationType: 'energy', correctionType: 'wrong_fact', correctedTo: { sleepMins: minutes }, payloadContains: { sleepMins: existing.sleep_mins } }).catch(() => undefined);
    router.back();
  }

  async function readHealth() {
    setLoading(true);
    setMessage('');
    const result = await readLastNightSleep();
    if (result.ok) await save(result.minutes, result.source);
    else setMessage(reasons[result.reason]);
    setLoading(false);
  }

  const parsed = Number(hours);
  const valid = parsed > 0 && parsed <= 18;
  return (
    <Screen eyebrow="Last night" title="Sleep">
      <View style={styles.card}><Text style={styles.title}>I’ll use this to decide how hard to push—not to grade you.</Text><Text style={styles.body}>Only sleep duration is read, between 6pm yesterday and noon today. You can always replace it.</Text><Button loading={loading} onPress={readHealth}>Read from health</Button>{message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}</View>
      <View style={styles.manual}><Text style={styles.label}>OR ENTER IT YOURSELF</Text><View style={styles.inputRow}><TextInput accessibilityLabel="Hours slept" keyboardType="decimal-pad" onChangeText={setHours} placeholder="7.5" placeholderTextColor={colors.muted} style={styles.input} value={hours} /><Text style={styles.unit}>hours</Text></View><Button variant="secondary" disabled={!valid} onPress={() => save(Math.round(parsed * 60), 'manual')}>Use manual sleep</Button></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.moss, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg },
  title: { color: colors.white, fontSize: 25, lineHeight: 32, fontWeight: '900' }, body: { color: colors.mossSoft, fontSize: 16, lineHeight: 24 },
  message: { color: colors.white, fontSize: 14, lineHeight: 21 },
  manual: { marginTop: spacing.xl, gap: spacing.md }, label: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, input: { flex: 1, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, color: colors.ink, fontSize: 30, fontWeight: '800', padding: spacing.md },
  unit: { color: colors.muted, fontSize: 17 },
});
