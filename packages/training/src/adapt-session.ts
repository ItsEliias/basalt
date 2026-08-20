// Adapt Session — transform the current session plan for the day you're
// actually having: less time, no equipment, a quiet room, a muscle to
// leave alone. Pure and propose-only: the engine returns a change list
// with a stated why per exercise; the UI shows it and the user confirms.
// Nothing is ever changed silently, and exercises with sets already
// logged are never touched — the ledger is history, not a draft.

export type AdaptExercise = {
  name: string;
  category: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string | null;
  difficulty: string | null;
};

export type AdaptItem<T extends AdaptExercise = AdaptExercise> = {
  id: string;
  committedSets: number;
  plannedSets: number;
  exercise: T;
};

export type AdaptMode =
  | { kind: 'less_time' }
  | { kind: 'no_equipment' }
  | { kind: 'quiet' }
  | { kind: 'exclude_muscle'; muscle: string };

export type AdaptChange<T extends AdaptExercise = AdaptExercise> = {
  id: string;
  action: 'keep' | 'trim' | 'swap' | 'drop';
  toSets?: number;
  replacement?: T;
  why: string;
};

const BODYWEIGHT = new Set(['body only', 'body_only', 'bodyweight', 'none']);

const isBodyweight = (ex: AdaptExercise) =>
  ex.equipment === null || BODYWEIGHT.has(ex.equipment.toLowerCase());

const NOISY_WORDS = ['jump', 'bound', 'drop', 'slam', 'clean', 'snatch', 'jerk', 'hop', 'skip', 'sprint'];
const isNoisy = (ex: AdaptExercise) =>
  ex.category === 'plyometrics' || NOISY_WORDS.some((w) => ex.name.toLowerCase().includes(w));

const hitsMuscle = (ex: AdaptExercise, muscle: string) =>
  ex.primaryMuscles.map((m) => m.toLowerCase()).includes(muscle.toLowerCase());

/** Best same-primary-muscle alternative passing `ok`, same category preferred. */
function alternative<T extends AdaptExercise>(
  ex: AdaptExercise,
  library: T[],
  ok: (candidate: T) => boolean,
): T | null {
  const primary = ex.primaryMuscles[0]?.toLowerCase();
  if (!primary) return null;
  const candidates = library.filter(
    (c) => c.name !== ex.name && hitsMuscle(c, primary) && ok(c),
  );
  if (candidates.length === 0) return null;
  return candidates.find((c) => c.category === ex.category) ?? candidates[0]!;
}

export function adaptSession<T extends AdaptExercise>(
  items: AdaptItem<T>[],
  mode: AdaptMode,
  library: T[],
): AdaptChange<T>[] {
  return items.map((item) => {
    const ex = item.exercise;
    if (item.committedSets > 0) {
      return { id: item.id, action: 'keep' as const, why: 'sets already logged — left alone' };
    }

    if (mode.kind === 'less_time') {
      if (item.plannedSets > 2) {
        return {
          id: item.id,
          action: 'trim' as const,
          toSets: 2,
          why: `${item.plannedSets} sets → 2 — two hard sets keep most of the stimulus`,
        };
      }
      return { id: item.id, action: 'keep' as const, why: 'already at 2 sets or fewer' };
    }

    if (mode.kind === 'no_equipment') {
      if (isBodyweight(ex)) return { id: item.id, action: 'keep' as const, why: 'already bodyweight' };
      const alt = alternative(ex, library, isBodyweight);
      if (alt) {
        return {
          id: item.id,
          action: 'swap' as const,
          replacement: alt,
          why: `${ex.equipment} unavailable — ${alt.name} works the same primary muscle with none`,
        };
      }
      return {
        id: item.id,
        action: 'drop' as const,
        why: `needs ${ex.equipment} and no bodyweight movement in the library covers ${ex.primaryMuscles[0] ?? 'it'}`,
      };
    }

    if (mode.kind === 'quiet') {
      if (!isNoisy(ex)) return { id: item.id, action: 'keep' as const, why: 'already quiet' };
      const alt = alternative(ex, library, (c) => !isNoisy(c));
      if (alt) {
        return {
          id: item.id,
          action: 'swap' as const,
          replacement: alt,
          why: `impact movement — ${alt.name} hits the same primary muscle without the noise`,
        };
      }
      return { id: item.id, action: 'drop' as const, why: 'impact movement with no quiet cover in the library' };
    }

    // exclude_muscle
    if (hitsMuscle(ex, mode.muscle)) {
      return {
        id: item.id,
        action: 'drop' as const,
        why: `primary muscle is ${mode.muscle} — excluded today at your request`,
      };
    }
    return { id: item.id, action: 'keep' as const, why: `doesn't target ${mode.muscle}` };
  });
}

/** "2 swapped · 1 trimmed · 3 kept" — the confirm-sheet summary line. */
export function adaptSummary(changes: AdaptChange[]): string {
  const count = (a: AdaptChange['action']) => changes.filter((c) => c.action === a).length;
  const parts = [
    count('swap') > 0 ? `${count('swap')} swapped` : null,
    count('trim') > 0 ? `${count('trim')} trimmed` : null,
    count('drop') > 0 ? `${count('drop')} dropped` : null,
    `${count('keep')} kept`,
  ].filter(Boolean);
  return parts.join(' · ');
}
