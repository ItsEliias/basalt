import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { startSession, endSession } from '@basalt/training';
import { currentUserId } from '@basalt/core-data';
import { supabase } from './supabase';
import {
  SERVICES, mapOuraSleep, mapStravaActivity, parseOauthRedirect, type ServiceId,
} from './connectedServicesModel';

// Runtime for connected services. Dormant until the registrations exist:
// availability is "the EXPO_PUBLIC_*_CLIENT_ID env var is set", and the
// token exchange happens in the oauth-exchange Edge Function so the client
// secret never ships in the bundle. Tokens live in app-private storage;
// disconnecting deletes them.

const TOKEN_PREFIX = 'basalt.oauth.';

const CLIENT_IDS: Record<ServiceId, string | undefined> = {
  strava: process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID,
  garmin: process.env.EXPO_PUBLIC_GARMIN_CLIENT_ID,
  oura: process.env.EXPO_PUBLIC_OURA_CLIENT_ID,
};

export function serviceAvailable(id: ServiceId): boolean {
  return !!CLIENT_IDS[id];
}

export async function isConnected(id: ServiceId): Promise<boolean> {
  return !!(await AsyncStorage.getItem(TOKEN_PREFIX + id));
}

export async function disconnect(id: ServiceId): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_PREFIX + id);
}

/** Open the service's authorize page; the redirect lands in handleOauthUrl. */
export async function connect(id: ServiceId): Promise<void> {
  const def = SERVICES.find((s) => s.id === id)!;
  const clientId = CLIENT_IDS[id];
  if (!clientId) return;
  await Linking.openURL(def.authorizeUrl(clientId));
}

/**
 * Deep-link entry: exchange the code server-side, keep the token, run the
 * first import. Returns a plain-words outcome for the caller to show.
 */
export async function handleOauthUrl(url: string): Promise<string | null> {
  const parsed = parseOauthRedirect(url);
  if (!parsed) return null;
  const { data, error } = await supabase.functions.invoke('oauth-exchange', {
    body: { service: parsed.service, code: parsed.code },
  });
  if (error || !data?.accessToken) {
    return `Could not connect ${parsed.service} — ${data?.error ?? error?.message ?? 'exchange failed'}.`;
  }
  await AsyncStorage.setItem(TOKEN_PREFIX + parsed.service, String(data.accessToken));
  const imported = await runImport(parsed.service);
  return `${parsed.service} connected — ${imported}`;
}

/** Pull recent rows and write them through the service layer, deduped by ext_id. */
export async function runImport(id: ServiceId): Promise<string> {
  const token = await AsyncStorage.getItem(TOKEN_PREFIX + id);
  if (!token) return 'not connected';
  try {
    if (id === 'strava') {
      const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return `Strava said ${res.status}`;
      const rows = (await res.json()) as unknown[];
      let n = 0;
      for (const raw of Array.isArray(rows) ? rows : []) {
        const m = mapStravaActivity(raw as any);
        if (!m) continue;
        const s = await startSession(supabase, {
          source: m.source, extId: m.extId, startedAt: m.startedAt, notes: m.notes,
        });
        // ext_id unique index makes a re-import a refused insert — a no-op.
        if (s.ok) {
          n += 1;
          if (m.endedAt) await endSession(supabase, s.data.id, { endedAt: m.endedAt });
        }
      }
      return `${n} new ${n === 1 ? 'session' : 'sessions'}`;
    }
    if (id === 'oura') {
      const res = await fetch('https://api.ouraring.com/v2/usercollection/sleep', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return `Oura said ${res.status}`;
      const body = (await res.json()) as { data?: unknown[] };
      const u = await currentUserId(supabase);
      if (!u.ok) return 'not signed in';
      let n = 0;
      for (const raw of body.data ?? []) {
        const m = mapOuraSleep(raw as any);
        if (!m) continue;
        const existing = await supabase
          .from('basalt_sleep_sessions')
          .select('id')
          .eq('user_id', u.data)
          .eq('ext_id', m.extId)
          .maybeSingle();
        if (existing.data) continue;
        const ins = await supabase.from('basalt_sleep_sessions').insert({
          user_id: u.data, date: m.date, bedtime: m.bedtime, waketime: m.waketime,
          source: m.source, ext_id: m.extId,
        });
        if (!ins.error) n += 1;
      }
      return `${n} new ${n === 1 ? 'night' : 'nights'}`;
    }
    // Garmin's Health API is push-based behind an approved program; the
    // authorize flow lands here but the pull is registered work — stated
    // plainly on the row until then.
    return 'Garmin import needs their approved program — see docs/REGISTRATIONS.md';
  } catch (e) {
    return `import failed: ${e instanceof Error ? e.message : 'network error'}`;
  }
}
