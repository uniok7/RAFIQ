// §9 Onboarding: promise + sign in, one question, LLM plan, permissions, hours.
// Target 90s. The editable-plan moment is what sells the product (§9.3).
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientCTA } from '@/components/GradientCTA';
import { Headline } from '@/components/Headline';
import { track } from '@/lib/analytics';
import { signInWithMagicLink } from '@/lib/auth';
import { parseOnboarding, type OnboardingParse } from '@/lib/llm';
import { requestSleepPermission } from '@/lib/health';
import { c, grad, radius, t } from '@/lib/theme';
import { useLocal } from '@/store/local';

type Step = 'signin' | 'ask' | 'plan' | 'perms';
const ORDER: Step[] = ['signin', 'ask', 'plan', 'perms'];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('signin');
  const [email, setEmail] = useState('');
  const [paragraph, setParagraph] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<OnboardingParse | null>(null);
  const addTask = useLocal((s) => s.addTask);

  const progress = (ORDER.indexOf(step) + 1) / ORDER.length;

  function finish() {
    track('trial_started'); // §14: 7-day trial begins at onboarding completion
    router.replace('/(tabs)/today');
  }

  async function turnIntoPlan() {
    setLoading(true);
    const result = await parseOnboarding(paragraph); // fallback: empty -> manual entry (§6 Job A)
    setParsed(result);
    setStep('plan');
    setLoading(false);
  }

  return (
    <LinearGradient colors={grad.hero} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* slim progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, gap: 20, flexGrow: 1 }}>
          {step === 'signin' && (
            <View style={{ gap: 16, flex: 1, justifyContent: 'center' }}>
              <Headline text="Tell me what you're {trying} to achieve." />
              <Text style={t.dim}>I'll tell you what to do next, and help you recover when you fall off.</Text>
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={c.faint}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          )}

          {step === 'ask' && (
            <View style={{ gap: 16 }}>
              <Headline text="What are you trying to get {done} in the next 90 days?" style={t.title} />
              <TextInput
                style={[styles.input, { height: 150, textAlignVertical: 'top' }]}
                multiline
                placeholder="Type one messy paragraph…"
                placeholderTextColor={c.faint}
                value={paragraph}
                onChangeText={setParagraph}
              />
              <Pressable onPress={() => setStep('ask')}>
                <Text style={[t.dim, { textAlign: 'center' }]}>Not sure yet — just today</Text>
              </Pressable>
              {loading && <ActivityIndicator color={c.accent} />}
            </View>
          )}

          {step === 'plan' && parsed && (
            <View style={{ gap: 12 }}>
              <Headline text="Here's your {plan}. Edit or delete anything." style={t.title} />
              {parsed.tasks.length === 0 && <Text style={t.dim}>Couldn't parse that — add tasks by hand below.</Text>}
              {parsed.tasks.map((task, i) => (
                <View key={i} style={styles.card}>
                  <Text style={t.body}>{task.title}</Text>
                  <Text style={t.dim}>{task.estimate}m · load {task.load}{task.due ? ` · due ${task.due}` : ''}</Text>
                </View>
              ))}
            </View>
          )}

          {step === 'perms' && (
            <View style={{ gap: 16, flex: 1, justifyContent: 'center' }}>
              <Headline text="I'll use your {sleep} to decide how hard to push you." style={t.title} />
              <Pressable style={styles.ghost} onPress={() => requestSleepPermission()}>
                <Text style={{ color: c.text, fontWeight: '600', textAlign: 'center' }}>Connect sleep</Text>
              </Pressable>
              <Pressable onPress={finish}>
                <Text style={[t.dim, { textAlign: 'center' }]}>Skip for now</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* CTA pinned bottom */}
        <View style={{ padding: 24, paddingTop: 0 }}>
          {step === 'signin' && (
            <GradientCTA
              label="Email me a magic link"
              disabled={!email.trim()}
              onPress={async () => {
                await signInWithMagicLink(email.trim());
                setStep('ask');
              }}
            />
          )}
          {step === 'ask' && (
            <GradientCTA label="Turn this into a plan" disabled={loading || !paragraph.trim()} onPress={turnIntoPlan} />
          )}
          {step === 'plan' && parsed && (
            <GradientCTA
              label="Looks right — start"
              onPress={() => {
                parsed.tasks.forEach((task) =>
                  addTask({
                    title: task.title,
                    estimate_mins: task.estimate,
                    cognitive_load: (task.load as 1 | 2 | 3) ?? 2,
                    due: task.due,
                  }),
                );
                setStep('perms');
              }}
            />
          )}
          {step === 'perms' && <GradientCTA label="Done" onPress={finish} />}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  progressTrack: { height: 3, backgroundColor: c.line, marginHorizontal: 24, marginTop: 8, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: c.accent, borderRadius: 2 },
  input: { backgroundColor: c.card, borderRadius: radius.md, padding: 16, color: c.text, borderColor: c.line, borderWidth: 1 },
  card: { backgroundColor: c.card, borderRadius: radius.md, padding: 16 },
  ghost: { backgroundColor: c.card, borderRadius: radius.pill, padding: 16, borderColor: c.line, borderWidth: 1 },
});
