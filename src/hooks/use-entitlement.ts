import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import { loadSubscription, trialState } from '@/src/services/subscriptions';

export function useEntitlement(userId?: string) {
  const profile = useQuery({
    queryKey: ['subscription-profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [profile, entitlement] = await Promise.all([
        supabase.from('profiles').select('onboarded_at').eq('id', userId!).single(),
        supabase.from('user_entitlements').select('trial_started_at').eq('user_id', userId!).maybeSingle(),
      ]);
      if (profile.error) throw profile.error;
      if (entitlement.error) throw entitlement.error;
      return { onboarded_at: entitlement.data?.trial_started_at ?? profile.data.onboarded_at };
    },
  });
  const subscription = useQuery({
    queryKey: ['subscription', userId],
    enabled: Boolean(userId),
    queryFn: () => loadSubscription(userId!),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const active = subscription.data?.active ?? false;
  return {
    ...trialState(profile.data?.onboarded_at, active),
    active,
    configured: subscription.data?.configured ?? false,
    packages: subscription.data?.packages ?? [],
    loading: profile.isLoading || subscription.isLoading,
    refresh: async () => { await Promise.all([profile.refetch(), subscription.refetch()]); },
  };
}
