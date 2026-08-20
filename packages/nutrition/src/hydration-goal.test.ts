import { describe, it, expect } from 'vitest';
import { hydrationGoalMl } from './hydration-goal';

// The real bodyweight formula (quarry phase9WellnessService), finally wired.

describe('hydrationGoalMl', () => {
  it('weight × 32, rounded to 50', () => {
    expect(hydrationGoalMl(81.4)).toBe(2600); // 2604.8 → 2600
    expect(hydrationGoalMl(70)).toBe(2250);   // 2240 → 2250
  });

  it('falls back to 2200 without a weight', () => {
    expect(hydrationGoalMl(null)).toBe(2200);
    expect(hydrationGoalMl(0)).toBe(2200);
  });

  it('adds the step-based activity bonus at the documented brackets', () => {
    expect(hydrationGoalMl(70, 3001)).toBe(2350); // +100
    expect(hydrationGoalMl(70, 6001)).toBe(2500); // +250
    expect(hydrationGoalMl(70, 9001)).toBe(2650); // +400
  });

  it('applies the goal modifier', () => {
    expect(hydrationGoalMl(70, 0, ['build'])).toBe(2450); // +200
    expect(hydrationGoalMl(70, 0, ['lose'])).toBe(2350);  // +100
  });

  it('clamps to 1600–3600', () => {
    expect(hydrationGoalMl(40)).toBe(1600);  // 1280 → floor
    expect(hydrationGoalMl(130, 10000, ['build'])).toBe(3600); // ceiling
  });
});
