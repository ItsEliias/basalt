import { describe, it, expect } from 'vitest';
import {
  addToPlate, removeFromPlate, setFactor, stepFactor, clampFactor,
  plateTotals, plateEntries, factorFromDrag, itemRadius, factorText,
  PLATE_MAX_ITEMS, FACTOR_MIN, FACTOR_MAX, type PlateFood,
} from './model';

const OATS: PlateFood = {
  key: 'oats', foodName: 'Oats & banana', brand: null,
  calories: 420, protein: 12, carbs: 68, fat: 9, fiber: 7, sugar: 14,
};
const CHICKEN: PlateFood = {
  key: 'chk', foodName: 'Chicken & rice bowl', brand: 'Deli',
  calories: 610, protein: 45, carbs: 70, fat: 14, fiber: 4, sodiumMg: 900,
};

describe('plate state', () => {
  it('adds at ×1, refuses duplicates and a seventh item', () => {
    let items = addToPlate([], OATS);
    expect(items).toHaveLength(1);
    expect(items[0]!.factor).toBe(1);
    items = addToPlate(items, OATS);
    expect(items).toHaveLength(1);
    for (let i = 0; i < 10; i++) {
      items = addToPlate(items, { ...CHICKEN, key: `f${i}` });
    }
    expect(items).toHaveLength(PLATE_MAX_ITEMS);
  });

  it('factors clamp to the published bounds, stepping included', () => {
    expect(clampFactor(0)).toBe(FACTOR_MIN);
    expect(clampFactor(99)).toBe(FACTOR_MAX);
    let items = addToPlate([], OATS);
    for (let i = 0; i < 30; i++) items = stepFactor(items, 'oats', -1);
    expect(items[0]!.factor).toBe(FACTOR_MIN);
    for (let i = 0; i < 30; i++) items = stepFactor(items, 'oats', 1);
    expect(items[0]!.factor).toBe(FACTOR_MAX);
  });

  it('remove removes', () => {
    const items = addToPlate(addToPlate([], OATS), CHICKEN);
    expect(removeFromPlate(items, 'oats').map((i) => i.food.key)).toEqual(['chk']);
  });
});

describe('scaled numbers — rounded, never more precise than the base', () => {
  it('totals scale with factors', () => {
    let items = addToPlate(addToPlate([], OATS), CHICKEN);
    items = setFactor(items, 'oats', 0.5);
    const t = plateTotals(items);
    expect(t.calories).toBe(Math.round(420 * 0.5 + 610));
    expect(t.protein).toBe(Math.round((12 * 0.5 + 45) * 10) / 10);
  });

  it('entries are ordinary food entries, one per item, factor in the name only when ≠1', () => {
    let items = addToPlate(addToPlate([], OATS), CHICKEN);
    items = setFactor(items, 'chk', 1.5);
    const entries = plateEntries(items);
    expect(entries[0]!.foodName).toBe('Oats & banana');
    expect(entries[1]!.foodName).toBe('Chicken & rice bowl (×1.5)');
    expect(entries[1]!.calories).toBe(915);
    expect(entries[1]!.sodiumMg).toBe(1350);
    expect(entries[0]!.sugar).toBe(14);
    expect(entries[1]!.brand).toBe('Deli');
  });
});

describe('drag + drawing math', () => {
  it('drag up grows, drag down shrinks, both clamped', () => {
    expect(factorFromDrag(1, -120)).toBe(2);
    expect(factorFromDrag(1, 120)).toBeCloseTo(FACTOR_MIN, 5);
    expect(factorFromDrag(1, -999)).toBe(FACTOR_MAX);
  });
  it('radius tracks area, not diameter — ×4 doubles the radius', () => {
    expect(itemRadius(1, 30)).toBe(30);
    expect(itemRadius(2.25, 30)).toBe(45);
  });
  it('factor text has no float noise', () => {
    expect(factorText(1.5)).toBe('1.5');
    expect(factorText(0.75)).toBe('0.75');
  });
});
