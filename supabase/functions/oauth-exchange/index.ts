// oauth-exchange — swaps an OAuth authorization code for tokens, with the
// client secrets held HERE, never in the app bundle. Dormant by design:
// until the developer registrations exist (docs/REGISTRATIONS.md) the env
// vars are unset and this returns a plain-words 501.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ServiceId = 'strava' | 'garmin' | 'oura';

const TOKEN_ENDPOINTS: Record<ServiceId, string> = {
  strava: 'https://www.strava.com/oauth/token',
  garmin: 'https://diauth.garmin.com/di-oauth2-service/oauth/token',
  oura: 'https://api.ouraring.com/oauth/token',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let body: { service?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const service = body.service as ServiceId;
  if (!['strava', 'garmin', 'oura'].includes(service) || !body.code) {
    return json({ error: 'Bad request.' }, 400);
  }

  const clientId = Deno.env.get(`${service.toUpperCase()}_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${service.toUpperCase()}_CLIENT_SECRET`);
  if (!clientId || !clientSecret) {
    return json({ error: `${service} is not registered yet — see docs/REGISTRATIONS.md.` }, 501);
  }

  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: body.code,
    grant_type: 'authorization_code',
    redirect_uri: `basalt://oauth/${service}`,
  });
  const res = await fetch(TOKEN_ENDPOINTS[service], {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) {
    return json({ error: `${service} token exchange failed (${res.status}).` }, 502);
  }
  const tokens = (await res.json()) as { access_token?: string; refresh_token?: string; expires_at?: number };
  if (!tokens.access_token) {
    return json({ error: `${service} returned no token.` }, 502);
  }
  return json({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expires_at ?? null,
  });
});
