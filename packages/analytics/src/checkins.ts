import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';

// Evening check-ins — facts about the day, logged as booleans + an optional
// mood, one row per date. They exist to feed the correlations engine (same
// gates, same "correlation, not cause"); nothing here scores or judges.

export const CHECKIN_FACTORS = [
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'late_meal', label: 'Late meal' },
  { key: 'stress', label: 'Stressful day' },
  { key: 'caffeine_late', label: 'Late caffeine' },
  { key: 'screens_late', label: 'Screens late' },
] as const;

export type CheckinFactor = (typeof CHECKIN_FACTORS)[number]['key'];

export type Checkin = {
  date: string;
  factors: string[];
  mood: number | null;
  energy: number | null;
  stress: number | null;
  note: string | null;
};

export async function saveCheckin(
  client: SupabaseClient,
  checkin: Checkin,
): Promise<Result<void>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { error } = await client.from('basalt_checkins').upsert(
    {
      user_id: u.data, date: checkin.date, factors: checkin.factors, mood: checkin.mood,
      energy: checkin.energy, stress: checkin.stress, note: checkin.note,
    },
    { onConflict: 'user_id,date' },
  );
  if (error) return err(error.message);
  return ok(undefined);
}

export async function getCheckin(client: SupabaseClient, date: string): Promise<Result<Checkin | null>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_checkins')
    .select('date, factors, mood, energy, stress, note')
    .eq('user_id', u.data)
    .eq('date', date)
    .maybeSingle();
  if (error) return err(error.message);
  return ok(data ? mapCheckin(data) : null);
}

const mapCheckin = (r: any): Checkin => ({
  date: r.date,
  factors: r.factors ?? [],
  mood: r.mood ?? null,
  energy: r.energy ?? null,
  stress: r.stress ?? null,
  note: r.note ?? null,
});

/** The last `days` of check-ins, oldest first — strip + stress rule. */
export async function listCheckins(client: SupabaseClient, days = 30): Promise<Result<Checkin[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { data, error } = await client
    .from('basalt_checkins')
    .select('date, factors, mood, energy, stress, note')
    .eq('user_id', u.data)
    .gte('date', from.toISOString().slice(0, 10))
    .order('date', { ascending: true });
  if (error) return err(error.message);
  return ok((data ?? []).map(mapCheckin));
}
