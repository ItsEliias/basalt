import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, type Result } from '@basalt/core-data';
import {
  personalSleepNeed, strainAdjustedNeed, sleepDebt, lastNightLine, debtLine, classifyDaySleep,
  SLEEP_NEED_RULES, type SleepNeed, type SleepDebt,
} from './sleep-need';
import { p75 } from './readiness';
import { bedtimeWindow, sleepConsistency, type BedtimeWindow, type SleepConsistency } from './sleep-window';

// Ledger → sleep need/debt. Persisted sleep sessions and set volumes only —
// the same rows readiness reads. Stages are never touched (product law).

export type SleepNeedReport = {
  need: SleepNeed;
  debt: SleepDebt;
  lastNight: { sleptMin: number; needMin: number; strained: boolean; line: string } | null;
  debtText: string;
  /** Per-night ledger for the math sheet — newest last. */
  nights: { date: string; sleptMin: number; napMin: number; needMin: number; strained: boolean }[];
  /** V3.1: suggested window + bedtime spread — null until earned. */
  window: BedtimeWindow | null;
  consistency: SleepConsistency | null;
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

  // Nap credit: collect every session per date, then classify — the
  // longest is the night, short extras are naps, long extras split-merge.
  const sessionsByDate = new Map<string, number[]>();
  for (const s of sleep.data ?? []) {
    const r = s as any;
    if (!r.bedtime || !r.waketime) continue;
    const min = (Date.parse(r.waketime) - Date.parse(r.bedtime)) / 60000;
    if (min > 0) sessionsByDate.set(r.date, [...(sessionsByDate.get(r.date) ?? []), min]);
  }
  const sleptByDate = new Map<string, { nightMin: number; napMin: number }>();
  for (const [date, mins] of sessionsByDate) sleptByDate.set(date, classifyDaySleep(mins));

  // Bed/wake clock times of each date's NIGHT (longest) session, for the
  // bedtime window and the consistency line.
  const nightClockByDate = new Map<string, { bedMin: number; wakeMin: number; durMin: number }>();
  for (const s of sleep.data ?? []) {
    const r = s as any;
    if (!r.bedtime || !r.waketime) continue;
    const durMin = (Date.parse(r.waketime) - Date.parse(r.bedtime)) / 60000;
    if (durMin <= 0) continue;
    const cur = nightClockByDate.get(r.date);
    if (!cur || durMin > cur.durMin) {
      const bed = new Date(r.bedtime);
      const wake = new Date(r.waketime);
      nightClockByDate.set(r.date, {
        bedMin: bed.getHours() * 60 + bed.getMinutes(),
        wakeMin: wake.getHours() * 60 + wake.getMinutes(),
        durMin,
      });
    }
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
  // The need median reads NIGHTS ONLY — naps repay debt, they never
  // shrink what a night is expected to be.
  const need = personalSleepNeed(allNights.map(([, v]) => v.nightMin));

  // Per-night ledger for the debt window, need strain-adjusted per night.
  const nights: SleepNeedReport['nights'] = [];
  for (const [date, day] of allNights.slice(-SLEEP_NEED_RULES.debtWindowDays)) {
    const prior = new Date(`${date}T00:00:00`);
    prior.setDate(prior.getDate() - 1);
    const adjusted = strainAdjustedNeed(need.needMin, volumeByDay.get(isoDay(prior)) ?? 0, volP75);
    nights.push({
      date,
      sleptMin: Math.round(day.nightMin + day.napMin),
      napMin: day.napMin,
      needMin: adjusted.needMin,
      strained: adjusted.strained,
    });
  }

  const debt = sleepDebt(nights);
  const todayIso = isoDay(today);
  const lastEntry = nights[nights.length - 1];
  const lastNight =
    lastEntry && lastEntry.date === todayIso
      ? { ...lastEntry, line: lastNightLine(lastEntry.sleptMin, lastEntry.needMin, lastEntry.napMin) }
      : null;

  const recentClocks = Array.from(nightClockByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-SLEEP_NEED_RULES.debtWindowDays)
    .map(([, v]) => v);
  const window = bedtimeWindow(
    need.needMin,
    need.personal,
    debt.debtMin,
    recentClocks.map((c) => c.wakeMin),
  );
  const consistency = sleepConsistency(recentClocks.map((c) => c.bedMin));

  return ok({ need, debt, lastNight, debtText: debtLine(debt), nights, window, consistency });
}
