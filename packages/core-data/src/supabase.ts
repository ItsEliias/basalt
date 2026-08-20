import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';

// Factory mirroring the source app's supabase.ts auth options exactly
// (autoRefreshToken/persistSession/detectSessionInUrl). Env reads and the
// storage adapter (e.g. React Native's AsyncStorage) stay app-side — the
// package never imports platform-specific storage or reads process.env.
export type SupabaseClientConfig = {
  url: string;
  anonKey: string;
  /** App-supplied storage adapter (e.g. AsyncStorage on React Native).
   *  Omit for environments with no persistent session storage (tests,
   *  scripts) — matches supabase-js's own default in that case. */
  storage?: SupportedStorage;
};

export function createSupabaseClient(config: SupabaseClientConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      storage: config.storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
