import { supabase } from './supabase';
import { readinessScoresForLastDays } from '@basalt/analytics';
import { e1rm, mainLiftKey, stalledMainLifts, deloadAdvised, DELOAD_TRIGGERS } from '@basalt/training';

// Ledger → deload signals. The engine (periodization.ts) is pure; this
// loader reads the three published inputs from persisted rows and hands
// them over. Absent data stays null — a missing signal is not a signal.

export async function loadDeloadSignals(): Promise<ReturnType<typeof deloadAdvised>> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // a · feedback trend, last 7 days
  const fb = await supabase
    .from('basalt_session_exercises')
    .select('feedback, created_at')
    .not('feedback', 'is', null)
    .gte('created_at', sevenDaysAgo.toISOString());
  let tooHardFraction7d: number | null = null;
  if (!fb.error && (fb.data ?? []).length > 0) {
    const total = fb.data!.length;
    const hard = fb.data!.filter((r: any) => r.feedback === 'too_hard').length;
    tooHardFraction7d = hard / total;
  }

  // b · readiness trend — mean needs ≥3 computable days to mean anything
  const scores = await readinessScoresForLastDays(supabase, 7);
  const readinessMean7d =
    scores.ok && scores.data.length >= 3
      ? scores.data.reduce((s, v) => s + v, 0) / scores.data.length
      : null;

  // c · performance stall — weekly best e1RM per main lift, last 3 weeks
  const threeWeeksAgo = new Date();
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 7 * (DELOAD_TRIGGERS.stallWeeks + 1));
  const sets = await supabase
    .from('basalt_set_entries')
    .select('weight_kg, reps, set_type, completed_at, session_exercise_id')
    .not('weight_kg', 'is', null)
    .gte('completed_at', threeWeeksAgo.toISOString())
    .limit(2000);
  const exs = await supabase
    .from('basalt_session_exercises')
    .select('id, exercise_name')
    .gte('created_at', threeWeeksAgo.toISOString())
    .limit(500);
  const nameFor = new Map<string, string>(((exs.data ?? []) as any[]).map((r) => [r.id, r.exercise_name]));
  const weekly = new Map<string, number[]>(); // lift key → [w0, w1, w2] bests
  const now = Date.now();
  for (const s of (sets.data ?? []) as any[]) {
    if (s.set_type === 'warmup' || !s.reps) continue;
    const name = nameFor.get(s.session_exercise_id);
    const key = name ? mainLiftKey(name) : null;
    if (!key) continue;
    const v = e1rm(Number(s.weight_kg), s.reps);
    if (v === null) continue;
    const weeksAgo = Math.min(
      DELOAD_TRIGGERS.stallWeeks,
      Math.floor((now - Date.parse(s.completed_at)) / (7 * 86_400_000)),
    );
    const idx = DELOAD_TRIGGERS.stallWeeks - weeksAgo; // oldest first
    const series = weekly.get(key) ?? Array(DELOAD_TRIGGERS.stallWeeks + 1).fill(0);
    if (v > series[idx]!) series[idx] = v;
    weekly.set(key, series);
  }
  const stalledLifts = stalledMainLifts(
    Array.from(weekly.entries()).map(([name, weeklyBestE1rm]) => ({ name, weeklyBestE1rm })),
  );

  return deloadAdvised({ tooHardFraction7d, readinessMean7d, stalledLifts });
}
