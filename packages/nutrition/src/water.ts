import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, todayISO, currentUserId, type Result } from '@basalt/core-data';

// water — follows the food.ts template.
//
// Basalt schema: hydration is per-event rows, not a counter column —
//   basalt_hydration_logs (id, user_id, ts, date, ml, source, ext_id)
//   unique(user_id, ext_id) where ext_id is not null
//
// This replaces the source app's daily_logs.water_ml counter + AsyncStorage
// dedupe memory. Health-Connect imports carry their HC record id as ext_id,
// so dedupe is server-side and key-based — uninstall/cache-clear on the
// device can no longer cause double-counting, and per-event timestamps make
// time-of-day charts possible.
//
// Unit contract: values stored + accepted at the service boundary are in ml.
// Cup/ml conversion lives at the UI layer.

export type HydrationSource = 'manual' | 'health_connect' | `health_connect:${string}`;

export type HydrationLogRow = {
  id: string;
  userId: string;
  ts: string;
  date: string;
  ml: number;
  source: HydrationSource;
  extId: string | null;
};

function mapRow(r: any): HydrationLogRow {
  return {
    id: r.id,
    userId: r.user_id,
    ts: r.ts,
    date: r.date,
    ml: Number(r.ml ?? 0),
    source: r.source ?? 'manual',
    extId: r.ext_id ?? null,
  };
}

/**
 * Log a drink of `ml` for the authed user (positive integers only — there is
 * no "negative water"; use undoLastWater to correct a mis-tap). Returns the
 * day's new total.
 *
 * `ts` backdates the row's own event timestamp; without it the DB default
 * (`now()`) applies even when `date` is in the past — fine for the app
 * (always today), wrong for backdated writes (seed scripts).
 */
export async function addWater(
  client: SupabaseClient,
  ml: number,
  date: string = todayISO(),
  ts?: string,
): Promise<Result<number>> {
  if (!isFinite(ml) || Math.round(ml) <= 0) return err('Invalid amount.');
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const payload: Record<string, unknown> = {
    user_id: u.data,
    date,
    ml: Math.round(ml),
    source: 'manual',
  };
  if (ts) payload.ts = ts;

  const { error } = await client.from('basalt_hydration_logs').insert(payload);
  if (error) return err(error.message);
  return getWaterForDay(client, date);
}

/** Delete the most recent manual entry for the day (mis-tap correction). */
export async function undoLastWater(
  client: SupabaseClient,
  date: string = todayISO(),
): Promise<Result<number>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const last = await client
    .from('basalt_hydration_logs')
    .select('id')
    .eq('user_id', u.data)
    .eq('date', date)
    .eq('source', 'manual')
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last.error && last.error.code !== 'PGRST116') return err(last.error.message);
  if (!last.data) return getWaterForDay(client, date);

  const { error } = await client.from('basalt_hydration_logs').delete().eq('id', last.data.id);
  if (error) return err(error.message);
  return getWaterForDay(client, date);
}

/** Get the day's water total in ml (0 when nothing logged). */
export async function getWaterForDay(
  client: SupabaseClient,
  date: string = todayISO(),
): Promise<Result<number>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_hydration_logs')
    .select('ml')
    .eq('user_id', u.data)
    .eq('date', date);

  if (error) return err(error.message);
  return ok((data ?? []).reduce((s: number, r: any) => s + Number(r.ml ?? 0), 0));
}

/** The day's individual hydration events, newest first. */
export async function getHydrationLogsForDay(
  client: SupabaseClient,
  date: string = todayISO(),
): Promise<Result<HydrationLogRow[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_hydration_logs')
    .select('*')
    .eq('user_id', u.data)
    .eq('date', date)
    .order('ts', { ascending: false });

  if (error) return err(error.message);
  return ok((data ?? []).map(mapRow));
}

/**
 * Idempotently import Health-Connect hydration records. Each HC record is
 * one row keyed by its HC record id (`ext_id`); upsert-with-ignore against
 * the unique(user_id, ext_id) index means re-syncing never double-counts,
 * and in-app "+250" taps still add cleanly on top as separate manual rows.
 */
export async function importHcHydration(
  client: SupabaseClient,
  input: { records: { id: string; ml: number; dataOrigin?: string }[]; date?: string },
): Promise<Result<{ addedMl: number; total: number }>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const iso = input.date ?? todayISO();

  const fresh = input.records.filter((r) => r.id && isFinite(r.ml) && r.ml > 0);
  if (fresh.length === 0) {
    const cur = await getWaterForDay(client, iso);
    if (!cur.ok) return cur;
    return ok({ addedMl: 0, total: cur.data });
  }

  // Which of these ids already exist? (Cheaper than relying on upsert
  // return shapes, and lets us report an honest addedMl.)
  const existing = await client
    .from('basalt_hydration_logs')
    .select('ext_id')
    .eq('user_id', u.data)
    .in('ext_id', fresh.map((r) => r.id));
  if (existing.error) return err(existing.error.message);
  const seen = new Set((existing.data ?? []).map((r: any) => r.ext_id));

  const newRecords = fresh.filter((r) => !seen.has(r.id));
  if (newRecords.length > 0) {
    const pkgTag = (o?: string) => {
      const pkg = (o ?? '').trim();
      return pkg ? `health_connect:${pkg}` : 'health_connect';
    };
    const { error } = await client.from('basalt_hydration_logs').upsert(
      newRecords.map((r) => ({
        user_id: u.data,
        date: iso,
        ml: Math.round(r.ml),
        source: pkgTag(r.dataOrigin),
        ext_id: r.id,
      })),
      { onConflict: 'user_id,ext_id', ignoreDuplicates: true },
    );
    if (error) return err(error.message);
  }

  const addedMl = newRecords.reduce((s, r) => s + Math.round(r.ml), 0);
  const total = await getWaterForDay(client, iso);
  if (!total.ok) return total;
  return ok({ addedMl, total: total.data });
}

/** Delete every hydration event for the day (only if any exist — else no-op). */
export async function resetWater(
  client: SupabaseClient,
  date: string = todayISO(),
): Promise<Result<number>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { error } = await client
    .from('basalt_hydration_logs')
    .delete()
    .eq('user_id', u.data)
    .eq('date', date);
  if (error) return err(error.message);
  return ok(0);
}
