// §9 Timer: work block → 5-min break → active return. Writes a sessions row on stop.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BREAK_MINS } from '@/engine';
import { track } from '@/lib/analytics';
import { scheduleBreakOver } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { c, t } from '@/lib/theme';
import { today, useLocal } from '@/store/local';

export default function Timer() {
  const router = useRouter();
  const { taskId, mins } = useLocalSearchParams<{ taskId: string; mins: string }>();
  const planned = Number(mins) || 45;
  const userId = useLocal((s) => s.userId);
  const tasks = useLocal((s) => s.tasks);
  const title = tasks.find((x) => x.id === taskId)?.title ?? 'your task';

  const [phase, setPhase] = useState<'work' | 'break'>('work');
  const [left, setLeft] = useState(planned * 60);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    track('session_started');
    const iv = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (left > 0) return;
    if (phase === 'work') {
      void writeSession(true);
      scheduleBreakOver(BREAK_MINS * 60, title);
      setPhase('break');
      setLeft(BREAK_MINS * 60);
    }
  }, [left, phase]);

  async function writeSession(completed: boolean) {
    const actual = Math.round((Date.now() - startedAt.current) / 60000);
    if (userId)
      await supabase.from('sessions').insert({
        user_id: userId,
        task_id: taskId,
        day: today(),
        planned_mins: planned,
        actual_mins: actual,
        completed,
      });
    if (completed) track('session_completed');
  }

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <SafeAreaView style={styles.screen}>
      {phase === 'break' && (
        <View style={styles.banner}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Break — back to {title} soon.</Text>
        </View>
      )}
      <View style={styles.center}>
        <Text style={t.dim}>{phase === 'work' ? title : 'Break'}</Text>
        <Text style={styles.clock}>{mm}:{ss}</Text>
        <Pressable
          style={styles.stop}
          onPress={async () => {
            await writeSession(phase === 'work' ? left === 0 : true);
            router.back();
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Stop</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  clock: { fontSize: 72, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] },
  stop: { backgroundColor: c.bad, borderRadius: 12, paddingHorizontal: 40, paddingVertical: 14 },
  banner: { backgroundColor: c.accent, padding: 14, alignItems: 'center' },
});
