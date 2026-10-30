// §9 Goals: goals with progress bars and their open tasks. reschedule_count>=3 = "stuck".
import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { ProgressRing } from '@/components/ProgressRing';
import { supabase } from '@/lib/supabase';
import { c, radius, t } from '@/lib/theme';
import { useLocal } from '@/store/local';

interface Goal { id: string; title: string; }

export default function Goals() {
  const tasks = useLocal((s) => s.tasks);
  const userId = useLocal((s) => s.userId);

  const { data: goals = [] } = useQuery({
    queryKey: ['goals', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('goals').select('id,title').eq('status', 'active');
      return (data as Goal[]) ?? [];
    },
  });

  if (goals.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <EmptyState counter="No goals yet." hint="Add a goal in onboarding, or tell the AI what you're working toward." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {goals.map((g) => {
          const mine = tasks.filter((x) => x.goal_id === g.id);
          const done = mine.filter((x) => x.status === 'done').length;
          const pct = mine.length ? done / mine.length : 0;
          return (
            <View key={g.id} style={styles.card}>
              <View style={styles.headRow}>
                <ProgressRing size={52} stroke={5} color={c.accent} progress={pct} value={`${Math.round(pct * 100)}`} />
                <Text style={[t.h2, { flex: 1 }]}>{g.title}</Text>
              </View>
              {mine.filter((x) => x.status === 'open').map((task) => (
                <View key={task.id} style={styles.row}>
                  <Text style={t.body}>{task.title}</Text>
                  {task.reschedule_count >= 3 && <Text style={styles.stuck}>stuck</Text>}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  card: { backgroundColor: c.card, borderRadius: radius.lg, padding: 16, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stuck: { color: c.warn, fontSize: 12, fontWeight: '600' },
});
