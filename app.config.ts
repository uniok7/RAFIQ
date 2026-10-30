import type { ExpoConfig } from 'expo/config';

// Dev build required (HealthKit / Health Connect are native modules — not Expo Go). §2, §11.
const config: ExpoConfig = {
  name: 'Rafiq',
  slug: 'one-thing',
  scheme: 'onething',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: false,
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.onething.app',
    infoPlist: {
      NSHealthShareUsageDescription:
        "One Thing reads last night's sleep to decide how hard to push you today.",
      NSCalendarsUsageDescription: 'One Thing reads your calendar to see what is already fixed in your week.',
    },
  },
  android: {
    package: 'com.onething.app',
    permissions: ['android.permission.health.READ_SLEEP', 'android.permission.SCHEDULE_EXACT_ALARM'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-notifications',
    ['react-native-health', { isClinicalDataEnabled: false }],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    revenueCatApiKey: process.env.EXPO_PUBLIC_REVENUECAT_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
  },
};

export default config;
