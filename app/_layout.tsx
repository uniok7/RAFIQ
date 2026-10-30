import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { daysSince, hasActiveEntitlement, initPurchases, TRIAL_DAYS } from '@/lib/purchases';
import { supabase } from '@/lib/supabase';
import { useLocal } from '@/store/local';

const dsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
if (dsn) Sentry.init({ dsn, tracesSampleRate: 0.2 });

const queryClient = new QueryClient();

function useAuthRedirect(sessionUserId: string | null | undefined, ready: boolean) {
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    const inApp = segments[0] === '(tabs)';
    if (!sessionUserId && inApp) router.replace('/onboarding');
    if (sessionUserId && !inApp && segments[0] !== 'onboarding') router.replace('/(tabs)/today');
  }, [sessionUserId, segments, ready, router]);
}

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const setUser = useLocal((s) => s.setUser);
  const sync = useLocal((s) => s.sync);

  // §12: on day 8+, if the trial has lapsed and there's no entitlement, surface the
  // paywall once. It's a dismissible modal — reading existing data is never blocked.
  async function maybePaywall(createdAt: string | undefined) {
    if (daysSince(createdAt) < TRIAL_DAYS) return;
    if (await hasActiveEntitlement()) return;
    router.push('/paywall');
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      const id = user?.id ?? null;
      setUserId(id);
      setUser(id);
      setReady(true);
      if (id) {
        initPurchases(id);
        void sync();
        void maybePaywall(user?.created_at);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const id = session?.user?.id ?? null;
      setUserId(id);
      setUser(id);
      if (id) {
        initPurchases(id);
        void sync();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [setUser, sync]);

  useAuthRedirect(userId, ready);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F1115' } }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="timer" options={{ presentation: 'modal' }} />
        <Stack.Screen name="night-review" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tired" options={{ presentation: 'modal' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      </Stack>
    </QueryClientProvider>
  );
}
