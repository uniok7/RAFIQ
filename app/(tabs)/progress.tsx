// §9 Progress: 14-day completion sparkline, day counter while patterns lock, then cards.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { patternCounter, patternsUnlocked } from '@/engine';
import { c, t } from '@/lib/theme';
import { useLocal } from '@/store/local';

export default function Progress() {
  const store = useLocal();
  const es = store.engineState();
  const unlocked = patternsUnlocked(es);

  // Last 14 days completion ratio as a simple bar sparkline.
  const last14 = [...store.daySignals]
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-14);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <Text style={t.h2}>Last 14 days</Text>
        <View style={styles.spark}>
          {last14.length === 0 && <Text style={t.dim}>No days logged yet.</Text>}
          {last14.map((d) => {
            const ratio = d.planned_count ? d.completed_count / d.planned_count : 0;
            return <View key={d.day} style={[styles.barCol, { height: 8 + ratio * 60 }]} />;
          })}
        </View>

        {!unlocked ? (
          <View style={styles.card}>
            <Text style={t.h2}>{patternCounter(es)}</Text>
            <Text style={t.dim}>A wrong confident number costs more than a slow one.</Text>
          </View>
        ) : (
          store.observations
            .filter((o) => !o.dismissed_at)
            .map((o) => (
              <View key={o.key} style={styles.card}>
                <Text style={t.body}>{o.value}</Text>
                <Text style={t.dim}>
                  {o.source === 'corrected' ? 'you corrected me' : 'I noticed'} · {o.evidence_count} · {o.confidence}
                </Text>
              </View>
            ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 70 },
  barCol: { flex: 1, backgroundColor: c.accent, borderRadius: 2 },
  card: { backgroundColor: c.card, borderRadius: 12, padding: 16, gap: 6 },
});
