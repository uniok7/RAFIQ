import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

import { Button } from '@/src/components/button';
import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/hooks/use-auth';
import { useEntitlement } from '@/src/hooks/use-entitlement';
import { localDay, tomorrow } from '@/src/lib/dates';
import { correctLatest } from '@/src/services/corrections';
import { interpretNaturalLanguage } from '@/src/services/llm';
import { useCorrectionStore } from '@/src/stores/correction-store';
import { daySignalKey, useDayStore } from '@/src/stores/day-store';
import { useTaskStore } from '@/src/stores/task-store';
import { colors, radius, spacing } from '@/src/theme/tokens';

const chips = ["I’m exhausted", 'I only have 30 minutes', 'Move this to tomorrow', 'What should I work on?'];

export default function AssistantScreen() {
  const { user } = useAuth();
  const access = useEntitlement(user?.id);
  const [text, setText] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const tasks = useTaskStore((state) => state.tasks);
  const addTask = useTaskStore((state) => state.addTask);
  const completeTask = useTaskStore((state) => state.completeTask);
  const dropTask = useTaskStore((state) => state.dropTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const sync = useTaskStore((state) => state.sync);
  const setEnergy = useDayStore((state) => state.setEnergy);
  const signal = useDayStore((state) => user ? state.signals[daySignalKey(user.id)] : undefined);
  const setBlockMins = useCorrectionStore((state) => state.setBlockMins);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => { const transcript = event.results[0]?.transcript; if (transcript) setText(transcript); });
  useSpeechRecognitionEvent('error', () => { setListening(false); setReply('Voice input is unavailable. Type it instead.'); });

  async function voice() {
    if (listening) { ExpoSpeechRecognitionModule.stop(); return; }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) { setReply('Microphone permission was not granted. Type it instead.'); return; }
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  }

  async function submit(value = text) {
    if (!user || !value.trim()) return;
    if (!access.canCreate) { router.replace('/paywall'); return; }
    setLoading(true); setReply('');
    const openTasks = tasks.filter((task) => task.user_id === user.id && task.status === 'open');
    try {
      const result = await interpretNaturalLanguage(value, { openTasks: openTasks.map(({ id, title, estimate_mins, cognitive_load, due }) => ({ id, title, estimate_mins, cognitive_load, due })), todaySleep: signal?.sleep_mins ?? null, todayEnergy: signal?.energy_stated ?? null });
      const selected = openTasks.find((task) => task.id === result.taskId);
      if (result.action === 'add_task' && result.task.title) addTask({ title: result.task.title, estimate_mins: result.task.estimate, cognitive_load: result.task.load, due: result.task.due }, user.id);
      if (result.action === 'complete' && selected) {
        if (result.task.status === 'dropped') { dropTask(selected.id); void correctLatest({ day: localDay(), recommendationType: 'main_win', correctionType: 'wrong_entirely', correctedTo: { status: 'dropped' }, taskId: selected.id }).catch(() => undefined); }
        else completeTask(selected.id);
      }
      if (result.action === 'set_energy') { void setEnergy(user.id, result.energy); void correctLatest({ day: localDay(), recommendationType: 'energy', correctionType: 'wrong_inference', correctedTo: { energy: result.energy } }).catch(() => undefined); }
      if (result.action === 'defer' && selected) updateTask(selected.id, { due: tomorrow(localDay()), reschedule_count: selected.reschedule_count + 1 });
      if (result.action === 'shorten') { setBlockMins(localDay(), result.minutes); void correctLatest({ day: localDay(), recommendationType: 'block_size', correctionType: 'wrong_inference', correctedTo: { minutes: result.minutes } }).catch(() => undefined); }
      void sync(user.id);
      setReply(result.say || 'Done.');
      setText('');
    } catch { setReply('That didn’t go through. Say it again?'); }
    finally { setLoading(false); }
  }

  return (
    <Screen eyebrow="Say it plainly" title="What changed?">
      {!access.canCreate ? <View style={styles.locked}><Text style={styles.replyText}>Your existing plan remains readable. New AI actions resume with Pro.</Text><Button onPress={() => router.replace('/paywall')}>See Pro</Button></View> : null}
      <Text style={styles.intro}>Add, finish, defer, shorten, or correct the plan in one sentence.</Text>
      <View style={styles.composer}><TextInput accessibilityLabel="Message One Thing" autoFocus multiline onChangeText={setText} placeholder="I’m wiped—give me something lighter." placeholderTextColor={colors.muted} style={styles.input} value={text} /><View style={styles.row}><Button variant="ghost" onPress={voice}>{listening ? 'Stop' : 'Voice'}</Button><Button disabled={!text.trim()} loading={loading} onPress={() => submit()}>Send</Button></View></View>
      {!text && !loading ? <View style={styles.chips}>{chips.map((chip) => <Pressable key={chip} onPress={() => { setText(chip); void submit(chip); }} style={styles.chip}><Text style={styles.chipText}>{chip}</Text></Pressable>)}</View> : null}
      {reply ? <View style={styles.reply}><Text accessibilityLiveRegion="polite" style={styles.replyText}>{reply}</Text></View> : null}
      <Button variant="ghost" onPress={() => router.back()}>Close</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: 16, lineHeight: 24, marginBottom: spacing.lg }, composer: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md },
  input: { minHeight: 130, color: colors.ink, fontSize: 19, lineHeight: 27, textAlignVertical: 'top' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }, chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }, chipText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  reply: { backgroundColor: colors.mossSoft, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.xl }, replyText: { color: colors.ink, fontSize: 17, lineHeight: 25, fontWeight: '700' },
  locked: { backgroundColor: '#FFF4DC', borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm },
});
