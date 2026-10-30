// §12 Paywall. Shows on day 8, never blocks reads — it's a dismissible modal.
// Free tier keeps reading everything; only NEW AI calls/recommendations stop (server-enforced).
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';
import { Headline } from '@/components/Headline';
import { track } from '@/lib/analytics';
import { fetchPackages, purchase, restore } from '@/lib/purchases';
import { c, grad, radius, t } from '@/lib/theme';

export default function Paywall() {
  const router = useRouter();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchPackages().then(setPackages);
  }, []);

  async function buy(pkg: PurchasesPackage) {
    setBusy(true);
    const ok = await purchase(pkg);
    setBusy(false);
    if (ok) {
      track('subscribed');
      router.back();
    }
  }

  return (
    <LinearGradient colors={grad.hero} style={{ flex: 1 }}>
    <SafeAreaView style={styles.screen}>
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: 'center' }}>
        <Headline text="Keep the {plan} coming." />
        <Text style={t.dim}>
          Your trial's up. You can still read everything you've saved — subscribing turns the
          daily plan, corrections, and new AI back on.
        </Text>

        {packages.length === 0 && <Text style={t.dim}>Plans load once billing is configured.</Text>}
        {packages.map((pkg) => (
          <Pressable key={pkg.identifier} style={styles.plan} onPress={() => buy(pkg)} disabled={busy}>
            <Text style={t.h2}>{pkg.product.title}</Text>
            <Text style={t.dim}>{pkg.product.priceString}</Text>
          </Pressable>
        ))}

        {busy && <ActivityIndicator color={c.accent} />}

        <Pressable onPress={async () => (await restore()) && router.back()}>
          <Text style={[t.dim, { textAlign: 'center' }]}>Restore purchases</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={[t.dim, { textAlign: 'center' }]}>Not now — keep reading</Text>
        </Pressable>
      </View>
    </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  plan: { backgroundColor: 'rgba(23,23,31,0.85)', borderRadius: radius.md, padding: 18, borderColor: c.accent, borderWidth: 1, gap: 4 },
});
