import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, getTargetsFor, type Result } from '@basalt/core-data';
import { computeReadiness } from './readiness';

// Consistency — streaks are COMPUTED, never stored (ported from the quarry's
// streakService, retargeted at the Basalt tables). Gaps stay gray: no
// flames, no broken-streak shaming; dual milestones (current + longest).
//
// Rest-day rule (published in the streak card's srcnote): a rest day does
// not break a training run. A day counts as active for training streaks
// when it has a logged session, a PLANNED rest day, or a READINESS-ADVISED
// rest — readiness below REST_ADVISED_BELOW on a day a readiness number
// actually existed. Rest days maintain a run, they never start one: a run
// made only of rest days is no run at all (restAwareDays drops it).

export type StreakType =
  | 'meal'        // any basalt_food_entries row that day
  | 'workout'     // any basalt_workout_sessions row that day
  | 'hydration'   // basalt_hydration_logs day total ≥ threshold
  | 'weight'      // any basalt_weight_entries row that day
  | 'mindfulness' // any basalt_mindfulness_sessions row that day
  | 'any'         // union of the above
  | 'full';       // meal ∩ workout — the "full log" run

export type StreakResult = { current: number; longest: number };

export const WINDOW_DAYS = 180;

/** Readiness below this advises rest; such a day maintains a training run.
 *  Published — the streak card's srcnote states this number. */
export const REST_ADVISED_BELOW = 40;

/**
 * Rest-aware training days. Union of trained + rest days, then any
 * contiguous run containing NO trained day is dropped — rest maintains a
 * streak, it never fabricates one. Pure; feeds currentAndLongest unchanged.
 */
export function restAwareDays(trained: Set<string>, rest: Set<string>): Set<string> {
  const union = new Set<string>([...trained, ...rest]);
  const sorted = Array.from(union).sort();
  const out = new Set<string>();
  let run: string[] = [];
  let runHasTraining = false;
  let prev: Date | null = null;

  const flush = () => {
    if (runHasTraining) run.forEach((d) => out.add(d));
    run = [];
    runHasTraining = false;
  };

  for (const iso of sorted) {
    const [y, m, d] = iso.split('-').map(Number);
    const cur = new Date(y!, m! - 1, d!);
    if (prev && Math.round((cur.getTime() - prev.getTime()) / 86_400_000) !== 1) flush();
    run.push(iso);
    if (trained.has(iso)) runHasTraining = true;
    prev = cur;
  }
  flush();
  return out;
}

// ─── Pure core ───────────────────────────────────────────────────────────────

/**
 * Current streak: walk backwards from `today` over active days until a gap
 * (an inactive today doesn't zero the streak until tomorrow — yesterday's
 * run still stands while today is in progress).
 * Longest: largest consecutive run in the window.
 */
export function currentAndLongest(days: Set<string>, today: Date = new Date()): StreakResult {
  let current = 0;
  const cursor = new Date(today);
  if (!days.has(isoDay(cursor))) {
    cursor.setDate(cursor.getDate() - 1); // today not logged yet — start at yesterday
  }
  while (days.has(isoDay(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sorted = Array.from(days).sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const iso of sorted) {
    const [y, m, d] = iso.split('-').map(Number);
    const cur = new Date(y!, m! - 1, d!);
    if (prev) {
      const diff = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = cur;
  }
  return { current, longest: Math.max(longest, current) };
}

export type CalendarCell = 'on' | 'part' | 'off' | 'today' | 'future' | 'hidden';

/**
 * Month grid for the no-guilt consistency calendar. `full` days render
 * filled, `partial` dim, gaps stay gray, the future stays quiet. Cells run
 * Monday-first; leading blanks are 'hidden'.
 */
export function monthCells(
  year: number,
  monthIndex0: number,
  full: Set<string>,
  partial: Set<string>,
  today: Date = new Date(),
): CalendarCell[] {
  const first = new Date(year, monthIndex0, 1);
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first offset
  const todayIso = isoDay(today);

  const cells: CalendarCell[] = Array.from({ length: lead }, () => 'hidden' as CalendarCell);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoDay(new Date(year, monthIndex0, d));
    if (iso === todayIso) cells.push('today');
    else if (iso > todayIso) cells.push('future');
    else if (full.has(iso)) cells.push('on');
    else if (partial.has(iso)) cells.push('part');
    else cells.push('off');
  }
  while (cells.length % 7 !== 0) cells.push('hidden');
  return cells;
}

// ─── Query layer over the Basalt tables ─────────────────────────────────────

async function timestampDays(
  client: SupabaseClient,
  userId: string,
  table: string,
  column: string,
  sinceISO: string,
): Promise<Result<Set<string>>> {
  const { data, error } = await client
    .from(table)
    .select(column)
    .eq('user_id', userId)
    .gte(column, sinceISO);
  if (error) return err(error.message);
  return ok(new Set((data ?? []).map((r: any) => isoDay(new Date(r[column])))));
}

/**
 * Days in the streak window on which readiness EXISTED and advised rest
 * (score < REST_ADVISED_BELOW). Recomputes historical per-day readiness
 * from persisted vitals/sleep/volume with rolling 30-day baselines — the
 * same published components loadReadiness uses for today, day by day.
 * Days with no computable number are simply absent (real-or-hidden).
 */
export async function restAdvisedDaysFor(
  client: SupabaseClient,
  today: Date = new Date(),
): Promise<Result<Set<string>>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const userId = u.data;
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - (WINDOW_DAYS - 1));
  const baselineStart = new Date(windowStart);
  baselineStart.setDate(baselineStart.getDate() - 30);
  const fromIso = isoDay(baselineStart);

  const [vitals, sleep, sets, targets] = await Promise.all([
    client.from('basalt_vitals').select('date, kind, value').eq('user_id', userId).gte('date', fromIso),
    client.from('basalt_sleep_sessions').select('date, bedtime, waketime').eq('user_id', userId).gte('date', fromIso),
    client
      .from('basalt_set_entries')
      .select('weight_kg, reps, set_type, completed_at')
      .eq('user_id', userId)
      .not('weight_kg', 'is', null)
      .gte('completed_at', fromIso),
    getTargetsFor(client, isoDay(today)),
  ]);
  if (vitals.error) return err(vitals.error.message);
  if (sleep.error) return err(sleep.error.message);
  if (sets.error) return err(sets.error.message);
  const sleepTargetMin = (targets.ok && targets.data?.sleepMin) || 480;

  const byKind = new Map<string, Map<string, number>>();
  for (const v of vitals.data ?? []) {
    const r = v as any;
    if (!byKind.has(r.kind)) byKind.set(r.kind, new Map());
    byKind.get(r.kind)!.set(r.date, Number(r.value));
  }
  const sleepByDay = new Map<string, number>();
  for (const s of sleep.data ?? []) {
    const r = s as any;
    if (!r.bedtime || !r.waketime) continue;
    const min = (Date.parse(r.waketime) - Date.parse(r.bedtime)) / 60000;
    if (min > 0) sleepByDay.set(r.date, (sleepByDay.get(r.date) ?? 0) + min);
  }
  const volumeByDay = new Map<string, number>();
  for (const s of sets.data ?? []) {
    const r = s as any;
    if (r.set_type === 'warmup' || !r.reps) continue;
    const d = String(r.completed_at).slice(0, 10);
    volumeByDay.set(d, (volumeByDay.get(d) ?? 0) + Number(r.weight_kg) * r.reps);
  }

  const advised = new Set<string>();
  const cursor = new Date(windowStart);
  while (cursor <= today) {
    const dayIso = isoDay(cursor);
    const baseFrom = new Date(cursor);
    baseFrom.setDate(baseFrom.getDate() - 30);
    const baseFromIso = isoDay(baseFrom);
    const baseline = (kind: string) => {
      const m = byKind.get(kind);
      if (!m) return [] as number[];
      return Array.from(m.entries())
        .filter(([d]) => d >= baseFromIso && d < dayIso)
        .map(([, v]) => v);
    };
    const prior = new Date(cursor);
    prior.setDate(prior.getDate() - 1);
    const priorIso = isoDay(prior);
    const volumeBaseline = Array.from(volumeByDay.entries())
      .filter(([d]) => d >= baseFromIso && d < dayIso)
      .map(([, v]) => v);

    const r = computeReadiness({
      todayHrv: byKind.get('hrv_rmssd')?.get(dayIso) ?? null,
      hrvBaseline: baseline('hrv_rmssd'),
      todayRhr: byKind.get('resting_hr')?.get(dayIso) ?? null,
      rhrBaseline: baseline('resting_hr'),
      lastNightSleepMin: sleepByDay.get(dayIso) ?? null,
      sleepTargetMin,
      priorDayVolumeKg: volumeByDay.get(priorIso) ?? 0,
      volumeBaseline,
    });
    if (r.score !== null && r.score < REST_ADVISED_BELOW) advised.add(dayIso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return ok(advised);
}

export async function activeDaysFor(
  client: SupabaseClient,
  type: StreakType,
  options: { hydrationThresholdMl?: number; restAware?: boolean } = {},
): Promise<Result<Set<string>>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const userId = u.data;
  const since = new Date();
  since.setDate(since.getDate() - (WINDOW_DAYS - 1));
  since.setHours(0, 0, 0, 0);
  const sinceISO = since.toISOString();

  switch (type) {
    case 'meal':
      return timestampDays(client, userId, 'basalt_food_entries', 'created_at', sinceISO);
    case 'workout': {
      const trained = await timestampDays(client, userId, 'basalt_workout_sessions', 'started_at', sinceISO);
      if (!trained.ok || !options.restAware) return trained;
      // Planned rest (a program's rest day) joins this union when the
      // periodization engine lands and programs carry a week structure —
      // today the only derivable rest source is readiness-advised.
      const advised = await restAdvisedDaysFor(client);
      if (!advised.ok) return advised;
      return ok(restAwareDays(trained.data, advised.data));
    }
    case 'weight':
      return timestampDays(client, userId, 'basalt_weight_entries', 'measured_at', sinceISO);
    case 'mindfulness':
      return timestampDays(client, userId, 'basalt_mindfulness_sessions', 'started_at', sinceISO);
    case 'hydration': {
      const threshold = options.hydrationThresholdMl ?? 2000;
      const { data, error } = await client
        .from('basalt_hydration_logs')
        .select('date, ml')
        .eq('user_id', userId)
        .gte('date', isoDay(since));
      if (error) return err(error.message);
      const totals = new Map<string, number>();
      (data ?? []).forEach((r: any) => totals.set(r.date, (totals.get(r.date) ?? 0) + Number(r.ml ?? 0)));
      const s = new Set<string>();
      totals.forEach((ml, date) => { if (ml >= threshold) s.add(date); });
      return ok(s);
    }
    case 'any':
    case 'full': {
      const parts = await Promise.all([
        activeDaysFor(client, 'meal'),
        activeDaysFor(client, 'workout', options), // carries restAware through
        activeDaysFor(client, 'hydration', options),
        activeDaysFor(client, 'weight'),
        activeDaysFor(client, 'mindfulness'),
      ]);
      for (const p of parts) if (!p.ok) return p;
      const [meal, workout, hydration, weight, mindfulness] = parts as { ok: true; data: Set<string> }[];
      if (type === 'full') {
        const out = new Set<string>();
        meal!.data.forEach((d) => { if (workout!.data.has(d)) out.add(d); });
        return ok(out);
      }
      const out = new Set<string>();
      [meal, workout, hydration, weight, mindfulness].forEach((p) => p!.data.forEach((d) => out.add(d)));
      return ok(out);
    }
  }
}

export async function getStreak(
  client: SupabaseClient,
  type: StreakType,
  options: { hydrationThresholdMl?: number } = {},
): Promise<Result<StreakResult>> {
  const active = await activeDaysFor(client, type, options);
  if (!active.ok) return active;
  return ok(currentAndLongest(active.data));
}
