import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUserId, isoDay } from '@basalt/core-data';
import {
  DERIVED_FACTOR_WINDOW_DAYS, derivedActivityFactor, type DerivedFactor,
} from '@basalt/nutrition';

// Ledger → the data-derived activity factor (V4 Phase 8-0). Reads the
// last three weeks of steps, strength sessions and walks; the pure model
// in @basalt/nutrition decides whether the data has earned a factor.

export async function loadDerivedActivityFactor(
  client: SupabaseClient,
  bmr: number,
  weightKg: number,
): Promise<DerivedFactor | null> {
  const u = await currentUserId(client);
  if (!u.ok) return null;
  const from = new Date();
  from.setDate(from.getDate() - DERIVED_FACTOR_WINDOW_DAYS);
  const fromIso = isoDay(from);

  const [steps, sessions, walks] = await Promise.all([
    client.from('basalt_step_logs').select('steps').eq('user_id', u.data).gte('date', fromIso),
    client
      .from('basalt_workout_sessions')
      .select('started_at, ended_at')
      .eq('user_id', u.data)
      .gte('started_at', from.toISOString()),
    client
      .from('basalt_walks')
      .select('duration_s')
      .eq('user_id', u.data)
      .gte('started_at', from.toISOString()),
  ]);

  const stepRows = (steps.data ?? []).map((r: any) => Number(r.steps)).filter((n) => n > 0);
  const strengthMinutes = (sessions.data ?? []).reduce((sum: number, r: any) => {
    if (!r.started_at || !r.ended_at) return sum;
    const min = (Date.parse(r.ended_at) - Date.parse(r.started_at)) / 60000;
    return min > 0 && min < 240 ? sum + min : sum;
  }, 0);
  const walkMinutes = (walks.data ?? []).reduce(
    (sum: number, r: any) => sum + (Number(r.duration_s) > 0 ? Number(r.duration_s) / 60 : 0),
    0,
  );

  return derivedActivityFactor({
    stepDays: stepRows.length,
    avgDailySteps: stepRows.length > 0 ? stepRows.reduce((a, b) => a + b, 0) / stepRows.length : 0,
    strengthMinutes,
    walkMinutes,
    weightKg,
    bmr,
  });
}
