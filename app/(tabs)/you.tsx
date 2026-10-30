// §9 You: observations (deletable, labelled), permissions, hours, export, delete, privacy.
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteAccount, requestExport, signOut } from '@/lib/auth';
import { requestSleepPermission } from '@/lib/health';
import { addRoutineItem, fetchRoutine, removeRoutineItem } from '@/lib/routines';
import { supabase } from '@/lib/supabase';
import { c, t } from '@/lib/theme';
import { useLocal } from '@/store/local';

export default function You() {
  const router = useRouter();
  const store = useLocal();

  function dismissObservation(key: string) {
    // Screen updates immediately (§7); persist the dismissal.
    useLocal.setState({
      observations: store.observations.map((o) =>
        o.key === key ? { ...o, dismissed_at: new Date().toISOString() } : o,
      ),
    });
    if (store.userId)
      void supabase
        .from('observations')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('user_id', store.userId)
        .eq('key', key);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={t.h2}>What I've learned</Text>
        {store.observations.filter((o) => !o.dismissed_at).length === 0 && (
          <Text style={t.dim}>Nothing yet — patterns appear here as they're found.</Text>
        )}
        {store.observations
          .filter((o) => !o.dismissed_at)
          .map((o) => (
            <View key={o.key} style={styles.card}>
              <Text style={t.body}>{o.value}</Text>
              <View style={styles.rowBetween}>
                <Text style={t.dim}>
                  {o.source === 'corrected' ? 'you corrected me' : 'I noticed'} · {o.evidence_count}
                </Text>
                <Pressable onPress={() => dismissObservation(o.key)}>
                  <Text style={{ color: c.bad }}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}

        <Text style={t.h2}>Nightly routine</Text>
        <RoutineEditor userId={store.userId} />

        <Text style={t.h2}>Permissions</Text>
        <Row label="Connect sleep" onPress={() => requestSleepPermission()} />

        <Text style={t.h2}>Your data</Text>
        <Text style={t.dim}>
          Your tasks, sleep, and moods stay yours. Nothing is sold or shared. Export or delete anytime.
        </Text>
        <Row label="Export my data (email a JSON copy)" onPress={() => requestExport()} />
        <Row
          label="Delete my account"
          danger
          onPress={() =>
            Alert.alert('Delete account', 'This erases everything and cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteAccount() },
            ])
          }
        />
        <Row label="Sign out" onPress={() => signOut().then(() => router.replace('/onboarding'))} />
      </ScrollView>
    </SafeAreaView>
  );
}

function RoutineEditor({ userId }: { userId: string | null }) {
  const [label, setLabel] = useState('');
  const { data: items = [], refetch } = useQuery({
    queryKey: ['routine', userId],
    enabled: !!userId,
    queryFn: fetchRoutine,
  });

  return (
    <View style={{ gap: 8 }}>
      {items.map((it) => (
        <View key={it.id} style={styles.rowBetweenCard}>
          <Text style={t.body}>{it.label}</Text>
          <Pressable onPress={async () => { await removeRoutineItem(it.id); refetch(); }}>
            <Text style={{ color: c.bad }}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Add a routine item…"
          placeholderTextColor={c.dim}
          value={label}
          onChangeText={setLabel}
        />
        <Pressable
          style={styles.addBtn}
          onPress={async () => {
            if (!userId || !label.trim()) return;
            await addRoutineItem(userId, label.trim(), items.length);
            setLabel('');
            refetch();
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <Text style={{ color: danger ? c.bad : c.text, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  card: { backgroundColor: c.card, borderRadius: 12, padding: 16, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBetweenCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, borderRadius: 10, padding: 14 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addInput: { flex: 1, backgroundColor: c.card, borderRadius: 10, padding: 12, color: c.text, borderColor: c.line, borderWidth: 1 },
  addBtn: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
});
