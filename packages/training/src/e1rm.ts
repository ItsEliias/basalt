import type { SetEntry } from './types';

// e1RM + PR logic — pure functions over set history. Published formula
// (honesty rule: any score links to its inputs and math): Epley,
// e1RM = weight × (1 + reps / 30), reps capped at 12 where the estimate
// stops being meaningful.

export const E1RM_REP_CAP = 12;

/** Epley estimated 1RM. Returns null for sets that can't produce one. */
export function e1rm(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || weightKg <= 0 || reps <= 0) return null;
  if (reps > E1RM_REP_CAP) return null;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** Best (highest) e1RM across a list of sets — warm-ups excluded. */
export function bestE1rm(sets: SetEntry[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (s.setType === 'warmup') continue;
    const v = e1rm(s.weightKg, s.reps);
    if (v !== null && (best === null || v > best)) best = v;
  }
  return best;
}

/**
 * Quiet PR check: a working set is a PR when its e1RM beats the best e1RM
 * in the exercise's prior history. `history` is every earlier set for the
 * exercise; an empty history yields no PR — a first session has no record
 * to beat, and marking everything "PR" on day one would be noise, not truth.
 */
export function isSetPr(set: SetEntry, history: SetEntry[]): boolean {
  if (set.setType === 'warmup') return false;
  const current = e1rm(set.weightKg, set.reps);
  if (current === null) return false;
  const prior = bestE1rm(history);
  if (prior === null) return false;
  return current > prior;
}

/** Session tonnage in kg — Σ (weight × reps) over completed weighted sets. */
export function sessionVolumeKg(sets: SetEntry[]): number {
  return sets.reduce((sum, s) => {
    if (s.weightKg == null || s.reps == null) return sum;
    return sum + s.weightKg * s.reps;
  }, 0);
}

/**
 * Weekly volume by muscle for the body map — counts working sets per primary
 * muscle. Callers join sets to their exercises and pass the muscle list;
 * this stays pure. FILL DEPTH = LOGGED SETS, FROM REAL HISTORY, NOT A GUESS.
 */
export function setsByMuscle(
  entries: { primaryMuscles: string[]; setType: SetEntry['setType'] }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (e.setType === 'warmup') continue;
    for (const m of e.primaryMuscles) {
      out[m] = (out[m] ?? 0) + 1;
    }
  }
  return out;
}

/** "4 × 8 @ 72.5 kg" prev-note text from a prior exercise's sets. */
export function prevSummary(sets: SetEntry[]): string | null {
  const working = sets.filter((s) => s.setType !== 'warmup' && s.reps != null);
  if (working.length === 0) return null;
  const top = working.reduce((a, b) => ((b.weightKg ?? 0) > (a.weightKg ?? 0) ? b : a));
  const atTop = working.filter((s) => s.weightKg === top.weightKg);
  const reps = atTop.map((s) => s.reps ?? 0);
  const repText = Math.min(...reps) === Math.max(...reps) ? String(reps[0]) : `${Math.min(...reps)}–${Math.max(...reps)}`;
  const weight = top.weightKg != null ? `${top.weightKg} kg` : 'bodyweight';
  return `${atTop.length} × ${repText} @ ${weight}`;
}
