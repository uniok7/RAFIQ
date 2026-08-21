import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { Button } from '@/src/components/button';
import { Screen } from '@/src/components/screen';
import { ENGINE_VERSION } from '@/src/engine';
import { useAuth } from '@/src/hooks/use-auth';
import { localDay, tomorrow } from '@/src/lib/dates';
import { supabase } from '@/src/lib/supabase';
import { useTaskStore } from '@/src/stores/task-store';
import { colors, radius, spacing } from '@/src/theme/tokens';
import type { Mood } from '@/src/types/domain';
import { track } from '@/src/services/telemetry';

const moods: { value: Mood; emoji: string; label: string }[] = [
  { value: 'bad', emoji: '😞', label: 'Bad' }, { value: 'okay', emoji: '😐', label: 'Okay' }, { value: 'good', emoji: '🙂', label: 'Good' }, { value: 'great', emoji: '😄', label: 'Great' },
];

export default function NightReviewScreen() {
  const { user } = useAuth();
  const day = localDay();
  const tasks = useTaskStore((state) => state.tasks).filter((task) => task.user_id === user?.id);
  const updateTask = useTaskStore((state) => state.updateTask);
  const [mood, setMood] = useState<Mood | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const routines = useQuery({
    queryKey: ['routine-items', user?.id], enabled: Boolean(user),
    queryFn: async () => { const { data, error } = await supabase.from('routine_items').select('*').eq('user_id', user!.id).eq('active', true).order('sort_order'); if (error) throw error; return data ?? []; },
  });
  const open = useMemo(() => tasks.filter((task) => task.status === 'open'), [tasks]);
  const completedToday = useMemo(() => tasks.filter((task) => task.status === 'done' && task.done_at === day), [day, tasks]);
  const plannedCount = Math.min(3, open.length + completedToday.length);
  const completedCount = Math.min(plannedCount, completedToday.length);
  const tomorrowTask = open[0] ?? null;

  function toggle(id: string) { setChecked((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]); }

  async function finish() {
    if (!user || !mood) return;
    setSaving(true); setError('');
    const { error: closeError } = await supabase.rpc('close_day', { p_day: day, p_mood: mood, p_planned_count: plannedCount, p_completed_count: completedCount, p_checked_item_ids: checked, p_tomorrow_task_id: tomorrowTask?.id ?? null, p_engine_version: ENGINE_VERSION });
    if (closeError) { setError(closeError.message); setSaving(false); return; }
    for (const task of open.filter((item) => item.due === day)) updateTask(task.id, { due: tomorrow(day), reschedule_count: task.reschedule_count + 1 });
    track('night_review_completed', { plannedCount, completedCount });
    setSaving(false); router.back();
  }

  return (
    <Screen eyebrow="Night review" title="Close the day">
      <View style={styles.ratio}><Text style={styles.ratioValue}>{completedCount}/{plannedCount}</Text><Text style={styles.ratioLabel}>planned tasks completed</Text></View>
      {routines.data?.length ? <View style={styles.section}><Text style={styles.sectionLabel}>ROUTINE</Text>{routines.data.map((item) => <Pressable key={item.id} onPress={() => toggle(item.id)} style={styles.routine}><View style={[styles.check, checked.includes(item.id) && styles.checked]} /> <Text style={styles.routineText}>{item.label}</Text></Pressable>)}</View> : <View style={styles.empty}><Text style={styles.emptyText}>Routine checks will appear here once you add them from You.</Text></View>}
      <View style={styles.tomorrow}><Text style={styles.sectionLabel}>TOMORROW STARTS WITH</Text><Text style={styles.tomorrowTitle}>{tomorrowTask?.title ?? 'A clear slate'}</Text><Text style={styles.tomorrowBody}>Anything unfinished and due today moves forward once, with its reschedule count kept.</Text></View>
      <View style={styles.section}><Text style={styles.sectionLabel}>HOW WAS TODAY?</Text><View style={styles.moods}>{moods.map((item) => <Pressable accessibilityLabel={item.label} accessibilityRole="button" key={item.value} onPress={() => setMood(item.value)} style={[styles.mood, mood === item.value && styles.moodSelected]}><Text style={styles.emoji}>{item.emoji}</Text><Text style={styles.moodLabel}>{item.label}</Text></Pressable>)}</View></View>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}<Button disabled={!mood} loading={saving} onPress={finish}>Done for today</Button><Button variant="ghost" onPress={() => router.back()}>Not yet</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ratio: { backgroundColor: colors.moss, borderRadius: radius.lg, padding: spacing.xl }, ratioValue: { color: colors.citrus, fontSize: 70, fontWeight: '900' }, ratioLabel: { color: colors.mossSoft, fontSize: 15 },
  section: { marginTop: spacing.xl }, sectionLabel: { color: colors.moss, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: spacing.sm },
  routine: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.line }, check: { width: 23, height: 23, borderRadius: 7, borderWidth: 2, borderColor: colors.moss, marginRight: spacing.md }, checked: { backgroundColor: colors.moss }, routineText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  empty: { padding: spacing.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: radius.md, marginTop: spacing.lg }, emptyText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  tomorrow: { backgroundColor: colors.paper, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, marginTop: spacing.xl }, tomorrowTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '900' }, tomorrowBody: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  moods: { flexDirection: 'row', justifyContent: 'space-between' }, mood: { width: '23%', alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }, moodSelected: { borderColor: colors.moss, backgroundColor: colors.mossSoft }, emoji: { fontSize: 27 }, moodLabel: { color: colors.muted, fontSize: 11, marginTop: spacing.xs }, error: { color: colors.danger, fontSize: 14, marginVertical: spacing.md },
});
