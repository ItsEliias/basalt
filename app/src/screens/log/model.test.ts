import { describe, it, expect } from 'vitest';
import { barcodeDisplay, offToEntryInput, qualityLine, resultMeta, dietaryConflicts, conflictLine, mealForHour } from './model';
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
