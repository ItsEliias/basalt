import { describe, it, expect } from 'vitest';
import { barcodeDisplay, offToEntryInput, qualityLine, resultMeta, dietaryConflicts, conflictLine, mealForHour, yesterdayMeals, labelToDraftFields, trayTotals, trayLine, type TrayItem } from './model';
import type { OFFProduct } from '@basalt/nutrition';

const yoghurt: OFFProduct = {
  id: '9300633481116', barcode: '9300633481116', name: 'Vaalia Greek Yoghurt, Natural 900 g',
  brand: 'Vaalia', calories: 152, protein: 16, fat: 5, carbs: 10, fiber: 0, sugar: 9.8,
  sodium: 0.06, saturatedFat: 3.2, servingSize: 170, servingUnit: 'g',
  allergens: ['milk'],
};

describe('barcodeDisplay', () => {
  it('splits the last six digits and marks validity', () => {
    expect(barcodeDisplay('9300633481116', true)).toBe('9300633 481116 ✓');
    expect(barcodeDisplay('9300633481116', false)).toBe('9300633 481116 ✕');
    expect(barcodeDisplay('73513537', true)).toBe('73 513537 ✓');
  });
});

describe('offToEntryInput', () => {
  it('maps a product per-serving with source=barcode and sodium in mg', () => {
    const input = offToEntryInput(yoghurt, 'breakfast');
    expect(input).toMatchObject({
      mealType: 'breakfast', foodName: yoghurt.name, brand: 'Vaalia',
      calories: 152, protein: 16, sugar: 9.8, sodiumMg: 60,
      servingSize: 170, servingUnit: 'g', barcode: '9300633481116', source: 'barcode',
    });
  });
});

describe('qualityLine — derived, published, never moralized', () => {
  it('calls out protein density at ≥25% of energy', () => {
    expect(qualityLine(yoghurt)).toContain('protein-dense'); // 64/152 = 42%
  });
  it('low added sugar under 5 g/serve; high sodium over 600 mg', () => {
    expect(qualityLine({ ...yoghurt, sugar: 2 })).toContain('low added sugar');
    expect(qualityLine({ ...yoghurt, sodium: 0.9 })).toContain('high sodium');
  });
  it('returns null when nothing meets a threshold — no filler adjectives', () => {
    expect(qualityLine({ ...yoghurt, protein: 2, sugar: 9.8, sodium: 0.06 })).toBeNull();
  });
});

describe('resultMeta', () => {
  it('renders the prototype form', () => {
    expect(resultMeta(yoghurt)).toBe('per 170 g serve — 152 kcal · P 16 · C 10 · F 5');
  });
});

describe('dietaryConflicts — flag plainly, never hide', () => {
  const flags = ['Coeliac (strict GF)', 'Dairy free', 'Peanut allergy'];

  it('maps OFF allergen tokens onto the user’s flags', () => {
    expect(dietaryConflicts(['milk'], flags)).toEqual([{ allergen: 'milk', flag: 'Dairy free' }]);
    expect(dietaryConflicts(['gluten'], flags)).toEqual([{ allergen: 'gluten', flag: 'Coeliac (strict GF)' }]);
  });

  it('peanuts hit both peanut and nut allergies when both are set', () => {
    const both = dietaryConflicts(['peanuts'], ['Peanut allergy', 'Nut allergy']);
    expect(both).toHaveLength(2);
  });

  it('no user flags → no conflicts, and unrelated allergens stay quiet', () => {
    expect(dietaryConflicts(['milk', 'soybeans'], [])).toEqual([]);
    expect(dietaryConflicts(['sesame seeds'], flags)).toEqual([]);
  });

  it('"fish" does not fire on shellfish tokens', () => {
    expect(dietaryConflicts(['crustaceans'], ['Fish'])).toEqual([]);
    expect(dietaryConflicts(['fish'], ['Fish'])).toEqual([{ allergen: 'fish', flag: 'Fish' }]);
  });
});

describe('mealForHour', () => {
  it('maps the clock onto meal slots', () => {
    expect(mealForHour(7)).toBe('breakfast');
    expect(mealForHour(12)).toBe('lunch');
    expect(mealForHour(18)).toBe('dinner');
    expect(mealForHour(22)).toBe('snacks');
  });
});

describe('conflictLine', () => {
  it('groups per allergen and reads plainly', () => {
    const line = conflictLine([
      { allergen: 'milk', flag: 'Dairy free' },
      { allergen: 'milk', flag: 'Lactose intolerant' },
    ]);
    expect(line).toBe('contains milk — conflicts with Dairy free, Lactose intolerant');
  });
  it('null when clear — no reassurance theater', () => {
    expect(conflictLine([])).toBeNull();
  });
});

describe('yesterdayMeals', () => {
  it('groups yesterday by meal in order with totals, dropping empties', () => {
    const rows = yesterdayMeals([
      { mealType: 'lunch', calories: 638 },
      { mealType: 'breakfast', calories: 412 },
      { mealType: 'breakfast', calories: 4 },
    ]);
    expect(rows).toEqual([
      { meal: 'breakfast', label: 'Breakfast', count: 2, calories: 416 },
      { meal: 'lunch', label: 'Lunch', count: 1, calories: 638 },
    ]);
  });
  it('an empty yesterday means no card at all', () => {
    expect(yesterdayMeals([])).toEqual([]);
  });
});

describe('labelToDraftFields', () => {
  const label = {
    food_name: 'Protein Oats', brand: 'Uncle Tobys', serving_size: 55, serving_unit: 'g',
    calories: 210.4, protein_g: 11.23, carbs_g: 30.06, fat_g: 4.98, fiber_g: 4.4,
    sugar_g: 8.91, sodium_mg: 85.6, note: 'kJ converted to kcal',
  };

  it('keeps printed per-serving values, tenth-gram rounded', () => {
    const d = labelToDraftFields(label, 8);
    expect(d).toMatchObject({
      foodName: 'Protein Oats', brand: 'Uncle Tobys', calories: 210,
      protein: 11.2, carbs: 30.1, fat: 5, sugar: 8.9, sodiumMg: 86,
      servingSize: 55, servingUnit: 'g', source: 'photo', mealType: 'breakfast',
    });
  });

  it('null brand maps to undefined, not the string "null"', () => {
    expect(labelToDraftFields({ ...label, brand: null }, 8).brand).toBeUndefined();
  });
});

describe('the Tray — running totals, plain sums, honest', () => {
  const item = (calories: number, protein = 10, carbs = 20, fat = 5): TrayItem => ({
    entry: {
      mealType: 'lunch', foodName: 'x', calories, protein, carbs, fat, fiber: 1,
    },
    photoB64: null,
  });

  it('sums entry totals as entered — quantity is metadata, never a multiplier', () => {
    const t = trayTotals([item(300), item(450), { ...item(250), entry: { ...item(250).entry, quantity: 3 } }]);
    expect(t).toEqual({ count: 3, calories: 1000, protein: 30, carbs: 60, fat: 15 });
  });

  it('an empty tray is zeroes, not fabrications', () => {
    expect(trayTotals([])).toEqual({ count: 0, calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('the banner line reads like the receipt it is', () => {
    expect(trayLine(trayTotals([item(1240, 82, 130, 41)]))).toBe('1 ITEM · 1,240 KCAL · P 82 · C 130 · F 41');
    expect(trayLine(trayTotals([item(600, 40, 60, 20), item(640, 42, 70, 21)]))).toBe(
      '2 ITEMS · 1,240 KCAL · P 82 · C 130 · F 41',
    );
  });
});
