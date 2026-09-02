import { roundToStep } from './progression';
import type { BlockPhase } from './periodization';

// %-of-training-max (V3.1 H4) — an alternative EXPRESSION of the same
// periodized suggestion, for lifters who think in percentages. Published
// rules, all here:
//   · TM = 90% of your best e1RM over the trailing 8 weeks, rounded to
//     2.5 kg — the classic convention, named as such
//   · the TM updates ONLY when a recomputation moves it by ≥ 2.5 kg
//     (one plate step); it never chases single-session noise
//   · phase percentages: accumulation 70 / 72.5 / 75 by week,
//     intensification 82.5 / 85, deload 60
//   · every prescription carries its math in words:
//     "72.5 kg = 85% of TM 85 kg" — a suggestion, never a mandate

export const TM_RULES = {
  tmFraction: 0.9,
  windowWeeks: 8,
  roundKg: 2.5,
  updateThresholdKg: 2.5,
} as const;

export const PHASE_PERCENTS: Record<BlockPhase, number[]> = {
  accumulation: [0.7, 0.725, 0.75],
  intensification: [0.825, 0.85],
  deload: [0.6],
};

/** TM from the window's best e1RM; null in, null out — never invented. */
export function trainingMax(bestE1rmKg: number | null): number | null {
  if (bestE1rmKg === null || bestE1rmKg <= 0) return null;
  return roundToStep(bestE1rmKg * TM_RULES.tmFraction, TM_RULES.roundKg);
}

/** The published update rule: move only by a full plate step. */
export function shouldUpdateTm(currentTmKg: number | null, recomputedTmKg: number | null): boolean {
  if (recomputedTmKg === null) return false;
  if (currentTmKg === null) return true;
  return Math.abs(recomputedTmKg - currentTmKg) >= TM_RULES.updateThresholdKg;
}

export type TmPrescription = {
  weightKg: number;
  percent: number;
  tmKg: number;
  mathLine: string;
};

/** "72.5 kg = 85% of TM 85 kg" for the phase week. */
export function prescribeFromTm(
  tmKg: number,
  phase: BlockPhase,
  weekInPhase: number,
): TmPrescription {
  const percents = PHASE_PERCENTS[phase];
  const pct = percents[Math.min(weekInPhase, percents.length - 1)]!;
  const weightKg = roundToStep(tmKg * pct, TM_RULES.roundKg);
  const pctText = `${Math.round(pct * 1000) / 10}%`;
  return {
    weightKg,
    percent: pct,
    tmKg,
    mathLine: `${weightKg} kg = ${pctText} of TM ${tmKg} kg`,
  };
}
