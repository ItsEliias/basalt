import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, type Result } from '@basalt/core-data';
import { checkVital, composeDeviation, DEVIATION_RULES, type DeviationReport } from './deviation';

// Ledger → deviation checks. Same persisted rows as readiness; today's
// values against the prior 30 days, today excluded from its own baseline.

export async function loadDeviation(
  client: SupabaseClient,
  today: Date = new Date(),
): Promise<Result<DeviationReport>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const todayIso = isoDay(today);
  const from = new Date(today);
  from.setDate(from.getDate() - DEVIATION_RULES.baselineDays);
  const fromIso = isoDay(from);

  const [vitals, sleep] = await Promise.all([
    client.from('basalt_vitals').select('date, kind, value').eq('user_id', u.data).gte('date', fromIso),
    client.from('basalt_sleep_sessions').select('date, bedtime, waketime').eq('user_id', u.data).gte('date', fromIso),
  ]);
  if (vitals.error) return err(vitals.error.message);
  if (sleep.error) return err(sleep.error.message);

  const series = (kind: string) =>
    (vitals.data ?? [])
      .filter((v: any) => v.kind === kind && v.date !== todayIso)
      .map((v: any) => Number(v.value));
  const todayOf = (kind: string) => {
    const row = (vitals.data ?? []).find((v: any) => v.kind === kind && v.date === todayIso);
    return row ? Number((row as any).value) : null;
  };

  const sleepByDate = new Map<string, number>();
  for (const s of sleep.data ?? []) {
    const r = s as any;
    if (!r.bedtime || !r.waketime) continue;
    const min = (Date.parse(r.waketime) - Date.parse(r.bedtime)) / 60000;
    if (min > 0) sleepByDate.set(r.date, (sleepByDate.get(r.date) ?? 0) + min);
  }
  const sleepBaseline = Array.from(sleepByDate.entries())
    .filter(([d]) => d !== todayIso)
    .map(([, v]) => v);

  return ok(
    composeDeviation([
      checkVital('hrv', 'HRV', todayOf('hrv_rmssd'), series('hrv_rmssd')),
      checkVital('rhr', 'Resting HR', todayOf('resting_hr'), series('resting_hr')),
      checkVital('sleep', 'Sleep duration', sleepByDate.get(todayIso) ?? null, sleepBaseline),
    ]),
  );
}
