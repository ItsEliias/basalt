import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, getTargetsFor, type Result } from '@basalt/core-data';
import { composeWeekReview, type ReviewDay, type WeekReview } from './week-review';

// Ledger → WeekReviewInput. Every dimension is read from its real table;
// anything absent stays null so the composer can leave it out instead of
// inventing it.

export type WeekWindow = { start: Date; end: Date; startIso: string; endIso: string };

/** Monday–Sunday of the last COMPLETED week strictly before `today`'s week. */
export function lastCompletedWeek(today: Date): WeekWindow {
  const monOffset = (today.getDay() + 6) % 7; // Mon=0 … Sun=6
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - monOffset - 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start, end, startIso: isoDay(start), endIso: isoDay(end) };
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

export async function loadWeekReview(
  client: SupabaseClient,
  today: Date,
  options: { hideNumbers?: boolean } = {},
): Promise<Result<WeekReview>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const win = lastCompletedWeek(today);
  const nextDayIso = isoDay(new Date(win.end.getFullYear(), win.end.getMonth(), win.end.getDate() + 1));

  // Food: daily logs give the day buckets, entries give the sums.
  const logs = await client
    .from('basalt_daily_logs')
    .select('id, date')
    .eq('user_id', u.data)
    .gte('date', win.startIso)
    .lte('date', win.endIso);
  if (logs.error) return err(logs.error.message);
  const dateForLog = new Map<string, string>((logs.data ?? []).map((l: any) => [l.id, l.date]));

  const byDate = new Map<string, { calories: number; proteinG: number; count: number }>();
  if (dateForLog.size > 0) {
    const entries = await client
      .from('basalt_food_entries')
      .select('log_id, calories, protein')
      .in('log_id', Array.from(dateForLog.keys()));
    if (entries.error) return err(entries.error.message);
    for (const e of entries.data ?? []) {
      const date = dateForLog.get((e as any).log_id);
      if (!date) continue;
      const acc = byDate.get(date) ?? { calories: 0, proteinG: 0, count: 0 };
      acc.calories += Number((e as any).calories);
      acc.proteinG += Number((e as any).protein);
      acc.count += 1;
      byDate.set(date, acc);
    }
  }

  // Training: sessions in the window; volume from working sets completed in it.
  const sessions = await client
    .from('basalt_workout_sessions')
    .select('id', { count: 'exact' })
    .eq('user_id', u.data)
    .gte('started_at', win.startIso)
    .lt('started_at', nextDayIso);
  if (sessions.error) return err(sessions.error.message);

  const sets = await client
    .from('basalt_set_entries')
    .select('weight_kg, reps, set_type')
    .eq('user_id', u.data)
    .not('weight_kg', 'is', null)
    .gte('completed_at', win.startIso)
    .lt('completed_at', nextDayIso);
  if (sets.error) return err(sets.error.message);
  const volumeKg = (sets.data ?? [])
    .filter((s: any) => s.set_type !== 'warmup' && s.reps)
    .reduce((sum: number, s: any) => sum + Number(s.weight_kg) * s.reps, 0);

  // Steps & sleep — persisted rows only (the HC sync's job, not ours).
  const steps = await client
    .from('basalt_step_logs')
    .select('date, steps')
    .eq('user_id', u.data)
    .gte('date', win.startIso)
    .lte('date', win.endIso);
  if (steps.error) return err(steps.error.message);
  const stepsFor = new Map<string, number>((steps.data ?? []).map((r: any) => [r.date, r.steps]));

  const sleep = await client
    .from('basalt_sleep_sessions')
    .select('date, bedtime, waketime')
    .eq('user_id', u.data)
    .gte('date', win.startIso)
    .lte('date', win.endIso);
  if (sleep.error) return err(sleep.error.message);
  const sleepFor = new Map<string, number>();
  for (const s of sleep.data ?? []) {
    const r = s as any;
    if (!r.bedtime || !r.waketime) continue;
    const min = (new Date(r.waketime).getTime() - new Date(r.bedtime).getTime()) / 60000;
    if (min <= 0) continue;
    sleepFor.set(r.date, (sleepFor.get(r.date) ?? 0) + min);
  }

  const targets = await getTargetsFor(client, win.endIso);
  const calorieTarget = targets.ok && targets.data ? targets.data.calories : null;
  const proteinTarget = targets.ok && targets.data ? targets.data.proteinG : null;

  const days: ReviewDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(win.start.getFullYear(), win.start.getMonth(), win.start.getDate() + i);
    const iso = isoDay(d);
    const food = byDate.get(iso);
    days.push({
      date: iso,
      calories: food ? Math.round(food.calories) : null,
      proteinG: food ? Math.round(food.proteinG) : null,
      loggedFood: !!food && food.count > 0,
      loggedTraining: false, // per-day training flag unused by the composer today
      steps: stepsFor.get(iso) ?? null,
      sleepMin: sleepFor.get(iso) ?? null,
    });
  }

  return ok(
    composeWeekReview({
      weekStartLabel: dayLabel(win.start),
      weekEndLabel: dayLabel(win.end),
      days,
      sessionCount: sessions.count ?? (sessions.data?.length ?? 0),
      volumeKg,
      calorieTarget,
      proteinTarget,
      hideNumbers: options.hideNumbers ?? false,
    }),
  );
}
