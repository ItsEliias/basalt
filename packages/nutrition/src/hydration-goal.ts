import type { GoalKey } from './targets';

// The REAL bodyweight hydration formula, extracted from the quarry's
// phase9WellnessService (the live water screen ignored it and hardcoded
// 2,000 ml — week-one chore: wire it properly).
//
// goal = weightKg × 32 ml  (2,200 ml fallback with no weight)
//      + activity bonus     (steps > 9,000 → +400 · > 6,000 → +250 · > 3,000 → +100)
//      + goal modifier      (build muscle +200 · lose weight +100)
// clamped to 1,600–3,600 ml, rounded to 50 ml.

export function hydrationGoalMl(
  weightKg: number | null | undefined,
  activitySteps = 0,
  goals: GoalKey[] = [],
): number {
  const base = weightKg && weightKg > 0 ? weightKg * 32 : 2200;
  const activityBonus = activitySteps > 9000 ? 400 : activitySteps > 6000 ? 250 : activitySteps > 3000 ? 100 : 0;
  const goalModifier = goals.includes('build') ? 200 : goals.includes('lose') ? 100 : 0;
  return Math.round(Math.max(1600, Math.min(3600, base + activityBonus + goalModifier)) / 50) * 50;
}
