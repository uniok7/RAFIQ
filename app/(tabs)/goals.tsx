import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/hooks/use-auth';
import { useTaskSync } from '@/src/hooks/use-task-sync';
import { supabase } from '@/src/lib/supabase';
import { useTaskStore } from '@/src/stores/task-store';
import { colors, radius, spacing } from '@/src/theme/tokens';
import type { Goal } from '@/src/types/domain';

export default function GoalsScreen() {
  const { user } = useAuth();
  useTaskSync(user?.id);
  const tasks = useTaskStore((state) => state.tasks).filter((task) => task.user_id === user?.id && task.status !== 'dropped');
  const completeTask = useTaskStore((state) => state.completeTask);
  const goals = useQuery({
    queryKey: ['goals', user?.id], enabled: Boolean(user),
    queryFn: async () => { const { data, error } = await supabase.from('goals').select('*').eq('user_id', user!.id).eq('status', 'active').order('created_at'); if (error) throw error; return (data ?? []) as Goal[]; },
  });
  const stuck = useMemo(() => tasks.filter((task) => task.status === 'open' && task.reschedule_count >= 3).sort((a, b) => b.reschedule_count - a.reschedule_count), [tasks]);

  return (
    <Screen eyebrow="Direction" title="Goals">
      {!goals.isLoading && !goals.data?.length ? <View style={styles.empty}><Text style={styles.number}>90</Text><Text style={styles.bigTitle}>No active goals yet.</Text><Text style={styles.body}>That is allowed. Today can still work bottom-up from one concrete task.</Text></View> : null}
      {goals.data?.map((goal) => {
        const goalTasks = tasks.filter((task) => task.goal_id === goal.id);
        const done = goalTasks.filter((task) => task.status === 'done').length;
        const progress = goalTasks.length ? done / goalTasks.length : 0;
        return <View key={goal.id} style={styles.goal}>
          <Text style={styles.horizon}>{goal.horizon_days} DAY DIRECTION</Text><Text style={styles.goalTitle}>{goal.title}</Text>{goal.why ? <Text style={styles.why}>{goal.why}</Text> : null}
          <View accessibilityLabel={`${done} of ${goalTasks.length} actions complete`} style={styles.track}><View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} /></View>
          <Text style={styles.progress}>{done}/{goalTasks.length} actions complete</Text>
          {goalTasks.filter((task) => task.status === 'open').map((task) => <Pressable accessibilityHint="Marks this action complete" accessibilityRole="button" key={task.id} onPress={() => completeTask(task.id)} style={styles.task}><View style={styles.check} /><View style={styles.taskCopy}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.estimate_mins} min · load {task.cognitive_load}{task.reschedule_count ? ` · moved ${task.reschedule_count}×` : ''}</Text></View></Pressable>)}
          {!goalTasks.length ? <Text style={styles.noTasks}>No actions attached yet.</Text> : null}
        </View>;
      })}
      {stuck.length ? <View style={styles.stuck}><Text style={styles.sectionLabel}>STUCK, NOT FAILED</Text>{stuck.map((task) => <View key={task.id} style={styles.stuckRow}><Text style={styles.stuckTitle}>{task.title}</Text><Text style={styles.stuckMeta}>Moved {task.reschedule_count} times. Check whether it is smaller—or blocked.</Text></View>)}</View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.xl }, number: { color: colors.citrus, fontSize: 54, fontWeight: '900' }, bigTitle: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: spacing.md }, body: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  goal: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }, horizon: { color: colors.moss, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, goalTitle: { color: colors.ink, fontSize: 25, lineHeight: 31, fontWeight: '900', marginTop: spacing.xs }, why: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  track: { height: 8, backgroundColor: colors.mossSoft, borderRadius: 4, overflow: 'hidden', marginTop: spacing.lg }, fill: { height: 8, backgroundColor: colors.moss, borderRadius: 4 }, progress: { color: colors.muted, fontSize: 11, marginTop: spacing.xs },
  task: { flexDirection: 'row', alignItems: 'center', minHeight: 60, borderTopWidth: 1, borderTopColor: colors.line, marginTop: spacing.md, paddingTop: spacing.md }, check: { width: 23, height: 23, borderRadius: 12, borderWidth: 2, borderColor: colors.moss, marginRight: spacing.md }, taskCopy: { flex: 1 }, taskTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, taskMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, noTasks: { color: colors.muted, fontSize: 13, marginTop: spacing.md },
  stuck: { marginTop: spacing.lg }, sectionLabel: { color: colors.citrus, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: spacing.sm }, stuckRow: { backgroundColor: '#FFF4DC', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }, stuckTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, stuckMeta: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
});
