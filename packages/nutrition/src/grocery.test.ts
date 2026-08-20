import { describe, it, expect } from 'vitest';
import { normalizeQty, consolidate, aisleFor, groupByAisle, AISLE_ORDER } from './grocery';
import type { GroceryItem } from './grocery';

describe('normalizeQty', () => {
  it('normalises kg→g and l→ml', () => {
    expect(normalizeQty(1.2, 'kg')).toEqual({ qty: 1200, unit: 'g' });
    expect(normalizeQty(0.7, 'l')).toEqual({ qty: 700, unit: 'ml' });
    expect(normalizeQty(300, 'g')).toEqual({ qty: 300, unit: 'g' });
  });
  it('collapses unit-word plurals', () => {
    expect(normalizeQty(2, 'cups')).toEqual({ qty: 2, unit: 'cup' });
    expect(normalizeQty(1, 'tablespoons')).toEqual({ qty: 1, unit: 'tbsp' });
  });
  it('leaves unknown units and null quantities alone', () => {
    expect(normalizeQty(2, 'bunch')).toEqual({ qty: 2, unit: 'bunch' });
    expect(normalizeQty(null, 'g')).toEqual({ qty: null, unit: 'g' });
  });
});

describe('consolidate — quantities consolidated across recipes', () => {
  it('sums same name + same base unit across unit spellings', () => {
    const { merged, added } = consolidate(
      [{ name: 'Passata', qty: 700, unit: 'ml' }],
      [{ name: 'passata', qty: 0.3, unit: 'l' }],
    );
    expect(merged[0]?.qty).toBe(1000);
    expect(added).toEqual([]);
  });

  it('different units of the same name stay separate — no unit fiction', () => {
    const { merged, added } = consolidate(
      [{ name: 'Carrot', qty: 300, unit: 'g' }],
      [{ name: 'carrot', qty: 2, unit: null }],
    );
    expect(merged[0]?.qty).toBe(300);
    expect(added).toEqual([{ name: 'carrot', qty: 2, unit: null }]);
  });

  it('prose amounts never merge into numbers', () => {
    const { added } = consolidate(
      [{ name: 'Salt', qty: null, unit: null }],
      [{ name: 'salt', qty: null, unit: null }],
    );
    expect(added).toHaveLength(1);
  });

  it('brand-new items land in added', () => {
    const { added } = consolidate([], [{ name: 'Beef chuck', qty: 1.2, unit: 'kg' }]);
    expect(added).toEqual([{ name: 'Beef chuck', qty: 1200, unit: 'g' }]);
  });
});

describe('aisleFor', () => {
  it('sorts the prototype grocery list into its aisles', () => {
    expect(aisleFor('Brown onion')).toBe('produce');
    expect(aisleFor('Baby spinach')).toBe('produce');
    expect(aisleFor('Beef chuck')).toBe('meat & fish');
    expect(aisleFor('Salmon fillets')).toBe('meat & fish');
    expect(aisleFor('Soba noodles')).toBe('pantry');
    expect(aisleFor('White miso')).toBe('pantry');
    expect(aisleFor('Passata')).toBe('pantry');
  });
  it('defaults honestly, never invents a category', () => {
    expect(aisleFor('Mystery item 9000')).toBe('pantry');
    expect(aisleFor('  ')).toBe('other');
  });
});

describe('groupByAisle', () => {
  const item = (name: string, aisle: string): GroceryItem => ({
    id: name, name, qty: 1, unit: null, aisle, checked: false,
  });
  it('groups in the fixed aisle order, skipping empty aisles', () => {
    const groups = groupByAisle([
      item('Passata', 'pantry'),
      item('Brown onion', 'produce'),
      item('Beef chuck', 'meat & fish'),
    ]);
    expect(groups.map((g) => g.aisle)).toEqual(['produce', 'meat & fish', 'pantry']);
    expect(AISLE_ORDER[0]).toBe('produce');
  });
});
