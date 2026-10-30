import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { c } from '@/lib/theme';

const icon = (glyph: string) => ({ color }: { color: string }) => (
  <Text style={{ color, fontSize: 20 }}>{glyph}</Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.dim,
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: icon('◎') }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals', tabBarIcon: icon('◇') }} />
      {/* AI sheet — persistent button in the tab bar (§9) */}
      <Tabs.Screen name="assistant" options={{ title: 'AI', tabBarIcon: icon('✦') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: icon('●') }} />
    </Tabs>
  );
}
