// Plate builder — the pure half. A plate holds up to six of the user's
// recent foods; each carries a portion factor the user drags (or steps)
// between ×0.25 and ×3 of the food's saved serving. Committing produces
// ordinary food entries — the same shape every other capture method
// writes; the Extra adds a surface, it never invents a new data path.
// Honesty: scaled numbers are rounded, never faked to more precision
// than the base food carries; a base food that was an AI estimate stays
// an estimate downstream (the entry keeps whatever ~ the base had).

export type PlateFood = {
  /** Stable key within the picker (favorite id or name). */
  key: string;
  foodName: string;
  brand: string | null;
  /** Per single serving, as saved. */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
  sodiumMg?: number;
};

export type PlateItem = { food: PlateFood; factor: number };

export const PLATE_MAX_ITEMS = 6;
export const FACTOR_MIN = 0.25;
export const FACTOR_MAX = 3;
export const FACTOR_STEP = 0.25;

export function clampFactor(f: number): number {
  return Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, f));
}

/** Add a food at ×1; refuses duplicates and a seventh item. */
export function addToPlate(items: PlateItem[], food: PlateFood): PlateItem[] {
  if (items.length >= PLATE_MAX_ITEMS) return items;
  if (items.some((i) => i.food.key === food.key)) return items;
  return [...items, { food, factor: 1 }];
}

export function removeFromPlate(items: PlateItem[], key: string): PlateItem[] {
  return items.filter((i) => i.food.key !== key);
}

export function setFactor(items: PlateItem[], key: string, factor: number): PlateItem[] {
  return items.map((i) => (i.food.key === key ? { ...i, factor: clampFactor(factor) } : i));
}

export function stepFactor(items: PlateItem[], key: string, direction: 1 | -1): PlateItem[] {
  const item = items.find((i) => i.food.key === key);
  if (!item) return items;
  return setFactor(items, key, item.factor + direction * FACTOR_STEP);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Plate totals, scaled — what the summary row shows before commit. */
export function plateTotals(items: PlateItem[]): { calories: number; protein: number; carbs: number; fat: number } {
  return {
    calories: Math.round(items.reduce((s, i) => s + i.food.calories * i.factor, 0)),
    protein: r1(items.reduce((s, i) => s + i.food.protein * i.factor, 0)),
    carbs: r1(items.reduce((s, i) => s + i.food.carbs * i.factor, 0)),
    fat: r1(items.reduce((s, i) => s + i.food.fat * i.factor, 0)),
  };
}

export type PlateEntry = {
  foodName: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
  sodiumMg?: number;
};

/** One ordinary entry per plate item, portion-scaled and rounded. */
export function plateEntries(items: PlateItem[]): PlateEntry[] {
  return items.map(({ food, factor }) => ({
    foodName: factor === 1 ? food.foodName : `${food.foodName} (×${factorText(factor)})`,
    ...(food.brand ? { brand: food.brand } : {}),
    calories: Math.round(food.calories * factor),
    protein: r1(food.protein * factor),
    carbs: r1(food.carbs * factor),
    fat: r1(food.fat * factor),
    fiber: r1(food.fiber * factor),
    ...(food.sugar !== undefined ? { sugar: r1(food.sugar * factor) } : {}),
    ...(food.sodiumMg !== undefined ? { sodiumMg: Math.round(food.sodiumMg * factor) } : {}),
  }));
}

export function factorText(f: number): string {
  return (Math.round(f * 100) / 100).toString();
}

/** Drag mapping: vertical delta in dp → factor delta. 120 dp spans ×1. */
export function factorFromDrag(startFactor: number, dyDp: number): number {
  return clampFactor(startFactor - dyDp / 120);
}

/** Circle radius for the plate graphic: area tracks the factor. */
export function itemRadius(factor: number, base = 34): number {
  return Math.round(base * Math.sqrt(factor));
}
