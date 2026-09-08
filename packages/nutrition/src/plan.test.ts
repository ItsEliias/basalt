import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ENERGY_FLOORS, PLAN_DISCLAIMER, RATE_CAPS, applyRateCap, computePlan, trendWeightKg,
} from './plan';

describe('nutrition plan — the worked example, pinned', () => {
  // The V4 report's example: 30 y, 82 kg, 178 cm, moderately active,
  // −0.5%/week (sex assumed male for the arithmetic below).
  const plan = computePlan({
    sex: 'male', weightKg: 82, heightCm: 178, age: 30,
    activityLevel: 'moderate', ratePctPerWeek: -0.5,
  });

  it('every number matches the published formulas', () => {
    if (plan.gated) throw new Error('should not be gated');
    expect(plan.bmr).toBe(1788);                       // 10·82 + 6.25·178 − 5·30 + 5
    expect(plan.tdee).toEqual({ low: 2494, high: 3048 }); // ×1.55, ±10%
    expect(plan.rate.kcalPerDay).toBe(-451);           // 82 × 0.5% × 7700 / 7
    expect(plan.rate.capped).toBe(false);
    expect(plan.energy).toEqual({ low: 2043, high: 2597 });
    expect(plan.proteinG).toEqual({ low: 131, high: 180 }); // 1.6–2.2 g/kg
    expect(plan.fatG).toEqual({ low: 52, high: 90 });       // 20–35% of 2,320
    expect(plan.carbsG).toEqual({ low: 222, high: 307 });   // the remainder
    expect(plan.fiberG).toBe(32);                       // 14 g / 1,000 kcal
    expect(plan.sugarCapG).toBe(58);                    // <10% of energy
    expect(plan.sodiumCapMg).toBe(2300);
    expect(plan.waterMl).toBe(2600);                    // 32 ml/kg, 50s
  });

  it('the disclaimer is the exact required line', () => {
    expect(PLAN_DISCLAIMER).toBe('Estimates, not medical advice.');
  });
});

describe('safety rails — in code, with reasons in words', () => {
  it('loss faster than 1%/week is capped and told to slow down', () => {
    const r = applyRateCap(-2);
    expect(r.appliedPct).toBe(-1);
    expect(r.capped).toBe(true);
    expect(r.capReason).toContain('Slow down');
  });

  it('gain faster than 0.5%/week is capped', () => {
    const r = applyRateCap(1);
    expect(r.appliedPct).toBe(0.5);
    expect(r.capped).toBe(true);
    expect(r.capReason).toContain('mostly fat');
  });

  it('rates inside the caps pass through untouched', () => {
    expect(applyRateCap(-0.5)).toEqual({ appliedPct: -0.5, capped: false, capReason: null });
    expect(RATE_CAPS).toEqual({ lossPctPerWeek: 1, gainPctPerWeek: 0.5 });
  });

  it('energy floors bind by stated sex with the reason in words', () => {
    expect(ENERGY_FLOORS).toEqual({ female: 1200, male: 1500, unspecified: 1500 });
    const small = computePlan({
      sex: 'female', weightKg: 45, heightCm: 150, age: 60,
      activityLevel: 'sedentary', ratePctPerWeek: -1,
    });
    if (small.gated) throw new Error('should not be gated');
    expect(small.energy.low).toBeGreaterThanOrEqual(1200);
    expect(small.floor.applied).toBe(true);
    expect(small.floor.reason).toContain('adequate nutrition unlikely');
  });

  it('under-18 hides the plan entirely, in words, and logging is stated to keep working', () => {
    const gated = computePlan({
      sex: 'male', weightKg: 70, heightCm: 175, age: 17,
      activityLevel: 'moderate', ratePctPerWeek: 0,
    });
    expect(gated.gated).toBe('under18');
    if (gated.gated) expect(gated.reason).toContain('Logging still works fully');
  });
});

describe('trend weight — never a single reading', () => {
  it('fits the last 7 days and needs 3+ weigh-ins', () => {
    const t = trendWeightKg([
      { date: '2026-09-01', kg: 83.0 },
      { date: '2026-09-03', kg: 82.6 },
      { date: '2026-09-05', kg: 82.4 },
      { date: '2026-09-07', kg: 82.0 },
    ]);
    expect(t?.readings).toBe(4);
    expect(t?.kg).toBeCloseTo(82.0, 0);
    expect(trendWeightKg([{ date: '2026-09-07', kg: 82.0 }])).toBeNull();
    expect(trendWeightKg([])).toBeNull();
  });

  it('older weigh-ins fall outside the 7-day window', () => {
    const t = trendWeightKg([
      { date: '2026-08-01', kg: 90 },
      { date: '2026-09-05', kg: 82.2 },
      { date: '2026-09-06', kg: 82.1 },
      { date: '2026-09-07', kg: 82.0 },
    ]);
    expect(t?.readings).toBe(3);
    expect(t!.kg).toBeLessThan(83);
  });
});

describe('NO BMI category labels, ever — source scan', () => {
  it('no app or package source labels a body with a BMI category', () => {
    const ROOT = resolve(__dirname, '..', '..', '..');
    const dirs = [join(ROOT, 'app', 'src'), join(ROOT, 'packages')];
    const offenders: string[] = [];
    const FORBIDDEN = /(bmi[^a-z0-9]{0,12}(category|underweight|overweight|obese|normal))|((underweight|overweight|obese)[^a-z0-9]{0,12}bmi)|category.{0,10}:.{0,10}'(underweight|overweight|obese)'/i;
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) {
          if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
          walk(p);
        } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')) {
          const src = readFileSync(p, 'utf8');
          if (FORBIDDEN.test(src)) offenders.push(p);
        }
      }
    };
    for (const d of dirs) walk(d);
    expect(offenders, `BMI category labels found in: ${offenders.join(', ')}`).toEqual([]);
  });
});
