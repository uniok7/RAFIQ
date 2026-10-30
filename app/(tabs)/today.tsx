import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { plan, dailyGap, foodNudges, formatDuration, nudgeLoadWeight, patternsUnlocked } from '@/engine';
import type { SleepQuality } from '@/engine';
import { supabase } from '@/lib/supabase';
import { CorrectableClaim } from '@/components/CorrectableClaim';
import { EmptyState } from '@/components/EmptyState';
import { ProgressRing } from '@/components/ProgressRing';
import { track } from '@/lib/analytics';
import { ensurePermission, scheduleDaily } from '@/lib/notifications';
import { recordCorrection, recordRecommendation } from '@/lib/recommendations';
import { c, grad, radius, t } from '@/lib/theme';
import { today, useLocal } from '@/store/local';

export default function Today() {
  const router = useRouter();
  const store = useLocal();
  const day = today();

  const p = useMemo(() => plan(store.engineState(), day), [store.tasks, store.daySignals, store.demotedTaskIds, day]);
  const signal = store.daySignals.find((d) => d.day === day);
  const [editingSleep, setEditingSleep] = useState(false);
  const [sleepInput, setSleepInput] = useState('');

  // DoD: every recommendation shown gets a row with its reasoning. Both the main win
  // and the energy call are logged — the energy row is what a wrong_inference correction
  // attaches to, which drives the 3-strikes softening (§5.2 / §5.7 / §8.4).
  useEffect(() => {
    if (!store.userId) return;
    void recordRecommendation({
      userId: store.userId,
      day,
      type: 'energy',
      payload: { energy: p.energy, source: p.energySource },
      reasoning: p.energyReasoning,
    });
    if (p.mainWin)
      void recordRecommendation({
        userId: store.userId,
        day,
        type: 'main_win',
        payload: { taskId: p.mainWin.id, blockMins: p.blockMins },
        reasoning: p.reasoning,
      });
  }, [store.userId, p.mainWin?.id, p.energy]);

  // §10: schedule the day's morning + night notifications (morning body = main win).
  // Cancels-and-reschedules internally, so the 3/day cap holds. ponytail: default hours 7/21; read profile when it lands.
  useEffect(() => {
    if (!p.mainWin) return;
    const ratio = signal ? `${signal.completed_count}/${signal.planned_count} done` : '';
    void ensurePermission().then((ok) => {
      if (ok) void scheduleDaily({ morningHour: 7, nightHour: 21, mainWinTitle: p.mainWin!.title, doneRatio: ratio });
    });
  }, [p.mainWin?.id, signal?.completed_count]);

  if (!p.mainWin) {
    return (
      <SafeAreaView style={styles.screen}>
        <EmptyState counter="Nothing open yet." hint="Add the one thing you have to get done today." />
        <AddButton onPress={() => router.push('/(tabs)/assistant')} />
      </SafeAreaView>
    );
  }

  const doneRatio = signal ? `${signal.completed_count}/${signal.planned_count}` : '—';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        {/* readout strip. Sleep is tappable to edit the number inline (§7 wrong_fact, §11 manual). */}
        <View style={styles.strip}>
          <Pressable
            onPress={() => {
              setSleepInput(signal?.sleep_mins ? String(signal.sleep_mins) : '');
              setEditingSleep((e) => !e);
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit last night's sleep"
          >
            <Readout label="Sleep ✎" value={signal?.sleep_mins ? formatDuration(signal.sleep_mins) : '—'} />
          </Pressable>
          <Readout label="Energy" value={p.energy} />
          <Readout label="Block" value={`${p.blockMins}m`} />
          <View style={{ alignItems: 'center', gap: 2 }}>
            <ProgressRing
              size={44}
              stroke={5}
              color={c.good}
              progress={signal && signal.planned_count ? signal.completed_count / signal.planned_count : 0}
              value={doneRatio === '—' ? '' : doneRatio}
            />
            <Text style={t.label}>DONE</Text>
          </View>
        </View>
        {editingSleep && (
          <View style={styles.sleepEdit}>
            <TextInput
              style={styles.sleepInput}
              keyboardType="number-pad"
              placeholder="minutes asleep"
              placeholderTextColor={c.dim}
              value={sleepInput}
              onChangeText={setSleepInput}
              autoFocus
            />
            <Pressable
              style={styles.saveSleep}
              onPress={() => {
                const mins = parseInt(sleepInput, 10);
                if (Number.isFinite(mins) && mins > 0) setSleep(mins);
                setEditingSleep(false);
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
            </Pressable>
          </View>
        )}

        {/* §10 sleep-quality pills — only while unset for a night with sleep data */}
        {signal?.sleep_mins != null && !signal.sleep_quality && (
          <View style={{ gap: 8 }}>
            <Text style={t.label}>HOW DID IT FEEL?</Text>
            <View style={styles.pills}>
              {(['broken', 'poor', 'ok', 'solid'] as SleepQuality[]).map((q) => (
                <Pressable key={q} style={styles.pill} onPress={() => upsertSignal({ sleep_quality: q })}>
                  <Text style={{ color: c.text }}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* §5.7: once the user has overridden the low-energy call 3× we stop lowering
            load automatically — and say so here, not just buried on You. */}
        {(() => {
          const stop = store.observations.find((o) => o.key === 'short_nights' && !o.dismissed_at);
          return stop ? (
            <View style={styles.stopBanner}>
              <Text style={{ color: c.text }}>{stop.value}</Text>
            </View>
          ) : null;
        })()}

        {/* energy claim — correctable (wrong_inference, §7) */}
        <CorrectableClaim
          text={p.energyReasoning}
          corrections={[
            { label: "I'm fine actually", onPick: () => setEnergy('normal') },
            { label: 'Worse than that', onPick: () => setEnergy('low') },
          ]}
        />

        {/* the one task, at display size (§9) */}
        <View>
          <Text style={t.dim}>Main win</Text>
          <Text style={[t.hero, { marginTop: 6 }]}>{p.mainWin.title}</Text>
        </View>

        {/* tappable reasoning (wrong_priority, §7) */}
        <CorrectableClaim
          text={p.reasoning}
          large
          corrections={[
            {
              label: 'Not this one',
              onPick: () => {
                const id = p.mainWin!.id;
                const replacement = p.alsoToday[0]; // next candidate becomes the new main win
                store.demoteToday(id);
                track('main_win_corrected');
                // §5.6: nudge load weight toward the load the user preferred, persist.
                // ponytail: single clamped 0.05 step per demote; the clamp keeps it from overshooting a one-off.
                if (replacement && replacement.cognitive_load !== p.mainWin!.cognitive_load) {
                  const weights = nudgeLoadWeight(store.weights, p.mainWin!.cognitive_load, replacement.cognitive_load);
                  useLocal.setState({ weights });
                  if (store.userId)
                    void supabase.from('profiles').update({ engine_weights: weights }).eq('id', store.userId);
                }
                if (store.userId)
                  void recordCorrection({
                    userId: store.userId,
                    day,
                    type: 'main_win',
                    accepted: false,
                    correctionType: 'wrong_priority',
                    correctedTo: { demoted: id },
                  });
              },
            },
          ]}
        />

        {/* §7 food nudges (borrowed priors, only when commentary is on) */}
        {store.foodCommentaryEnabled &&
          foodNudges(store.engineState(), day, new Date().toISOString()).map((n, i) => (
            <Text key={i} style={t.dim}>🍽 {n}</Text>
          ))}

        {/* §7 daily gap check, surfaced after 18:00 with 2+ meals */}
        {store.foodCommentaryEnabled && new Date().getHours() >= 18 && (() => {
          const gap = dailyGap(store.meals.filter((m) => m.day === day));
          return gap ? <Text style={t.dim}>🍽 {gap}</Text> : null;
        })()}

        {/* timer card */}
        <Pressable
          onPress={() => {
            track('main_win_accepted');
            router.push({ pathname: '/timer', params: { taskId: p.mainWin!.id, mins: p.blockMins } });
          }}
        >
          <LinearGradient colors={grad.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.timerCard}>
            <Text style={[t.h2, { color: '#fff' }]}>Start {p.blockMins}-minute block</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)' }}>then a {p.breakMins}-minute break</Text>
          </LinearGradient>
        </Pressable>

        {/* §10 food row + tired affordance */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={styles.rowBtn} onPress={() => router.push('/(tabs)/assistant')}>
            <Text style={{ color: c.text }}>🍽 Log a meal ({store.meals.filter((m) => m.day === day).length})</Text>
          </Pressable>
          <Pressable style={styles.rowBtn} onPress={() => router.push('/tired?trigger=reset')}>
            <Text style={{ color: c.text }}>Feeling tired?</Text>
          </Pressable>
        </View>

        {/* also today — max two (§9) */}
        {p.alsoToday.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={t.dim}>Also today</Text>
            {p.alsoToday.map((task) => (
              <View key={task.id} style={styles.alsoRow}>
                <Text style={t.body}>{task.title}</Text>
              </View>
            ))}
          </View>
        )}

        {!patternsUnlocked(store.engineState()) && (
          <Text style={t.dim}>Patterns unlock at 15 days of data.</Text>
        )}
      </ScrollView>
      <AddButton onPress={() => router.push('/(tabs)/assistant')} />
    </SafeAreaView>
  );

  function upsertSignal(patch: Partial<(typeof store.daySignals)[number]>) {
    const existing = store.daySignals.find((d) => d.day === day);
    const next = existing
      ? store.daySignals.map((d) => (d.day === day ? { ...d, ...patch } : d))
      : [{ day, sleep_mins: null, sleep_quality: null, sleep_source: null, energy_stated: null, mood: null, tired_reports: 0, planned_count: 0, completed_count: 0, ...patch }, ...store.daySignals];
    useLocal.setState({ daySignals: next });
    store.enqueue({ table: 'day_signals', type: 'upsert', row: { day, ...patch } });
  }

  function setEnergy(energy: 'low' | 'normal' | 'high') {
    upsertSignal({ energy_stated: energy });
    if (store.userId)
      void recordCorrection({
        userId: store.userId,
        day,
        type: 'energy',
        accepted: false,
        correctionType: 'wrong_inference',
        correctedTo: { energy },
      });
  }

  function setSleep(mins: number) {
    // §7 wrong_fact: correct the fact only, no learning. §11 manual fallback / override.
    upsertSignal({ sleep_mins: mins, sleep_source: 'manual' });
  }
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={t.dim}>{label}</Text>
      <Text style={t.body}>{value}</Text>
    </View>
  );
}

function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.add} onPress={onPress} accessibilityRole="button" accessibilityLabel="Add a task">
      <LinearGradient colors={grad.accent} style={styles.addInner}>
        <Text style={{ color: '#fff', fontSize: 28 }}>＋</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  strip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, borderRadius: radius.lg, padding: 16 },
  sleepEdit: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  sleepInput: { flex: 1, backgroundColor: c.card, borderRadius: 10, padding: 12, color: c.text, borderColor: c.line, borderWidth: 1 },
  saveSleep: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
  stopBanner: { backgroundColor: c.card, borderLeftColor: c.warn, borderLeftWidth: 3, borderRadius: 8, padding: 12 },
  pills: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, alignItems: 'center', backgroundColor: c.card, borderRadius: radius.pill, paddingVertical: 10, borderColor: c.line, borderWidth: 1 },
  rowBtn: { flex: 1, alignItems: 'center', backgroundColor: c.card, borderRadius: radius.md, paddingVertical: 14, borderColor: c.line, borderWidth: 1 },
  timerCard: { borderRadius: radius.lg, padding: 20, gap: 4 },
  alsoRow: { backgroundColor: c.card, borderRadius: radius.md, padding: 14 },
  add: { position: 'absolute', right: 20, bottom: 24, width: 58, height: 58 },
  addInner: { flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
});
