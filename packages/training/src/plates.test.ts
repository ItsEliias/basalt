import { describe, it, expect } from 'vitest';
import { platesFor, platesText, DEFAULT_BAR_KG } from './plates';

describe('platesFor', () => {
  it('loads 100 kg as 25 + 15 per side on a 20 kg bar', () => {
    const b = platesFor(100)!;
    expect(b.perSide).toEqual([
      { plateKg: 25, count: 1 },
      { plateKg: 15, count: 1 },
    ]);
    expect(b.achievableKg).toBe(100);
    expect(b.residualKg).toBe(0);
  });

  it('hits fractional loads exactly with micro plates', () => {
    const b = platesFor(77.5)!;
    // per side 28.75 = 25 + 2.5 + 1.25
    expect(b.perSide).toEqual([
      { plateKg: 25, count: 1 },
      { plateKg: 2.5, count: 1 },
      { plateKg: 1.25, count: 1 },
    ]);
    expect(b.residualKg).toBe(0);
  });

  it('states the residual plainly when the target is not loadable', () => {
    const b = platesFor(62.7)!;
    expect(b.achievableKg).toBe(62.5);
    expect(b.residualKg).toBe(0.2);
  });

  it('an empty bar is a valid answer at exactly bar weight', () => {
    const b = platesFor(DEFAULT_BAR_KG)!;
    expect(b.perSide).toEqual([]);
    expect(b.achievableKg).toBe(20);
    expect(platesText(b)).toBe('empty bar (20 kg)');
  });

  it('below bar weight there is no loading — null, not a negative plate', () => {
    expect(platesFor(15)).toBeNull();
    expect(platesFor(NaN)).toBeNull();
  });

  it('respects a different bar and a limited plate set', () => {
    const b = platesFor(60, { barKg: 15, plates: [20, 10, 5] })!;
    // per side 22.5 → 20 + (2.5 unreachable) → residual 5 total
    expect(b.perSide).toEqual([{ plateKg: 20, count: 1 }]);
    expect(b.achievableKg).toBe(55);
    expect(b.residualKg).toBe(5);
  });

  it('repeats plates when needed', () => {
    const b = platesFor(180)!;
    // per side 80 = 25×3 + 5×1
    expect(b.perSide).toEqual([
      { plateKg: 25, count: 3 },
      { plateKg: 5, count: 1 },
    ]);
    expect(platesText(b)).toBe('25 + 25 + 25 + 5 per side · 20 kg bar');
  });
});
