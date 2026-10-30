import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const url = Constants.expoConfig?.extra?.supabaseUrl as string;
const anon = Constants.expoConfig?.extra?.supabaseAnonKey as string;

// §4: session persisted with expo-secure-store. SecureStore has a ~2KB/value ceiling;
// Supabase tokens fit, but we fall back to AsyncStorage if a value is ever oversized.
// ponytail: direct SecureStore adapter; add AES-in-AsyncStorage (Supabase LargeSecureStore) only if tokens outgrow 2KB.
const storage = {
  getItem: (k: string) => SecureStore.getItemAsync(k).catch(() => AsyncStorage.getItem(k)),
  setItem: (k: string, v: string) =>
    SecureStore.setItemAsync(k, v).catch(() => AsyncStorage.setItem(k, v)),
  removeItem: (k: string) =>
    SecureStore.deleteItemAsync(k).catch(() => AsyncStorage.removeItem(k)),
};

export const supabase = createClient(url, anon, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
