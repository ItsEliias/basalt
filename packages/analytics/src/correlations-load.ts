import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, type Result } from '@basalt/core-data';
import type { DailySeries } from './correlations';

// Ledger → daily series for the correlations engine. Same real tables the
// Week in Review reads; a day with no row simply isn't in the map.

export async function loadDailySeries(
  client: SupabaseClient,
  today: Date,
  days = 90,
): Promise<Result<DailySeries>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  const fromIso = isoDay(from);

  const intakeKcal = new Map<string, number>();
  const proteinG = new Map<string, number>();
  const logs = await client
    .from('basalt_daily_logs')
    .select('id, date')
    .eq('user_id', u.data)
    .gte('date', fromIso);
  if (logs.error) return err(logs.error.message);
  const dateForLog = new Map<string, string>((logs.data ?? []).map((l: any) => [l.id, l.date]));
  if (dateForLog.size > 0) {
    const entries = await client
      .from('basalt_food_entries')
      .select('log_id, calories, protein')
      .in('log_id', Array.from(dateForLog.keys()));
    if (entries.error) return err(entries.error.message);
    for (const e of entries.data ?? []) {
      const date = dateForLog.get((e as any).log_id);
      if (!date) continue;
      intakeKcal.set(date, (intakeKcal.get(date) ?? 0) + Number((e as any).calories));
      proteinG.set(date, (proteinG.get(date) ?? 0) + Number((e as any).protein));
    }
  }

  const steps = new Map<string, number>();
  const stepRows = await client
    .from('basalt_step_logs')
    .select('date, steps')
    .eq('user_id', u.data)
    .gte('date', fromIso);
  if (stepRows.error) return err(stepRows.error.message);
  for (const r of stepRows.data ?? []) steps.set((r as any).date, (r as any).steps);

  const sleepMin = new Map<string, number>();
  const sleepRows = await client
    .from('basalt_sleep_sessions')
    .select('date, bedtime, waketime')
    .eq('user_id', u.data)
    .gte('date', fromIso);
  if (sleepRows.error) return err(sleepRows.error.message);
  for (const s of sleepRows.data ?? []) {
    const r = s as any;
    if (!r.bedtime || !r.waketime) continue;
    const min = (new Date(r.waketime).getTime() - new Date(r.bedtime).getTime()) / 60000;
    if (min <= 0) continue;
    sleepMin.set(r.date, (sleepMin.get(r.date) ?? 0) + min);
  }

  const volumeKg = new Map<string, number>();
  const sets = await client
    .from('basalt_set_entries')
    .select('weight_kg, reps, set_type, completed_at')
    .eq('user_id', u.data)
    .not('weight_kg', 'is', null)
    .gte('completed_at', fromIso);
  if (sets.error) return err(sets.error.message);
  for (const s of sets.data ?? []) {
    const r = s as any;
    if (r.set_type === 'warmup' || !r.reps) continue;
    const date = String(r.completed_at).slice(0, 10);
    volumeKg.set(date, (volumeKg.get(date) ?? 0) + Number(r.weight_kg) * r.reps);
  }

  return ok({ intakeKcal, proteinG, steps, sleepMin, volumeKg });
}
