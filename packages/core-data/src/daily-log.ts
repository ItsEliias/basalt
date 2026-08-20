import type { SupabaseClient } from '@supabase/supabase-js';
import { type Result, ok, err } from './result';
import { currentUserId } from './user';

// Find-or-create the per-day `basalt_daily_logs` parent row. Pattern lifted
// from the source app's foodService/waterService find-then-insert shape,
// canonicalized to resolve the user internally (via currentUserId) and
// return the full row.
//
// Basalt schema deviations from the source app's daily_logs:
//   • no calories_target — targets are versioned rows in basalt_targets, so
//     the old caller-supplied createDefaults.caloriesTarget is gone with it.
//   • no water_ml / streak_day — hydration lives in basalt_hydration_logs
//     (per-event rows), streaks are computed, never stored.
export type DailyLogRow = {
  id: string;
  userId: string;
  date: string;
  caloriesEaten: number;
  caloriesBurned: number;
  syncedAt: string | null;
  createdAt: string;
};

function mapRow(r: any): DailyLogRow {
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    caloriesEaten: Number(r.calories_eaten ?? 0),
    caloriesBurned: Number(r.calories_burned ?? 0),
    syncedAt: r.synced_at ?? null,
    createdAt: r.created_at,
  };
}

export async function findOrCreateDailyLog(
  client: SupabaseClient,
  date: string,
): Promise<Result<DailyLogRow>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const userId = u.data;

  // Try to fetch first.
  const found = await client
    .from('basalt_daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (found.error && found.error.code !== 'PGRST116') {
    return err(found.error.message);
  }
  if (found.data) {
    return ok(mapRow(found.data));
  }

  const created = await client
    .from('basalt_daily_logs')
    .insert({ user_id: userId, date })
    .select('*')
    .single();

  if (created.error || !created.data) {
    return err(created.error?.message ?? 'Could not create daily log.');
  }
  return ok(mapRow(created.data));
}
