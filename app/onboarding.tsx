import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Calendar from 'expo-calendar';
import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

import { Button } from '@/src/components/button';
import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/hooks/use-auth';
import { localDay } from '@/src/lib/dates';
import { supabase } from '@/src/lib/supabase';
import { readLastNightSleep } from '@/src/native/health';
import { parseOnboarding, type ParsedPlan } from '@/src/services/llm';
import { useDayStore } from '@/src/stores/day-store';
import { useOnboardingStore } from '@/src/stores/onboarding-store';
import { useTaskStore } from '@/src/stores/task-store';
import { colors, radius, spacing } from '@/src/theme/tokens';

const blankPlan: ParsedPlan = { goals: [], tasks: [{ title: '', goal: '', estimate: 30, load: 2, due: null }] };

function plusDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + count);
  return localDay(date);
}

export default function OnboardingScreen() {
  const { user } = useAuth();
  const store = useOnboardingStore();
  const setSleep = useDayStore((state) => state.setSleep);
  const syncTasks = useTaskStore((state) => state.sync);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [workStart, setWorkStart] = useState(new Date(2026, 0, 1, 9, 0));
  const [workEnd, setWorkEnd] = useState(new Date(2026, 0, 1, 18, 0));

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) store.setRaw(transcript);
  });
  useSpeechRecognitionEvent('error', () => { setListening(false); setMessage('Voice input is unavailable. Typing still works.'); });

  useEffect(() => {
    if (store.stage !== 'parsing' || !user || store.parsed) return;
    let active = true;
    void parseOnboarding(store.raw).then((parsed) => {
      if (active) store.setParsed(parsed.tasks.length ? parsed : blankPlan);
    }).catch(() => {
      if (!active) return;
      setMessage('The plan needs a manual pass. Add the first action below.');
      store.setParsed(blankPlan);
    });
    return () => { active = false; };
  }, [store, user]);

  async function dictate() {
    if (listening) { ExpoSpeechRecognitionModule.stop(); return; }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) { setMessage('Microphone permission was not granted. Typing still works.'); return; }
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  }

  function turnIntoPlan() {
    if (!store.raw.trim()) return;
    store.setStage('parsing');
    if (!user) router.push('/sign-in');
  }

  function updatePlan(next: ParsedPlan) { store.setParsed(next); }

  async function savePlan() {
    if (!user || !store.parsed) return;
    const tasks = store.parsed.tasks.filter((task) => task.title.trim());
    if (!tasks.length) { setMessage('Add at least one concrete first action.'); return; }
    setSaving(true);
    const { error } = await supabase.rpc('save_onboarding_plan', { p_goals: store.parsed.goals, p_tasks: tasks });
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    await syncTasks(user.id);
    store.setStage('calendar');
  }

  async function askCalendar() {
    await Calendar.requestCalendarPermissionsAsync();
    store.setStage('health');
  }

  async function askHealth() {
    if (!user) return;
    setSaving(true);
    const result = await readLastNightSleep();
    if (result.ok) await setSleep(user.id, result.minutes, result.source);
    else setMessage(result.reason === 'no_data' ? 'Permission is set. No sleep sample was found, so manual entry remains available.' : 'Health access is not set. You can enable it later from You.');
    setSaving(false);
    store.setStage('hours');
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ work_start: workStart.getHours(), work_end: workEnd.getHours(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, onboarded_at: new Date().toISOString() }).eq('id', user.id);
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    store.complete(user.id, store.bottomUp ? plusDays(localDay(), 3) : null);
    router.replace('/(tabs)');
  }

  if (store.stage === 'question') {
    const prompt = store.bottomUp ? 'What’s the one thing you have to get done today?' : 'What are you trying to get done in the next 90 days?';
    return (
      <Screen>
        <View style={styles.promise}><Text style={styles.mark}>1</Text><Text style={styles.promiseTitle}>One clear next move.</Text><Text style={styles.promiseBody}>I’ll turn what matters into a plan, choose what comes first, and help you restart when the day goes sideways.</Text></View>
        <View style={styles.question}><Text style={styles.step}>ONE OPEN QUESTION</Text><Text style={styles.questionTitle}>{prompt}</Text><TextInput accessibilityLabel={prompt} autoFocus multiline onChangeText={store.setRaw} placeholder="Say it messily. Projects, deadlines, worries—all of it." placeholderTextColor={colors.muted} style={styles.textarea} value={store.raw} /><View style={styles.voiceRow}><Button variant="ghost" onPress={dictate}>{listening ? 'Stop listening' : 'Use voice'}</Button><Text style={styles.private}>You can edit everything next.</Text></View>{message ? <Text style={styles.message}>{message}</Text> : null}<Button disabled={!store.raw.trim()} onPress={turnIntoPlan}>Turn this into a plan</Button>{!store.bottomUp ? <Button variant="ghost" onPress={() => store.setBottomUp(true)}>Not sure yet</Button> : null}<Button variant="ghost" onPress={() => router.push('/sign-in')}>I already use One Thing</Button></View>
      </Screen>
    );
  }

  if (store.stage === 'parsing') {
    return <Screen scroll={false}><View style={styles.loading}><ActivityIndicator color={colors.moss} size="large" /><Text style={styles.loadingTitle}>Finding the first moves…</Text><Text style={styles.promiseBody}>No ranking happens in the language model. It only turns your words into editable goals and actions.</Text></View></Screen>;
  }

  if (store.stage === 'edit' && store.parsed) {
    return (
      <Screen eyebrow="Your draft" title="Make it yours">
        <Text style={styles.intro}>Tap into any line. Delete what’s wrong. Nothing becomes a recommendation until you approve it.</Text>
        {store.parsed.goals.length ? <Text style={styles.groupLabel}>GOALS</Text> : null}
        {store.parsed.goals.map((goal, index) => <View key={`goal-${index}`} style={styles.editCard}><TextInput onChangeText={(title) => updatePlan({ ...store.parsed!, goals: store.parsed!.goals.map((item, i) => i === index ? { ...item, title } : item) })} style={styles.editTitle} value={goal.title} /><TextInput multiline onChangeText={(why) => updatePlan({ ...store.parsed!, goals: store.parsed!.goals.map((item, i) => i === index ? { ...item, why } : item) })} placeholder="Why this matters" placeholderTextColor={colors.muted} style={styles.editWhy} value={goal.why} /><Pressable onPress={() => updatePlan({ ...store.parsed!, goals: store.parsed!.goals.filter((_, i) => i !== index) })}><Text style={styles.remove}>Remove goal</Text></Pressable></View>)}
        <Text style={styles.groupLabel}>FIRST ACTIONS</Text>
        {store.parsed.tasks.map((task, index) => <View key={`task-${index}`} style={styles.editCard}><TextInput onChangeText={(title) => updatePlan({ ...store.parsed!, tasks: store.parsed!.tasks.map((item, i) => i === index ? { ...item, title } : item) })} placeholder="Concrete first action" placeholderTextColor={colors.muted} style={styles.editTitle} value={task.title} /><View style={styles.taskDetails}><Text style={styles.chip}>{task.estimate} min</Text><Text style={styles.chip}>Load {task.load}</Text>{task.goal ? <Text numberOfLines={1} style={styles.chip}>{task.goal}</Text> : null}</View><Pressable onPress={() => updatePlan({ ...store.parsed!, tasks: store.parsed!.tasks.filter((_, i) => i !== index) })}><Text style={styles.remove}>Remove action</Text></Pressable></View>)}
        {store.parsed.tasks.length < 10 ? <Button variant="secondary" onPress={() => updatePlan({ ...store.parsed!, tasks: [...store.parsed!.tasks, { title: '', goal: '', estimate: 30, load: 2, due: null }] })}>Add an action</Button> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}<Button loading={saving} onPress={savePlan}>Use this plan</Button>
      </Screen>
    );
  }

  if (store.stage === 'calendar') return <PermissionStep number="2" title="What’s already fixed in your week?" body="Calendar access helps protect time that is already spoken for. I won’t create or change events." action="Allow calendar" onAction={askCalendar} onSkip={() => store.setStage('health')} />;
  if (store.stage === 'health') return <PermissionStep number="3" title="I’ll use your sleep to decide how hard to push you." body="Read-only. One metric: last night’s sleep duration. Manual entry is always available." action="Allow health" loading={saving} onAction={askHealth} onSkip={() => store.setStage('hours')} />;

  return (
    <Screen eyebrow="Last step" title="Your usual day">
      <Text style={styles.intro}>These set the boundaries for morning and night planning. Change them any time.</Text>
      <View style={styles.timeCard}><Text style={styles.groupLabel}>USUAL START</Text><DateTimePicker display={Platform.OS === 'ios' ? 'spinner' : 'default'} mode="time" onChange={(_event, date) => date && setWorkStart(date)} value={workStart} /></View>
      <View style={styles.timeCard}><Text style={styles.groupLabel}>USUAL STOP</Text><DateTimePicker display={Platform.OS === 'ios' ? 'spinner' : 'default'} mode="time" onChange={(_event, date) => date && setWorkEnd(date)} value={workEnd} /></View>
      {message ? <Text style={styles.message}>{message}</Text> : null}<Button loading={saving} onPress={finish}>Plan the rest of today</Button>
    </Screen>
  );
}

function PermissionStep({ number, title, body, action, loading, onAction, onSkip }: { number: string; title: string; body: string; action: string; loading?: boolean; onAction: () => void; onSkip: () => void }) {
  return <Screen scroll={false}><View style={styles.permission}><Text style={styles.bigNumber}>{number}</Text><Text style={styles.permissionTitle}>{title}</Text><Text style={styles.permissionBody}>{body}</Text></View><View style={styles.permissionActions}><Button loading={loading} onPress={onAction}>{action}</Button><Button variant="ghost" onPress={onSkip}>Skip for now</Button></View></Screen>;
}

const styles = StyleSheet.create({
  promise: { paddingTop: spacing.xxl }, mark: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', backgroundColor: colors.citrus, color: colors.ink, fontSize: 24, fontWeight: '900' },
  promiseTitle: { color: colors.ink, fontSize: 42, lineHeight: 46, fontWeight: '900', letterSpacing: -1.7, marginTop: spacing.lg }, promiseBody: { color: colors.muted, fontSize: 17, lineHeight: 26, marginTop: spacing.sm, textAlign: 'center' },
  question: { flex: 1, justifyContent: 'flex-end', paddingBottom: spacing.xl }, step: { color: colors.moss, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 }, questionTitle: { color: colors.ink, fontSize: 25, lineHeight: 31, fontWeight: '900', marginTop: spacing.sm },
  textarea: { minHeight: 132, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, color: colors.ink, fontSize: 17, lineHeight: 25, padding: spacing.md, textAlignVertical: 'top', marginTop: spacing.md },
  voiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, private: { color: colors.muted, fontSize: 11 }, message: { color: colors.danger, fontSize: 14, lineHeight: 21, marginVertical: spacing.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, loadingTitle: { color: colors.ink, fontSize: 28, fontWeight: '900', marginTop: spacing.lg }, intro: { color: colors.muted, fontSize: 16, lineHeight: 24, marginBottom: spacing.lg },
  groupLabel: { color: colors.moss, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginTop: spacing.md, marginBottom: spacing.sm }, editCard: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  editTitle: { color: colors.ink, fontSize: 18, lineHeight: 24, fontWeight: '800' }, editWhy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.xs }, remove: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: spacing.sm },
  taskDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }, chip: { color: colors.muted, backgroundColor: colors.canvas, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 9, fontSize: 11, maxWidth: 180 },
  permission: { flex: 1, justifyContent: 'center' }, bigNumber: { color: colors.citrus, fontSize: 100, lineHeight: 106, fontWeight: '900' }, permissionTitle: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -1 }, permissionBody: { color: colors.muted, fontSize: 17, lineHeight: 26, marginTop: spacing.md }, permissionActions: { paddingBottom: spacing.xl, gap: spacing.sm },
  timeCard: { backgroundColor: colors.paper, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, marginBottom: spacing.md },
});
