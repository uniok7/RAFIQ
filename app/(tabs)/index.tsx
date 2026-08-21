import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Button } from '@/src/components/button';
import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/hooks/use-auth';
import { useTaskSync } from '@/src/hooks/use-task-sync';
import { useDayPlan } from '@/src/hooks/use-day-plan';
import { useEntitlement } from '@/src/hooks/use-entitlement';
import { useDailyNotifications } from '@/src/hooks/use-daily-notifications';
import { friendlyDay, localDay } from '@/src/lib/dates';
import { daySignalKey, useDayStore } from '@/src/stores/day-store';
import { useTaskStore } from '@/src/stores/task-store';
import { useCorrectionStore } from '@/src/stores/correction-store';
import { acceptDayPlan, correctLatest } from '@/src/services/corrections';
import { colors, radius, spacing } from '@/src/theme/tokens';
import { track } from '@/src/services/telemetry';

export default function TodayScreen() {
  const { user } = useAuth();
  useTaskSync(user?.id);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [expandedClaim, setExpandedClaim] = useState<'energy' | 'block' | 'main' | null>(null);
  const tasks = useTaskStore((state) => state.tasks);
  const addTask = useTaskStore((state) => state.addTask);
  const completeTask = useTaskStore((state) => state.completeTask);
  const dropTask = useTaskStore((state) => state.dropTask);
  const syncing = useTaskStore((state) => state.syncing);
  const syncTasks = useTaskStore((state) => state.sync);
  const signal = useDayStore((state) => user ? state.signals[daySignalKey(user.id, localDay())] : undefined);
  const hydrateSignal = useDayStore((state) => state.hydrateRemote);
  const setEnergy = useDayStore((state) => state.setEnergy);
  const corrections = useCorrectionStore((state) => state.days[localDay()]);
  const demote = useCorrectionStore((state) => state.demote);
  const setBlockMins = useCorrectionStore((state) => state.setBlockMins);
  const openTasks = useMemo(() => tasks.filter((task) => task.user_id === user?.id && task.status === 'open'), [tasks, user?.id]);
  const done = useMemo(() => tasks.filter((task) => task.user_id === user?.id && task.status === 'done'), [tasks, user?.id]);
  const dayPlan = useDayPlan(user?.id);
  const access = useEntitlement(user?.id);
  const doneToday = useMemo(() => done.filter((task) => task.done_at === localDay()), [done]);
  const plannedToday = dayPlan.plan ? 1 + dayPlan.plan.alsoToday.length : 0;
  useDailyNotifications({ userId: user?.id, mainTitle: dayPlan.plan?.mainWin?.title, completedCount: doneToday.length, plannedCount: plannedToday });

  useEffect(() => {
    if (user) void hydrateSignal(user.id);
  }, [hydrateSignal, user]);

  useEffect(() => {
    if (!user || access.day == null) return;
    const key = `one-thing-open-${user.id}-${localDay()}`;
    void AsyncStorage.getItem(key).then((seen) => { if (!seen) { track('day_n_open', { n: access.day! }); void AsyncStorage.setItem(key, '1'); } });
  }, [access.day, user]);

  function submit() {
    if (!title.trim()) return;
    addTask({ title }, user?.id);
    setTitle('');
    setAdding(false);
  }

  const main = dayPlan.plan?.mainWin;
  const alsoToday = dayPlan.plan?.alsoToday ?? [];
  const effectiveBlock = corrections?.blockMins ?? dayPlan.plan?.blockMins;
  async function correctEnergy(energy: 'low' | 'normal' | 'high') {
    if (!user || !dayPlan.plan) return;
    const previous = dayPlan.plan.energy.level;
    void setEnergy(user.id, energy);
    setExpandedClaim(null);
    void correctLatest({ day: localDay(), recommendationType: 'energy', correctionType: 'wrong_inference', correctedTo: { energy }, payloadContains: { level: previous } }).catch(() => undefined);
  }
  function correctBlock(minutes: number) {
    if (!dayPlan.plan) return;
    const previous = dayPlan.plan.blockMins;
    setBlockMins(localDay(), minutes);
    setExpandedClaim(null);
    void correctLatest({ day: localDay(), recommendationType: 'block_size', correctionType: 'wrong_inference', correctedTo: { minutes }, payloadContains: { minutes: previous } }).catch(() => undefined);
  }
  function rejectMain() {
    if (!main) return;
    const replacement = dayPlan.plan?.ranked.find((item) => item.task.id !== main.id)?.task;
    demote(localDay(), main.id);
    setExpandedClaim(null);
    track('main_win_corrected', { correction: 'priority' });
    void correctLatest({ day: localDay(), recommendationType: 'main_win', correctionType: 'wrong_priority', correctedTo: { taskId: replacement?.id ?? null }, taskId: main.id, replacementTaskId: replacement?.id }).catch(() => undefined);
  }
  function rejectTaskEntirely() {
    if (!main) return;
    dropTask(main.id);
    if (user) void syncTasks(user.id);
    setExpandedClaim(null);
    track('main_win_corrected', { correction: 'entirely' });
    void correctLatest({ day: localDay(), recommendationType: 'main_win', correctionType: 'wrong_entirely', correctedTo: { status: 'dropped' }, taskId: main.id }).catch(() => undefined);
  }
  return (
    <Screen eyebrow="Your day" title="Today" right={<Text style={styles.sync}>{syncing || dayPlan.preparing ? 'Preparing…' : 'Saved'}</Text>}>
      <View style={styles.readout}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/sleep')}><Text style={styles.readoutValue}>{signal?.sleep_mins ? `${Math.floor(signal.sleep_mins / 60)}h ${signal.sleep_mins % 60}m` : 'Add'}</Text><Text style={styles.readoutLabel}>Sleep</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setExpandedClaim(expandedClaim === 'energy' ? null : 'energy')}><Text style={styles.readoutValue}>{dayPlan.plan?.energy.level ?? '—'}</Text><Text style={styles.readoutLabel}>Energy</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setExpandedClaim(expandedClaim === 'block' ? null : 'block')}><Text style={styles.readoutValue}>{effectiveBlock ? `${effectiveBlock}m` : '—'}</Text><Text style={styles.readoutLabel}>Block</Text></Pressable>
        <View><Text style={styles.readoutValue}>{doneToday.length}/{plannedToday}</Text><Text style={styles.readoutLabel}>Done</Text></View>
      </View>
      {access.expired ? <View style={styles.reader}><Text style={styles.readerTitle}>Free reader mode</Text><Text style={styles.readerBody}>Everything you already made stays available. Pro is needed only for new recommendations and AI actions.</Text><Button variant="secondary" onPress={() => router.push('/paywall')}>See Pro</Button></View> : null}
      {expandedClaim === 'energy' && dayPlan.plan ? <View style={styles.correction}><Text style={styles.correctionReason}>{dayPlan.plan.energy.reasoning}</Text><View style={styles.correctionRow}>{(['low', 'normal', 'high'] as const).filter((energy) => energy !== dayPlan.plan?.energy.level).map((energy) => <Pressable key={energy} onPress={() => void correctEnergy(energy)} style={styles.correctionChoice}><Text style={styles.correctionChoiceText}>{energy === 'normal' ? 'I’m fine actually' : energy === 'low' ? 'Worse than that' : 'More energy than that'}</Text></Pressable>)}</View></View> : null}
      {expandedClaim === 'block' && effectiveBlock ? <View style={styles.correction}><Text style={styles.correctionReason}>This block was sized from today’s energy call. Pick the size that is actually workable.</Text><View style={styles.correctionRow}>{([30, 45, 60] as const).filter((minutes) => minutes !== effectiveBlock).map((minutes) => <Pressable key={minutes} onPress={() => correctBlock(minutes)} style={styles.correctionChoice}><Text style={styles.correctionChoiceText}>{minutes} minutes</Text></Pressable>)}</View></View> : null}
      {main ? (
        <View style={styles.mainCard}>
          <Text style={styles.kicker}>THE ONE THING</Text>
          <Pressable accessibilityRole="button" onPress={() => setExpandedClaim(expandedClaim === 'main' ? null : 'main')}><Text style={styles.mainTitle}>{main.title}</Text><Text style={styles.reason}>{dayPlan.plan?.reasoning}</Text></Pressable>
          <View style={styles.metaRow}><Text style={styles.meta}>{main.estimate_mins} min{dayPlan.estimateMultiplier ? ` stated · ~${Math.round(main.estimate_mins * dayPlan.estimateMultiplier)} usual` : ''}</Text><Text style={styles.meta}>{friendlyDay(main.due)}</Text></View>
          {expandedClaim === 'main' ? <View style={styles.mainCorrection}><Text style={styles.correctionReason}>This is first because of the reasons above. Change it without explaining.</Text><Button variant="secondary" onPress={rejectMain}>Not this one</Button><Button variant="ghost" onPress={rejectTaskEntirely}>This task isn’t real</Button></View> : null}
          <Button onPress={() => { track('main_win_accepted', { blockMins: effectiveBlock ?? 45 }); void acceptDayPlan(localDay(), main.id).catch(() => undefined); router.push({ pathname: '/timer', params: { taskId: main.id, minutes: String(effectiveBlock ?? 45) } }); }}>Start {effectiveBlock}-minute block</Button>
          <Button variant="secondary" onPress={() => completeTask(main.id)}>Mark complete</Button>
          <Button variant="ghost" onPress={() => Alert.alert('Remove task?', 'It will be kept as dropped in your history.', [{ text: 'Keep it' }, { text: 'Remove', style: 'destructive', onPress: () => dropTask(main.id) }])}>Remove</Button>
        </View>
      ) : openTasks.length && dayPlan.preparing ? (
        <View style={styles.preparing}><Text style={styles.preparingTitle}>Choosing one thing…</Text><Text style={styles.emptyBody}>The plan appears only after its reasoning is safely logged.</Text></View>
      ) : access.expired && openTasks.length ? (
        <View style={styles.readerList}><Text style={styles.sectionTitle}>Your open tasks</Text>{openTasks.map((task) => <Pressable accessibilityRole="button" key={task.id} onPress={() => completeTask(task.id)} style={styles.taskRow}><View style={styles.check} /><View style={styles.taskText}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.estimate_mins} min · {friendlyDay(task.due)}</Text></View></Pressable>)}</View>
      ) : (
        <View style={styles.empty}><Text style={styles.emptyNumber}>01</Text><Text style={styles.emptyTitle}>Give today a center.</Text><Text style={styles.emptyBody}>Add one concrete action. The decision engine will take over once it has enough context.</Text></View>
      )}
      {alsoToday.length ? (
        <View style={styles.also}><Text style={styles.sectionTitle}>Also today</Text>{alsoToday.map((task) => (
          <Pressable key={task.id} onPress={() => completeTask(task.id)} style={styles.taskRow}><View style={styles.check} /><View style={styles.taskText}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.estimate_mins} min · {friendlyDay(task.due)}</Text></View></Pressable>
        ))}</View>
      ) : null}
      {dayPlan.error ? <Text accessibilityLiveRegion="polite" style={styles.planError}>The plan could not be logged yet. Your tasks are still safe offline.</Text> : null}
      {adding ? (
        <View style={styles.composer}>
          <TextInput autoFocus multiline onChangeText={setTitle} onSubmitEditing={submit} placeholder="What needs doing?" placeholderTextColor={colors.muted} style={styles.composerInput} value={title} />
          <View style={styles.composerButtons}><Button variant="ghost" onPress={() => setAdding(false)}>Cancel</Button><Button disabled={!title.trim()} onPress={submit}>Add task</Button></View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={styles.addButton}><Ionicons color={colors.white} name="add" size={26} /><Text style={styles.addLabel}>Add task</Text></Pressable>
      )}
      <Button variant="ghost" onPress={() => router.push('/night-review')}>Close the day</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sync: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  readout: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: spacing.md, marginBottom: spacing.lg },
  readoutValue: { color: colors.ink, fontSize: 15, fontWeight: '800' }, readoutLabel: { color: colors.muted, fontSize: 11, marginTop: 3 },
  mainCard: { backgroundColor: colors.paper, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, gap: spacing.md },
  kicker: { color: colors.moss, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  mainTitle: { color: colors.ink, fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -1.1 },
  reason: { color: colors.muted, fontSize: 16, lineHeight: 24 }, metaRow: { flexDirection: 'row', gap: spacing.sm },
  meta: { color: colors.ink, fontSize: 12, fontWeight: '700', backgroundColor: colors.mossSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  empty: { minHeight: 330, backgroundColor: colors.moss, borderRadius: radius.lg, padding: spacing.xl, justifyContent: 'flex-end' },
  emptyNumber: { color: colors.citrus, fontSize: 72, lineHeight: 78, fontWeight: '900' },
  emptyTitle: { color: colors.white, fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: spacing.sm },
  emptyBody: { color: '#DCE8DD', fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  preparing: { minHeight: 240, backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.xl, justifyContent: 'center' }, preparingTitle: { color: colors.white, fontSize: 27, fontWeight: '900' },
  planError: { color: colors.danger, fontSize: 13, lineHeight: 20, marginTop: spacing.md },
  correction: { backgroundColor: colors.mossSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }, correctionReason: { color: colors.ink, fontSize: 14, lineHeight: 21 }, correctionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }, correctionChoice: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, correctionChoiceText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, mainCorrection: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
  reader: { backgroundColor: '#FFF4DC', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm }, readerTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' }, readerBody: { color: colors.muted, fontSize: 13, lineHeight: 20 }, readerList: { backgroundColor: colors.paper, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.line },
  also: { marginTop: spacing.xl }, sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginBottom: spacing.sm },
  taskRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.paper, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: spacing.md },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.moss, marginRight: spacing.md }, taskText: { flex: 1 },
  taskTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' }, taskMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  addButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: spacing.lg, minHeight: 52, marginTop: spacing.xl },
  addLabel: { color: colors.white, fontSize: 15, fontWeight: '800' },
  composer: { backgroundColor: colors.paper, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, marginTop: spacing.lg },
  composerInput: { color: colors.ink, fontSize: 18, lineHeight: 25, minHeight: 78, textAlignVertical: 'top' }, composerButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
