// Progression engine v1 — deterministic next-session suggestions from what
// actually happened last time: set history, RIR, and the one-tap
// post-exercise feedback. Every rule is published here and every output
// carries its basis in plain words. A suggestion is NEVER a mandate: the UI
// shows it as a hint line, prefills nothing, and the user is free to ignore
// it without the app noticing or caring.
//
// The rules, in order (first match wins):
//   0. No history → no numbers. Basalt does not invent a starting weight.
//   1. Break detection: ≥28 days since this exercise → ramp back to 80% of
//      the last top working weight; 14–27 days → 90%. Stated plainly.
//   2. Struggle: feedback "too hard", or any working set at RIR 0 —
//      suggest 5% lighter to buy back reps in reserve.
//   3. Top of the rep range with reps in reserve (all working sets ≥ max
//      reps and min RIR ≥ 1), or feedback "too easy" → +2.5 kg, reps reset
//      to the bottom of the range (double progression, load step).
//   4. Reps in reserve mid-range (min RIR ≥ 2) → +1 rep at the same load
//      (double progression, rep step).
//   5. Otherwise → hold: same load, same reps, consolidate.
//
// Bodyweight/timed work (no loads recorded) progresses by reps only.

import type { ExerciseFeedback } from './types';

export type ProgressionSet = {
  setType: string;
  reps: number | null;
  weightKg: number | null;
  rir: number | null;
};

export type ProgressionInput = {
  prev: {
    performedAt: string;
    sets: ProgressionSet[];
    feedback: ExerciseFeedback | null;
  } | null;
  /** "now" — injected so the gap tiers are testable. */
  today: Date;
};

export type Suggestion = {
  kind: 'first_time' | 'ramp_back' | 'lighten' | 'increase_load' | 'increase_reps' | 'hold';
  weightKg: number | null;
  reps: number | null;
  basis: string;
};

export const REP_RANGE = { min: 8, max: 12 } as const;
export const LOAD_STEP_KG = 2.5;
export const RAMP_TIERS = [
  { minDays: 28, factor: 0.8 },
  { minDays: 14, factor: 0.9 },
] as const;

export function roundToStep(kg: number, step = LOAD_STEP_KG): number {
  return Math.round(kg / step) * step;
}

function working(sets: ProgressionSet[]): ProgressionSet[] {
  return sets.filter((s) => s.setType !== 'warmup');
}

export function suggestNext(input: ProgressionInput): Suggestion {
  const prev = input.prev;
  if (!prev || working(prev.sets).length === 0) {
    return {
      kind: 'first_time',
      weightKg: null,
      reps: null,
      basis: 'no history for this movement — pick a load you could lift for ~10 with 2–3 in reserve',
    };
  }

  const sets = working(prev.sets);
  const weighted = sets.filter((s) => s.weightKg !== null && s.weightKg > 0);
  const topWeight = weighted.length > 0 ? Math.max(...weighted.map((s) => s.weightKg!)) : null;
  const topSets = topWeight !== null ? weighted.filter((s) => s.weightKg === topWeight) : sets;
  const repsAtTop = topSets.filter((s) => s.reps !== null).map((s) => s.reps!);
  const topReps = repsAtTop.length > 0 ? Math.max(...repsAtTop) : null;
  const rirs = sets.filter((s) => s.rir !== null).map((s) => s.rir!);
  const minRir = rirs.length > 0 ? Math.min(...rirs) : null;

  // 1 · break detection
  const gapDays = Math.floor(
    (input.today.getTime() - new Date(prev.performedAt).getTime()) / 86_400_000,
  );
  if (topWeight !== null) {
    for (const tier of RAMP_TIERS) {
      if (gapDays >= tier.minDays) {
        return {
          kind: 'ramp_back',
          weightKg: roundToStep(topWeight * tier.factor),
          reps: topReps ?? REP_RANGE.min,
          basis: `${gapDays} days since this movement — ramp back at ${Math.round(tier.factor * 100)}% of your last ${topWeight} kg, then build`,
        };
      }
    }
  }

  // 2 · struggle
  const struggled = prev.feedback === 'too_hard' || (minRir !== null && minRir === 0);
  if (struggled && topWeight !== null) {
    return {
      kind: 'lighten',
      weightKg: Math.max(0, roundToStep(topWeight * 0.95)),
      reps: topReps ?? REP_RANGE.min,
      basis:
        prev.feedback === 'too_hard'
          ? 'you marked this too hard last time — 5% lighter buys back reps in reserve'
          : 'a set hit RIR 0 last time — 5% lighter buys back reps in reserve',
    };
  }

  // Bodyweight / timed path: reps only.
  if (topWeight === null) {
    if (topReps === null) {
      return { kind: 'hold', weightKg: null, reps: null, basis: 'repeat last session — not enough recorded to suggest more' };
    }
    if (prev.feedback === 'too_easy' || (minRir !== null && minRir >= 2)) {
      return {
        kind: 'increase_reps',
        weightKg: null,
        reps: topReps + 1,
        basis: `bodyweight movement with reps in reserve — one more rep than last time's ${topReps}`,
      };
    }
    return { kind: 'hold', weightKg: null, reps: topReps, basis: 'close to your limit last time — repeat and consolidate' };
  }

  // 3 · top of range with room → load step
  const allAtMax = repsAtTop.length > 0 && repsAtTop.every((r) => r >= REP_RANGE.max);
  if (prev.feedback === 'too_easy' || (allAtMax && (minRir === null || minRir >= 1))) {
    return {
      kind: 'increase_load',
      weightKg: roundToStep(topWeight + LOAD_STEP_KG),
      reps: REP_RANGE.min,
      basis:
        prev.feedback === 'too_easy'
          ? `you marked this too easy — +${LOAD_STEP_KG} kg, back to ${REP_RANGE.min}s`
          : `all sets at ${REP_RANGE.max}+ with reps in reserve — +${LOAD_STEP_KG} kg, back to ${REP_RANGE.min}s`,
    };
  }

  // 4 · mid-range with room → rep step
  if (minRir !== null && minRir >= 2 && topReps !== null && topReps < REP_RANGE.max) {
    return {
      kind: 'increase_reps',
      weightKg: topWeight,
      reps: topReps + 1,
      basis: `RIR ≥ 2 across the board — same ${topWeight} kg, one more rep than last time's ${topReps}`,
    };
  }

  // 5 · hold
  return {
    kind: 'hold',
    weightKg: topWeight,
    reps: topReps,
    basis: 'close to your limit last time (RIR ≤ 1) — repeat and consolidate',
  };
}

/** One-line display text; null values render as em-dashes upstream. */
export function suggestionText(s: Suggestion): string {
  if (s.kind === 'first_time') return s.basis;
  const load = s.weightKg !== null ? `${s.weightKg} kg` : 'bodyweight';
  const reps = s.reps !== null ? ` × ${s.reps}` : '';
  return `Suggested: ${load}${reps} — ${s.basis}`;
}
