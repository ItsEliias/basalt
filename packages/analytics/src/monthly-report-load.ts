import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, isoDay, type Result } from '@basalt/core-data';
import { CHECKIN_FACTORS } from './checkins';
import { loadDailySeries } from './correlations-load';
import { computeCorrelations } from './correlations';
import { composeMonthlyBehavior, type MonthlyBehaviorReport } from './monthly-report';

// Ledger → monthly behavior report. The month supplies the checkin facts;
// the correlations run over their own trailing window (same engine, same
// gates) — composing both is the report.

export async function loadMonthlyBehavior(
  client: SupabaseClient,
  today: Date = new Date(),
): Promise<Result<MonthlyBehaviorReport>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  // The last COMPLETED month — a report about a month mid-flight is fiction.
  const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const monthStart = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), 1);
  const monthLabel = monthStart.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  const daysInMonth = monthEnd.getDate();

  const checkins = await client
    .from('basalt_checkins')
    .select('date, factors, mood')
    .eq('user_id', u.data)
    .gte('date', isoDay(monthStart))
    .lte('date', isoDay(monthEnd));
  if (checkins.error) return err(checkins.error.message);

  const rows = (checkins.data ?? []) as { date: string; factors: string[] | null; mood: number | null }[];
  const factorCounts = CHECKIN_FACTORS.map((f) => ({
    label: f.label,
    evenings: rows.filter((r) => (r.factors ?? []).includes(f.key)).length,
  }));
  const moods = rows.map((r) => r.mood).filter((m): m is number => m !== null);
  const moodMean = moods.length > 0 ? moods.reduce((s, v) => s + v, 0) / moods.length : null;

  const series = await loadDailySeries(client, today);
  const correlations = series.ok
    ? computeCorrelations(series.data)
    : { shown: [], checkedNotShown: [] };

  return ok(
    composeMonthlyBehavior({
      monthLabel,
      daysInMonth,
      factorCounts,
      moodMean,
      moodDays: moods.length,
      daysWithCheckins: rows.length,
      shown: correlations.shown,
      checkedNotShown: correlations.checkedNotShown,
    }),
  );
}
