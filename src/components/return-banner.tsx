import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { useTimerStore } from '@/src/stores/timer-store';
import { colors, spacing } from '@/src/theme/tokens';

export function ReturnBanner() {
  const phase = useTimerStore((state) => state.phase);
  const taskTitle = useTimerStore((state) => state.taskTitle);
  if (phase !== 'return' || !taskTitle) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/timer')} style={styles.banner}>
      <Text style={styles.kicker}>BREAK’S OVER</Text>
      <Text numberOfLines={1} style={styles.text}>Back to {taskTitle} →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', zIndex: 100, top: 0, left: 0, right: 0, backgroundColor: colors.citrus, paddingTop: 52, paddingBottom: spacing.md, paddingHorizontal: spacing.lg, shadowColor: colors.black, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  kicker: { color: colors.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  text: { color: colors.ink, fontSize: 17, lineHeight: 24, fontWeight: '900', marginTop: 2 },
});
