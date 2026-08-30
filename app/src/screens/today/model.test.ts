import { describe, it, expect } from 'vitest';
import { groupEntriesByMeal, heroModel, sessionMeta, microTotals, entryMeta, todayTileSpecs } from './model';
import type { FoodEntryRow } from '@basalt/nutrition';
import type { TargetsRecord } from '@basalt/core-data';

function entry(partial: Partial<FoodEntryRow>): FoodEntryRow {
  return {
    id: 'e', logId: 'l', userId: 'u', mealType: 'breakfast', foodName: 'Food',
    brand: null, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0,
    sodiumMg: 0, saturatedFat: 0, servingSize: 100, servingUnit: 'g', quantity: 1,
    barcode: null, photoPath: null, source: 'manual', extSource: null, extId: null, micros: null,
    createdAt: '2026-08-20T07:12:00',
    ...partial,
  };
}

const targets: TargetsRecord = {
  effectiveDate: '2026-08-20', calories: 2340, proteinG: 180, carbsG: 260, fatG: 78,
  fiberG: 28, sugarCapG: 36, sodiumCapMg: 2300, waterMl: 2850, steps: 7000,
  sleepMin: 450, reason: null,
};

describe('groupEntriesByMeal', () => {
  it('groups in meal order, stamps the earliest time, drops empty meals', () => {
    const sections = groupEntriesByMeal([
      entry({ id: '1', mealType: 'lunch', createdAt: '2026-08-20T12:48:00' }),
      entry({ id: '2', mealType: 'breakfast', createdAt: '2026-08-20T07:30:00' }),
      entry({ id: '3', mealType: 'breakfast', createdAt: '2026-08-20T07:12:00' }),
    ]);
    expect(sections.map((s) => s.meal)).toEqual(['breakfast', 'lunch']);
    expect(sections[0]?.time).toBe('07:12');
    expect(sections[0]?.entries.map((e) => e.id)).toEqual(['3', '2']);
  });

  it('returns [] for an empty day — the receipt shows an empty state instead', () => {
    expect(groupEntriesByMeal([])).toEqual([]);
  });
});

describe('heroModel', () => {
  const totals = { calories: 1728, protein: 142, carbs: 203, fat: 48, fiber: 19, sugar: 41, sodiumMg: 1600 };

  it('computes remaining vs target and the eaten line', () => {
    const h = heroModel(targets, totals, null);
    expect(h.remaining).toBe(612);
    expect(h.over).toBe(false);
    expect(h.targetText).toBe('2,340');
    expect(h.subParts).toEqual(['1,728 eaten']);
  });

  it('adds "active" only when a real source supplied it', () => {
    expect(heroModel(targets, totals, 412).subParts).toEqual(['1,728 eaten', '412 active']);
    expect(heroModel(targets, totals, 0).subParts).toEqual(['1,728 eaten']);
  });

  it('states over-target plainly instead of clamping to zero', () => {
    const h = heroModel(targets, { ...totals, calories: 2500 }, null);
    expect(h.over).toBe(true);
    expect(h.remaining).toBe(160);
  });

  it('stack fractions are consumed macro kcal over the target', () => {
    const h = heroModel(targets, totals, null);
    expect(h.stack[0]?.fraction).toBeCloseTo((142 * 4) / 2340, 3);
    expect(h.stack[1]?.fraction).toBeCloseTo((203 * 4) / 2340, 3);
    expect(h.stack[2]?.fraction).toBeCloseTo((48 * 9) / 2340, 3);
  });
});

describe('entryMeta', () => {
  it('renders macro shorthand and tags scans', () => {
    expect(entryMeta(entry({ protein: 31, carbs: 52, fat: 9 }))).toBe('P 31 · C 52 · F 9');
    expect(entryMeta(entry({ protein: 0, carbs: 0, fat: 0, source: 'barcode', brand: '7 Grams' })))
      .toBe('P 0 · C 0 · F 0 · scanned · 7 Grams');
  });
});

describe('sessionMeta', () => {
  it('formats the training receipt line', () => {
    expect(sessionMeta(14, 6240, 52)).toBe('14 sets · 6,240 kg volume · 52 min');
    expect(sessionMeta(1, 0, null)).toBe('1 set');
  });
});

describe('microTotals — only nutrients with source data', () => {
  it('sums pctTarget across entries and sorts descending', () => {
    const rows = microTotals([
      entry({ micros: { Iron: { pctTarget: 60 }, Zinc: { pctTarget: 40 } } }),
      entry({ micros: { Iron: { pctTarget: 44 } } }),
    ]);
    expect(rows).toEqual([
      { name: 'Iron', pct: 104 },
      { name: 'Zinc', pct: 40 },
    ]);
  });

  it('yields [] with no source micros — the card hides, no estimates as fact', () => {
    expect(microTotals([entry({}), entry({ micros: {} })])).toEqual([]);
  });
});

describe('todayTileSpecs — the Tiles layout fixed v1 content model', () => {
  const totals = { calories: 1728, protein: 142, carbs: 203, fat: 48, fiber: 19, sugar: 41, sodiumMg: 1600 };
  const hero = heroModel(targets, totals, null);
  const base = {
    hero, hideNumbers: false, targets, totals,
    steps: 8412, sleepHours: 7.2, waterMl: 1750, waterTargetMl: 2850,
    hydrationEnabled: true, trainingTitle: null,
  };

  it('always includes energy (full) and training (full) — six slots when fully populated', () => {
    const tiles = todayTileSpecs(base);
    expect(tiles.map((t) => t.key)).toEqual(['energy', 'protein', 'steps', 'sleep', 'water', 'training']);
    expect(tiles.find((t) => t.key === 'energy')?.span).toBe('full');
    expect(tiles.find((t) => t.key === 'training')?.span).toBe('full');
    expect(tiles.filter((t) => t.span === 'half')).toHaveLength(4);
  });

  it('rest day is real information, not an empty state', () => {
    const t = todayTileSpecs(base).find((x) => x.key === 'training')!;
    expect(t.value).toBe('Rest day');
    expect(t.empty).toBeUndefined();
  });

  it('a real session names itself instead of "Rest day"', () => {
    const t = todayTileSpecs({ ...base, trainingTitle: 'Push day' }).find((x) => x.key === 'training')!;
    expect(t.value).toBe('Push day');
  });

  it('protein is absent (not empty) with no targets — hide, not a placeholder', () => {
    const tiles = todayTileSpecs({ ...base, targets: null, hero: null });
    expect(tiles.find((t) => t.key === 'protein')).toBeUndefined();
  });

  it('water is absent (not empty) when hydration is disabled', () => {
    const tiles = todayTileSpecs({ ...base, hydrationEnabled: false });
    expect(tiles.find((t) => t.key === 'water')).toBeUndefined();
  });

  it('steps and sleep show an honest empty state with no source — never a zero', () => {
    const tiles = todayTileSpecs({ ...base, steps: null, sleepHours: null });
    const steps = tiles.find((t) => t.key === 'steps')!;
    const sleep = tiles.find((t) => t.key === 'sleep')!;
    expect(steps.empty).toBe(true);
    expect(steps.value).toBeUndefined();
    expect(sleep.empty).toBe(true);
    expect(sleep.value).toBeUndefined();
  });

  it('energy tile states over-target plainly via unit + tone, matching the ledger hero', () => {
    const overHero = heroModel(targets, { ...totals, calories: 2500 }, null);
    const t = todayTileSpecs({ ...base, hero: overHero }).find((x) => x.key === 'energy')!;
    expect(t.unit).toBe('kcal over');
    expect(t.over).toBe(true);
  });

  it('hideNumbers empties the energy tile honestly instead of showing hidden numbers', () => {
    const t = todayTileSpecs({ ...base, hideNumbers: true }).find((x) => x.key === 'energy')!;
    expect(t.empty).toBe(true);
    expect(t.value).toBeUndefined();
  });
});
