import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, type Result } from '@basalt/core-data';
import {
  personalSleepNeed, strainAdjustedNeed, sleepDebt, lastNightLine, debtLine,
  SLEEP_NEED_RULES, type SleepNeed, type SleepDebt,
} from './sleep-need';
import { p75 } from './readiness';

// Ledger → sleep need/debt. Persisted sleep sessions and set volumes only —
// the same rows readiness reads. Stages are never touched (product law).

export type SleepNeedReport = {
  need: SleepNeed;
  debt: SleepDebt;
  lastNight: { sleptMin: number; needMin: number; strained: boolean; line: string } | null;
  debtText: string;
  /** Per-night ledger for the math sheet — newest last. */
  nights: { date: string; sleptMin: number; needMin: number; strained: boolean }[];
};

export async function loadSleepNeed(
  client: SupabaseClient,
  today: Date = new Date(),
): Promise<Result<SleepNeedReport>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - (SLEEP_NEED_RULES.personalWindowNights + SLEEP_NEED_RULES.debtWindowDays));
  const fromIso = isoDay(windowStart);

  const [sleep, sets] = await Promise.all([
    client
      .from('basalt_sleep_sessions')
      .select('date, bedtime, waketime')
      .eq('user_id', u.data)
      .gte('date', fromIso)
      .order('date', { ascending: true }),
    client
      .from('basalt_set_entries')
      .select('weight_kg, reps, set_type, completed_at')
      .eq('user_id', u.data)
      .not('weight_kg', 'is', null)
      .gte('completed_at', fromIso),
  ]);
  if (sleep.error) return err(sleep.error.message);
  if (sets.error) return err(sets.error.message);

  const sleptByDate = new Map<string, number>();
  for (const s of sleep.data ?? []) {
    const r = s as any;
    if (!r.bedtime || !r.waketime) continue;
    const min = (Date.parse(r.waketime) - Date.parse(r.bedtime)) / 60000;
    if (min > 0) sleptByDate.set(r.date, (sleptByDate.get(r.date) ?? 0) + min);
  }

  const volumeByDay = new Map<string, number>();
  for (const s of sets.data ?? []) {
    const r = s as any;
    if (r.set_type === 'warmup' || !r.reps) continue;
    const d = String(r.completed_at).slice(0, 10);
    volumeByDay.set(d, (volumeByDay.get(d) ?? 0) + Number(r.weight_kg) * r.reps);
  }
  const volP75 = p75(Array.from(volumeByDay.values()).filter((v) => v > 0));

  const allNights = Array.from(sleptByDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  const need = personalSleepNeed(allNights.map(([, min]) => min));

  // Per-night ledger for the debt window, need strain-adjusted per night.
  const nights: SleepNeedReport['nights'] = [];
  for (const [date, sleptMin] of allNights.slice(-SLEEP_NEED_RULES.debtWindowDays)) {
    const prior = new Date(`${date}T00:00:00`);
    prior.setDate(prior.getDate() - 1);
    const adjusted = strainAdjustedNeed(need.needMin, volumeByDay.get(isoDay(prior)) ?? 0, volP75);
    nights.push({ date, sleptMin: Math.round(sleptMin), needMin: adjusted.needMin, strained: adjusted.strained });
  }

  const debt = sleepDebt(nights);
  const todayIso = isoDay(today);
  const lastEntry = nights[nights.length - 1];
  const lastNight =
    lastEntry && lastEntry.date === todayIso
      ? { ...lastEntry, line: lastNightLine(lastEntry.sleptMin, lastEntry.needMin) }
      : null;

  return ok({ need, debt, lastNight, debtText: debtLine(debt), nights });
}
