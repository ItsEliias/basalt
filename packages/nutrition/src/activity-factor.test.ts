import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_FACTOR_EXPLAINER, ACTIVITY_METS, derivedActivityFactor,
} from './activity-factor';
import { GOAL_POINTS, computePlan, goalFrom } from './plan';

const BASE = {
  stepDays: 18, avgDailySteps: 8000, strengthMinutes: 3 * 60 * 3, // 3h/wk × 3wk
  walkMinutes: 90 * 3, weightKg: 82, bmr: 1788,
};

describe('derived activity factor — published MET model, earned by data', () => {
  it('needs 14 step-days; fewer → null (self-reported band stays in use)', () => {
    expect(derivedActivityFactor({ ...BASE, stepDays: 13 })).toBeNull();
    expect(derivedActivityFactor({ ...BASE, stepDays: 14 })).not.toBeNull();
  });

  it('computes a factor with a stated ±20% range', () => {
    const d = derivedActivityFactor(BASE)!;
    expect(d.factor).toBeGreaterThan(1.2);
    expect(d.low).toBeLessThan(d.factor);
    expect(d.high).toBeGreaterThan(d.factor);
    expect(d.activityKcalPerDay).toBeGreaterThan(0);
    // more movement → higher factor, monotonic
    const more = derivedActivityFactor({ ...BASE, avgDailySteps: 14000 })!;
    expect(more.factor).toBeGreaterThan(d.factor);
  });

  it('walk steps are not double-counted with the step term', () => {
    const noWalks = derivedActivityFactor({ ...BASE, walkMinutes: 0 })!;
    const withWalks = derivedActivityFactor(BASE)!;
    // walks add MET kcal but subtract their steps — net still positive
    // (small enough that the 2-dp factor may tie; the kcal term must not)
    expect(withWalks.activityKcalPerDay).toBeGreaterThan(noWalks.activityKcalPerDay);
    expect(withWalks.factor).toBeGreaterThanOrEqual(noWalks.factor);
  });

  it('the explainer names every constant', () => {
    expect(ACTIVITY_FACTOR_EXPLAINER).toContain('3.5 MET');
    expect(ACTIVITY_FACTOR_EXPLAINER).toContain('3.3 MET');
    expect(ACTIVITY_FACTOR_EXPLAINER).toContain('±20%');
    expect(ACTIVITY_METS.strengthSession).toBe(3.5);
  });
});

describe('goal-based points inside the ranges (8-0)', () => {
  const input = {
    sex: 'male' as const, weightKg: 82, heightCm: 178, age: 30,
    activityLevel: 'moderate' as const, ratePctPerWeek: -0.5,
  };

  it('cut picks protein 2.0–2.2 g/kg and fat toward 20–25%, why in words', () => {
    const p = computePlan({ ...input, goal: 'cut' });
    if (p.gated) throw new Error('gated');
    expect(p.points.proteinG).toBe(Math.round(2.1 * 82)); // 172, inside 131–180
    expect(p.points.fatG).toBe(Math.round((0.225 * 2320) / 9)); // 58, inside 52–90
    expect(p.points.why).toBe('because your goal is cut');
    expect(p.points.proteinG).toBeGreaterThanOrEqual(p.proteinG.low);
    expect(p.points.proteinG).toBeLessThanOrEqual(p.proteinG.high);
  });

  it('gain gives carbs the surplus and says so', () => {
    const p = computePlan({ ...input, ratePctPerWeek: 0.25, goal: 'gain' });
    if (p.gated) throw new Error('gated');
    expect(p.points.why).toContain('carbs take the surplus');
    const kcalFromPoints = p.points.proteinG * 4 + p.points.fatG * 9 + p.points.carbsG * 4;
    expect(Math.abs(kcalFromPoints - p.points.energyKcal)).toBeLessThanOrEqual(6);
  });

  it('goalFrom maps rate sign and goalTypes', () => {
    expect(goalFrom(-0.5)).toBe('cut');
    expect(goalFrom(0.5)).toBe('gain');
    expect(goalFrom(0)).toBe('maintain');
    expect(goalFrom(0, ['lose'])).toBe('cut');
    expect(GOAL_POINTS.maintain.proteinGPerKg).toBe(1.8);
  });

  it('a derived factor replaces the band and is stated as the source', () => {
    const self = computePlan(input);
    const derived = computePlan({ ...input, derivedActivityFactor: 1.4 });
    if (self.gated || derived.gated) throw new Error('gated');
    expect(self.activitySource).toBe('self-reported');
    expect(derived.activitySource).toBe('derived-from-data');
    expect(derived.tdee.high).toBeLessThan(self.tdee.high); // 1.4 < moderate 1.55
  });
});
