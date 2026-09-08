import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';
import { CATALOG } from './generator/catalog';

// Pain flags (V4 Phase 8d) — the engine side. A flag is the user's own
// 0–3 word for how a movement felt. The rules, published and pinned:
//   · pain > 0 on an exercise's last session → next time that exercise
//     comes up, a substitution is PROPOSED (never forced)
//   · 3+ flagged sets across ANY exercises in 14 days → one plain line:
//     worth getting that looked at. No diagnosis, no urgency theatre.

export const PAIN_LOOKBACK_DAYS = 14;
export const PAIN_PROMPT_THRESHOLD = 3;
export const PAIN_PROMPT_LINE =
  'Three pain flags in a fortnight — worth getting that looked at by someone qualified. Basalt only counts; it cannot diagnose.';

export type PainSummary = {
  /** Exercise names whose most recent flagged set was pain > 0. */
  flaggedExercises: { name: string; pain: number; lastAt: string }[];
  totalFlags: number;
  promptCheckup: boolean;
};

export async function loadPainSummary(client: SupabaseClient): Promise<Result<PainSummary>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const since = new Date();
  since.setDate(since.getDate() - PAIN_LOOKBACK_DAYS);

  const sets = await client
    .from('basalt_set_entries')
    .select('pain, completed_at, session_exercise_id')
    .eq('user_id', u.data)
    .gt('pain', 0)
    .gte('completed_at', since.toISOString())
    .order('completed_at', { ascending: false });
  if (sets.error) return err(sets.error.message);
  const rows = sets.data ?? [];
  if (rows.length === 0) return ok({ flaggedExercises: [], totalFlags: 0, promptCheckup: false });

  const seIds = [...new Set(rows.map((r: any) => r.session_exercise_id).filter(Boolean))];
  const ses = await client
    .from('basalt_session_exercises')
    .select('id, exercise_name')
    .in('id', seIds);
  if (ses.error) return err(ses.error.message);
  const nameBySe = new Map((ses.data ?? []).map((r: any) => [r.id, r.exercise_name as string]));

  const byName = new Map<string, { pain: number; lastAt: string }>();
  for (const r of rows as any[]) {
    const name = nameBySe.get(r.session_exercise_id);
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, { pain: Number(r.pain), lastAt: r.completed_at });
  }
  return ok({
    flaggedExercises: [...byName.entries()].map(([name, v]) => ({ name, ...v })),
    totalFlags: rows.length,
    promptCheckup: rows.length >= PAIN_PROMPT_THRESHOLD,
  });
}

/** Substitution proposal for a flagged exercise, from the catalog by name. */
export function substitutionForName(exerciseName: string): string | null {
  const lower = exerciseName.trim().toLowerCase();
  const entry = CATALOG.find((x) => x.name.toLowerCase() === lower);
  if (!entry || entry.subs.length === 0) return null;
  const sub = CATALOG.find((x) => x.id === entry.subs[0]);
  return sub?.name ?? null;
}
