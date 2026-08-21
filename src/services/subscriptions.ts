import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { env } from '@/src/lib/env';
import { supabase } from '@/src/lib/supabase';
export { trialState } from '@/src/services/access';

let configuredUserId: string | null = null;

export type SubscriptionSnapshot = {
  active: boolean;
  configured: boolean;
  packages: PurchasesPackage[];
};

function publicKey() {
  if (Platform.OS === 'ios') return env.revenueCatIosKey;
  if (Platform.OS === 'android') return env.revenueCatAndroidKey;
  return '';
}

function isActive(info: CustomerInfo) {
  return Boolean(info.entitlements.active[env.revenueCatEntitlementId]);
}

async function configure(userId: string) {
  const apiKey = publicKey();
  if (!apiKey) return false;
  if (configuredUserId !== userId) {
    if (configuredUserId) await Purchases.logIn(userId);
    else Purchases.configure({ apiKey, appUserID: userId });
    configuredUserId = userId;
  }
  return true;
}

async function syncServerEntitlement() {
  const { error } = await supabase.functions.invoke('account', { body: { action: 'sync_entitlement' } });
  if (error) throw error;
}

export async function loadSubscription(userId: string): Promise<SubscriptionSnapshot> {
  if (!(await configure(userId))) return { active: false, configured: false, packages: [] };
  const [info, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
  await syncServerEntitlement();
  return { active: isActive(info), configured: true, packages: offerings.current?.availablePackages ?? [] };
}

export async function purchase(userId: string, selected: PurchasesPackage) {
  if (!(await configure(userId))) throw new Error('revenuecat_not_configured');
  const result = await Purchases.purchasePackage(selected);
  await syncServerEntitlement();
  return isActive(result.customerInfo);
}

export async function restore(userId: string) {
  if (!(await configure(userId))) throw new Error('revenuecat_not_configured');
  const info = await Purchases.restorePurchases();
  await syncServerEntitlement();
  return isActive(info);
}
