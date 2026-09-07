import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { isoDay, listWeightEntries } from '@basalt/core-data';
import { supabase } from './supabase';
import { buildDoctorReportHtml, type DoctorReportInput } from './doctorReportModel';

// Collector + print for the doctor report. Queries the last 90 days of
// persisted rows and hands them to the pure composer; the PDF is generated
// on-device and shared wherever the user sends it.

export const DOCTOR_REPORT_DAYS = 90;

export async function shareDoctorReport(today = new Date()): Promise<void> {
  const fromIso = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - DOCTOR_REPORT_DAYS));

  const weights = await listWeightEntries(supabase, DOCTOR_REPORT_DAYS + 1);
  const sleepRows = await supabase
    .from('basalt_sleep_sessions')
    .select('bedtime, waketime')
    .gte('date', fromIso);
  let nights = 0;
  let totalMin = 0;
  for (const r of sleepRows.data ?? []) {
    const row = r as any;
    if (!row.bedtime || !row.waketime) continue;
    const min = (Date.parse(row.waketime) - Date.parse(row.bedtime)) / 60000;
    if (min > 0) {
      nights += 1;
      totalMin += min;
    }
  }

  const steps = await supabase.from('basalt_step_logs').select('steps').gte('date', fromIso);
  const stepList = (steps.data ?? []).map((r: any) => Number(r.steps)).filter((n) => n > 0);

  const sessions = await supabase
    .from('basalt_workout_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('started_at', fromIso);
  const sets = await supabase
    .from('basalt_set_entries')
    .select('weight_kg, reps, set_type')
    .not('weight_kg', 'is', null)
    .gte('completed_at', fromIso);
  const volumeKg = (sets.data ?? [])
    .filter((s: any) => s.set_type !== 'warmup' && s.reps)
    .reduce((sum: number, s: any) => sum + Number(s.weight_kg) * s.reps, 0);

  const walks = await supabase.from('basalt_walks').select('distance_m').gte('started_at', fromIso);
  const walkKm = (walks.data ?? []).reduce((s: number, w: any) => s + Number(w.distance_m), 0) / 1000;

  const vitals = await supabase.from('basalt_vitals').select('kind, value').gte('date', fromIso);
  const band = (kind: string) => {
    const vals = (vitals.data ?? []).filter((v: any) => v.kind === kind).map((v: any) => Number(v.value));
    if (vals.length < 7) return null;
    const s = [...vals].sort((a, b) => a - b);
    return { min: s[0]!, median: s[Math.floor(s.length / 2)]!, max: s[s.length - 1]!, days: s.length };
  };

  const foods = await supabase
    .from('basalt_food_entries')
    .select('date, calories, protein')
    .gte('date', fromIso);
  const byDay = new Map<string, { kcal: number; protein: number }>();
  for (const r of foods.data ?? []) {
    const row = r as any;
    const d = byDay.get(row.date) ?? { kcal: 0, protein: 0 };
    d.kcal += Number(row.calories) || 0;
    d.protein += Number(row.protein) || 0;
    byDay.set(row.date, d);
  }
  const dayKcals = [...byDay.values()].map((d) => d.kcal).filter((k) => k > 0).sort((a, b) => a - b);
  const dayProteins = [...byDay.values()].map((d) => d.protein).filter((p) => p > 0).sort((a, b) => a - b);

  const input: DoctorReportInput = {
    monthLabel: `last ${DOCTOR_REPORT_DAYS} days to ${today.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    generatedAtIso: today.toISOString(),
    weight:
      weights.ok && weights.data.length > 0
        ? {
            entries: weights.data.map((w) => ({ date: w.measuredAt.slice(0, 10), kg: w.weightKg })),
            source: 'user weigh-ins (Basalt)',
          }
        : null,
    sleep: nights > 0 ? { nights, avgMin: totalMin / nights, source: 'Health Connect (synced) + manual' } : null,
    activity: {
      stepDays: stepList.length,
      stepsAvg: stepList.length > 0 ? stepList.reduce((a, b) => a + b, 0) / stepList.length : 0,
      sessions: sessions.count ?? 0,
      volumeKg,
      walks: (walks.data ?? []).length,
      walkKm,
    },
    intake:
      dayKcals.length > 0
        ? {
            loggedDays: dayKcals.length,
            minKcal: dayKcals[0]!,
            medianKcal: dayKcals[Math.floor(dayKcals.length / 2)]!,
            maxKcal: dayKcals[dayKcals.length - 1]!,
            proteinMedianG: dayProteins.length > 0 ? dayProteins[Math.floor(dayProteins.length / 2)]! : null,
          }
        : null,
    vitals: { hrv: band('hrv_rmssd'), rhr: band('resting_hr'), source: 'Health Connect rollups' },
  };

  const { uri } = await Print.printToFileAsync({ html: buildDoctorReportHtml(input) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'basalt-doctor-report.pdf' });
}
