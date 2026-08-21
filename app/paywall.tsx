import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';

import { Button } from '@/src/components/button';
import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/hooks/use-auth';
import { useEntitlement } from '@/src/hooks/use-entitlement';
import { purchase, restore } from '@/src/services/subscriptions';
import { captureError, track } from '@/src/services/telemetry';
import { colors, radius, spacing } from '@/src/theme/tokens';

export default function PaywallScreen() {
  const { user } = useAuth();
  const access = useEntitlement(user?.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function buy(item: PurchasesPackage) {
    if (!user) return;
    setBusy(item.identifier); setMessage('');
    try {
      if (await purchase(user.id, item)) {
        const type = item.packageType === 'MONTHLY' ? 'monthly' : item.packageType === 'ANNUAL' ? 'annual' : 'other';
        track('subscribed', { packageType: type });
        await access.refresh();
        router.back();
      }
    } catch (error) { captureError(error); setMessage('Purchase was not completed. Nothing was charged here.'); }
    finally { setBusy(null); }
  }

  async function restorePurchase() {
    if (!user) return;
    setBusy('restore'); setMessage('');
    try {
      if (await restore(user.id)) { await access.refresh(); router.back(); }
      else setMessage('No active subscription was found for this store account.');
    } catch (error) { captureError(error); setMessage('Restore could not connect. Try again when you are online.'); }
    finally { setBusy(null); }
  }

  return (
    <Screen eyebrow="Keep the planning layer" title="One Thing Pro">
      <View style={styles.hero}><Text style={styles.seven}>7</Text><Text style={styles.heroTitle}>days were free. No card up front.</Text><Text style={styles.heroBody}>Your tasks, history, observations, and exports remain readable. Pro creates new daily recommendations and handles natural-language changes.</Text></View>
      {access.packages.map((item) => <Button key={item.identifier} loading={busy === item.identifier} onPress={() => void buy(item)}>{item.product.title} · {item.product.priceString}</Button>)}
      {!access.configured ? <View style={styles.note}><Text style={styles.noteText}>Purchases are ready in code. Add the RevenueCat public keys and current offering before release.</Text></View> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      <Button loading={busy === 'restore'} variant="secondary" onPress={() => void restorePurchase()}>Restore purchases</Button>
      <Button variant="ghost" onPress={() => router.back()}>Keep using the free reader</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  seven: { color: colors.citrus, fontSize: 76, lineHeight: 80, fontWeight: '900' },
  heroTitle: { color: colors.white, fontSize: 27, lineHeight: 33, fontWeight: '900' },
  heroBody: { color: colors.mossSoft, fontSize: 15, lineHeight: 23, marginTop: spacing.sm },
  note: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, marginVertical: spacing.md },
  noteText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  message: { color: colors.danger, fontSize: 14, lineHeight: 21, marginVertical: spacing.md },
});
