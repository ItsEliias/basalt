// Basalt training model — Oathbound's set_entry relational shape ported to
// Postgres (migration report Tier B). Sessions → session_exercises →
// set_entries; per-set rows, RPE/RIR 0–10, set types, superset groups,
// per-exercise remembered rest. Unlock/trial/stat tables were left behind.

export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure';
export type ExerciseFeedback = 'too_easy' | 'right' | 'too_hard';

export type WorkoutSession = {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  sessionRpe: number | null;
  source: string;
};

export type SessionExercise = {
  id: string;
  sessionId: string;
  userId: string;
  exerciseId: string | null;
  exerciseName: string;
  orderIndex: number;
  supersetGroup: number | null;
  restSeconds: number | null;
  notes: string | null;
  feedback: ExerciseFeedback | null;
};

export type SetEntry = {
  id: string;
  sessionExerciseId: string;
  userId: string;
  setNumber: number;
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
  durationS: number | null;
  rir: number | null;
  rpe: number | null;
  restS: number | null;
  comment: string | null;
  completedAt: string;
};

export type SetInput = {
  setNumber: number;
  setType?: SetType;
  reps?: number | null;
  weightKg?: number | null;
  durationS?: number | null;
  rir?: number | null;
  rpe?: number | null;
  restS?: number | null;
  comment?: string | null;
  /** Backdates the row's own completion timestamp — without it the DB
   *  default (`now()`) applies even for a set logged inside a backdated
   *  session, which is only wrong for backdated writes (seed scripts). */
  completedAt?: string;
};

export function mapSession(r: any): WorkoutSession {
  return {
    id: r.id,
    userId: r.user_id,
    startedAt: r.started_at,
    endedAt: r.ended_at ?? null,
    notes: r.notes ?? null,
    sessionRpe: r.session_rpe === null || r.session_rpe === undefined ? null : Number(r.session_rpe),
    source: r.source ?? 'manual',
  };
}

export function mapSessionExercise(r: any): SessionExercise {
  return {
    id: r.id,
    sessionId: r.session_id,
    userId: r.user_id,
    exerciseId: r.exercise_id ?? null,
    exerciseName: r.exercise_name,
    orderIndex: Number(r.order_index ?? 0),
    supersetGroup: r.superset_group ?? null,
    restSeconds: r.rest_seconds ?? null,
    notes: r.notes ?? null,
    feedback: r.feedback ?? null,
  };
}

export function mapSetEntry(r: any): SetEntry {
  return {
    id: r.id,
    sessionExerciseId: r.session_exercise_id,
    userId: r.user_id,
    setNumber: Number(r.set_number),
    setType: r.set_type ?? 'normal',
    reps: r.reps ?? null,
    weightKg: r.weight_kg === null || r.weight_kg === undefined ? null : Number(r.weight_kg),
    durationS: r.duration_s ?? null,
    rir: r.rir === null || r.rir === undefined ? null : Number(r.rir),
    rpe: r.rpe === null || r.rpe === undefined ? null : Number(r.rpe),
    restS: r.rest_s ?? null,
    comment: r.comment ?? null,
    completedAt: r.completed_at,
  };
}
