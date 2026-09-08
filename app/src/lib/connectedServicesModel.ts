// Connected services (imports Extra) — Strava, Garmin, Oura. Pure model:
// authorize URLs, redirect parsing, and the row-mapping from each API's
// payload to Basalt's own tables. Everything here is dormant until the
// developer registrations in docs/REGISTRATIONS.md exist; the client ids
// arrive via EXPO_PUBLIC_* env and the secrets NEVER leave the server
// (token exchange runs in the oauth-exchange Edge Function).

export type ServiceId = 'strava' | 'garmin' | 'oura';

export const OAUTH_REDIRECT_SCHEME = 'basalt';
export const REGISTRATION_NOTE = 'Coming soon — needs developer registration';

export function redirectUriFor(service: ServiceId): string {
  return `${OAUTH_REDIRECT_SCHEME}://oauth/${service}`;
}

export type ServiceDef = {
  id: ServiceId;
  name: string;
  /** What Basalt reads, in plain words on the row. */
  reads: string;
  clientIdEnv: string;
  authorizeUrl: (clientId: string) => string;
};

export const SERVICES: readonly ServiceDef[] = [
  {
    id: 'strava',
    name: 'Strava',
    reads: 'activities → sessions, source “strava”, never edited',
    clientIdEnv: 'EXPO_PUBLIC_STRAVA_CLIENT_ID',
    authorizeUrl: (clientId) =>
      'https://www.strava.com/oauth/mobile/authorize'
      + `?client_id=${encodeURIComponent(clientId)}`
      + `&redirect_uri=${encodeURIComponent(redirectUriFor('strava'))}`
      + '&response_type=code&approval_prompt=auto&scope=activity:read_all',
  },
  {
    id: 'garmin',
    name: 'Garmin',
    reads: 'activities and sleep via Garmin Health — needs their approved program',
    clientIdEnv: 'EXPO_PUBLIC_GARMIN_CLIENT_ID',
    authorizeUrl: (clientId) =>
      'https://connect.garmin.com/oauth2Confirm'
      + `?client_id=${encodeURIComponent(clientId)}`
      + `&redirect_uri=${encodeURIComponent(redirectUriFor('garmin'))}`
      + '&response_type=code',
  },
  {
    id: 'oura',
    name: 'Oura',
    reads: 'sleep → sleep sessions, source “oura”, stages display-only as always',
    clientIdEnv: 'EXPO_PUBLIC_OURA_CLIENT_ID',
    authorizeUrl: (clientId) =>
      'https://cloud.ouraring.com/oauth/authorize'
      + `?client_id=${encodeURIComponent(clientId)}`
      + `&redirect_uri=${encodeURIComponent(redirectUriFor('oura'))}`
      + '&response_type=code&scope=daily+session+sleep',
  },
] as const;

/** Parse `basalt://oauth/<service>?code=...` — null for anything else. */
export function parseOauthRedirect(url: string): { service: ServiceId; code: string } | null {
  const m = url.match(/^basalt:\/\/oauth\/(strava|garmin|oura)\?(.*)$/);
  if (!m) return null;
  const params = new URLSearchParams(m[2]);
  const code = params.get('code');
  if (!code) return null;
  return { service: m[1] as ServiceId, code };
}

// ── Row mapping — imported rows carry source + a stable ext_id so
//    re-imports are no-ops, exactly like the CSV importer ─────────────────

export type SessionInsert = {
  source: ServiceId;
  extId: string;
  startedAt: string;
  endedAt: string | null;
  notes: string;
};

export type SleepInsert = {
  source: ServiceId;
  extId: string;
  date: string;
  bedtime: string;
  waketime: string;
};

/** Strava /athlete/activities item → session. Distance stated in the notes. */
export function mapStravaActivity(a: {
  id: number | string;
  name?: string;
  sport_type?: string;
  start_date?: string;
  elapsed_time?: number;
  distance?: number;
}): SessionInsert | null {
  if (!a?.id || !a.start_date || typeof a.elapsed_time !== 'number') return null;
  const started = Date.parse(a.start_date);
  if (Number.isNaN(started)) return null;
  const km = typeof a.distance === 'number' && a.distance > 0 ? ` · ${(a.distance / 1000).toFixed(2)} km` : '';
  return {
    source: 'strava',
    extId: `strava:${a.id}`,
    startedAt: new Date(started).toISOString(),
    endedAt: new Date(started + a.elapsed_time * 1000).toISOString(),
    notes: `${a.name ?? a.sport_type ?? 'Activity'}${km} · imported from Strava`,
  };
}

/** Oura v2 sleep item → sleep session. */
export function mapOuraSleep(s: {
  id?: string;
  day?: string;
  bedtime_start?: string;
  bedtime_end?: string;
}): SleepInsert | null {
  if (!s?.id || !s.day || !s.bedtime_start || !s.bedtime_end) return null;
  if (Number.isNaN(Date.parse(s.bedtime_start)) || Number.isNaN(Date.parse(s.bedtime_end))) return null;
  return {
    source: 'oura',
    extId: `oura:${s.id}`,
    date: s.day,
    bedtime: s.bedtime_start,
    waketime: s.bedtime_end,
  };
}
