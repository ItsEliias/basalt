import AsyncStorage from '@react-native-async-storage/async-storage';
import { isoDay } from '@basalt/core-data';
import {
  computeRecovery, parseOverrides, serializeOverrides, REGION_FOR_MUSCLE,
  type BodyRegion, type RegionRecovery, type RegionSetEvent,
} from '@basalt/training';
import { supabase } from './supabase';

// Ledger → per-muscle recovery. Sets from the last 72 h resolve to regions
// through each exercise's primary muscles; the sleep modifier applies only
// when last night is actually persisted — no wearable, no modifier.

const OVERRIDE_KEY = 'basalt.recoveryOverrides';

export async function loadRecovery(nowMs: number): Promise<{
  recovery: RegionRecovery[];
  shortSleep: boolean;
  overrides: BodyRegion[];
}> {
  const since = new Date(nowMs - 72 * 3600_000).toISOString();

  const sets = await supabase
    .from('basalt_set_entries')
    .select('session_exercise_id, set_type, completed_at')
    .neq('set_type', 'warmup')
    .gte('completed_at', since)
    .limit(1000);
  const seIds = Array.from(new Set((sets.data ?? []).map((s: any) => s.session_exercise_id)));

  const events: RegionSetEvent[] = [];
  if (seIds.length > 0) {
    const ses = await supabase
      .from('basalt_session_exercises')
      .select('id, exercise_id')
      .in('id', seIds);
    const exIds = Array.from(new Set((ses.data ?? []).map((r: any) => r.exercise_id).filter(Boolean)));
    const exs = exIds.length > 0
      ? await supabase.from('basalt_exercises').select('id, primary_muscles').in('id', exIds)
      : { data: [] as any[] };
    const musclesFor = new Map<string, string[]>(
      (exs.data ?? []).map((r: any) => [r.id, r.primary_muscles ?? []]),
    );
    const exForSe = new Map<string, string>((ses.data ?? []).map((r: any) => [r.id, r.exercise_id]));
    for (const s of sets.data ?? []) {
      const muscles = musclesFor.get(exForSe.get((s as any).session_exercise_id) ?? '') ?? [];
      const regions = new Set<BodyRegion>();
      for (const m of muscles) {
        const region = REGION_FOR_MUSCLE[m.toLowerCase()];
        if (region) regions.add(region);
      }
      for (const region of regions) {
        events.push({ region, atMs: Date.parse((s as any).completed_at), sets: 1 });
      }
    }
  }

  let shortSleep = false;
  const lastNight = await supabase
    .from('basalt_sleep_sessions')
    .select('bedtime, waketime')
    .eq('date', isoDay(new Date(nowMs)))
    .limit(3);
  for (const r of lastNight.data ?? []) {
    const row = r as any;
    if (!row.bedtime || !row.waketime) continue;
    const min = (Date.parse(row.waketime) - Date.parse(row.bedtime)) / 60000;
    if (min > 0 && min < 360) shortSleep = true;
  }

  const overrides = parseOverrides(
    (await AsyncStorage.getItem(OVERRIDE_KEY)) ?? '',
    isoDay(new Date(nowMs)),
  );
  return { recovery: computeRecovery(events, { nowMs, shortSleep, overrides }), shortSleep, overrides };
}

export async function toggleRecoveryOverride(region: BodyRegion, nowMs: number): Promise<void> {
  const today = isoDay(new Date(nowMs));
  const current = parseOverrides((await AsyncStorage.getItem(OVERRIDE_KEY)) ?? '', today);
  const next = current.includes(region) ? current.filter((r) => r !== region) : [...current, region];
  await AsyncStorage.setItem(OVERRIDE_KEY, serializeOverrides(next, today));
}
