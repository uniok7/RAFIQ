// §7: every AI claim is tappable, revealing 2–3 corrections specific to it.
// ≤3 taps, no modal, no free text, no "are you sure". Screen updates immediately.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { c, t } from '@/lib/theme';

export interface Correction {
  label: string;
  onPick: () => void;
}

export function CorrectableClaim({
  text,
  corrections,
  large,
}: {
  text: string;
  corrections: Correction[];
  large?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityHint="Tap to correct this"
      >
        <Text style={large ? t.body : t.dim}>
          {text} <Text style={{ color: c.accent }}>✎</Text>
        </Text>
      </Pressable>
      {open && (
        <View style={styles.tray}>
          {corrections.map((corr) => (
            <Pressable
              key={corr.label}
              style={styles.chip}
              onPress={() => {
                corr.onPick(); // never argue — apply immediately, log the disagreement elsewhere
                setOpen(false);
              }}
              accessibilityRole="button"
            >
              <Text style={{ color: c.text }}>{corr.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    backgroundColor: c.card,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
