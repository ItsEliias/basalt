import type { OFFProduct, FoodEntryInput, MealType } from '@basalt/nutrition';

// Log/Capture view-model — pure. OFF product → editable entry input, the
// derived quality line, the barcode display form, and the dietary-conflict
// check (flag + say it plainly; never filter silently — the open
// differentiator nobody else ships).

/** Default meal slot from the clock — 1-tap re-logs use it; always editable. */
export function mealForHour(hour: number): MealType {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snacks';
}

/** "9300633 481116 ✓" — the verified-scan display form. */
export function barcodeDisplay(code: string, valid: boolean): string {
  const trimmed = code.trim();
  const split = trimmed.length > 6
    ? `${trimmed.slice(0, trimmed.length - 6)} ${trimmed.slice(-6)}`
    : trimmed;
  return `${split} ${valid ? '✓' : '✕'}`;
}

/** Editable entry input from an OFF product — per serving, user-adjustable. */
export function offToEntryInput(p: OFFProduct, mealType: MealType): FoodEntryInput {
  return {
    mealType,
    foodName: p.name,
    brand: p.brand || undefined,
    calories: p.calories,
    protein: p.protein,
    carbs: p.carbs,
    fat: p.fat,
    fiber: p.fiber,
    sugar: p.sugar,
    sodiumMg: Math.round(p.sodium * 1000), // OFF reports sodium in g
    saturatedFat: p.saturatedFat,
    servingSize: p.servingSize,
    servingUnit: p.servingUnit,
    quantity: 1,
    barcode: p.barcode,
    source: 'barcode',
  };
}

/**
 * The quality line under a scan result — derived, published thresholds, no
 * moralizing: protein-dense = ≥25% of energy from protein; low added sugar
 * = <5 g per serving; high sodium = >600 mg per serving.
 */
export function qualityLine(p: OFFProduct): string | null {
  const parts: string[] = [];
  if (p.calories > 0 && (p.protein * 4) / p.calories >= 0.25) parts.push('protein-dense');
  if (p.sugar < 5) parts.push('low added sugar');
  if (p.sodium * 1000 > 600) parts.push('high sodium');
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** "per 170 g serve — 152 kcal · P 16 · C 10 · F 5" result meta. */
export function resultMeta(p: OFFProduct): string {
  const serve = `per ${p.servingSize} ${p.servingUnit} serve`;
  return `${serve} — ${Math.round(p.calories)} kcal · P ${Math.round(p.protein)} · C ${Math.round(p.carbs)} · F ${Math.round(p.fat)}`;
}

// ─── Dietary conflict flagging ──────────────────────────────────────────────
// OFF allergen tokens (normalized lowercase, 'en:' prefix stripped by the
// client) → the onboarding dietary flags they collide with.

const ALLERGEN_TO_FLAGS: [RegExp, string[]][] = [
  [/gluten|wheat|barley|rye|oats/, ['Coeliac (strict GF)', 'Gluten sensitivity']],
  [/milk|dairy|lactose/, ['Dairy free', 'Lactose intolerant']],
  [/(?<!pea)nuts|almond|hazelnut|cashew|walnut|pecan|pistachio|macadamia/, ['Nut allergy']],
  [/peanut/, ['Peanut allergy', 'Nut allergy']],
  [/crustacean|mollusc|shellfish|shrimp|prawn|crab|lobster/, ['Shellfish']],
  [/(?<!shell)fish(?!ing)/, ['Fish']],
  [/egg/, ['Egg']],
  [/soy|soja|soybean/, ['Soy']],
  [/sesame/, ['Sesame']],
  [/sulph|sulfit/, ['Sulphites']],
];

export type DietaryConflict = { allergen: string; flag: string };

/**
 * Cross-check a product's allergen tags against the user's dietary flags.
 * Returns every collision — the UI states them plainly with the product
 * still fully visible and loggable. Nothing is hidden, nothing is filtered.
 */
export function dietaryConflicts(allergens: string[], userFlags: string[]): DietaryConflict[] {
  const out: DietaryConflict[] = [];
  const seen = new Set<string>();
  for (const raw of allergens) {
    const token = raw.toLowerCase();
    for (const [pattern, flags] of ALLERGEN_TO_FLAGS) {
      if (!pattern.test(token)) continue;
      for (const flag of flags) {
        if (userFlags.includes(flag) && !seen.has(`${raw}:${flag}`)) {
          seen.add(`${raw}:${flag}`);
          out.push({ allergen: raw, flag });
        }
      }
    }
  }
  return out;
}

/** "contains milk — conflicts with Dairy free" line for the result card. */
export function conflictLine(conflicts: DietaryConflict[]): string | null {
  if (conflicts.length === 0) return null;
  const grouped = new Map<string, string[]>();
  for (const c of conflicts) {
    grouped.set(c.allergen, [...(grouped.get(c.allergen) ?? []), c.flag]);
  }
  return Array.from(grouped.entries())
    .map(([allergen, flags]) => `contains ${allergen} — conflicts with ${flags.join(', ')}`)
    .join(' · ');
}

// ─── Copy yesterday ─────────────────────────────────────────────────────────

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks',
};

export type YesterdayMeal = { meal: MealType; label: string; count: number; calories: number };

/** Yesterday's meals grouped for the tap-to-copy card; empty meals vanish. */
export function yesterdayMeals(
  entries: { mealType: MealType; calories: number }[],
): YesterdayMeal[] {
  return MEAL_ORDER.map((meal) => {
    const rows = entries.filter((e) => e.mealType === meal);
    return {
      meal,
      label: MEAL_LABEL[meal],
      count: rows.length,
      calories: Math.round(rows.reduce((s, e) => s + e.calories, 0)),
    };
  }).filter((m) => m.count > 0);
}

// ─── Nutrition-label transcription → custom-food draft fields ───────────────

export type LabelScan = {
  food_name: string;
  brand: string | null;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  note: string;
};

/**
 * Label photo → draft fields. Per-serving values as printed; saving the
 * entry also lands it in favorites (via the normal save path), which is
 * what makes it a reusable custom food.
 */
export function labelToDraftFields(label: LabelScan, hour: number) {
  return {
    mealType: mealForHour(hour),
    foodName: label.food_name,
    brand: label.brand ?? undefined,
    calories: Math.round(label.calories),
    protein: Math.round(label.protein_g * 10) / 10,
    carbs: Math.round(label.carbs_g * 10) / 10,
    fat: Math.round(label.fat_g * 10) / 10,
    fiber: Math.round(label.fiber_g * 10) / 10,
    sugar: Math.round(label.sugar_g * 10) / 10,
    sodiumMg: Math.round(label.sodium_mg),
    servingSize: label.serving_size,
    servingUnit: label.serving_unit,
    source: 'photo' as const,
  };
}

// ─── The Tray — accumulate a whole meal, commit once ─────────────────────────
//
// The fastest logging pattern in the category: add an item, the search
// clears, the sticky banner keeps the running total, keep typing; one
// action commits everything. Entries hold their macros as TOTALS as
// entered (quantity is provenance metadata, not a multiplier — matching
// how addFoodEntry stores and Today sums them), so tray math is plain
// sums, honestly.

export type TrayItem = {
  entry: FoodEntryInput;
  /** JPEG b64 pending upload with its entry at commit, or null. */
  photoB64: string | null;
};

export type TrayTotals = {
  count: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function trayTotals(items: TrayItem[]): TrayTotals {
  return items.reduce<TrayTotals>(
    (t, { entry }) => ({
      count: t.count + 1,
      calories: t.calories + entry.calories,
      protein: t.protein + entry.protein,
      carbs: t.carbs + entry.carbs,
      fat: t.fat + entry.fat,
    }),
    { count: 0, calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** The sticky banner line: "3 ITEMS · 1,240 KCAL · P 82 · C 130 · F 41". */
export function trayLine(totals: TrayTotals): string {
  const int = (n: number) => Math.round(n).toLocaleString('en-US');
  return `${totals.count} ${totals.count === 1 ? 'ITEM' : 'ITEMS'} · ${int(totals.calories)} KCAL · P ${int(totals.protein)} · C ${int(totals.carbs)} · F ${int(totals.fat)}`;
}
