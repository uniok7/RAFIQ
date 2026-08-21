import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/src/theme/tokens';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = { index: 'sunny-outline', goals: 'flag-outline', progress: 'pulse-outline', you: 'person-outline' };

export default function TabLayout() {
  return (
    <Tabs screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.moss,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { height: 76, paddingTop: 8, paddingBottom: 12, backgroundColor: colors.paper, borderTopColor: colors.line },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      tabBarIcon: ({ color, size }) => <Ionicons color={color} name={icons[route.name] ?? 'ellipse-outline'} size={size} />,
    })}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
      <Tabs.Screen name="ai" options={{
        title: 'Ask',
        tabBarButton: () => <Pressable accessibilityLabel="Ask One Thing" accessibilityRole="button" onPress={() => router.push('/assistant')} style={styles.ask}><Ionicons color={colors.white} name="sparkles" size={20} /><Text style={styles.askText}>Ask</Text></Pressable>,
      }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({ ask: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: -18, width: 62, height: 62, borderRadius: 31, backgroundColor: colors.ink }, askText: { color: colors.white, fontSize: 10, fontWeight: '800', marginTop: 2 } });
