// Deep imports keep this module (and its tests) free of react-native —
// the ui barrel re-exports RN components a Node test runner can't parse.
import { THEMES, type ThemeId } from '@basalt/ui/src/theme/themes';
import type { Theme } from '@basalt/ui/src/theme/contract';

// Pure logic for the theme picker (Settings › Appearance › Theme, and the
// onboarding step). Selection is staged: NOTHING restyles until Confirm.

// ── Selection state machine ─────────────────────────────────────────────

export type PickerState = { selected: ThemeId | null };

export const initialPicker: PickerState = { selected: null };

/**
 * Tap a row. Tapping the CURRENT theme (or the already-selected row) clears
 * the staged selection; tapping any other theme stages it.
 */
export function selectTheme(state: PickerState, id: ThemeId, current: ThemeId): PickerState {
  if (id === current || id === state.selected) return { selected: null };
  return { selected: id };
}

/** Back discards whatever was staged. */
export function discard(_state: PickerState): PickerState {
  return { selected: null };
}

/** Confirm returns what to persist (null = nothing staged, no-op). */
export function confirmTheme(state: PickerState): ThemeId | null {
  return state.selected;
}

/** The tick renders only on the staged row. */
export function isTicked(state: PickerState, id: ThemeId): boolean {
  return state.selected === id;
}

// ── Row metadata — derived from tokens, never hand-written per row ──────

/** One-word character, derived from the theme's own declarations. */
function characterWord(t: Theme): string {
  if (t.shape.elevation === 'clay') return 'claymorphism';
  if (t.shape.elevation === 'halo') return 'die-cut';
  if (t.shape.elevation === 'gloss') return t.isDark ? 'glossy dark' : 'glossy';
  if (t.shape.elevation === 'softShadow') return 'neumorphic';
  if (t.shape.meter === 'ring') return 'rings';
  if (t.shape.meter === 'dial') return 'dial';
  if (t.shape.elevation === 'blur') return 'depth';
  if (t.shape.elevation === 'hardShadow') return 'hard edges';
  if (t.typography.data === 'Mono' || /mono/i.test(t.typography.data)) return 'mono';
  if (t.typography.data === t.typography.ui && t.shape.meter === 'pill') return 'rounded';
  return 'condensed';
}

/** "typeface · one-word character" — the row strap. */
export function strapFor(id: ThemeId): string {
  const t = THEMES[id];
  const face = (t.typography.display !== t.typography.ui ? t.typography.display : t.typography.ui).toLowerCase();
  return `${face === 'mono' ? 'platform mono' : face} · ${characterWord(t)}`;
}

/**
 * The `Uses:` line — which THEME-SCOPED expressions this theme declares.
 * Derived from the tokens so it can never drift from what actually renders.
 * Returns null when a theme declares none (the six originals).
 */
export function usesLine(id: ThemeId): string | null {
  const t = THEMES[id];
  const uses: string[] = [];
  if (t.shape.elevation === 'softShadow') uses.push('soft shadows');
  if (t.shape.elevation === 'clay') uses.push('clay shadows');
  if (t.shape.elevation === 'halo') uses.push('sticker halo', 'hard offsets');
  if (t.shape.elevation === 'gloss') uses.push('gloss');
  if (t.surfaces.gradient) uses.push('gradients');
  if (t.shape.tilt !== 0) uses.push('tilt');
  if (t.shape.meter === 'ring') uses.push('ring meters');
  if (t.shape.meter === 'dial') uses.push('dial meter');
  if (t.fill.domainGround) uses.push('pastel domain grounds');
  return uses.length > 0 ? `Uses: ${uses.join(', ')}` : null;
}

/** The full accessibility label for a row. */
export function rowAccessibilityLabel(id: ThemeId, state: PickerState, current: ThemeId): string {
  const t = THEMES[id];
  const status = isTicked(state, id) ? 'selected' : id === current ? 'current theme' : 'not selected';
  return `${t.name} theme, ${t.description} ${status}`;
}

// ── Preview data — the user's own numbers, or the labelled sample ───────

export type PreviewData = {
  remaining: number;
  over: boolean;
  target: number;
  protein: { value: number; target: number };
  carbs: { value: number; target: number };
  fat: { value: number; cap: number };
  rows: { name: string; kcal: number }[];
  sample: boolean;
};

/** The mockups' Today numbers — used when the user's day is empty. */
export const SAMPLE_PREVIEW: PreviewData = {
  remaining: 2029,
  over: false,
  target: 2800,
  protein: { value: 142, target: 180 },
  carbs: { value: 210, target: 240 },
  fat: { value: 41, cap: 36 },
  rows: [
    { name: 'Almonds', kcal: 85 },
    { name: 'Jasmine rice', kcal: 195 },
  ],
  sample: true,
};

export function previewDataFrom(input: {
  calories: number;
  targetCalories: number;
  protein: number; proteinTarget: number;
  carbs: number; carbsTarget: number;
  fat: number; fatTarget: number;
  entries: { name: string; kcal: number }[];
}): PreviewData {
  if (input.calories <= 0 && input.entries.length === 0) return SAMPLE_PREVIEW;
  const remaining = Math.round(input.targetCalories - input.calories);
  return {
    remaining: Math.abs(remaining),
    over: remaining < 0,
    target: Math.round(input.targetCalories),
    protein: { value: Math.round(input.protein), target: Math.round(input.proteinTarget) },
    carbs: { value: Math.round(input.carbs), target: Math.round(input.carbsTarget) },
    fat: { value: Math.round(input.fat), cap: Math.round(input.fatTarget) },
    rows: input.entries.slice(0, 2).map((e) => ({ name: e.name, kcal: Math.round(e.kcal) })),
    sample: false,
  };
}

/**
 * Preview-image cache key: theme + the numbers the preview shows. When the
 * day's totals change, the key changes and the shot re-captures.
 */
export function previewCacheKey(id: ThemeId, d: PreviewData): string {
  return `${id}:${d.sample ? 'sample' : `${d.remaining}-${d.protein.value}-${d.carbs.value}-${d.fat.value}-${d.rows.length}`}`;
}

// ── Preview render plan — everything the mini-Today branches on ─────────

export type PreviewPlan = {
  meter: 'ring' | 'dial' | 'numeral';
  energyFrac: number;
  proteinFrac: number;
  carbsFrac: number;
  /** Over-cap is stated in WORDS on every meter variant — honesty law. */
  heroLabel: string;
};

/** Pure per-theme plan for TodayMiniPreview; must never throw for any theme. */
export function previewPlan(id: ThemeId, d: PreviewData): PreviewPlan {
  const t = THEMES[id];
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const consumed = d.over ? d.target + d.remaining : d.target - d.remaining;
  const meter = t.shape.meter === 'ring' ? 'ring' : t.shape.meter === 'dial' ? 'dial' : 'numeral';
  return {
    meter,
    energyFrac: clamp(consumed / Math.max(1, d.target)),
    proteinFrac: clamp(d.protein.value / Math.max(1, d.protein.target)),
    carbsFrac: clamp(d.carbs.value / Math.max(1, d.carbs.target)),
    heroLabel: meter === 'ring' ? (d.over ? 'over' : 'left') : d.over ? 'kcal over' : meter === 'dial' ? 'kcal left' : 'kcal',
  };
}
