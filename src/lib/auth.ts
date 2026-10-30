// §4: Apple, Google, email magic link. No password fields anywhere.
import { supabase } from './supabase';

export async function signInWithMagicLink(email: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithOtp({ email });
  return { error: error?.message };
}

// Apple / Google use native identity tokens from expo-apple-authentication /
// Google sign-in, exchanged via signInWithIdToken. Wire the native token providers
// in the dev build; the exchange is identical below.
export async function signInWithIdToken(
  provider: 'apple' | 'google',
  idToken: string,
): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithIdToken({ provider, token: idToken });
  return { error: error?.message };
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** §4: account deletion — cascades all rows + revokes the auth user (Edge Function). */
export async function deleteAccount(): Promise<{ error?: string }> {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (!error) await supabase.auth.signOut();
  return { error: error?.message };
}

/** §4/§13: export — Edge Function emails a JSON dump of every table for this user. */
export async function requestExport(): Promise<{ error?: string }> {
  const { error } = await supabase.functions.invoke('export-data', { body: {} });
  return { error: error?.message };
}
