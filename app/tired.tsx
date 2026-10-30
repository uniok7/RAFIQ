// §6/§10 Tired sheet. One sentence from the deterministic ladder, three actions.
// No scrolling, no list of causes. "Push through anyway" must always exist (§6).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tiredLadder } from '@/engine';
import { track } from '@/lib/analytics';
import { recordRecommendation } from '@/lib/recommendations';
import { supabase } from '@/lib/supabase';
import { c, radius, t } from '@/lib/theme';
import { today, useLocal } from '@/store/local';

export default function TiredSheet() {
  const router = useRouter();
  const store = useLocal();
  const day = today();
  const { trigger = 'chat', sessionMins } = useLocalSearchParams<{ trigger?: string; sessionMins?: string }>();
  const [logged, setLogged] = useState(false);

  // A tired report happened — bump today's counter once (feeds ladder rule 7).
  useEffect(() => {
    if (logged) return;
    setLogged(true);
    const sig = store.daySignals.find((d) => d.day === day);
    const count = (sig?.tired_reports ?? 0) + 1;
    const next = sig
      ? store.daySignals.map((d) => (d.day === day ? { ...d, tired_reports: count } : d))
      : [{ day, sleep_mins: null, sleep_quality: null, sleep_source: null, energy_stated: null, mood: null, tired_reports: count, planned_count: 0, completed_count: 0 }, ...store.daySignals];
    useLocal.setState({ daySignals: next });
    store.enqueue({ table: 'day_signals', type: 'upsert', row: { day, tired_reports: count } });
  }, [logged]);

  const result = useMemo(
    () =>
      tiredLadder(store.engineState(), day, {
        now: new Date().toISOString(),
        currentSessionMins: sessionMins ? Number(sessionMins) : undefined,
      }),
    [day],
  );

  // Log the tired recommendation (DoD: every shown recommendation has a row).
  useEffect(() => {
    if (!store.userId) return;
    void recordRecommendation({
      userId: store.userId,
      day,
      type: 'tired',
      payload: { rule: result.rule, trigger },
      reasoning: result.sentence,
    });
    track('tired_reported', result.rule ? { rule: result.rule } : {});
  }, [store.userId]);

  function act(action: 'shorten' | 'stop' | 'push') {
    if (store.userId)
      void supabase.from('tired_events').insert({
        user_id: store.userId,
        day,
        trigger,
        explanation_rule: result.rule,
        action_taken: action,
      });
    router.back();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={[t.title, { textAlign: 'center' }]}>{result.sentence}</Text>
      </View>
      <View style={styles.actions}>
        <Action label="Shorten today" onPress={() => act('shorten')} />
        <Action label="Stop for today" onPress={() => act('stop')} />
        <Action label="Push through anyway" onPress={() => act('push')} subtle />
      </View>
    </SafeAreaView>
  );
}

function Action({ label, onPress, subtle }: { label: string; onPress: () => void; subtle?: boolean }) {
  return (
    <Pressable style={[styles.action, subtle && styles.subtle]} onPress={onPress} accessibilityRole="button">
      <Text style={{ color: c.text, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg, justifyContent: 'space-between' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  actions: { padding: 20, gap: 12 },
  action: { backgroundColor: c.card, borderRadius: radius.md, padding: 16, borderColor: c.line, borderWidth: 1 },
  subtle: { backgroundColor: 'transparent' },
});
