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

/**
 * Which face the Ledger hero card wears. With numbers hidden the card must
 * stay qualitative — it must never fall through to the no-targets onboarding
 * prompt while targets exist (shipped once as exactly that bug).
 */
export type LedgerHeroMode = 'numeric' | 'qualitative' | 'no-targets';

export function ledgerHeroMode(hasHero: boolean, hideNumbers: boolean): LedgerHeroMode {
  if (hasHero && hideNumbers) return 'qualitative';
  if (hasHero) return 'numeric';
  return 'no-targets';
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

export type TileSpec = {
  key: string;
  span: 'full' | 'half';
  label: string;
  value?: string;
  unit?: string;
  source?: string;
  over?: boolean;
  empty?: boolean;
  emptyMessage?: string;
};

/**
 * The Tiles Today layout's fixed v1 content model (docs/basalt-layouts.md
 * §"Tiles content model (fixed in v1)"). Same rule everywhere: real-or-
 * hidden — a metric with no data shows its own honest empty state, never
 * a zero; a metric the user switched off is removed from the grid
 * entirely, not shown empty. Pure so the fixed set can be tested without
 * rendering — the screen only assembles the raw values.
 */
export function todayTileSpecs(input: {
  hero: HeroModel | null;
  hideNumbers: boolean;
  targets: TargetsRecord | null;
  totals: DailyTotals;
  steps: number | null;
  sleepHours: number | null;
  waterMl: number;
  waterTargetMl: number;
  hydrationEnabled: boolean;
  trainingTitle: string | null;
}): TileSpec[] {
  const tiles: TileSpec[] = [];

  // 1 — Energy remaining, full, always present.
  if (input.hero && !input.hideNumbers) {
    tiles.push({
      key: 'energy', span: 'full', label: 'Energy remaining',
      value: Math.round(input.hero.remaining).toLocaleString('en-US'),
      unit: input.hero.over ? 'kcal over' : 'kcal',
      over: input.hero.over,
    });
  } else {
    tiles.push({
      key: 'energy', span: 'full', label: 'Energy', empty: true,
      emptyMessage: input.hideNumbers
        ? 'Numbers hidden at your request — still recorded, just not shown.'
        : 'No daily targets yet — finish onboarding in Settings → Profile.',
    });
  }

  // 2 — Protein, half, hide if no target set (not an empty state: absent).
  if (input.targets && !input.hideNumbers) {
    tiles.push({
      key: 'protein', span: 'half', label: 'Protein',
      value: String(Math.round(input.totals.protein)),
      unit: `of ${Math.round(input.targets.proteinG)} g`,
    });
  }

  // 3 — Steps, half, honest empty state if no source.
  tiles.push(
    input.steps !== null
      ? { key: 'steps', span: 'half', label: 'Steps', value: input.steps.toLocaleString('en-US') }
      : { key: 'steps', span: 'half', label: 'Steps', empty: true, emptyMessage: 'No step source connected.' },
  );

  // 4 — Sleep, half, honest empty state if no source.
  if (input.sleepHours !== null) {
    const h = Math.floor(input.sleepHours);
    const m = Math.round((input.sleepHours - h) * 60);
    tiles.push({ key: 'sleep', span: 'half', label: 'Sleep', value: `${h}:${String(m).padStart(2, '0')}` });
  } else {
    tiles.push({ key: 'sleep', span: 'half', label: 'Sleep', empty: true, emptyMessage: 'No sleep source connected.' });
  }

  // 5 — Water, half, hide if hydration disabled (not an empty state: absent).
  // Zero logged is "nothing yet", never a placeholder 0 — real or hidden.
  if (input.hydrationEnabled) {
    if (input.waterMl > 0) {
      tiles.push({
        key: 'water', span: 'half', label: 'Water',
        value: Math.round(input.waterMl).toLocaleString('en-US'),
        unit: `/ ${Math.round(input.waterTargetMl).toLocaleString('en-US')} ml`,
      });
    } else {
      tiles.push({
        key: 'water', span: 'half', label: 'Water', empty: true,
        emptyMessage: `Nothing logged yet · ${Math.round(input.waterTargetMl).toLocaleString('en-US')} ml`,
      });
    }
  }

  // 6 — Training, full, "Rest day" or the session name — never absent,
  // never empty-state (a rest day is real information, not missing data).
  tiles.push({ key: 'training', span: 'full', label: 'Training', value: input.trainingTitle ?? 'Rest day' });

  return tiles;
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

// Micronutrient DETAIL (V3.1 stretch) — the full wall behind the top-8
// card. Same law, more rows: a nutrient exists only where source data
// exists; amounts sum only when every contributing entry agrees on the
// unit — mixed units keep the %-of-target and omit the amount rather
// than inventing a conversion.
export type MicroDetail = {
  name: string;
  pct: number;
  /** Summed amount + unit — null when contributing units disagree. */
  amount: number | null;
  unit: string | null;
  /** How many of the day's entries carried source data for this nutrient. */
  fromEntries: number;
};

export function microDetail(entries: FoodEntryRow[]): MicroDetail[] {
  const acc = new Map<string, { pct: number; amount: number; unit: string | null; mixed: boolean; n: number }>();
  for (const e of entries) {
    if (!e.micros) continue;
    for (const [name, v] of Object.entries(e.micros)) {
      if (typeof v?.pctTarget !== 'number' || !isFinite(v.pctTarget)) continue;
      const cur = acc.get(name) ?? { pct: 0, amount: 0, unit: null, mixed: false, n: 0 };
      cur.pct += v.pctTarget;
      cur.n += 1;
      if (typeof v.amount === 'number' && isFinite(v.amount) && v.unit) {
        if (cur.unit === null && !cur.mixed) cur.unit = v.unit;
        if (cur.unit === v.unit) cur.amount += v.amount;
        else { cur.mixed = true; cur.unit = null; }
      } else {
        cur.mixed = true;
        cur.unit = null;
      }
      acc.set(name, cur);
    }
  }
  return Array.from(acc.entries())
    .map(([name, c]) => ({
      name,
      pct: Math.round(c.pct),
      amount: c.mixed || c.unit === null ? null : Math.round(c.amount * 10) / 10,
      unit: c.mixed ? null : c.unit,
      fromEntries: c.n,
    }))
    .sort((a, b) => b.pct - a.pct);
}

// ── Tile hide/show (V3 Phase 5) ─────────────────────────────────────
// Hiding is OMISSION: a hidden section renders nothing at all — never a
// ghost, never a locked placeholder. The energy hero is the day's anchor
// and cannot be hidden; everything else is the user's call.

export const HIDEABLE_SECTIONS = [
  { key: 'macros', label: 'Macros & caps' },
  { key: 'meals', label: 'Logged meals' },
  { key: 'micros', label: 'Micronutrients' },
  { key: 'steps', label: 'Steps' },
  { key: 'sleep', label: 'Sleep tile' },
  { key: 'water', label: 'Water' },
  { key: 'training', label: 'Training tile' },
] as const;

export type HideableSection = (typeof HIDEABLE_SECTIONS)[number]['key'];

/** Tiles-layout keys fold into the same registry (macros covers P/C/F). */
export function sectionForTile(tileKey: string): string {
  return tileKey === 'protein' || tileKey === 'carbs' || tileKey === 'fat' ? 'macros' : tileKey;
}

export function filterTiles(tiles: TileSpec[], hidden: ReadonlySet<string>): TileSpec[] {
  return tiles.filter((t) => t.key === 'energy' || !hidden.has(sectionForTile(t.key)));
}
