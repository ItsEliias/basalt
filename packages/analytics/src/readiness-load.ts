import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, getTargetsFor, type Result } from '@basalt/core-data';
import { computeReadiness, baselineBand, type Readiness } from './readiness';

// Ledger → readiness inputs. Everything reads persisted rows only — the
// HC sync's vitals rollups, the persisted sleep night, the set ledger.

export type VitalsBands = {
  hrv: { band: { min: number; median: number; max: number } | null; today: number | null };
  rhr: { band: { min: number; median: number; max: number } | null; today: number | null };
};

export async function loadReadiness(
  client: SupabaseClient,
  today: Date,
): Promise<Result<{ readiness: Readiness; bands: VitalsBands }>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const todayIso = isoDay(today);
  const fromIso = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30));
  const yesterdayIso = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));

  const vitals = await client
    .from('basalt_vitals')
    .select('date, kind, value')
    .eq('user_id', u.data)
    .gte('date', fromIso);
  if (vitals.error) return err(vitals.error.message);
  const series = (kind: string) =>
    (vitals.data ?? []).filter((v: any) => v.kind === kind && v.date !== todayIso).map((v: any) => Number(v.value));
  const todayOf = (kind: string) => {
    const row = (vitals.data ?? []).find((v: any) => v.kind === kind && v.date === todayIso);
    return row ? Number((row as any).value) : null;
  };

  const sleep = await client
    .from('basalt_sleep_sessions')
    .select('bedtime, waketime')
    .eq('user_id', u.data)
    .eq('date', todayIso);
  if (sleep.error) return err(sleep.error.message);
  let sleepMin: number | null = null;
  for (const s of sleep.data ?? []) {
    const r = s as any;
    if (!r.bedtime || !r.waketime) continue;
    const min = (Date.parse(r.waketime) - Date.parse(r.bedtime)) / 60000;
    if (min > 0) sleepMin = (sleepMin ?? 0) + min;
  }

  const sets = await client
    .from('basalt_set_entries')
    .select('weight_kg, reps, set_type, completed_at')
    .eq('user_id', u.data)
    .not('weight_kg', 'is', null)
    .gte('completed_at', fromIso);
  if (sets.error) return err(sets.error.message);
  const volumeByDay = new Map<string, number>();
  for (const s of sets.data ?? []) {
    const r = s as any;
    if (r.set_type === 'warmup' || !r.reps) continue;
    const d = String(r.completed_at).slice(0, 10);
    volumeByDay.set(d, (volumeByDay.get(d) ?? 0) + Number(r.weight_kg) * r.reps);
  }

  const targets = await getTargetsFor(client, todayIso);
  const sleepTargetMin = (targets.ok && targets.data?.sleepMin) || 480;

  const readiness = computeReadiness({
    todayHrv: todayOf('hrv_rmssd'),
    hrvBaseline: series('hrv_rmssd'),
    todayRhr: todayOf('resting_hr'),
    rhrBaseline: series('resting_hr'),
    lastNightSleepMin: sleepMin,
    sleepTargetMin,
    priorDayVolumeKg: volumeByDay.get(yesterdayIso) ?? 0,
    volumeBaseline: Array.from(volumeByDay.values()),
  });

  return ok({
    readiness,
    bands: {
      hrv: { band: baselineBand(series('hrv_rmssd')), today: todayOf('hrv_rmssd') },
      rhr: { band: baselineBand(series('resting_hr')), today: todayOf('resting_hr') },
    },
  });
}

/**
 * Readiness scores for each of the last `days` days (today inclusive),
 * recomputed from persisted rows with the same published components —
 * days with no computable number are simply absent. Feeds the
 * periodization deload trigger's 7-day mean.
 */
export async function readinessScoresForLastDays(
  client: SupabaseClient,
  days = 7,
  today: Date = new Date(),
): Promise<Result<number[]>> {
  const scores: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const r = await loadReadiness(client, d);
    if (r.ok && r.data.readiness.score !== null) scores.push(r.data.readiness.score);
  }
  return ok(scores);
}
