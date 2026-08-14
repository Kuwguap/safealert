import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Real Supabase Auth + Postgres client. The publishable anon key is meant to
// ship in the client; data access is governed by the RLS policies on
// public.profiles / safealert_bulletins / safealert_events.
export const SUPABASE_URL = 'https://vzrabcnknbycmdbmvdso.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_rMz6Dp7xX9cYlz9x9ax79A_8OcwC4fY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // pick up the token from a password-reset link on web only
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// The signed-in user's access token (for authenticated REST calls); null when
// logged out — RLS then denies, which is the intended behaviour.
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
