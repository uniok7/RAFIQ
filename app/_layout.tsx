import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AccessibilityInfo } from 'react-native';

import { useAuth } from '@/src/hooks/use-auth';
import { ReturnBanner } from '@/src/components/return-banner';
import { useTimerClock } from '@/src/hooks/use-timer-clock';
import { supabase } from '@/src/lib/supabase';
import { useOnboardingStore } from '@/src/stores/onboarding-store';
import { useEntitlement } from '@/src/hooks/use-entitlement';
import { localDay } from '@/src/lib/dates';
import { track } from '@/src/services/telemetry';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useTimerClock();
  const completedUserId = useOnboardingStore((state) => state.completedUserId);
  const completedLocally = completedUserId === user?.id;
  const resetOnboarding = useOnboardingStore((state) => state.reset);
  const access = useEntitlement(user?.id);
  const [reduceMotion, setReduceMotion] = useState(false);
  const profile = useQuery({
    queryKey: ['profile-onboarding', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('onboarded_at').eq('id', user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (completedUserId && completedUserId !== user?.id) resetOnboarding();
  }, [completedUserId, resetOnboarding, user?.id]);

  useEffect(() => {
    if (loading || (user && profile.isLoading)) return;
    const inAuth = segments[0] === 'sign-in';
    const inOnboarding = segments[0] === 'onboarding';
    const onboarded = completedLocally || Boolean(profile.data?.onboarded_at);
    if (!user && !inAuth && !inOnboarding) router.replace('/onboarding');
    if (user && !onboarded && !inOnboarding) router.replace('/onboarding');
    if (user && onboarded && (inAuth || inOnboarding)) router.replace('/(tabs)');
  }, [completedLocally, loading, profile.data?.onboarded_at, profile.isLoading, router, segments, user]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!user || access.loading || !profile.data?.onboarded_at) return;
    const trialKey = `one-thing-trial-started-${user.id}`;
    void AsyncStorage.getItem(trialKey).then((seen) => {
      if (!seen) { track('trial_started', { trialDays: 7 }); void AsyncStorage.setItem(trialKey, '1'); }
    });
    if (!access.expired || segments[0] === 'paywall') return;
    const promptKey = `one-thing-paywall-${user.id}-${localDay()}`;
    void AsyncStorage.getItem(promptKey).then((seen) => {
      if (!seen) { void AsyncStorage.setItem(promptKey, '1'); router.push('/paywall'); }
    });
  }, [access.expired, access.loading, profile.data?.onboarded_at, router, segments, user]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'fade' }}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="timer" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="sleep" />
        <Stack.Screen name="night-review" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="assistant" options={{ presentation: 'modal' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      </Stack>
      <ReturnBanner />
    </>
  );
}

function RootLayout() {
  return <QueryClientProvider client={queryClient}><RootNavigator /></QueryClientProvider>;
}

export default Sentry.wrap(RootLayout);
