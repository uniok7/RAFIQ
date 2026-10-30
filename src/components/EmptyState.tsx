// §9: never a blank screen — show the counter and what unlocks it.
import { StyleSheet, Text, View } from 'react-native';
import { c, t } from '@/lib/theme';

export function EmptyState({ counter, hint }: { counter: string; hint: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={[t.h2, { textAlign: 'center' }]}>{counter}</Text>
      <Text style={[t.dim, { textAlign: 'center', marginTop: 8 }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 4 },
});
