import { describe, it, expect } from 'vitest';
import { reconcilePlan, OUTCOME_TEXT, type DayEntry } from './reconcile';

const TODAY = '2026-08-21';

const dinnerPlan = { date: '2026-08-20', mealSlot: 'dinner' as const, recipeTitle: 'Walkthrough chilli' };

const recipeEntry = (mealType: DayEntry['mealType']): DayEntry => ({
  mealType,
  foodName: 'Walkthrough chilli',
  source: 'recipe',
});

describe('reconcilePlan', () => {
  it('recipe logged in its slot → as_planned', () => {
    expect(reconcilePlan(dinnerPlan, [recipeEntry('dinner')], TODAY)).toBe('as_planned');
  });

  it('recipe logged in another slot → moved, stated as a fact', () => {
    expect(reconcilePlan(dinnerPlan, [recipeEntry('lunch')], TODAY)).toBe('moved');
    expect(OUTCOME_TEXT.moved).toBe('eaten · different slot');
  });

  it('other food in the slot → different (a swap, not a fault)', () => {
    const entries: DayEntry[] = [{ mealType: 'dinner', foodName: 'Takeaway pad thai', source: 'manual' }];
    expect(reconcilePlan(dinnerPlan, entries, TODAY)).toBe('different');
  });

  it('a same-named manual entry does not count as the planned recipe', () => {
    const entries: DayEntry[] = [{ mealType: 'dinner', foodName: 'Walkthrough chilli', source: 'manual' }];
    expect(reconcilePlan(dinnerPlan, entries, TODAY)).toBe('different');
  });

  it('past day, empty slot → not_logged', () => {
    expect(reconcilePlan(dinnerPlan, [], TODAY)).toBe('not_logged');
  });

  it("today's empty slot stays pending — the day is not over", () => {
    const plan = { ...dinnerPlan, date: TODAY };
    expect(reconcilePlan(plan, [], TODAY)).toBe('pending');
  });

  it("today's already-logged slot reconciles immediately", () => {
    const plan = { ...dinnerPlan, date: TODAY };
    expect(reconcilePlan(plan, [recipeEntry('dinner')], TODAY)).toBe('as_planned');
  });

  it('future plans are pending regardless of entries', () => {
    const plan = { ...dinnerPlan, date: '2026-08-25' };
    expect(reconcilePlan(plan, [recipeEntry('dinner')], TODAY)).toBe('pending');
  });

  it('a plan with no recipe title can never be as_planned, only different/not_logged', () => {
    const plan = { ...dinnerPlan, recipeTitle: null };
    expect(reconcilePlan(plan, [recipeEntry('dinner')], TODAY)).toBe('different');
    expect(reconcilePlan(plan, [], TODAY)).toBe('not_logged');
  });

  it('no outcome text scolds', () => {
    for (const text of Object.values(OUTCOME_TEXT)) {
      expect(text).toBe(text.toLowerCase());
      expect(text).not.toMatch(/!|missed|fail|should|oops/);
    }
  });
});
