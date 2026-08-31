import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, type Result } from '@basalt/core-data';
import { composeCoop, COOP_DAYS, type CoopReport } from './coop';

// Co-op persistence. Each device computes its OWN dots from its own
// ledger and publishes only the booleans; loading reads both members'
// published dots and composes. The pair, join and end paths mirror the
// sharing module's invite-code discipline.

export type Pair = {
  id: string;
  aId: string;
  bId: string | null;
  inviteCode: string;
  expiresAt: string;
  createdAt: string;
};

function mapPair(r: any): Pair {
  return {
    id: r.id, aId: r.a_id, bId: r.b_id ?? null,
    inviteCode: r.invite_code, expiresAt: r.expires_at, createdAt: r.created_at,
  };
}

export async function getMyPair(client: SupabaseClient): Promise<Result<Pair | null>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_pairs')
    .select('*')
    .or(`a_id.eq.${u.data},b_id.eq.${u.data}`)
    .is('ended_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return err(error.message);
  return ok(data ? mapPair(data) : null);
}

export async function createPair(client: SupabaseClient): Promise<Result<Pair>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_pairs')
    .insert({ a_id: u.data })
    .select()
    .single();
  if (error || !data) return err(error?.message ?? 'Could not create the pair.');
  return ok(mapPair(data));
}

export async function joinPair(client: SupabaseClient, code: string): Promise<Result<string>> {
  const { data, error } = await client.rpc('basalt_join_pair', { p_code: code });
  if (error) return err(error.message);
  return ok(String(data));
}

export async function endPair(client: SupabaseClient, pairId: string): Promise<Result<void>> {
  const { error } = await client
    .from('basalt_pairs')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', pairId);
  if (error) return err(error.message);
  return ok(undefined);
}

/** My last-14-day activity, computed from my own ledger — booleans only. */
export async function computeMyDots(
  client: SupabaseClient,
  today: Date = new Date(),
): Promise<Result<Map<string, boolean>>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const from = new Date(today);
  from.setDate(from.getDate() - (COOP_DAYS - 1));
  const fromIso = isoDay(from);
  const fromTs = new Date(`${fromIso}T00:00:00`).toISOString();

  const [food, sessions, walks, checkins] = await Promise.all([
    client.from('basalt_food_entries').select('created_at').eq('user_id', u.data).gte('created_at', fromTs),
    client.from('basalt_workout_sessions').select('started_at').eq('user_id', u.data).gte('started_at', fromTs),
    client.from('basalt_walks').select('started_at').eq('user_id', u.data).gte('started_at', fromTs),
    client.from('basalt_checkins').select('date').eq('user_id', u.data).gte('date', fromIso),
  ]);
  for (const r of [food, sessions, walks, checkins]) {
    if (r.error) return err(r.error.message);
  }

  const dots = new Map<string, boolean>();
  for (let i = 0; i < COOP_DAYS; i++) {
    dots.set(isoDay(new Date(from.getTime() + i * 86400000)), false);
  }
  const mark = (iso: string) => {
    const day = iso.slice(0, 10);
    if (dots.has(day)) dots.set(day, true);
  };
  (food.data ?? []).forEach((r: any) => mark(new Date(r.created_at).toISOString()));
  (sessions.data ?? []).forEach((r: any) => mark(new Date(r.started_at).toISOString()));
  (walks.data ?? []).forEach((r: any) => mark(new Date(r.started_at).toISOString()));
  (checkins.data ?? []).forEach((r: any) => mark(r.date));
  return ok(dots);
}

/** Publish my dots for the pair, then read both sides and compose. */
export async function loadCoop(
  client: SupabaseClient,
  pair: Pair,
  today: Date = new Date(),
): Promise<Result<CoopReport>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const mine = await computeMyDots(client, today);
  if (!mine.ok) return mine;

  const rows = [...mine.data.entries()].map(([date, active]) => ({
    pair_id: pair.id, user_id: u.data, date, active,
  }));
  const up = await client.from('basalt_pair_days').upsert(rows, { onConflict: 'pair_id,user_id,date' });
  if (up.error) return err(up.error.message);

  const { data, error } = await client
    .from('basalt_pair_days')
    .select('user_id, date, active')
    .eq('pair_id', pair.id);
  if (error) return err(error.message);

  const theirs = new Map<string, boolean>();
  const mineRead = new Map<string, boolean>();
  for (const r of data ?? []) {
    const row = r as any;
    (row.user_id === u.data ? mineRead : theirs).set(row.date, !!row.active);
  }
  return ok(composeCoop(mineRead, theirs, isoDay(today)));
}
