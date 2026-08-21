import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/hooks/use-auth';
import { useEntitlement } from '@/src/hooks/use-entitlement';
import { localDay } from '@/src/lib/dates';
import { supabase } from '@/src/lib/supabase';
import { weeklySummary } from '@/src/services/llm';
import { track } from '@/src/services/telemetry';
import { colors, radius, spacing } from '@/src/theme/tokens';
import type { DaySignal, Observation, Session } from '@/src/types/domain';

function daysAgo(count: number) { const date = new Date(); date.setDate(date.getDate() - count); return localDay(date); }

export default function ProgressScreen() {
  const { user } = useAuth();
  const access = useEntitlement(user?.id);
  const [summary, setSummary] = useState('');
  const tracked = useRef(new Set<string>());
  const evidence = useQuery({
    queryKey: ['progress', user?.id], enabled: Boolean(user),
    queryFn: async () => {
      const [signals, sessions, observations] = await Promise.all([
        supabase.from('day_signals').select('*').eq('user_id', user!.id).order('day'),
        supabase.from('sessions').select('*').eq('user_id', user!.id).order('day'),
        supabase.from('observations').select('*').eq('user_id', user!.id).is('dismissed_at', null).order('updated_at', { ascending: false }),
      ]);
      const error = signals.error ?? sessions.error ?? observations.error;
      if (error) throw error;
      return { signals: (signals.data ?? []) as DaySignal[], sessions: (sessions.data ?? []) as Session[], observations: (observations.data ?? []) as Observation[] };
    },
  });
  const dataDays = useMemo(() => new Set([...(evidence.data?.signals.map((item) => item.day) ?? []), ...(evidence.data?.sessions.map((item) => item.day) ?? [])]).size, [evidence.data]);
  const recent = useMemo(() => (evidence.data?.signals ?? []).filter((item) => item.day >= daysAgo(13)).slice(-14), [evidence.data?.signals]);

  useEffect(() => {
    for (const observation of evidence.data?.observations ?? []) {
      if (!tracked.current.has(observation.id)) { track('observation_shown', { key: observation.key, evidenceCount: observation.evidence_count }); tracked.current.add(observation.id); }
    }
  }, [evidence.data?.observations]);

  useEffect(() => {
    if (!user || dataDays < 7 || !access.canCreate || !evidence.data) return;
    const weekKey = `one-thing-weekly-summary-${user.id}-${daysAgo(new Date().getDay())}`;
    void AsyncStorage.getItem(weekKey).then(async (cached) => {
      if (cached) { setSummary(cached); return; }
      const compact = evidence.data.signals.slice(-7).map(({ day, sleep_mins, energy_stated, mood, planned_count, completed_count }) => ({ day, sleep_mins, energy_stated, mood, planned_count, completed_count }));
      try { const next = await weeklySummary({ evidenceDays: dataDays, dailySignals: compact }); setSummary(next); await AsyncStorage.setItem(weekKey, next); } catch { /* The chart remains useful without AI copy. */ }
    });
  }, [access.canCreate, dataDays, evidence.data, user]);

  return (
    <Screen eyebrow="Patterns" title="Progress">
      <View style={styles.counterCard}><Text style={styles.counter}>Day {Math.min(dataDays, 15)} of 15</Text><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, (dataDays / 15) * 100)}%` }]} /></View><Text style={styles.counterTitle}>{dataDays < 15 ? 'Patterns need time.' : 'Your evidence window is open.'}</Text><Text style={styles.body}>{dataDays < 15 ? `${15 - dataDays} distinct data days remain before inferred patterns are shown confidently.` : 'Every pattern below includes its evidence count and can be removed from You.'}</Text></View>
      <View style={styles.chartCard}><Text style={styles.sectionLabel}>LAST 14 DAYS</Text>{recent.length ? <View accessibilityLabel="Completion rate for the last fourteen data days" style={styles.chart}>{recent.map((item) => { const rate = item.planned_count ? item.completed_count / item.planned_count : 0; return <View key={item.day} style={styles.barColumn}><View style={[styles.bar, { height: Math.max(4, Math.round(rate * 100)) }]} /><Text style={styles.day}>{new Date(`${item.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</Text></View>; })}</View> : <Text style={styles.body}>Close a day to start the completion chart.</Text>}</View>
      {summary ? <View style={styles.summary}><Text style={styles.sectionLabel}>THIS WEEK, PLAINLY</Text><Text style={styles.summaryText}>{summary}</Text></View> : dataDays >= 7 && !access.canCreate ? <View style={styles.summary}><Text style={styles.summaryText}>Your existing progress remains here. New weekly summaries resume with Pro.</Text></View> : null}
      {dataDays >= 15 ? evidence.data?.observations.map((observation) => <View key={observation.id} style={styles.observation}><View style={styles.observationTop}><Text style={styles.observationLabel}>{observation.label}</Text><Text style={styles.confidence}>{observation.confidence}</Text></View><Text style={styles.observationValue}>{observation.value}</Text><Text style={styles.evidence}>{observation.evidence_count} pieces of evidence · {observation.source === 'corrected' ? 'you corrected me' : 'I noticed'}</Text></View>) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  counterCard: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.xl }, counter: { color: colors.moss, fontSize: 14, fontWeight: '900' }, track: { height: 8, borderRadius: 4, backgroundColor: colors.mossSoft, marginVertical: spacing.lg, overflow: 'hidden' }, fill: { height: 8, borderRadius: 4, backgroundColor: colors.moss }, counterTitle: { color: colors.ink, fontSize: 24, fontWeight: '900' }, body: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: spacing.sm },
  chartCard: { marginTop: spacing.lg, backgroundColor: colors.paper, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.lg }, sectionLabel: { color: colors.moss, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: spacing.md }, chart: { height: 130, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }, barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' }, bar: { width: '100%', maxWidth: 20, backgroundColor: colors.moss, borderTopLeftRadius: 5, borderTopRightRadius: 5 }, day: { color: colors.muted, fontSize: 9, marginTop: 5 },
  summary: { backgroundColor: colors.mossSoft, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg }, summaryText: { color: colors.ink, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  observation: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md }, observationTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, observationLabel: { color: colors.ink, fontSize: 17, fontWeight: '900', flex: 1 }, confidence: { color: colors.moss, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }, observationValue: { color: colors.ink, fontSize: 15, lineHeight: 23, marginTop: spacing.sm }, evidence: { color: colors.muted, fontSize: 11, marginTop: spacing.md },
});
