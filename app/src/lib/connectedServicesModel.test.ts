import { describe, it, expect } from 'vitest';
import {
  SERVICES, mapOuraSleep, mapStravaActivity, parseOauthRedirect, redirectUriFor,
} from './connectedServicesModel';

describe('connected services model', () => {
  it('authorize URLs carry the client id, the basalt redirect, and read-only scopes', () => {
    const strava = SERVICES.find((s) => s.id === 'strava')!;
    const url = strava.authorizeUrl('123');
    expect(url).toContain('client_id=123');
    expect(url).toContain(encodeURIComponent('basalt://oauth/strava'));
    expect(url).toContain('scope=activity:read_all');
    expect(url).not.toMatch(/write/);
  });

  it('every service redirects to its own basalt:// path', () => {
    for (const s of SERVICES) {
      expect(redirectUriFor(s.id)).toBe(`basalt://oauth/${s.id}`);
      expect(s.authorizeUrl('x')).toContain(encodeURIComponent(`basalt://oauth/${s.id}`));
    }
  });

  it('parses redirect URLs and rejects everything else', () => {
    expect(parseOauthRedirect('basalt://oauth/strava?code=abc&scope=read')).toEqual({ service: 'strava', code: 'abc' });
    expect(parseOauthRedirect('basalt://oauth/oura?code=z')).toEqual({ service: 'oura', code: 'z' });
    expect(parseOauthRedirect('basalt://oauth/strava?error=access_denied')).toBeNull();
    expect(parseOauthRedirect('https://evil.example/oauth/strava?code=abc')).toBeNull();
    expect(parseOauthRedirect('basalt://oauth/fitbit?code=abc')).toBeNull();
  });

  it('maps a Strava activity with source, stable ext_id, and distance in words', () => {
    const s = mapStravaActivity({ id: 9, name: 'Morning Run', start_date: '2026-09-01T06:00:00Z', elapsed_time: 1800, distance: 5230 });
    expect(s).toEqual({
      source: 'strava',
      extId: 'strava:9',
      startedAt: '2026-09-01T06:00:00.000Z',
      endedAt: '2026-09-01T06:30:00.000Z',
      notes: 'Morning Run · 5.23 km · imported from Strava',
    });
    expect(mapStravaActivity({ id: 9 } as any)).toBeNull();
  });

  it('maps Oura sleep to a sleep session and rejects partial rows', () => {
    const s = mapOuraSleep({ id: 'a1', day: '2026-09-01', bedtime_start: '2026-08-31T22:10:00+10:00', bedtime_end: '2026-09-01T06:20:00+10:00' });
    expect(s?.source).toBe('oura');
    expect(s?.extId).toBe('oura:a1');
    expect(s?.date).toBe('2026-09-01');
    expect(mapOuraSleep({ id: 'a1', day: '2026-09-01' })).toBeNull();
  });
});
