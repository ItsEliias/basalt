import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, type Result } from '@basalt/core-data';

// Consistency — streaks are COMPUTED, never stored (ported from the quarry's
// streakService, retargeted at the Basalt tables). Gaps stay gray: no
// flames, no broken-streak shaming; dual milestones (current + longest).

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

export async function activeDaysFor(
  client: SupabaseClient,
  type: StreakType,
  options: { hydrationThresholdMl?: number } = {},
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
    case 'workout':
      return timestampDays(client, userId, 'basalt_workout_sessions', 'started_at', sinceISO);
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
        activeDaysFor(client, 'workout'),
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
