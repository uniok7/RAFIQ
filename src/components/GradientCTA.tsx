// Full-width rounded gradient button pinned at the bottom of a flow (OxeAI CTA).
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';
import { grad, radius } from '@/lib/theme';

export function GradientCTA({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={{ opacity: disabled ? 0.45 : 1 }}>
      <LinearGradient colors={grad.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius.pill, paddingVertical: 17, alignItems: 'center' },
  label: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
