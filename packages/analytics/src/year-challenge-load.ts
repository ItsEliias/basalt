import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, type Result } from '@basalt/core-data';
import { composeYearReview, type YearReview } from './year-review';
import { computeMonthlyChallenge, type MonthlyChallenge } from './challenge';

// Ledger → Year in Review + monthly-challenge inputs, in one sweep.

export async function loadYearAndChallenge(
  client: SupabaseClient,
  today: Date,
): Promise<Result<{ year: YearReview; challenge: MonthlyChallenge }>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const jan1 = `${today.getFullYear()}-01-01`;
  const monthStart = isoDay(new Date(today.getFullYear(), today.getMonth(), 1));
  const sixtyAgo = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 60));
  const totalDaysSoFar = Math.floor((today.getTime() - Date.parse(jan1)) / 86_400_000) + 1;

  const logs = await client
    .from('basalt_daily_logs')
    .select('id, date')
    .eq('user_id', u.data)
    .gte('date', jan1);
  if (logs.error) return err(logs.error.message);
  const logIds = (logs.data ?? []).map((l: any) => l.id);
  const loggedDates = new Set<string>();
  if (logIds.length > 0) {
    const entries = await client
      .from('basalt_food_entries')
      .select('log_id')
      .in('log_id', logIds.slice(0, 400));
    if (!entries.error) {
      const dateFor = new Map((logs.data ?? []).map((l: any) => [l.id, l.date]));
      for (const e of entries.data ?? []) {
        const d = dateFor.get((e as any).log_id);
        if (d) loggedDates.add(d);
      }
    }
  }

  const sessions = await client
    .from('basalt_workout_sessions')
    .select('started_at')
    .eq('user_id', u.data)
    .gte('started_at', jan1);
  if (sessions.error) return err(sessions.error.message);
  const sessionDates = (sessions.data ?? []).map((s: any) => String(s.started_at).slice(0, 10));

  const sets = await client
    .from('basalt_set_entries')
    .select('weight_kg, reps, set_type')
    .eq('user_id', u.data)
    .not('weight_kg', 'is', null)
    .gte('completed_at', jan1)
    .limit(5000);
  const volumeKg = (sets.data ?? [])
    .filter((s: any) => s.set_type !== 'warmup' && s.reps)
    .reduce((sum: number, s: any) => sum + Number(s.weight_kg) * s.reps, 0);

  const walks = await client
    .from('basalt_walks')
    .select('distance_m')
    .eq('user_id', u.data)
    .gte('started_at', jan1);
  const walkKm = (walks.data ?? []).reduce((s: number, w: any) => s + Number(w.distance_m), 0) / 1000;

  const sleep = await client
    .from('basalt_sleep_sessions')
    .select('bedtime, waketime')
    .eq('user_id', u.data)
    .gte('date', jan1);
  let sleepNights = 0;
  let sleepTotal = 0;
  for (const r of sleep.data ?? []) {
    const row = r as any;
    if (!row.bedtime || !row.waketime) continue;
    const min = (Date.parse(row.waketime) - Date.parse(row.bedtime)) / 60000;
    if (min > 0) {
      sleepNights += 1;
      sleepTotal += min;
    }
  }

  const weights = await client
    .from('basalt_weight_entries')
    .select('measured_at, weight_kg')
    .eq('user_id', u.data)
    .gte('measured_at', jan1)
    .order('measured_at', { ascending: true });
  const wFirst = weights.data?.[0] ? Number((weights.data[0] as any).weight_kg) : null;
  const wLast = weights.data && weights.data.length > 1
    ? Number((weights.data[weights.data.length - 1] as any).weight_kg)
    : null;

  const steps = await client
    .from('basalt_step_logs')
    .select('date, steps')
    .eq('user_id', u.data)
    .gte('date', sixtyAgo);
  const stepsBaseline = (steps.data ?? [])
    .filter((r: any) => r.date < monthStart)
    .map((r: any) => Number(r.steps));
  const stepsThisMonth = (steps.data ?? [])
    .filter((r: any) => r.date >= monthStart)
    .map((r: any) => Number(r.steps));

  const recentSessionDates = sessionDates.filter((d) => d >= sixtyAgo && d < monthStart);
  const sessionsPerWeekMedian = recentSessionDates.length > 0 ? recentSessionDates.length / (60 / 7) : 0;
  const sessionsThisMonth = sessionDates.filter((d) => d >= monthStart).length;

  return ok({
    year: composeYearReview({
      yearLabel: `${today.getFullYear()} so far`,
      totalDaysSoFar,
      foodLoggedDays: loggedDates.size,
      sessions: sessionDates.length,
      volumeKg,
      walks: (walks.data ?? []).length,
      walkKm,
      sleepNights,
      sleepAvgMin: sleepNights > 0 ? sleepTotal / sleepNights : null,
      weightFirstKg: wFirst,
      weightLastKg: wLast,
    }),
    challenge: computeMonthlyChallenge({
      monthLabel: today.toLocaleDateString('en-AU', { month: 'long' }),
      daysInMonth: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
      stepsBaseline,
      stepsThisMonth,
      sessionsPerWeekMedian,
      sessionsThisMonth,
    }),
  });
}
