import { describe, it, expect } from 'vitest';
import {
  calculateBMR, computeTargets, resolveGoals, sugarCapG, sodiumCapMg,
  stepsTarget, sleepTargetMin, estimateExpenditure, weeklyAdjustment,
  ACTIVITY_MULTIPLIER, MIN_SAFE_CALORIES,
} from './targets';

// The ported core (quarry targetsService) — same numbers, same floors.

describe('calculateBMR (Mifflin-St Jeor, ported)', () => {
  it('male formula', () => {
    // 10×80 + 6.25×180 − 5×30 + 5 = 800 + 1125 − 150 + 5 = 1780
    expect(calculateBMR('male', 80, 180, 30)).toBe(1780);
  });
  it('female formula', () => {
    // 10×65 + 6.25×165 − 5×28 − 161 = 650 + 1031.25 − 140 − 161 = 1380.25
    expect(calculateBMR('female', 65, 165, 28)).toBeCloseTo(1380.25);
  });
  it('intersex / undisclosed averages the two formulas', () => {
    const m = calculateBMR('male', 70, 170, 25);
    const f = calculateBMR('female', 70, 170, 25);
    expect(calculateBMR('intersex', 70, 170, 25)).toBeCloseTo((m + f) / 2);
    expect(calculateBMR('prefer_not_to_say', 70, 170, 25)).toBeCloseTo((m + f) / 2);
  });
});

describe('resolveGoals — multi-goal balancing', () => {
  it('lose + build leans recomp and says so plainly', () => {
    const r = resolveGoals(['lose', 'build']);
    expect(r.delta).toBe(-150);
    expect(r.split.protein).toBe(0.35);
    expect(r.explanation).toContain('opposite directions');
    expect(r.explanation).toContain('recomposition');
  });
  it('single goals keep the ported deltas and splits', () => {
    expect(resolveGoals(['lose'])).toMatchObject({ delta: -500, split: { protein: 0.4, carbs: 0.3, fat: 0.3 } });
    expect(resolveGoals(['build'])).toMatchObject({ delta: 400, split: { protein: 0.3, carbs: 0.45, fat: 0.25 } });
    expect(resolveGoals(['health'])).toMatchObject({ delta: 0, split: { protein: 0.3, carbs: 0.4, fat: 0.3 } });
    expect(resolveGoals(['refine'])).toMatchObject({ delta: 0, split: { protein: 0.35, carbs: 0.35, fat: 0.3 } });
  });
  it('empty selection falls back to maintenance', () => {
    expect(resolveGoals([]).delta).toBe(0);
  });
});

describe('computeTargets', () => {
  const input = {
    biologicalSex: 'male' as const, age: 30, heightCm: 180, weightKg: 80,
    activityLevel: 'moderate' as const, goals: ['lose' as const],
  };

  it('BMR → TDEE → delta → macros, with the ported constants', () => {
    const t = computeTargets(input);
    expect(t.bmr).toBe(1780);
    expect(t.tdee).toBe(Math.round(1780 * ACTIVITY_MULTIPLIER.moderate)); // 2759
    expect(t.calories).toBe(t.tdee - 500);
    expect(t.proteinG).toBe(Math.round((t.calories * 0.4) / 4));
    expect(t.fatG).toBe(Math.round((t.calories * 0.3) / 9));
    expect(t.fiberG).toBe(28);
  });

  it('enforces the 1200 kcal floor', () => {
    const t = computeTargets({
      biologicalSex: 'female', age: 60, heightCm: 150, weightKg: 45,
      activityLevel: 'sedentary', goals: ['lose'],
    });
    expect(t.calories).toBe(MIN_SAFE_CALORIES);
  });

  it('emits the full onboarding output: caps, water, steps, sleep, why', () => {
    const t = computeTargets({ ...input, jobActivity: 'desk' });
    expect(t.sugarCapG).toBeGreaterThan(0);
    expect(t.sodiumCapMg).toBe(2300);
    expect(t.waterMl).toBeGreaterThanOrEqual(1600);
    expect(t.waterMl % 50).toBe(0);
    expect(t.steps).toBe(7000);
    expect(t.sleepMin).toBe(450);
    expect(t.explanation.length).toBeGreaterThan(10);
  });
});

describe('caps', () => {
  it('sugar: 6% of energy baseline, 5% for a stated health goal', () => {
    expect(sugarCapG(2000, [])).toBe(Math.round((2000 * 0.06) / 4)); // 30
    expect(sugarCapG(2000, ['health'])).toBe(25);
  });
  it('sugar: daily sugary drinks push the cap to realistic, not punitive', () => {
    expect(sugarCapG(2000, [], { sugaryDrinks: 'daily' })).toBe(40); // 8%
    expect(sugarCapG(2000, ['health'], { alcohol: 'daily' })).toBe(35); // 5% + 2
  });
  it('sodium: 2300 mg standard, 1500 mg on a low-sodium pattern', () => {
    expect(sodiumCapMg([])).toBe(2300);
    expect(sodiumCapMg(['Low sodium'])).toBe(1500);
    expect(sodiumCapMg(['low-sodium'])).toBe(1500);
  });
});

describe('steps & sleep targets', () => {
  it('job activity sets the base, fitness goal adds 1500, rounded to 500', () => {
    expect(stepsTarget('desk')).toBe(7000);
    expect(stepsTarget('mixed')).toBe(7500);
    expect(stepsTarget('feet')).toBe(8000);
    expect(stepsTarget('desk', ['fitness'])).toBe(8500);
  });
  it('sleep goal raises the target to 8 h', () => {
    expect(sleepTargetMin([])).toBe(450);
    expect(sleepTargetMin(['sleep'])).toBe(480);
  });
});

describe('adaptive TDEE loop — day-1 seed', () => {
  const days = (n: number) =>
    Array.from({ length: n }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`);

  it('refuses to estimate from under 14 days — no noise dressed as insight', () => {
    expect(estimateExpenditure([2000, 2100], [{ date: '2026-07-01', kg: 80 }, { date: '2026-07-02', kg: 80 }])).toBeNull();
  });

  it('estimates expenditure from intake minus the weight-trend energy', () => {
    // 14 days at 2000 kcal; weight falls exactly 0.1 kg/day → slope −0.1.
    const intake = Array.from({ length: 14 }, () => 2000);
    const weights = days(14).map((date, i) => ({ date, kg: 80 - 0.1 * i }));
    // expenditure = 2000 − (−0.1 × 7700) = 2770
    expect(estimateExpenditure(intake, weights)).toBe(2770);
  });

  it('stable weight → expenditure equals intake', () => {
    const intake = Array.from({ length: 14 }, () => 2400);
    const weights = days(14).map((date) => ({ date, kg: 80 }));
    expect(estimateExpenditure(intake, weights)).toBe(2400);
  });

  it('weekly adjustment moves ≤150 kcal with an honest reason', () => {
    const r = weeklyAdjustment({ currentCalories: 2200, expenditure: 2770, goals: ['lose'] });
    // ideal = 2770 − 500 = 2270 → +70 within the step limit.
    expect(r.calories).toBe(2270);
    expect(r.reason).toContain('2770');

    const big = weeklyAdjustment({ currentCalories: 1800, expenditure: 2900, goals: [] });
    expect(big.calories).toBe(1950); // clamped to +150
  });

  it('holds steady without data and near the ideal', () => {
    expect(weeklyAdjustment({ currentCalories: 2200, expenditure: null, goals: ['lose'] })).toMatchObject({
      calories: 2200,
    });
    const near = weeklyAdjustment({ currentCalories: 2270, expenditure: 2770, goals: ['lose'] });
    expect(near.calories).toBe(2270);
    expect(near.reason).toContain('on track');
  });
});
