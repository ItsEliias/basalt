import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { isoDay, listWeightEntries } from '@basalt/core-data';
import { supabase } from './supabase';
import { buildDoctorReportHtml, type DoctorReportInput } from './doctorReportModel';

// Collector + print for the monthly doctor report. Queries the last 30
// days of persisted rows and hands them to the pure composer; the PDF is
// generated on-device and shared wherever the user sends it.

export async function shareDoctorReport(today = new Date()): Promise<void> {
  const fromIso = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30));

  const weights = await listWeightEntries(supabase, 31);
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

  const input: DoctorReportInput = {
    monthLabel: today.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }),
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
    vitals: { hrv: band('hrv_rmssd'), rhr: band('resting_hr'), source: 'Health Connect rollups' },
  };

  const { uri } = await Print.printToFileAsync({ html: buildDoctorReportHtml(input) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'basalt-doctor-report.pdf' });
}
