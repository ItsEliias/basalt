import { describe, it, expect } from 'vitest';
import {
  trainingMax, shouldUpdateTm, prescribeFromTm, TM_RULES, PHASE_PERCENTS,
} from './training-max';

describe('trainingMax', () => {
  it('TM = 90% of best e1RM, rounded to 2.5 kg — the named convention', () => {
    expect(TM_RULES.tmFraction).toBe(0.9);
    expect(trainingMax(94.5)).toBe(85); // 85.05 → 85
    expect(trainingMax(100)).toBe(90);
  });

  it('null in, null out — never invented', () => {
    expect(trainingMax(null)).toBeNull();
    expect(trainingMax(0)).toBeNull();
  });
});

describe('shouldUpdateTm — the published one-plate-step rule', () => {
  it('moves only by ≥2.5 kg; noise never chases the TM', () => {
    expect(shouldUpdateTm(85, 87.5)).toBe(true);
    expect(shouldUpdateTm(85, 86)).toBe(false);
    expect(shouldUpdateTm(85, 82.5)).toBe(true); // down moves too — honesty cuts both ways
    expect(shouldUpdateTm(null, 85)).toBe(true);
    expect(shouldUpdateTm(85, null)).toBe(false);
  });
});

describe('prescribeFromTm', () => {
  it('phase percentages are published and week-indexed', () => {
    expect(PHASE_PERCENTS.accumulation).toEqual([0.7, 0.725, 0.75]);
    expect(PHASE_PERCENTS.intensification).toEqual([0.825, 0.85]);
    expect(PHASE_PERCENTS.deload).toEqual([0.6]);
  });

  it('the math line is the promise, verbatim', () => {
    const p = prescribeFromTm(85, 'intensification', 1);
    expect(p.weightKg).toBe(72.5); // 85 × 0.85 = 72.25 → 72.5
    expect(p.mathLine).toBe('72.5 kg = 85% of TM 85 kg');
  });

  it('week index clamps to the phase length — no out-of-range invention', () => {
    expect(prescribeFromTm(100, 'deload', 5).percent).toBe(0.6);
  });
});
