import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getDailyTotals, getFoodEntriesForDay } from '@basalt/nutrition';
import { listRecentSessions } from '@basalt/training';

// Daily-summary loader: gathers YESTERDAY's numbers (the client decides
// exactly what leaves the device), calls the edge function once, caches
// per day. Loaded only by the Today host inside <ExtraSlot id="narrative">.

const CACHE_PREFIX = 'basalt.narrative.';

type DayNumbers = {
  date: string;
  calories: number | null;
  targetCalories: number | null;
  proteinG: number | null;
  entryCount: number;
  sessionCount: number;
  walkKm: number | null;
  sleepHours: number | null;
};

export async function loadDailySummary(
  client: SupabaseClient,
  input: { date: string; targetCalories: number | null; sleepHours: number | null },
): Promise<string | null> {
  const cacheKey = CACHE_PREFIX + input.date;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) return cached || null;

  const [totals, entries, sessions] = await Promise.all([
    getDailyTotals(client, input.date),
    getFoodEntriesForDay(client, input.date),
    listRecentSessions(client, 20),
  ]);
  const entryCount = entries.ok ? entries.data.length : 0;
  const sessionCount = (sessions.ok ? sessions.data : [])
    .filter((s) => s.startedAt.slice(0, 10) === input.date).length;
  const day: DayNumbers = {
    date: input.date,
    calories: totals.ok ? Math.round(totals.data.calories) : null,
    targetCalories: input.targetCalories,
    proteinG: totals.ok ? Math.round(totals.data.protein) : null,
    entryCount,
    sessionCount,
    walkKm: null,
    sleepHours: input.sleepHours,
  };
  if (entryCount === 0 && sessionCount === 0 && day.sleepHours === null) {
    await AsyncStorage.setItem(cacheKey, '');
    return null;
  }
  const { data, error } = await client.functions.invoke('ai-daily-summary', { body: { day } });
  if (error || !data?.summary) return null;
  await AsyncStorage.setItem(cacheKey, String(data.summary));
  return String(data.summary);
}
