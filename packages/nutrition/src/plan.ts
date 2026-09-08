import { ACTIVITY_MULTIPLIER, calculateBMR, type ActivityLevel, type BiologicalSex } from './targets';
import { hydrationGoalMl } from './hydration-goal';

// Profile & Targets (V4 Phase 6a — core). The published-ranges plan:
// every number is a RANGE from a stated formula, overridable with the
// computed range kept visible, and the safety rails live HERE, in code,
// with their reasons in words. All of it pinned by test.
//
// Published formulas (rendered verbatim in-app):
//   energy   Mifflin-St Jeor × activity factor, ±10% (formulas carry that
//            much honest error), then your chosen rate applied
//   protein  1.6–2.2 g per kg of body weight
//   fat      20–35% of energy
//   carbs    whatever energy remains
//   fibre    14 g per 1,000 kcal
//   sugar    under 10% of energy
//   sodium   under 2,300 mg
//   water    by body weight (32 ml/kg, activity-adjusted)

export const PLAN_DISCLAIMER = 'Estimates, not medical advice.';

export const RATE_CAPS = {
  lossPctPerWeek: 1.0,
  gainPctPerWeek: 0.5,
} as const;

export const ENERGY_FLOORS = {
  female: 1200,
  male: 1500,
  unspecified: 1500,
} as const;

export const RAIL_REASONS = {
  lossCap: 'Faster than 1% of body weight a week costs muscle and rarely holds — capped. Slow down.',
  gainCap: 'Gaining faster than 0.5% a week is mostly fat — capped.',
  floor: (kcal: number) =>
    `Held at ${kcal.toLocaleString('en-US')} kcal — going lower makes adequate nutrition unlikely without medical supervision.`,
  under18: 'Basalt does not compute energy plans for under-18s — growth changes the arithmetic and a formula should not be the guide. Logging still works fully.',
} as const;

export type PlanRange = { low: number; high: number };

export type PlanGoal = 'cut' | 'maintain' | 'gain';

/**
 * Goal-based POINTS inside the published ranges (V4 Phase 8-0). The
 * ranges never move; the goal only picks where inside them the applied
 * target sits, and the why is one plain sentence.
 */
export const GOAL_POINTS: Record<PlanGoal, { proteinGPerKg: number; fatPctOfEnergy: number }> = {
  cut: { proteinGPerKg: 2.1, fatPctOfEnergy: 0.225 },      // protein 2.0–2.2, fat toward 20–25%
  maintain: { proteinGPerKg: 1.8, fatPctOfEnergy: 0.275 }, // fat 25–30%
  gain: { proteinGPerKg: 1.7, fatPctOfEnergy: 0.275 },     // 1.6–1.8; carbs take the surplus
};

export function goalFrom(ratePctPerWeek: number, goalTypes: readonly string[] = []): PlanGoal {
  if (ratePctPerWeek < 0 || goalTypes.includes('lose')) return 'cut';
  if (ratePctPerWeek > 0 || goalTypes.includes('build')) return 'gain';
  return 'maintain';
}

export type PlanInput = {
  sex: BiologicalSex;
  /** 7-day trend weight where available — never a single reading. */
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  /** Signed % of body weight per week: −0.5 = lose, +0.25 = gain. */
  ratePctPerWeek: number;
  /** Picks the applied POINT inside each range. Default 'maintain'. */
  goal?: PlanGoal;
  /** Data-derived activity factor (Phase 8-0) — overrides the band when set. */
  derivedActivityFactor?: number | null;
};

export type NutritionPlan =
  | { gated: 'under18'; reason: string }
  | {
      gated: null;
      bmr: number;
      tdee: PlanRange;
      rate: { requestedPct: number; appliedPct: number; capped: boolean; capReason: string | null; kcalPerDay: number };
      energy: PlanRange;
      floor: { kcal: number; applied: boolean; reason: string };
      proteinG: PlanRange;
      fatG: PlanRange;
      carbsG: PlanRange;
      /** The goal-picked applied targets, inside the ranges, with the why. */
      points: { energyKcal: number; proteinG: number; fatG: number; carbsG: number; why: string };
      /** Which activity factor fed the TDEE, stated. */
      activitySource: 'self-reported' | 'derived-from-data';
      fiberG: number;
      sugarCapG: number;
      sodiumCapMg: number;
      waterMl: number;
    };

function floorFor(sex: BiologicalSex): number {
  if (sex === 'female') return ENERGY_FLOORS.female;
  if (sex === 'male') return ENERGY_FLOORS.male;
  return ENERGY_FLOORS.unspecified;
}

/** Clamp the requested rate to the caps; say why when it bites. */
export function applyRateCap(requestedPct: number): { appliedPct: number; capped: boolean; capReason: string | null } {
  if (requestedPct < -RATE_CAPS.lossPctPerWeek) {
    return { appliedPct: -RATE_CAPS.lossPctPerWeek, capped: true, capReason: RAIL_REASONS.lossCap };
  }
  if (requestedPct > RATE_CAPS.gainPctPerWeek) {
    return { appliedPct: RATE_CAPS.gainPctPerWeek, capped: true, capReason: RAIL_REASONS.gainCap };
  }
  return { appliedPct: requestedPct, capped: false, capReason: null };
}

/**
 * 7-day trend weight: least-squares fit over the last 7 days of weigh-ins,
 * evaluated at the newest day. Needs 3+ weigh-ins — with fewer, return
 * null and let the caller fall back to the stated weight, labelled.
 */
export function trendWeightKg(
  weighIns: readonly { date: string; kg: number }[],
): { kg: number; readings: number } | null {
  if (weighIns.length === 0) return null;
  const newest = Date.parse(weighIns[weighIns.length - 1]!.date);
  const window = weighIns.filter((w) => newest - Date.parse(w.date) <= 6 * 86_400_000);
  if (window.length < 3) return null;
  const t0 = Date.parse(window[0]!.date);
  const pts = window.map((w) => ({ x: (Date.parse(w.date) - t0) / 86_400_000, y: w.kg }));
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const denom = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const slope = denom === 0 ? 0 : pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / denom;
  const xNewest = (newest - t0) / 86_400_000;
  return { kg: Math.round((my + slope * (xNewest - mx)) * 10) / 10, readings: n };
}

export function computePlan(input: PlanInput): NutritionPlan {
  if (input.age < 18) {
    return { gated: 'under18', reason: RAIL_REASONS.under18 };
  }
  const bmr = calculateBMR(input.sex, input.weightKg, input.heightCm, input.age);
  const derived = input.derivedActivityFactor ?? null;
  const activityFactor = derived ?? ACTIVITY_MULTIPLIER[input.activityLevel];
  const tdeeMid = bmr * activityFactor;
  const tdee: PlanRange = { low: Math.round(tdeeMid * 0.9), high: Math.round(tdeeMid * 1.1) };

  const { appliedPct, capped, capReason } = applyRateCap(input.ratePctPerWeek);
  const kcalPerDay = Math.round((input.weightKg * (appliedPct / 100) * 7700) / 7);

  const floorKcal = floorFor(input.sex);
  const rawLow = Math.round(tdeeMid * 0.9 + kcalPerDay);
  const rawHigh = Math.round(tdeeMid * 1.1 + kcalPerDay);
  const energy: PlanRange = { low: Math.max(floorKcal, rawLow), high: Math.max(floorKcal, rawHigh) };
  const floorApplied = rawLow < floorKcal;

  const energyMid = Math.round((energy.low + energy.high) / 2);
  const proteinG: PlanRange = { low: Math.round(1.6 * input.weightKg), high: Math.round(2.2 * input.weightKg) };
  const proteinMid = Math.round((proteinG.low + proteinG.high) / 2);
  const fatG: PlanRange = { low: Math.round((0.2 * energyMid) / 9), high: Math.round((0.35 * energyMid) / 9) };
  const carbsG: PlanRange = {
    low: Math.round((energyMid - proteinMid * 4 - fatG.high * 9) / 4),
    high: Math.round((energyMid - proteinMid * 4 - fatG.low * 9) / 4),
  };

  const goal = input.goal ?? 'maintain';
  const gp = GOAL_POINTS[goal];
  const proteinPoint = Math.min(proteinG.high, Math.max(proteinG.low, Math.round(gp.proteinGPerKg * input.weightKg)));
  const fatPoint = Math.min(fatG.high, Math.max(fatG.low, Math.round((gp.fatPctOfEnergy * energyMid) / 9)));
  const carbsPoint = Math.max(0, Math.round((energyMid - proteinPoint * 4 - fatPoint * 9) / 4));
  const points = {
    energyKcal: energyMid,
    proteinG: proteinPoint,
    fatG: fatPoint,
    carbsG: carbsPoint,
    why: `because your goal is ${goal}${goal === 'gain' ? ' — carbs take the surplus' : ''}`,
  };

  return {
    gated: null,
    bmr: Math.round(bmr),
    tdee,
    rate: { requestedPct: input.ratePctPerWeek, appliedPct, capped, capReason, kcalPerDay },
    energy,
    floor: { kcal: floorKcal, applied: floorApplied, reason: RAIL_REASONS.floor(floorKcal) },
    proteinG,
    fatG,
    carbsG,
    points,
    activitySource: derived !== null ? 'derived-from-data' : 'self-reported',
    fiberG: Math.round((14 * energyMid) / 1000),
    sugarCapG: Math.round((0.1 * energyMid) / 4),
    sodiumCapMg: 2300,
    waterMl: hydrationGoalMl(input.weightKg),
  };
}
