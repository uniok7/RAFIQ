import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/src/theme/tokens';

export function Screen({ children, title, eyebrow, right, scroll = true }: PropsWithChildren<{ title?: string; eyebrow?: string; right?: ReactNode; scroll?: boolean }>) {
  const content = (
    <View style={styles.content}>
      {(title || eyebrow || right) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : null}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );

  return <SafeAreaView edges={['top']} style={styles.safe}>{scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.lg, marginBottom: spacing.xl },
  headerText: { flex: 1 },
  eyebrow: { color: colors.moss, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: spacing.xs },
  title: { color: colors.ink, fontSize: 36, lineHeight: 41, fontWeight: '800', letterSpacing: -1.2 },
});
