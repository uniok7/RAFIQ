// §9 Night review: routine, done ratio, tomorrow's first task, mood, roll forward.
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { computeObservations, plan, type Session } from '@/engine';
import { GradientCTA } from '@/components/GradientCTA';
import { Headline } from '@/components/Headline';
import { track } from '@/lib/analytics';
import { energyCorrectionCount } from '@/lib/recommendations';
import { fetchChecks, fetchRoutine, setCheck, type RoutineItem } from '@/lib/routines';
import { supabase } from '@/lib/supabase';
import { c, t } from '@/lib/theme';
import { today, useLocal } from '@/store/local';

const MOODS: Array<{ e: string; v: 'bad' | 'okay' | 'good' | 'great' }> = [
  { e: '😣', v: 'bad' },
  { e: '😐', v: 'okay' },
  { e: '🙂', v: 'good' },
  { e: '😄', v: 'great' },
];

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function NightReview() {
  const router = useRouter();
  const store = useLocal();
  const day = today();
  const [mood, setMood] = useState<'bad' | 'okay' | 'good' | 'great' | null>(null);
  const [routine, setRoutine] = useState<RoutineItem[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!store.userId) return;
    void fetchRoutine().then(setRoutine);
    void fetchChecks(day).then(setChecked);
  }, [store.userId, day]);

  async function toggleCheck(itemId: string) {
    const next = new Set(checked);
    const on = !next.has(itemId);
    on ? next.add(itemId) : next.delete(itemId);
    setChecked(next); // immediate update
    if (store.userId) await setCheck(store.userId, itemId, day, on);
  }

  const openToday = store.tasks.filter((x) => x.status === 'open' && x.due === day);
  const tomorrowPlan = useMemo(() => plan(store.engineState(), tomorrow()), [store.tasks]);

  async function finish() {
    // Roll incomplete tasks due today → tomorrow, reschedule_count + 1 (§9).
    for (const task of openToday) {
      store.updateTask(task.id, { due: tomorrow(), reschedule_count: task.reschedule_count + 1 });
    }

    const planned = store.tasks.filter((x) => x.due === day).length;
    const completed = store.tasks.filter((x) => x.due === day && x.status === 'done').length;

    if (store.userId) {
      await supabase.from('day_signals').upsert({
        user_id: store.userId,
        day,
        mood,
        planned_count: planned,
        completed_count: completed,
      });

      // Recompute observations nightly and upsert (§8). estimate_multiplier (§8.1)
      // needs completed sessions, which live server-side — hydrate them here, along
      // with the energy-correction count for short_nights (§8.4).
      const [{ data: sessions }, energyCorr] = await Promise.all([
        supabase.from('sessions').select('*').eq('user_id', store.userId),
        energyCorrectionCount(store.userId),
      ]);
      const fullState = { ...store.engineState(), sessions: (sessions as Session[]) ?? [] };
      const obs = computeObservations(fullState, { energyCorrectionCount: energyCorr, day });
      for (const o of obs) {
        await supabase.from('observations').upsert(
          { user_id: store.userId, ...o, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,key' },
        );
      }
    }

    track('night_review_completed');
    router.replace('/(tabs)/today');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        <Headline text="Close the {day}" />

        {routine.length > 0 && (
          <View style={styles.card}>
            <Text style={t.dim}>Routine</Text>
            {routine.map((it) => (
              <Pressable key={it.id} style={styles.checkRow} onPress={() => toggleCheck(it.id)} accessibilityRole="checkbox" accessibilityState={{ checked: checked.has(it.id) }}>
                <Text style={{ fontSize: 20 }}>{checked.has(it.id) ? '☑' : '☐'}</Text>
                <Text style={t.body}>{it.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={t.dim}>Done today</Text>
          <Text style={t.h2}>
            {store.tasks.filter((x) => x.due === day && x.status === 'done').length} /{' '}
            {store.tasks.filter((x) => x.due === day).length}
          </Text>
        </View>

        {tomorrowPlan.mainWin && (
          <View style={styles.card}>
            <Text style={t.dim}>Tomorrow, first thing</Text>
            <Text style={t.h2}>{tomorrowPlan.mainWin.title}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {MOODS.map((m) => (
            <Pressable key={m.v} onPress={() => setMood(m.v)} style={[styles.mood, mood === m.v && styles.moodOn]}>
              <Text style={{ fontSize: 32 }}>{m.e}</Text>
            </Pressable>
          ))}
        </View>

        <GradientCTA label="Done for today" onPress={finish} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  card: { backgroundColor: c.card, borderRadius: 12, padding: 16, gap: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  mood: { padding: 8, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  moodOn: { borderColor: c.accent, backgroundColor: c.card },
  btn: { backgroundColor: c.accent, borderRadius: 12, padding: 16 },
});
