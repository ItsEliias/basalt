import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';
import { startSession } from './sessions';
import type { WorkoutSession } from './types';

// Named, reusable workout templates — a plan the user can start a session
// from, distinct from the one-off logged session (basalt_workout_sessions).
// Targets (sets/reps/weight) are the user's own stated plan, not invented
// data, so it's honest to show them as pre-filled ghost values on start.

export type TemplateLocation = 'gym' | 'home';

export type WorkoutTemplate = {
  id: string;
  userId: string;
  name: string;
  location: TemplateLocation;
  notes: string | null;
  createdAt: string;
};

export type TemplateExercise = {
  id: string;
  templateId: string;
  exerciseId: string | null;
  exerciseName: string;
  orderIndex: number;
  targetSets: number;
  targetReps: number | null;
  targetWeightKg: number | null;
};

export type TemplateDetail = WorkoutTemplate & { exercises: TemplateExercise[] };

export type SaveTemplateInput = {
  name: string;
  location: TemplateLocation;
  notes?: string | null;
  exercises: {
    exerciseId?: string | null;
    exerciseName: string;
    targetSets: number;
    targetReps?: number | null;
    targetWeightKg?: number | null;
  }[];
};

function mapTemplate(r: any): WorkoutTemplate {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    location: r.location ?? 'gym',
    notes: r.notes ?? null,
    createdAt: r.created_at,
  };
}

function mapTemplateExercise(r: any): TemplateExercise {
  return {
    id: r.id,
    templateId: r.template_id,
    exerciseId: r.exercise_id ?? null,
    exerciseName: r.exercise_name,
    orderIndex: Number(r.order_index ?? 0),
    targetSets: Number(r.target_sets ?? 3),
    targetReps: r.target_reps === null || r.target_reps === undefined ? null : Number(r.target_reps),
    targetWeightKg: r.target_weight_kg === null || r.target_weight_kg === undefined ? null : Number(r.target_weight_kg),
  };
}

export async function saveTemplate(client: SupabaseClient, input: SaveTemplateInput): Promise<Result<WorkoutTemplate>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_workout_templates')
    .insert({
      user_id: u.data,
      name: input.name,
      location: input.location,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not save template.');

  if (input.exercises.length > 0) {
    const { error: ee } = await client.from('basalt_template_exercises').insert(
      input.exercises.map((e, i) => ({
        template_id: data.id,
        user_id: u.data,
        exercise_id: e.exerciseId ?? null,
        exercise_name: e.exerciseName,
        order_index: i,
        target_sets: e.targetSets,
        target_reps: e.targetReps ?? null,
        target_weight_kg: e.targetWeightKg ?? null,
      })),
    );
    if (ee) return err(ee.message);
  }
  return ok(mapTemplate(data));
}

export async function listTemplates(client: SupabaseClient): Promise<Result<WorkoutTemplate[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_workout_templates')
    .select('*')
    .eq('user_id', u.data)
    .order('created_at', { ascending: false });
  if (error) return err(error.message);
  return ok((data ?? []).map(mapTemplate));
}

export async function getTemplateDetail(client: SupabaseClient, id: string): Promise<Result<TemplateDetail>> {
  const t = await client.from('basalt_workout_templates').select('*').eq('id', id).single();
  if (t.error || !t.data) return err(t.error?.message ?? 'Template not found.');
  const ex = await client
    .from('basalt_template_exercises')
    .select('*')
    .eq('template_id', id)
    .order('order_index', { ascending: true });
  if (ex.error) return err(ex.error.message);
  return ok({ ...mapTemplate(t.data), exercises: (ex.data ?? []).map(mapTemplateExercise) });
}

export async function deleteTemplate(client: SupabaseClient, id: string): Promise<Result<void>> {
  const { error } = await client.from('basalt_workout_templates').delete().eq('id', id);
  if (error) return err(error.message);
  return ok(undefined);
}

/** Copy a template's exercises + targets into a new template — "duplicate a week". */
export async function duplicateTemplate(
  client: SupabaseClient,
  templateId: string,
  newName: string,
): Promise<Result<WorkoutTemplate>> {
  const detail = await getTemplateDetail(client, templateId);
  if (!detail.ok) return detail;
  return saveTemplate(client, {
    name: newName,
    location: detail.data.location,
    notes: detail.data.notes,
    exercises: detail.data.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      targetWeightKg: e.targetWeightKg,
    })),
  });
}

/**
 * Start a new logged session from a template: creates the session row and
 * returns the template's exercises + targets so the caller can add each one
 * through the normal add-exercise flow (same prevSets/suggestion setup as
 * adding by hand) with its target attached as a ghost hint. No session_exercise
 * or set_entries rows are pre-created here — targets are a plan, not a log.
 */
export async function startSessionFromTemplate(
  client: SupabaseClient,
  templateId: string,
): Promise<Result<{ session: WorkoutSession; exercises: TemplateExercise[] }>> {
  const detail = await getTemplateDetail(client, templateId);
  if (!detail.ok) return detail;

  const session = await startSession(client);
  if (!session.ok) return session;

  return ok({ session: session.data, exercises: detail.data.exercises });
}
