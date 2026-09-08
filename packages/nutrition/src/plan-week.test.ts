import { describe, it, expect } from 'vitest';
import {
  ateOutEstimate, batchCookWeek, planCapsAdherence, recipeFlags, swapAlternatives,
} from './plan-week';
import type { Recipe } from './recipes';

const recipe = (id: string, over: Partial<Recipe> = {}): Recipe => ({
  id, title: id, description: null, serves: 4, totalTimeMin: 30, sourceUrl: null,
  source: 'manual', caloriesPerServe: 500, proteinPerServe: 30, carbsPerServe: 50,
  fatPerServe: 15, fiberPerServe: 8, macrosConfirmed: true, coverPath: null,
  createdAt: '2026-09-01T00:00:00Z', ...over,
});

describe('recipe flags — annotate, never hide', () => {
  it('dislikes, conflicts and slow-for-quick all flag with reasons', () => {
    const flags = recipeFlags(
      recipe('mushroom risotto', { totalTimeMin: 45 }),
      { dislikes: ['mushroom'], cookingTime: 'quick' },
      ['contains dairy — flagged against Dairy free'],
    );
    expect(flags.map((f) => f.kind)).toEqual(['dislike', 'diet-conflict', 'slow-for-you']);
    expect(flags[0]!.text).toContain('dislike list');
  });

  it('no prefs, no flags', () => {
    expect(recipeFlags(recipe('plain'), {})).toEqual([]);
  });
});

describe('swaps at similar macros', () => {
  it('returns the 3 closest by kcal/serve', () => {
    const all = [recipe('a', { caloriesPerServe: 500 }), recipe('b', { caloriesPerServe: 520 }),
      recipe('c', { caloriesPerServe: 480 }), recipe('d', { caloriesPerServe: 900 }), recipe('e', { caloriesPerServe: 505 })];
    const alts = swapAlternatives(all, all[0]!);
    expect(alts.map((r) => r.id)).toEqual(['e', 'b', 'c']);
  });
});

describe('ate out — a range, not a number', () => {
  it('anchors on the planned recipe ±25%', () => {
    const e = ateOutEstimate(recipe('thai', { caloriesPerServe: 640 }), 'dinner');
    expect(e).toMatchObject({ kcal: 640, low: 480, high: 800 });
    expect(e.note).toContain('±25%');
  });

  it('falls back to slot defaults ±35% and says so', () => {
    const e = ateOutEstimate(null, 'lunch');
    expect(e.kcal).toBe(600);
    expect(e.low).toBe(390);
    expect(e.note).toContain('±35%');
  });
});

describe('batch cook', () => {
  it('cycles 2–3 recipes across the week’s lunches and dinners', () => {
    const week = batchCookWeek(['r1', 'r2'], '2026-09-08', 7);
    expect(week).toHaveLength(14);
    expect(week[0]).toEqual({ date: '2026-09-08', mealSlot: 'lunch', recipeId: 'r1' });
    expect(week[1]).toEqual({ date: '2026-09-08', mealSlot: 'dinner', recipeId: 'r2' });
    expect(new Set(week.map((w) => w.recipeId))).toEqual(new Set(['r1', 'r2']));
  });

  it('needs 2–3 recipes; anything else returns nothing', () => {
    expect(batchCookWeek(['r1'], '2026-09-08')).toEqual([]);
    expect(batchCookWeek(['a', 'b', 'c', 'd'], '2026-09-08')).toEqual([]);
  });
});

describe('caps adherence — honest about what recipes carry', () => {
  it('fibre averages from planned meals; sugar/sodium absence stated; unattached meals counted', () => {
    const byId = new Map([['r1', recipe('r1', { fiberPerServe: 10 })]]);
    const lines = planCapsAdherence(
      [
        { recipeId: 'r1', serves: 1, date: '2026-09-08' },
        { recipeId: 'r1', serves: 2, date: '2026-09-09' },
        { recipeId: null, serves: 1, date: '2026-09-09' },
      ],
      byId,
      { fiberG: 32, sugarCapG: 55, sodiumCapMg: 2300 },
    );
    expect(lines[0]).toContain('15 g/day of your 32 g target');
    expect(lines[1]).toContain('can’t claim adherence');
    expect(lines[2]).toContain('no recipe attached');
  });
});
