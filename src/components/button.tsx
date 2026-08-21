import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, radius, spacing } from '@/src/theme/tokens';

type ButtonProps = PressableProps & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};

export function Button({ children, variant = 'primary', loading, disabled, ...props }: PropsWithChildren<ButtonProps>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.ink} />
      ) : (
        <Text style={[styles.label, variant === 'primary' && styles.primaryLabel, variant === 'danger' && styles.dangerLabel]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: radius.pill, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  primary: { backgroundColor: colors.moss },
  secondary: { backgroundColor: colors.paper, borderColor: colors.line },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: '#F8E4DE', borderColor: '#EBC4BA' },
  label: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  primaryLabel: { color: colors.white },
  dangerLabel: { color: colors.danger },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.86 },
  disabled: { opacity: 0.45 },
});
