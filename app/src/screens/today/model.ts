import type { FoodEntryRow, DailyTotals } from '@basalt/nutrition';
import type { TargetsRecord } from '@basalt/core-data';

// Today view-model — pure. The screen renders these; the rules live here
// where they can be tested.

export type MealSection = {
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  label: string;
  /** "07:12" from the earliest entry in the section (device-local). */
  time: string | null;
  entries: FoodEntryRow[];
};

const MEAL_ORDER: MealSection['meal'][] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const MEAL_LABEL: Record<MealSection['meal'], string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks',
};

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Group the day's entries into ordered meal sections; empty meals vanish. */
export function groupEntriesByMeal(entries: FoodEntryRow[]): MealSection[] {
  return MEAL_ORDER.map((meal) => {
    const rows = entries
      .filter((e) => e.mealType === meal)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      meal,
      label: MEAL_LABEL[meal],
      time: rows.length > 0 ? hhmm(rows[0]!.createdAt) : null,
      entries: rows,
    };
  }).filter((s) => s.entries.length > 0);
}

/** "P 31 · C 52 · F 9" meta line for a receipt row. */
export function entryMeta(e: FoodEntryRow): string {
  const parts = [`P ${Math.round(e.protein)}`, `C ${Math.round(e.carbs)}`, `F ${Math.round(e.fat)}`];
  if (e.source === 'barcode') parts.push('scanned');
  if (e.brand) parts.push(e.brand);
  return parts.join(' · ');
}

export type HeroModel = {
  /** Remaining kcal (target − eaten). Negative shows as over, plainly. */
  remaining: number;
  over: boolean;
  targetText: string;
  subParts: string[];
  /** Stack fractions of target energy: protein/carbs/fat as consumed kcal. */
  stack: { fraction: number; kind: 'protein' | 'carbs' | 'fat' }[];
};

/**
 * The hero: remaining energy vs the versioned target. Consumed macro kcal
 * (P/C×4, F×9) fill the stack as fractions of the calorie target. Active
 * energy appears only when a real source supplied it — never a guess.
 */
export function heroModel(
  targets: TargetsRecord,
  totals: DailyTotals,
  activeKcal: number | null,
): HeroModel {
  const remaining = Math.round(targets.calories - totals.calories);
  const subParts = [`${Math.round(totals.calories).toLocaleString('en-US')} eaten`];
  if (activeKcal !== null && activeKcal > 0) subParts.push(`${Math.round(activeKcal)} active`);

  const target = Math.max(1, targets.calories);
  const frac = (kcal: number) => Math.max(0, Math.min(1, kcal / target));
  return {
    remaining: Math.abs(remaining),
    over: remaining < 0,
    targetText: targets.calories.toLocaleString('en-US'),
    subParts,
    stack: [
      { fraction: frac(totals.protein * 4), kind: 'protein' },
      { fraction: frac(totals.carbs * 4), kind: 'carbs' },
      { fraction: frac(totals.fat * 9), kind: 'fat' },
    ],
  };
}

export type SessionRow = {
  title: string;
  meta: string;
  startedAt: string;
};

/** "14 sets · 6,240 kg volume · 52 min" training receipt meta. */
export function sessionMeta(setCount: number, volumeKg: number, minutes: number | null): string {
  const parts = [`${setCount} ${setCount === 1 ? 'set' : 'sets'}`];
  if (volumeKg > 0) parts.push(`${Math.round(volumeKg).toLocaleString('en-US')} kg volume`);
  if (minutes !== null && minutes > 0) parts.push(`${Math.round(minutes)} min`);
  return parts.join(' · ');
}

export type MicroTotal = { name: string; pct: number };

/**
 * Micronutrient rows — ONLY nutrients that actually appeared in the day's
 * entries' source data (micros jsonb of {name: {amount, unit, pctTarget}}).
 * No source data → empty array → the card hides itself entirely.
 */
export function microTotals(entries: FoodEntryRow[]): MicroTotal[] {
  const sums = new Map<string, number>();
  for (const e of entries) {
    const micros = e.micros;
    if (!micros) continue;
    for (const [name, v] of Object.entries(micros)) {
      if (typeof v?.pctTarget === 'number' && isFinite(v.pctTarget)) {
        sums.set(name, (sums.get(name) ?? 0) + v.pctTarget);
      }
    }
  }
  return Array.from(sums.entries())
    .map(([name, pct]) => ({ name, pct: Math.round(pct) }))
    .sort((a, b) => b.pct - a.pct);
}
