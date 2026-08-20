import { describe, it, expect } from 'vitest';
import { parseQtyText, scaleQty, fmtQty, draftFromImport, ingredientConflicts } from './recipes';
import type { UrlRecipeImport } from './recipe-import';

describe('parseQtyText', () => {
  it('parses decimals, fractions and vulgar fractions', () => {
    expect(parseQtyText('1.5')).toBe(1.5);
    expect(parseQtyText('1/2')).toBe(0.5);
    expect(parseQtyText('½')).toBe(0.5);
    expect(parseQtyText('1 ½')).toBe(1.5);
    expect(parseQtyText('⅔')).toBeCloseTo(0.667, 2);
  });
  it('prose amounts stay null — no invented numbers', () => {
    expect(parseQtyText('a pinch')).toBeNull();
    expect(parseQtyText('')).toBeNull();
  });
});

describe('scaleQty / fmtQty — live serving scaling', () => {
  it('scales from base serves (the prototype ragu: 1.2 kg at 6 → 1.6 kg at 8)', () => {
    expect(scaleQty(1200, 6, 8)).toBe(1600);
    expect(scaleQty(700, 6, 3)).toBe(350);
  });
  it('null quantities scale to null', () => {
    expect(scaleQty(null, 6, 8)).toBeNull();
  });
  it('formats g→kg, ml→l, unitless as ×N', () => {
    expect(fmtQty(1600, 'g')).toBe('1.6 kg');
    expect(fmtQty(350, 'ml')).toBe('350 ml');
    expect(fmtQty(1500, 'ml')).toBe('1.5 l');
    expect(fmtQty(2, null)).toBe('×2');
    expect(fmtQty(null, 'g')).toBe('');
  });
});

describe('draftFromImport — the ~ rule', () => {
  const imp: UrlRecipeImport = {
    title: 'Miso salmon', description: 'Weeknight', servings: 2,
    ingredients: [
      { name: 'salmon fillets', quantity: '2', unit: '' },
      { name: 'white miso', quantity: '½', unit: 'cup' },
      { name: 'soba noodles', quantity: '', unit: '' },
    ],
    steps: ['Whisk.', 'Bake.'],
    prepMinutes: 10, cookMinutes: 15,
    estimatedMacros: { calories: 548, protein: 38, fat: 22, carbs: 42 },
    source: 'https://example.com/miso', confidence: 90,
  };

  it('maps to an editable draft with macrosConfirmed=false', () => {
    const d = draftFromImport(imp);
    expect(d.macrosConfirmed).toBe(false);
    expect(d.source).toBe('jsonld');
    expect(d.sourceUrl).toBe('https://example.com/miso');
    expect(d.serves).toBe(2);
    expect(d.totalTimeMin).toBe(25);
    expect(d.caloriesPerServe).toBe(548);
    expect(d.ingredients[0]).toEqual({ qty: 2, unit: null, name: 'salmon fillets' });
    expect(d.ingredients[1]).toEqual({ qty: 0.5, unit: 'cup', name: 'white miso' });
    expect(d.ingredients[2]).toEqual({ qty: null, unit: null, name: 'soba noodles' });
  });
});

describe('ingredientConflicts — per-ingredient, flagged never hidden', () => {
  const flags = ['Dairy free', 'Coeliac (strict GF)'];

  it('finds dairy and gluten in ingredient text', () => {
    const conflicts = ingredientConflicts(['unsalted butter', 'GF pappardelle', 'plain flour'], flags);
    expect(conflicts).toContainEqual({ ingredient: 'unsalted butter', flag: 'Dairy free' });
    expect(conflicts).toContainEqual({ ingredient: 'plain flour', flag: 'Coeliac (strict GF)' });
  });

  it('quiet when the user has no matching flags', () => {
    expect(ingredientConflicts(['butter', 'flour'], [])).toEqual([]);
    expect(ingredientConflicts(['brown onion', 'carrot'], flags)).toEqual([]);
  });
});
