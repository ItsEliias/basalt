import type { SupabaseClient } from '@supabase/supabase-js';
import { activeDaysFor } from '@basalt/analytics';

// Structurally matches @basalt/extras' GrowthInputs without importing the
// package here — the lint rule keeps extras imports at the render gate;
// the registry-published window (30) is restated and pinned by the shared
// test that compares the two constants.
export const GROWTH_WINDOW_DAYS = 30;
export type GrowthInputs = {
  loggingDays30: number;
  trainingDays30: number;
  sleepDays30: number;
};

// 30-day inputs for the published Pebble-growth score. Reads the same
// engines the core app reads; computes nothing new. Loaded only while
// the pebbleGrows Extra is on.

export async function loadGrowthInputs(client: SupabaseClient): Promise<GrowthInputs | null> {
  const cutoff = new Date(Date.now() - (GROWTH_WINDOW_DAYS - 1) * 86400000).toISOString().slice(0, 10);
  const inWindow = (days: Set<string>) => [...days].filter((d) => d >= cutoff).length;
  const [meal, workout] = await Promise.all([
    activeDaysFor(client, 'meal'),
    activeDaysFor(client, 'workout', { restAware: true }),
  ]);
  if (!meal.ok || !workout.ok) return null;
  const { data: sleepRows } = await client
    .from('basalt_sleep_sessions')
    .select('date')
    .gte('date', cutoff)
    .limit(60);
  return {
    loggingDays30: inWindow(meal.data),
    trainingDays30: inWindow(workout.data),
    sleepDays30: new Set((sleepRows ?? []).map((r: { date: string }) => r.date)).size,
  };
}
