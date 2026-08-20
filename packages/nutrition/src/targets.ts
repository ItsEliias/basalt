// The ONE target engine (week-one chore #4: utils/tdee.ts stays dead).
// Ported from the quarry's targetsService — Mifflin-St Jeor with intersex
// averaging, 5-level activity multipliers, goal deltas, macro splits, the
// 1200 kcal floor — and extended for Basalt's onboarding output: multi-goal
// balancing (conflicting pairs lean recomp and SAY SO), sugar/sodium caps,
// water, steps and sleep targets. Every rule is published here in plain
// numbers: algorithm, not black box.

export type BiologicalSex = 'female' | 'male' | 'intersex' | 'prefer_not_to_say';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extreme';
export type GoalKey = 'lose' | 'build' | 'health' | 'fitness' | 'sleep' | 'refine';

export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light:     1.375,
  moderate:  1.55,
  very:      1.725,
  extreme:   1.9,
};

export const MIN_SAFE_CALORIES = 1200;

type Split = { protein: number; carbs: number; fat: number };

export type TargetInput = {
  biologicalSex: BiologicalSex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  /** Multi-select goals from onboarding step 2. Empty falls back to 'health'. */
  goals: GoalKey[];
  /** Honest-habits answers that adjust caps toward realistic, not punitive. */
  habits?: { sugaryDrinks?: 'rarely' | 'few_week' | 'daily'; alcohol?: 'none' | 'social' | 'few_week' | 'daily' };
  /** Diet & belief flags; 'Low sodium' tightens the sodium cap. */
  dietPatterns?: string[];
  jobActivity?: 'desk' | 'feet' | 'physical' | 'mixed';
};

export type ComputedTargets = {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarCapG: number;
  sodiumCapMg: number;
  waterMl: number;
  steps: number;
  sleepMin: number;
  /** The one-line "why" — stored on basalt_targets.reason, shown in the UI. */
  explanation: string;
};

function bmrFor(sex: 'male' | 'female', weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Mifflin-St Jeor; intersex / undisclosed → average of the two formulas. */
export function calculateBMR(sex: BiologicalSex, weightKg: number, heightCm: number, age: number): number {
  if (sex === 'male') return bmrFor('male', weightKg, heightCm, age);
  if (sex === 'female') return bmrFor('female', weightKg, heightCm, age);
  return (bmrFor('male', weightKg, heightCm, age) + bmrFor('female', weightKg, heightCm, age)) / 2;
}

/**
 * Resolve a multi-goal selection into one calorie delta + macro split.
 * lose + build together pull opposite ways → lean recomposition (slight
 * deficit, protein-forward) and the explanation states the trade-off
 * plainly instead of hiding it.
 */
export function resolveGoals(goals: GoalKey[]): { delta: number; split: Split; explanation: string } {
  const set = new Set(goals.length > 0 ? goals : ['health' as GoalKey]);
  if (set.has('lose') && set.has('build')) {
    return {
      delta: -150,
      split: { protein: 0.35, carbs: 0.35, fat: 0.30 },
      explanation: 'Lose weight and build muscle pull in opposite directions — targets lean recomposition: a slight deficit with protein protected.',
    };
  }
  if (set.has('lose')) {
    return {
      delta: -500,
      split: { protein: 0.40, carbs: 0.30, fat: 0.30 },
      explanation: 'Steady deficit (−500 kcal/day from estimated expenditure), protein protected.',
    };
  }
  if (set.has('build')) {
    return {
      delta: 400,
      split: { protein: 0.30, carbs: 0.45, fat: 0.25 },
      explanation: 'Building surplus (+400 kcal/day over estimated expenditure), carb-forward for training.',
    };
  }
  if (set.has('refine')) {
    return {
      delta: 0,
      split: { protein: 0.35, carbs: 0.35, fat: 0.30 },
      explanation: 'Maintenance calories with tighter macro bands for recomposition.',
    };
  }
  return {
    delta: 0,
    split: { protein: 0.30, carbs: 0.40, fat: 0.30 },
    explanation: 'Maintenance calories from estimated expenditure.',
  };
}

/**
 * Added-sugar cap: 6% of energy as a baseline (between WHO's 5% ideal and
 * 10% limit), 5% when general health is a stated goal, and +2 points when
 * daily sugary drinks or daily alcohol make 5–6% unrealistic on week one —
 * a cap you'll blow through every day teaches nothing.
 */
export function sugarCapG(calories: number, goals: GoalKey[], habits?: TargetInput['habits']): number {
  let pct = goals.includes('health') ? 0.05 : 0.06;
  if (habits?.sugaryDrinks === 'daily' || habits?.alcohol === 'daily') pct += 0.02;
  return Math.round((calories * pct) / 4);
}

/** Sodium cap: 2,300 mg standard; 1,500 mg when Low sodium is selected. */
export function sodiumCapMg(dietPatterns: string[] = []): number {
  const low = dietPatterns.some((p) => p.toLowerCase().replace(/[^a-z]/g, '').includes('lowsodium'));
  return low ? 1500 : 2300;
}

/**
 * Day-one step target from job activity (deliberate movement on top of the
 * day you already have), +1,500 when fitness & endurance is a goal.
 * Clamped 6,000–12,000, rounded to 500. Baseline-adaptive goals are V1.x.
 */
export function stepsTarget(jobActivity?: TargetInput['jobActivity'], goals: GoalKey[] = []): number {
  const base = jobActivity === 'feet' ? 8000 : jobActivity === 'physical' ? 8000 : jobActivity === 'mixed' ? 7500 : 7000;
  const withGoal = base + (goals.includes('fitness') ? 1500 : 0);
  const clamped = Math.max(6000, Math.min(12000, withGoal));
  return Math.round(clamped / 500) * 500;
}

/** Sleep target: 8 h when sleep & recovery is a stated goal, else 7.5 h. */
export function sleepTargetMin(goals: GoalKey[] = []): number {
  return goals.includes('sleep') ? 480 : 450;
}

import { hydrationGoalMl } from './hydration-goal';

export function computeTargets(input: TargetInput): ComputedTargets {
  const bmr = calculateBMR(input.biologicalSex, input.weightKg, input.heightCm, input.age);
  const tdee = bmr * ACTIVITY_MULTIPLIER[input.activityLevel];
  const { delta, split, explanation } = resolveGoals(input.goals);
  const calories = Math.max(MIN_SAFE_CALORIES, Math.round(tdee + delta));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    proteinG: Math.round((calories * split.protein) / 4),
    carbsG: Math.round((calories * split.carbs) / 4),
    fatG: Math.round((calories * split.fat) / 9),
    fiberG: 28,
    sugarCapG: sugarCapG(calories, input.goals, input.habits),
    sodiumCapMg: sodiumCapMg(input.dietPatterns),
    waterMl: hydrationGoalMl(input.weightKg, 0, input.goals),
    steps: stepsTarget(input.jobActivity, input.goals),
    sleepMin: sleepTargetMin(input.goals),
    explanation,
  };
}

// ─── Adaptive TDEE loop (MacroFactor pattern) — day-1 seed ──────────────────
// The formula target above is only the seed. From week two, expenditure is
// estimated from what actually happened: average logged intake minus the
// energy content of the weight change (7,700 kcal per kg).

/**
 * Estimate daily expenditure from logged intake + the weight trend.
 * Returns null with fewer than 14 days of both signals — an estimate from
 * less data would be noise dressed as insight.
 */
export function estimateExpenditure(
  dailyIntakeKcal: number[],
  weighIns: { date: string; kg: number }[],
): number | null {
  if (dailyIntakeKcal.length < 14 || weighIns.length < 2) return null;
  const span =
    (Date.parse(weighIns[weighIns.length - 1]!.date) - Date.parse(weighIns[0]!.date)) / 86_400_000;
  if (span < 13) return null;

  // Least-squares slope of weight over days → kg/day.
  const t0 = Date.parse(weighIns[0]!.date);
  const pts = weighIns.map((w) => ({ x: (Date.parse(w.date) - t0) / 86_400_000, y: w.kg }));
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const denom = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (denom === 0) return null;
  const slopeKgPerDay = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / denom;

  const avgIntake = dailyIntakeKcal.reduce((s, v) => s + v, 0) / dailyIntakeKcal.length;
  return Math.round(avgIntake - slopeKgPerDay * 7700);
}

/**
 * Weekly target adjustment: move the calorie target toward
 * (estimated expenditure + goal delta), at most 150 kcal per week so one
 * odd week can't whipsaw the plan. Returns the unchanged target with an
 * honest reason when no adjustment is warranted.
 */
export function weeklyAdjustment(input: {
  currentCalories: number;
  expenditure: number | null;
  goals: GoalKey[];
}): { calories: number; reason: string } {
  const { delta } = resolveGoals(input.goals);
  if (input.expenditure === null) {
    return {
      calories: input.currentCalories,
      reason: 'Not enough logged data yet to estimate expenditure — target unchanged.',
    };
  }
  const ideal = Math.max(MIN_SAFE_CALORIES, input.expenditure + delta);
  const diff = ideal - input.currentCalories;
  if (Math.abs(diff) < 50) {
    return {
      calories: input.currentCalories,
      reason: `Expenditure ≈ ${input.expenditure} kcal/day — target already on track.`,
    };
  }
  const step = Math.max(-150, Math.min(150, diff));
  const next = Math.max(MIN_SAFE_CALORIES, input.currentCalories + step);
  const dir = step > 0 ? 'up' : 'down';
  return {
    calories: next,
    reason: `Expenditure estimated at ${input.expenditure} kcal/day from your weight trend vs intake — target moved ${dir} ${Math.abs(step)} kcal.`,
  };
}
