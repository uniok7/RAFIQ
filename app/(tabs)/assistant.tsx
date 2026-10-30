// §6 Job B + §9 AI sheet (tab). Text + voice. Applies actions locally, optimistically, then syncs.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { foodReply, isRedFlag, RED_FLAG_MESSAGE } from '@/engine';
import type { Rating } from '@/engine';
import { track } from '@/lib/analytics';
import { interpret, parseMeal, type NLResult } from '@/lib/llm';
import { c, t } from '@/lib/theme';
import { today, useLocal } from '@/store/local';

const CHIPS = ['I’m exhausted', 'I only have 30 minutes', 'I just ate', 'What should I work on?'];

export default function Assistant() {
  const router = useRouter();
  const store = useLocal();
  const [text, setText] = useState('');
  const [say, setSay] = useState('What do you need?');

  async function send(sentence: string) {
    setText('');
    // §12 red-flag escalation: drop everything, say it once, stop. No LLM, no plan change.
    if (isRedFlag(sentence)) {
      setSay(RED_FLAG_MESSAGE);
      return;
    }
    // §6 tired triggers route straight to the deterministic ladder — no LLM.
    if (/exhausted|head is falling|can'?t focus|so tired|no energy/i.test(sentence)) {
      router.push('/tired?trigger=chat');
      return;
    }
    setSay('…');
    const compact = {
      tasks: store.tasks.filter((x) => x.status === 'open').map((x) => ({ id: x.id, title: x.title })),
      sleep: store.daySignals.find((d) => d.day === today())?.sleep_mins ?? null,
    };
    const r = await interpret(sentence, compact); // fallback handled in llm.ts
    await apply(r);
    if (r.action !== 'log_meal' && r.action !== 'tired') setSay(r.say);
  }

  async function apply(r: NLResult) {
    const day = today();
    switch (r.action) {
      case 'add_task':
        if (r.task?.title) store.addTask({ title: String(r.task.title) });
        break;
      case 'complete':
        if (r.taskId) store.completeTask(r.taskId);
        break;
      case 'log_meal':
        await logMeal(r.mealText ?? '');
        break;
      case 'tired':
        router.push('/tired?trigger=chat');
        break;
      case 'set_energy':
        if (r.energy) {
          const ds = store.daySignals.find((d) => d.day === day);
          useLocal.setState({
            daySignals: ds
              ? store.daySignals.map((d) => (d.day === day ? { ...d, energy_stated: r.energy! } : d))
              : [...store.daySignals, { day, sleep_mins: null, sleep_quality: null, sleep_source: null, energy_stated: r.energy!, mood: null, tired_reports: 0, planned_count: 0, completed_count: 0 }],
          });
        }
        break;
      case 'defer':
        if (r.taskId) store.demoteToday(r.taskId);
        break;
    }
  }

  async function logMeal(mealText: string) {
    if (!mealText.trim()) {
      setSay('What did you eat?');
      return;
    }
    setSay('…');
    const p = await parseMeal(mealText, new Date().toISOString()); // Job D
    store.addMeal({
      raw_text: mealText,
      slot: p.slot,
      protein: p.protein as Rating | null,
      veg: p.veg as Rating | null,
      fibre: p.fibre as Rating | null,
      carb_type: p.carb_type,
    });
    track('meal_logged');
    // §12: if the disordered-eating guard has disabled commentary, log silently.
    const enabled = useLocal.getState().foodCommentaryEnabled;
    setSay(enabled ? foodReply({ protein: p.protein as Rating, veg: p.veg as Rating, fibre: p.fibre as Rating }) : 'Logged.');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Pressable onPress={() => router.push('/(tabs)/today')}>
          <Text style={[t.dim, { textAlign: 'right' }]}>Back to today</Text>
        </Pressable>
        <Text style={t.h2}>{say}</Text>
        <View style={styles.chips}>
          {CHIPS.map((ch) => (
            <Pressable key={ch} style={styles.chip} onPress={() => send(ch)}>
              <Text style={{ color: c.text }}>{ch}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Say anything…"
            placeholderTextColor={c.dim}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => text.trim() && send(text.trim())}
          />
          {/* Voice: expo-speech-recognition mic wired in the dev build. */}
          <Pressable style={styles.mic} accessibilityLabel="Voice input">
            <Text style={{ fontSize: 20 }}>🎙️</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: c.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, borderColor: c.line, borderWidth: 1 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 14, color: c.text, borderColor: c.line, borderWidth: 1 },
  mic: { padding: 12 },
});
