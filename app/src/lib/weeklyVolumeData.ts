import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';
import {
  weeklyMuscleVolume, regionsFor, getActiveProgram, weekIndexFor, phaseFor,
  type RegionVolume, type BlockPhase,
} from '@basalt/training';

// Ledger → weekly per-muscle volume. Counting rules on top of the
// engine's published ones: the window is the last 7 days, warmup sets
// are excluded (they are not hard sets), and exercises without a library
// link carry no muscle data — they are SKIPPED AND COUNTED, never guessed.

export type WeeklyVolumeReport = {
  regions: RegionVolume[];
  phase: BlockPhase | null;
  unlinkedExercises: number;
};

export async function loadWeeklyVolume(client: SupabaseClient): Promise<Result<WeeklyVolumeReport>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const sets = await client
    .from('basalt_set_entries')
    .select('session_exercise_id, set_type')
    .eq('user_id', u.data)
    .gte('completed_at', since.toISOString());
  if (sets.error) return err(sets.error.message);

  const countBySe = new Map<string, number>();
  for (const r of sets.data ?? []) {
    const row = r as any;
    if (row.set_type === 'warmup') continue;
    countBySe.set(row.session_exercise_id, (countBySe.get(row.session_exercise_id) ?? 0) + 1);
  }
  if (countBySe.size === 0) return ok({ regions: [], phase: null, unlinkedExercises: 0 });

  const ses = await client
    .from('basalt_session_exercises')
    .select('id, exercise_id')
    .in('id', [...countBySe.keys()]);
  if (ses.error) return err(ses.error.message);

  const exIds = [...new Set((ses.data ?? []).map((r: any) => r.exercise_id).filter(Boolean))];
  const exercises = exIds.length > 0
    ? await client.from('basalt_exercises').select('id, primary_muscles, secondary_muscles').in('id', exIds)
    : { data: [], error: null };
  if (exercises.error) return err(exercises.error.message);

  const emphasisByEx = new Map(
    (exercises.data ?? []).map((e: any) => [
      e.id,
      regionsFor({
        primaryMuscles: Array.isArray(e.primary_muscles) ? e.primary_muscles : [],
        secondaryMuscles: Array.isArray(e.secondary_muscles) ? e.secondary_muscles : [],
      }),
    ]),
  );

  let unlinked = 0;
  const rows: { emphasis: ReturnType<typeof regionsFor>; sets: number }[] = [];
  for (const r of ses.data ?? []) {
    const row = r as any;
    const setCount = countBySe.get(row.id) ?? 0;
    const emphasis = row.exercise_id ? emphasisByEx.get(row.exercise_id) : undefined;
    if (!emphasis) {
      unlinked++;
      continue;
    }
    rows.push({ emphasis, sets: setCount });
  }

  const program = await getActiveProgram(client);
  const phase =
    program.ok && program.data
      ? phaseFor(weekIndexFor(program.data.startedOn, new Date())).phase
      : null;

  return ok({ regions: weeklyMuscleVolume(rows, phase), phase, unlinkedExercises: unlinked });
}
