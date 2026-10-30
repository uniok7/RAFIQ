// §12 RevenueCat. 7-day trial, no card up front. Paywall shows on day 8, never before,
// and never blocks reads. Free tier after trial: read everything, no new AI calls.
// The LLM rate limit is enforced SERVER-side against the entitlement (Edge Function).
import Constants from 'expo-constants';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

const apiKey = Constants.expoConfig?.extra?.revenueCatApiKey as string | undefined;
export const TRIAL_DAYS = 7;

export function initPurchases(userId: string) {
  if (!apiKey) return; // pre-billing dev
  Purchases.configure({ apiKey, appUserID: userId });
}

/** Client-side hint only (gates the paywall UI). Server is the source of truth. */
export async function hasActiveEntitlement(): Promise<boolean> {
  if (!apiKey) return true;
  try {
    const info = await Purchases.getCustomerInfo();
    return Object.keys(info.entitlements.active).length > 0;
  } catch {
    return false;
  }
}

/** Monthly + annual packages from the current offering (§12). Empty in dev. */
export async function fetchPackages(): Promise<PurchasesPackage[]> {
  if (!apiKey) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

export async function purchase(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return Object.keys(customerInfo.entitlements.active).length > 0;
  } catch {
    return false; // includes user cancellation
  }
}

export async function restore(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return Object.keys(info.entitlements.active).length > 0;
  } catch {
    return false;
  }
}

/** Whole days since account creation. Drives the day-8 paywall (§12). */
export function daysSince(createdAtIso: string | undefined): number {
  if (!createdAtIso) return 0;
  return Math.floor((Date.now() - Date.parse(createdAtIso)) / 86400000);
}
