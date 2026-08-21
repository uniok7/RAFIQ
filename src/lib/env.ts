const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  isSupabaseConfigured:
    supabaseUrl.startsWith('https://') && supabaseAnonKey.length > 20,
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim() ?? '',
  revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim() ?? '',
  revenueCatEntitlementId: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || 'pro',
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? '',
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com',
};
