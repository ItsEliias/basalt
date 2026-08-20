import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, type Result } from '@basalt/core-data';

// Exercise library — read-only access to the shared basalt_exercises
// reference table (873 free-exercise-db movements, seeded server-side).
// Ported from the quarry's exerciseService: same Result<T> contract, same
// ILIKE pattern-escaping; extended with equipment filters so the library's
// "My equipment" chip works against the onboarding inventory.

export type Exercise = {
  id: string;
  extId: string;
  source: string;
  name: string;
  category: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string | null;
  difficulty: string | null;
  instructions: string[];
  imageUrls: string[];
  /** Nullable. Renders a "coming soon" slot until a richer source populates it. */
  videoUrl: string | null;
};

function mapRow(r: any): Exercise {
  return {
    id: r.id,
    extId: r.ext_id,
    source: r.source,
    name: r.name,
    category: r.category ?? null,
    primaryMuscles: Array.isArray(r.primary_muscles) ? r.primary_muscles : [],
    secondaryMuscles: Array.isArray(r.secondary_muscles) ? r.secondary_muscles : [],
    equipment: r.equipment ?? null,
    difficulty: r.difficulty ?? null,
    instructions: Array.isArray(r.instructions) ? r.instructions : [],
    imageUrls: Array.isArray(r.image_urls) ? r.image_urls : [],
    videoUrl: r.video_url ?? null,
  };
}

export type ExerciseFilter = {
  muscle?: string;        // primary_muscles contains this token
  category?: string;      // exact category match
  equipment?: string[];   // equipment IN (…) — the "My equipment" filter
  search?: string;        // case-insensitive substring on name
  limit?: number;         // default 200; UI caps the visible list
};

/** Escape %/_ so user input can't act as ILIKE wildcards. */
export function escapeIlike(input: string): string {
  return input.replace(/[%_]/g, (m) => `\\${m}`);
}

/** List exercises with optional filters. Ordered alphabetically by name. */
export async function getExercises(
  client: SupabaseClient,
  filter: ExerciseFilter = {},
): Promise<Result<Exercise[]>> {
  let q = client.from('basalt_exercises').select('*').order('name', { ascending: true });

  if (filter.category) q = q.eq('category', filter.category);
  if (filter.muscle) q = q.contains('primary_muscles', [filter.muscle]);
  if (filter.equipment && filter.equipment.length > 0) q = q.in('equipment', filter.equipment);
  if (filter.search && filter.search.trim() !== '') {
    q = q.ilike('name', `%${escapeIlike(filter.search)}%`);
  }
  q = q.limit(filter.limit ?? 200);

  const { data, error } = await q;
  if (error) return err(error.message);
  return ok((data ?? []).map(mapRow));
}

/** Full detail record for a single exercise, or null when not found. */
export async function getExerciseById(
  client: SupabaseClient,
  id: string,
): Promise<Result<Exercise | null>> {
  const { data, error } = await client.from('basalt_exercises').select('*').eq('id', id).maybeSingle();
  if (error && error.code !== 'PGRST116') return err(error.message);
  return ok(data ? mapRow(data) : null);
}

/** Distinct primary muscles present — for the library filter chips. */
export async function listMuscles(client: SupabaseClient): Promise<Result<string[]>> {
  const { data, error } = await client.from('basalt_exercises').select('primary_muscles');
  if (error) return err(error.message);
  const uniq = new Set<string>();
  (data ?? []).forEach((r: any) => (r.primary_muscles ?? []).forEach((m: string) => uniq.add(m)));
  return ok(Array.from(uniq).sort());
}

/** Distinct equipment kinds present — for the library filter chips. */
export async function listEquipment(client: SupabaseClient): Promise<Result<string[]>> {
  const { data, error } = await client.from('basalt_exercises').select('equipment');
  if (error) return err(error.message);
  const uniq = Array.from(new Set((data ?? []).map((r: any) => r.equipment).filter(Boolean))) as string[];
  uniq.sort();
  return ok(uniq);
}
