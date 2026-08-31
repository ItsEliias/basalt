import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';
import {
  mapSession, mapSessionExercise, mapSetEntry,
  type SessionExercise, type SetEntry, type SetInput, type WorkoutSession, type ExerciseFeedback,
} from './types';

// Session CRUD + set logging — follows the nutrition food.ts service
// template: Result<T> everywhere, client passed explicitly, every write
// through this layer so the offline outbox can slot in later.

export async function startSession(
  client: SupabaseClient,
  input: { notes?: string; startedAt?: string; source?: string; extId?: string } = {},
): Promise<Result<WorkoutSession>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const payload: Record<string, unknown> = { user_id: u.data };
  if (input.notes) payload.notes = input.notes;
  if (input.startedAt) payload.started_at = input.startedAt;
  // Imported sessions carry their origin (source shows in srcnotes) and a
  // stable ext_id — the (user_id, ext_id) unique index makes re-importing
  // the same file a no-op instead of a duplicate.
  if (input.source) payload.source = input.source;
  if (input.extId) payload.ext_id = input.extId;

  const { data, error } = await client
    .from('basalt_workout_sessions')
    .insert(payload)
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not start session.');
  return ok(mapSession(data));
}

export async function endSession(
  client: SupabaseClient,
  sessionId: string,
  input: { sessionRpe?: number; notes?: string; endedAt?: string } = {},
): Promise<Result<WorkoutSession>> {
  const payload: Record<string, unknown> = { ended_at: input.endedAt ?? new Date().toISOString() };
  if (input.sessionRpe !== undefined) payload.session_rpe = input.sessionRpe;
  if (input.notes !== undefined) payload.notes = input.notes;

  const { data, error } = await client
    .from('basalt_workout_sessions')
    .update(payload)
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not end session.');
  return ok(mapSession(data));
}

export async function addSessionExercise(
  client: SupabaseClient,
  input: {
    sessionId: string;
    exerciseId?: string | null;
    exerciseName: string;
    orderIndex: number;
    supersetGroup?: number | null;
    restSeconds?: number | null;
    notes?: string | null;
  },
): Promise<Result<SessionExercise>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_session_exercises')
    .insert({
      session_id: input.sessionId,
      user_id: u.data,
      exercise_id: input.exerciseId ?? null,
      exercise_name: input.exerciseName,
      order_index: input.orderIndex,
      superset_group: input.supersetGroup ?? null,
      rest_seconds: input.restSeconds ?? null,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not add exercise.');
  return ok(mapSessionExercise(data));
}

/**
 * Log (or amend) one set — upserts on (session_exercise_id, set_number) so
 * editing a value in place is the same call as completing the set.
 */
export async function logSet(
  client: SupabaseClient,
  sessionExerciseId: string,
  input: SetInput,
): Promise<Result<SetEntry>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  if (input.reps == null && input.durationS == null) {
    return err('A set needs reps or a duration.');
  }

  const payload: Record<string, unknown> = {
    session_exercise_id: sessionExerciseId,
    user_id: u.data,
    set_number: input.setNumber,
    set_type: input.setType ?? 'normal',
    reps: input.reps ?? null,
    weight_kg: input.weightKg ?? null,
    duration_s: input.durationS ?? null,
    rir: input.rir ?? null,
    rpe: input.rpe ?? null,
    rest_s: input.restS ?? null,
    comment: input.comment ?? null,
  };
  if (input.completedAt) payload.completed_at = input.completedAt;

  const { data, error } = await client
    .from('basalt_set_entries')
    .upsert(payload, { onConflict: 'session_exercise_id,set_number' })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not save set.');
  return ok(mapSetEntry(data));
}

export async function deleteSet(client: SupabaseClient, setId: string): Promise<Result<void>> {
  const { error } = await client.from('basalt_set_entries').delete().eq('id', setId);
  if (error) return err(error.message);
  return ok(undefined);
}

/** One-tap post-exercise feedback — logged from day one for the V1.x engine. */
export async function setExerciseFeedback(
  client: SupabaseClient,
  sessionExerciseId: string,
  feedback: ExerciseFeedback,
): Promise<Result<void>> {
  const { error } = await client
    .from('basalt_session_exercises')
    .update({ feedback })
    .eq('id', sessionExerciseId);
  if (error) return err(error.message);
  return ok(undefined);
}

/** Remember a per-exercise rest preference on the session exercise row. */
export async function setExerciseRest(
  client: SupabaseClient,
  sessionExerciseId: string,
  restSeconds: number,
): Promise<Result<void>> {
  const { error } = await client
    .from('basalt_session_exercises')
    .update({ rest_seconds: restSeconds })
    .eq('id', sessionExerciseId);
  if (error) return err(error.message);
  return ok(undefined);
}

export type SessionDetail = {
  session: WorkoutSession;
  exercises: (SessionExercise & { sets: SetEntry[] })[];
};

export async function getSessionDetail(
  client: SupabaseClient,
  sessionId: string,
): Promise<Result<SessionDetail>> {
  const s = await client.from('basalt_workout_sessions').select('*').eq('id', sessionId).single();
  if (s.error || !s.data) return err(s.error?.message ?? 'Session not found.');

  const ex = await client
    .from('basalt_session_exercises')
    .select('*')
    .eq('session_id', sessionId)
    .order('order_index', { ascending: true });
  if (ex.error) return err(ex.error.message);

  const exercises = (ex.data ?? []).map(mapSessionExercise);
  const ids = exercises.map((e) => e.id);
  let sets: SetEntry[] = [];
  if (ids.length > 0) {
    const se = await client
      .from('basalt_set_entries')
      .select('*')
      .in('session_exercise_id', ids)
      .order('set_number', { ascending: true });
    if (se.error) return err(se.error.message);
    sets = (se.data ?? []).map(mapSetEntry);
  }

  return ok({
    session: mapSession(s.data),
    exercises: exercises.map((e) => ({ ...e, sets: sets.filter((x) => x.sessionExerciseId === e.id) })),
  });
}

/**
 * The Prev column + remembered rest: the most recent completed instance of
 * this exercise before `before`, with its sets in order. Returns null when
 * no history exists — the UI ghosts nothing rather than inventing values.
 */
export async function getPrevExerciseSets(
  client: SupabaseClient,
  exerciseId: string,
  options: { before?: string } = {},
): Promise<Result<{ performedAt: string; restSeconds: number | null; feedback: 'too_easy' | 'right' | 'too_hard' | null; sets: SetEntry[] } | null>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  let q = client
    .from('basalt_session_exercises')
    .select('id, rest_seconds, created_at, feedback')
    .eq('user_id', u.data)
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (options.before) q = q.lt('created_at', options.before);
  const prev = await q;
  if (prev.error) return err(prev.error.message);

  for (const row of prev.data ?? []) {
    const sets = await client
      .from('basalt_set_entries')
      .select('*')
      .eq('session_exercise_id', row.id)
      .order('set_number', { ascending: true });
    if (sets.error) return err(sets.error.message);
    if ((sets.data ?? []).length > 0) {
      return ok({
        performedAt: row.created_at,
        restSeconds: row.rest_seconds ?? null,
        feedback: (row as any).feedback ?? null,
        sets: (sets.data ?? []).map(mapSetEntry),
      });
    }
  }
  return ok(null);
}

/** Recent sessions, newest first (Today receipt, history lists). */
export async function listRecentSessions(
  client: SupabaseClient,
  limit = 20,
): Promise<Result<WorkoutSession[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_workout_sessions')
    .select('*')
    .eq('user_id', u.data)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) return err(error.message);
  return ok((data ?? []).map(mapSession));
}

/** Set or clear an exercise's superset group (A1/A2 chaining). */
export async function setSupersetGroup(
  client: SupabaseClient,
  sessionExerciseId: string,
  group: number | null,
): Promise<Result<void>> {
  const { error } = await client
    .from('basalt_session_exercises')
    .update({ superset_group: group })
    .eq('id', sessionExerciseId);
  if (error) return err(error.message);
  return ok(undefined);
}

/** Remove an exercise (and its cascade of sets) from a session. */
export async function removeSessionExercise(client: SupabaseClient, sessionExerciseId: string): Promise<Result<void>> {
  const { error } = await client.from('basalt_session_exercises').delete().eq('id', sessionExerciseId);
  if (error) return err(error.message);
  return ok(undefined);
}
