import { createClient } from 'npm:@supabase/supabase-js@2';

// beacon — user-initiated live-location sharing. Explicit start, explicit
// stop, hard auto-expiry (2 h). The share URL carries the row's uuid as an
// unguessable token; anyone holding the link sees ONLY the latest position
// while the beacon is active — no name, no history, no route.
//
// Deployed with verify_jwt OFF because the public GET must work without
// auth; every mutating action validates the caller's JWT itself.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // ── Public read: GET ?token=<beacon id> ──────────────────────────────
  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('token') ?? '';
    if (!UUID_RE.test(token)) return json({ error: 'Bad token.' }, 400);
    const { data, error } = await admin
      .from('basalt_beacons')
      .select('last_lat, last_lng, last_accuracy_m, updated_at, ended_at, expires_at')
      .eq('id', token)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ active: false, reason: 'unknown' });
    const ended = data.ended_at !== null;
    const expired = Date.parse(data.expires_at) < Date.now();
    if (ended || expired) return json({ active: false, reason: ended ? 'ended' : 'expired' });
    if (data.last_lat === null) return json({ active: true, position: null });
    return json({
      active: true,
      position: {
        lat: data.last_lat,
        lng: data.last_lng,
        accuracyM: data.last_accuracy_m,
        updatedAt: data.updated_at,
      },
      expiresAt: data.expires_at,
    });
  }

  // ── Authed mutations ─────────────────────────────────────────────────
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Not signed in.' }, 401);
  const uid = userData.user.id;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  if (body.action === 'start') {
    // One active beacon per user: end any others first.
    await admin.from('basalt_beacons').update({ ended_at: new Date().toISOString() })
      .eq('user_id', uid).is('ended_at', null);
    const { data, error } = await admin
      .from('basalt_beacons')
      .insert({ user_id: uid })
      .select('id, expires_at')
      .single();
    if (error || !data) return json({ error: error?.message ?? 'Could not start beacon.' }, 500);
    return json({ id: data.id, expiresAt: data.expires_at });
  }

  if (body.action === 'update' || body.action === 'stop') {
    const id = String(body.id ?? '');
    if (!UUID_RE.test(id)) return json({ error: 'Bad beacon id.' }, 400);
    if (body.action === 'update') {
      const { error } = await admin
        .from('basalt_beacons')
        .update({
          last_lat: Number(body.lat),
          last_lng: Number(body.lng),
          last_accuracy_m: Number(body.accuracyM ?? 0),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', uid)
        .is('ended_at', null);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    const { error } = await admin
      .from('basalt_beacons')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: 'Unknown action.' }, 400);
});
