import { describe, it, expect } from 'vitest';
import { mealBudgets, trainingDayTarget, MEAL_SPLIT } from './meal-budgets';

describe('mealBudgets', () => {
  it('morning, nothing eaten: the published split over the full day', () => {
    const { rows } = mealBudgets(2000, {}, 7);
    expect(rows.map((r) => [r.meal, r.suggestedKcal])).toEqual([
      ['breakfast', 500], ['lunch', 600], ['dinner', 600], ['snacks', 300],
    ]);
    expect(rows.every((r) => r.state === 'upcoming')).toBe(true);
  });

  it('eaten meals show actuals; remaining redistributes over upcoming only', () => {
    const { rows } = mealBudgets(2000, { breakfast: 700 }, 11);
    const bk = rows.find((r) => r.meal === 'breakfast')!;
    expect(bk).toMatchObject({ state: 'eaten', eatenKcal: 700, suggestedKcal: null });
    // remaining 1300 over lunch/dinner/snacks split .3/.3/.15
    expect(rows.find((r) => r.meal === 'lunch')!.suggestedKcal).toBe(520);
    expect(rows.find((r) => r.meal === 'snacks')!.suggestedKcal).toBe(260);
  });

  it("a skipped window's share flows forward and the note says so", () => {
    const { rows, note } = mealBudgets(2000, {}, 12); // breakfast window passed uneaten
    expect(rows.find((r) => r.meal === 'breakfast')!.state).toBe('passed');
    expect(rows.find((r) => r.meal === 'breakfast')!.suggestedKcal).toBeNull();
    expect(note).toContain("skipped window's share flows");
    // full 2000 over lunch/dinner/snacks
    expect(rows.find((r) => r.meal === 'lunch')!.suggestedKcal).toBe(800);
  });

  it('over-target days floor at zero — no negative budgets, no scolding text', () => {
    const { rows, note } = mealBudgets(1800, { breakfast: 1000, lunch: 1000 }, 16);
    expect(rows.find((r) => r.meal === 'dinner')!.suggestedKcal).toBe(0);
    expect(note).not.toMatch(/over|blew|too much/i);
  });

  it('the split is published and sums to 1', () => {
    expect(Object.values(MEAL_SPLIT).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe('trainingDayTarget', () => {
  it('no activity → base target, no note (real-or-hidden)', () => {
    expect(trainingDayTarget(2200, 0)).toEqual({ kcal: 2200, note: null });
  });

  it('activity adds an eat-back suggestion that says what it is', () => {
    const r = trainingDayTarget(2200, 342.6);
    expect(r.kcal).toBe(2543);
    expect(r.note).toContain('+343 kcal');
    expect(r.note).toContain('suggestion, never a mandate');
  });
});
