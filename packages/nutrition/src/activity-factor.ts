// Activity factor from data (V4 Phase 8-0). Once two weeks of real
// movement exist in the ledger, the plan stops trusting the self-reported
// band and derives the factor from what actually happened — a published
// MET model, shown as a range because it IS an estimate.
//
// Published model (rendered verbatim in-app):
//   strength sessions  3.5 MET
//   recorded walks     3.3 MET
//   remaining steps    0.0004 kcal per step per kg
//     (walk steps subtracted first at a published 100 steps/min cadence)
//   activity kcal/day  = MET kcal spread over the window
//   factor             = 1.2 (sedentary base) + activity kcal / BMR
//   range              = the activity term at ±20%

export const ACTIVITY_METS = { strengthSession: 3.5, walk: 3.3 } as const;
export const STEP_KCAL_PER_STEP_PER_KG = 0.0004;
export const WALK_CADENCE_STEPS_PER_MIN = 100;
export const SEDENTARY_BASE = 1.2;
export const DERIVED_FACTOR_MIN_STEP_DAYS = 14;
export const DERIVED_FACTOR_WINDOW_DAYS = 21;

export const ACTIVITY_FACTOR_EXPLAINER =
  'Derived from your last three weeks: strength at 3.5 MET, walks at 3.3 MET, remaining steps at '
  + '0.0004 kcal/step/kg (walk steps subtracted at 100 steps/min), over a 1.2 sedentary base — ±20% '
  + 'because it is an estimate, not a measurement.';

export type ActivityData = {
  /** Days in the window that have a step reading. */
  stepDays: number;
  avgDailySteps: number;
  /** Total minutes across the window, not per day. */
  strengthMinutes: number;
  walkMinutes: number;
  weightKg: number;
  bmr: number;
};

export type DerivedFactor = {
  factor: number;
  low: number;
  high: number;
  activityKcalPerDay: number;
};

/** Null until the data has earned it (≥14 step-days in the window). */
export function derivedActivityFactor(data: ActivityData): DerivedFactor | null {
  if (data.stepDays < DERIVED_FACTOR_MIN_STEP_DAYS) return null;
  if (data.bmr <= 0 || data.weightKg <= 0) return null;

  const days = DERIVED_FACTOR_WINDOW_DAYS;
  const strengthKcal = ACTIVITY_METS.strengthSession * data.weightKg * (data.strengthMinutes / 60);
  const walkKcal = ACTIVITY_METS.walk * data.weightKg * (data.walkMinutes / 60);
  const walkSteps = data.walkMinutes * WALK_CADENCE_STEPS_PER_MIN;
  const totalSteps = data.avgDailySteps * days;
  const remainingSteps = Math.max(0, totalSteps - walkSteps);
  const stepKcal = remainingSteps * STEP_KCAL_PER_STEP_PER_KG * data.weightKg;

  const perDay = (strengthKcal + walkKcal + stepKcal) / days;
  const factorAt = (scale: number) => Math.round((SEDENTARY_BASE + (perDay * scale) / data.bmr) * 100) / 100;
  return {
    factor: factorAt(1),
    low: factorAt(0.8),
    high: factorAt(1.2),
    activityKcalPerDay: Math.round(perDay),
  };
}
