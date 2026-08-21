import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

import { env } from '@/src/lib/env';

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const fallbackUrl = 'https://not-configured.supabase.co';
const fallbackKey = 'not-configured-anon-key-for-local-ui-only';

export const supabase = createClient(
  env.supabaseUrl || fallbackUrl,
  env.supabaseAnonKey || fallbackKey,
  {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
