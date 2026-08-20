import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseClient } from '@basalt/core-data';

// The one Supabase client. Only the URL + publishable key live in the
// bundle (EXPO_PUBLIC_*) — no secrets, ever; privileged operations go
// through Edge Functions.

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy app/.env.example to app/.env.',
  );
}

export const supabase = createSupabaseClient({ url, anonKey, storage: AsyncStorage });
