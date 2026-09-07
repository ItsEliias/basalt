import type { FoodSource } from './food';

// Visible uncertainty (V4 Phase 5 — a Basalt-pitch feature, on by default).
// Every food entry already records HOW it was captured (`source`); that is
// its confidence. The published model below turns a day's entries into an
// intake RANGE that narrows as entries come from tighter sources — weighed
// barcode grams beat a photo guess, and the day's number says so.
//
// The percentages are published in-app verbatim (INTAKE_RANGE_EXPLAINER)
// and pinned by test. They are deliberately round: this is a stated model,
// not a measurement.

export const SOURCE_UNCERTAINTY: Record<string, number> = {
  barcode: 0.05,   // label data, gram portions
  recipe: 0.10,    // ingredients weighed when the recipe was built
  manual: 0.10,    // your own numbers, typed
  search: 0.15,    // database match, portion estimated
  health_connect: 0.20, // another app's number, method unknown
  photo: 0.25,     // AI proposal from an image
  quick_add: 0.25, // a single figure, no breakdown
};

export const DEFAULT_UNCERTAINTY = 0.25;

/** `health_connect:com.foo` folds to `health_connect`. */
export function uncertaintyFor(source: FoodSource | string | null | undefined): number {
  if (!source) return SOURCE_UNCERTAINTY.manual!;
  const base = String(source).split(':')[0]!;
  return SOURCE_UNCERTAINTY[base] ?? DEFAULT_UNCERTAINTY;
}

export type IntakeRange = {
  low: number;
  high: number;
  /** Half-width as a fraction of the total — 0 for an empty day. */
  widthFraction: number;
};

/**
 * Sum each entry's calories ± its source's uncertainty. Entries from
 * tighter sources contribute narrower slices, so the day's range narrows
 * as capture quality improves — the whole point, visible.
 */
export function intakeRange(entries: readonly { calories: number; source?: string | null }[]): IntakeRange {
  let low = 0;
  let high = 0;
  let total = 0;
  for (const e of entries) {
    const kcal = Math.max(0, e.calories);
    const u = uncertaintyFor(e.source);
    low += kcal * (1 - u);
    high += kcal * (1 + u);
    total += kcal;
  }
  return {
    low: Math.round(low),
    high: Math.round(high),
    widthFraction: total > 0 ? (high - low) / (2 * total) : 0,
  };
}

/** The line under the hero: null when there is nothing logged. */
export function intakeRangeLine(entries: readonly { calories: number; source?: string | null }[]): string | null {
  const r = intakeRange(entries);
  if (r.high <= 0) return null;
  if (r.low === r.high) return null;
  return `likely ${r.low.toLocaleString('en-US')}–${r.high.toLocaleString('en-US')} kcal eaten · narrows as entries are weighed`;
}

export const INTAKE_RANGE_EXPLAINER =
  'Each entry carries the uncertainty of how it was captured: barcode ±5%, recipe ±10%, '
  + 'typed ±10%, database match ±15%, synced ±20%, photo or quick-add ±25%. '
  + 'The day’s range is the sum of every entry at its worst and best. A stated model, not a measurement.';
