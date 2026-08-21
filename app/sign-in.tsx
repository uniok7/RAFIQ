import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { Button } from '@/src/components/button';
import { Screen } from '@/src/components/screen';
import { env } from '@/src/lib/env';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing } from '@/src/theme/tokens';

WebBrowser.maybeCompleteAuthSession();

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  if (!params.access_token || !params.refresh_token) return;
  const { error } = await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
  if (error) throw error;
}

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function magicLink() {
    if (!email.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: makeRedirectUri({ scheme: 'onething', path: 'auth/callback' }) },
      });
      if (error) throw error;
      setMessage('Check your email. The link will bring you straight back.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign-in did not go through.');
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    setMessage('');
    try {
      const redirectTo = makeRedirectUri({ scheme: 'onething', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
      if (error) throw error;
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') await createSessionFromUrl(result.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign-in did not go through.');
    } finally {
      setLoading(false);
    }
  }

  async function apple() {
    setLoading(true);
    setMessage('');
    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
      if (error) throw error;
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') setMessage(error instanceof Error ? error.message : 'Sign-in did not go through.');
    } finally {
      setLoading(false);
    }
  }

  if (!env.isSupabaseConfigured) {
    return (
      <Screen scroll={false}>
        <View style={styles.hero}>
          <Text style={styles.mark}>1</Text>
          <Text accessibilityRole="header" style={styles.title}>One thing, clearly.</Text>
          <Text style={styles.body}>Add your Supabase public URL and anon key to `.env` to enable secure sign-in.</Text>
          <View style={styles.notice}><Text style={styles.noticeText}>Configuration is intentionally not bundled with the app.</Text></View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <Text style={styles.mark}>1</Text>
        <Text accessibilityRole="header" style={styles.title}>One thing, clearly.</Text>
        <Text style={styles.body}>Tell me where you’re going. I’ll help choose the next honest step.</Text>
      </View>
      <View style={styles.form}>
        {Platform.OS === 'ios' ? <Button loading={loading} onPress={apple}>Continue with Apple</Button> : null}
        <Button variant="secondary" loading={loading} onPress={google}>Continue with Google</Button>
        <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>or</Text><View style={styles.line} /></View>
        <TextInput accessibilityLabel="Email address" autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} onSubmitEditing={magicLink} placeholder="you@example.com" placeholderTextColor={colors.muted} style={styles.input} value={email} />
        <Button variant="secondary" disabled={!email.trim()} loading={loading} onPress={magicLink}>Email me a magic link</Button>
        {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', paddingTop: spacing.xxl },
  mark: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', backgroundColor: colors.citrus, color: colors.ink, fontSize: 24, fontWeight: '900', marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 46, lineHeight: 49, fontWeight: '900', letterSpacing: -2 },
  body: { color: colors.muted, fontSize: 19, lineHeight: 28, marginTop: spacing.md, maxWidth: 340 },
  notice: { marginTop: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.citrus, paddingLeft: spacing.md },
  noticeText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  form: { gap: spacing.sm, paddingBottom: spacing.xl },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  or: { color: colors.muted, fontSize: 13 },
  input: { minHeight: 54, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: radius.pill, paddingHorizontal: spacing.lg, color: colors.ink, fontSize: 16 },
  message: { color: colors.moss, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: spacing.xs },
});
