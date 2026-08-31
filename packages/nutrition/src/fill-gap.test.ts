import { describe, it, expect } from 'vitest';
import {
  macroGap, scarcestMacro, suggestFill, gapLine,
  GAP_MIN_KCAL, MAX_SUGGESTIONS, OFF_FALLBACK_QUERY,
  type FillCandidate,
} from './fill-gap';

const T = { calories: 2200, protein: 150, carbs: 220, fat: 70 };

const own = (name: string, kcal: number, p: number, c: number, f: number): FillCandidate =>
  ({ foodName: name, brand: null, calories: kcal, protein: p, carbs: c, fat: f, source: 'own' });
const off = (name: string, kcal: number, p: number, c: number, f: number): FillCandidate =>
  ({ ...own(name, kcal, p, c, f), source: 'off' });

describe('macroGap', () => {
  it('is target minus eaten, floored at zero — over is over, never negative fuel', () => {
    const gap = macroGap(T, { calories: 1600, protein: 160, carbs: 150, fat: 40 });
    expect(gap).toEqual({ calories: 600, protein: 0, carbs: 70, fat: 30 });
  });
});

describe('scarcestMacro', () => {
  it('picks the open macro with the most remaining energy (kcal-weighted)', () => {
    // fat 30 g = 270 kcal beats carbs 60 g = 240 kcal
    expect(scarcestMacro({ calories: 600, protein: 0, carbs: 60, fat: 30 })).toBe('fat');
  });
  it('null when every macro gap is closed', () => {
    expect(scarcestMacro({ calories: 200, protein: 0, carbs: 0, fat: 0 })).toBeNull();
  });
  it('fallback queries are published for every macro', () => {
    expect(Object.keys(OFF_FALLBACK_QUERY).sort()).toEqual(['carbs', 'fat', 'protein']);
  });
});

describe('suggestFill', () => {
  const gap = { calories: 600, protein: 40, carbs: 55, fat: 12 };

  it(`renders nothing under the published ${GAP_MIN_KCAL} kcal floor — a full day needs no filling`, () => {
    expect(suggestFill({ calories: GAP_MIN_KCAL - 1, protein: 30, carbs: 0, fat: 0 },
      [own('Skyr', 90, 16, 5, 0)])).toEqual([]);
  });

  it('own foods always outrank OFF, regardless of score', () => {
    const s = suggestFill(gap,
      [own('Skyr', 90, 16, 5, 0)],
      [off('Whey isolate', 120, 27, 2, 1)]);
    expect(s[0]!.foodName).toBe('Skyr');
    expect(s[0]!.source).toBe('own');
    expect(s[1]!.source).toBe('off');
  });

  it('OFF only fills the slots own foods left empty', () => {
    const owns = [own('A', 100, 15, 5, 1), own('B', 100, 14, 5, 1), own('C', 100, 13, 5, 1)];
    const s = suggestFill(gap, owns, [off('D', 100, 30, 0, 0)]);
    expect(s).toHaveLength(MAX_SUGGESTIONS);
    expect(s.every((x) => x.source === 'own')).toBe(true);
  });

  it('a food that blows the remaining energy is excluded, not ranked low', () => {
    // covers 40g protein = 160 kcal, but overshoots by 400 → score < 0
    const s = suggestFill(gap, [own('Giant burger', 1000, 45, 60, 50)]);
    expect(s).toEqual([]);
  });

  it('the why line states the dominant gap it closes — arithmetic, not advice', () => {
    const s = suggestFill(gap, [own('Skyr', 90, 16, 5, 0)]);
    expect(s[0]!.why).toBe('16 g of your 40 g protein gap');
  });

  it('duplicate names collapse to the first (own) occurrence', () => {
    const s = suggestFill(gap, [own('Skyr', 90, 16, 5, 0)], [off('skyr', 95, 17, 5, 0)]);
    expect(s).toHaveLength(1);
    expect(s[0]!.source).toBe('own');
  });

  it('macros already closed contribute nothing to the score', () => {
    const noProteinGap = { calories: 600, protein: 0, carbs: 55, fat: 12 };
    const s = suggestFill(noProteinGap, [
      own('Whey', 120, 27, 2, 1),   // protein closes 0 now
      own('Rice', 200, 4, 44, 0),   // carbs 44*4 = 176
    ]);
    expect(s[0]!.foodName).toBe('Rice');
  });
});

describe('gapLine', () => {
  it('states the gap plainly', () => {
    expect(gapLine({ calories: 620, protein: 40, carbs: 55, fat: 12 }))
      .toBe('620 kcal · P 40 · C 55 · F 12 left');
  });
});
