import { matchExerciseName, normalizeExerciseName } from './import-csv';
import type { SaveTemplateInput } from './templates';

// Routine-photo import — the OCR'd routine (from ai-photo-food mode
// 'routine') mapped into saveable templates, through the SAME dry-run
// discipline as the CSV importer: fuzzy match against the catalog with
// manual overrides, unmatched names imported as written (the name is the
// record, the id is a link), and everything previewed before commit.

export type OcrRoutineExercise = {
  name: string;
  sets: number;
  reps: number | null;
  weight_kg: number | null;
};

export type OcrRoutineDay = { label: string; exercises: OcrRoutineExercise[] };

export type OcrRoutine = { name: string; days: OcrRoutineDay[] };

export type RoutinePreview = {
  templates: SaveTemplateInput[];
  /** Distinct source names with no catalog match — importable as written. */
  unmatched: string[];
  /** Rows dropped for stating no set count — named, never silent. */
  skipped: string[];
};

/**
 * One template per routine day (single-day routines keep the plain name).
 * `overrides` maps a source name (normalized) to a catalog exercise name.
 */
export function routineToTemplates(
  routine: OcrRoutine,
  catalog: { id: string; name: string }[],
  overrides: Record<string, string> = {},
): RoutinePreview {
  const names = catalog.map((c) => c.name);
  const byName = new Map(catalog.map((c) => [c.name, c.id]));
  const unmatched = new Set<string>();
  const skipped: string[] = [];

  const templates = routine.days.map((day): SaveTemplateInput => ({
    name: routine.days.length > 1 ? `${routine.name} — ${day.label}` : routine.name,
    location: 'gym',
    notes: null,
    exercises: day.exercises
      .filter((e) => {
        if (e.sets >= 1) return true;
        skipped.push(`${day.label}: ${e.name} (no set count)`);
        return false;
      })
      .map((e) => {
        const override = overrides[normalizeExerciseName(e.name)];
        const matched = override ?? matchExerciseName(e.name, names);
        if (!matched) unmatched.add(e.name);
        return {
          exerciseId: matched ? byName.get(matched) ?? null : null,
          exerciseName: matched ?? e.name,
          targetSets: Math.round(e.sets),
          targetReps: e.reps === null ? null : Math.round(e.reps),
          targetWeightKg: e.weight_kg,
        };
      }),
  })).filter((t) => t.exercises.length > 0);

  return { templates, unmatched: [...unmatched], skipped };
}

/** "3 days · 14 exercises · 2 unmatched names" — the dry-run header line. */
export function routinePreviewLine(p: RoutinePreview): string {
  const ex = p.templates.reduce((s, t) => s + t.exercises.length, 0);
  const parts = [
    `${p.templates.length} ${p.templates.length === 1 ? 'day' : 'days'}`,
    `${ex} ${ex === 1 ? 'exercise' : 'exercises'}`,
  ];
  if (p.unmatched.length > 0) parts.push(`${p.unmatched.length} unmatched ${p.unmatched.length === 1 ? 'name' : 'names'}`);
  return parts.join(' · ');
}
