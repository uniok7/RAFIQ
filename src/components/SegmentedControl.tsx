// Pill segmented control (METRIC/IMPERIAL, SETS/INSTRUCTIONS in the reference).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { c, radius } from '@/lib/theme';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.seg, active && styles.segActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.text, active && styles.textActive]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: c.card, borderRadius: radius.pill, padding: 4 },
  seg: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  segActive: { backgroundColor: c.cardHi },
  text: { color: c.dim, fontWeight: '600', fontSize: 13, letterSpacing: 0.5 },
  textActive: { color: c.text },
});
