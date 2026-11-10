// Gives iOS and Android a localStorage for the session (see session-storage.ts).
import './session-storage';

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in mobile/.env (see .env.example).');
}

// In development on a phone, 127.0.0.1 is the phone itself. Swap in the address of the computer
// running Metro, which also runs the local Supabase stack.
function reachableUrl(raw: string): string {
  if (!__DEV__ || Platform.OS === 'web') return raw;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (!host || !/^\d+\.\d+\.\d+\.\d+$/.test(host)) return raw;
  return raw.replace(/\/\/(127\.0\.0\.1|localhost)(?=[:/]|$)/, `//${host}`);
}

export const supabase = createClient<Database>(reachableUrl(url), key, {
  auth: {
    // Read from globalThis: a bare `localStorage` throws while the web build renders on the server.
    storage: globalThis.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Google sign-in returns a one-time code to /auth/callback, which exchanges it (auth.tsx).
    flowType: 'pkce',
    detectSessionInUrl: false,
  },
});

// Refresh the session only while the app is in the foreground. The browser handles this on web.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
