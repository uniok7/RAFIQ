import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/src/components/button';
import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/hooks/use-auth';
import { useTimerClock } from '@/src/hooks/use-timer-clock';
import { useTaskStore } from '@/src/stores/task-store';
import { useTimerStore } from '@/src/stores/timer-store';
import { colors, radius, spacing } from '@/src/theme/tokens';
import { track } from '@/src/services/telemetry';

function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function TimerScreen() {
  const params = useLocalSearchParams<{ taskId?: string; minutes?: string }>();
  const { user } = useAuth();
  const tasks = useTaskStore((state) => state.tasks);
  const storedTaskId = useTimerStore((state) => state.taskId);
  const taskTitle = useTimerStore((state) => state.taskTitle);
  const start = useTimerStore((state) => state.start);
  const finishWork = useTimerStore((state) => state.finishWork);
  const stop = useTimerStore((state) => state.stop);
  const interrupt = useTimerStore((state) => state.interrupt);
  const interruptions = useTimerStore((state) => state.interruptions);
  const returnToTask = useTimerStore((state) => state.returnToTask);
  const { phase, remainingSeconds } = useTimerClock();
  const [error, setError] = useState('');
  const task = useMemo(() => tasks.find((item) => item.id === (params.taskId ?? storedTaskId)), [params.taskId, storedTaskId, tasks]);
  const minutes = Math.max(1, Number(params.minutes) || 45);

  useEffect(() => {
    if (phase !== 'idle' || !task || !user) return;
    void start(task, user.id, minutes).then(() => track('session_started', { plannedMins: minutes })).catch(() => setError('The timer started, but the session could not sync yet.'));
  }, [minutes, phase, start, task, user]);

  const label = phase === 'work' ? 'FOCUS BLOCK' : phase === 'break' ? 'FIVE-MINUTE BREAK' : 'BREAK’S OVER';
  const title = phase === 'break' ? 'Step away. Come back clean.' : taskTitle ?? task?.title ?? 'Choose a task first';

  async function stopEarly() {
    await stop().catch(() => setError('The session is saved on this device but has not synced.'));
    track('session_completed', { plannedMins: minutes, completed: false });
    router.back();
  }

  return (
    <Screen scroll={false}>
      <View style={styles.top}><Pressable accessibilityLabel="Close timer" onPress={() => Alert.alert('Stop this block?', 'Your actual time will still be saved.', [{ text: 'Keep working' }, { text: 'Stop', style: 'destructive', onPress: () => void stopEarly() }])} style={styles.close}><Ionicons color={colors.ink} name="close" size={26} /></Pressable><Text style={styles.label}>{label}</Text><View style={styles.close} /></View>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        <Text accessibilityLabel={`${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds remaining`} style={styles.clock}>{phase === 'return' ? '00:00' : clock(remainingSeconds)}</Text>
        <Text style={styles.sub}>{phase === 'work' ? 'One task. Notifications can wait.' : phase === 'break' ? 'No inbox. No next task. Just five.' : 'The next move is the same task.'}</Text>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.actions}>
        {phase === 'work' ? <><Button onPress={async () => { await finishWork(); track('session_completed', { plannedMins: minutes, completed: true }); }}>Finish block</Button><Button variant="secondary" onPress={interrupt}>I was interrupted · {interruptions}</Button></> : null}
        {phase === 'break' ? <Button variant="secondary" onPress={() => { returnToTask(); router.back(); }}>Return early</Button> : null}
        {phase === 'return' ? <Button onPress={() => { returnToTask(); router.back(); }}>Back to task</Button> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  label: { color: colors.moss, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 26, lineHeight: 32, fontWeight: '900', textAlign: 'center', maxWidth: 330 },
  clock: { color: colors.ink, fontSize: 80, lineHeight: 92, letterSpacing: -4, fontVariant: ['tabular-nums'], fontWeight: '300', marginVertical: spacing.lg },
  sub: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  error: { color: colors.danger, backgroundColor: '#F8E4DE', borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md },
  actions: { gap: spacing.sm, paddingBottom: spacing.xl },
});
