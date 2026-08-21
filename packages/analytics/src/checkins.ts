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

export type Checkin = { date: string; factors: string[]; mood: number | null };

export async function saveCheckin(
  client: SupabaseClient,
  checkin: Checkin,
): Promise<Result<void>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { error } = await client.from('basalt_checkins').upsert(
    { user_id: u.data, date: checkin.date, factors: checkin.factors, mood: checkin.mood },
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
    .select('date, factors, mood')
    .eq('user_id', u.data)
    .eq('date', date)
    .maybeSingle();
  if (error) return err(error.message);
  return ok(data ? { date: (data as any).date, factors: (data as any).factors ?? [], mood: (data as any).mood ?? null } : null);
}
