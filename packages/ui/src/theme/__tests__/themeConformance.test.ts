import { describe, it, expect } from 'vitest';
import { THEMES, THEME_IDS, DEFAULT_THEME, type ThemeId } from '../themes';
import { INVARIANTS } from '../contract';
import { contrastRatio, relativeLuminance } from '../contrast';

const SURFACES = ['bg', 'surface', 'surface2'] as const;
// Object.keys() always types as string[] regardless of the record's key
// type — this cast is safe because "registry and id list agree" below
// asserts THEMES' keys are exactly THEME_IDS.
const ids = Object.keys(THEMES) as ThemeId[];

describe('theme contract conformance', () => {
  it.each(ids)('%s implements every contract key', (id) => {
    const t = THEMES[id];
    expect(Object.keys(t.surfaces).sort()).toEqual(
      ['bg', 'border', 'borderStrong', 'surface', 'surface2']);
    expect(Object.keys(t.text).sort()).toEqual(
      ['accent', 'carbs', 'faint', 'fat', 'ink', 'ink2', 'mute', 'protein', 'recovery', 'warn']);
    expect(Object.keys(t.fill).sort()).toEqual(
      ['accent', 'accentOn', 'carbs', 'faint', 'fat', 'mark', 'markOn', 'protein', 'recovery', 'warnBg']);
    expect(Object.keys(t.typography.scale).length).toBe(8);
    expect(t.shape.container).toBeDefined();
    expect(t.shape.elevation).toBeDefined();
    expect(t.expression.overCap).toBeDefined();
  });

  it('registry and id list agree, and the default exists', () => {
    expect([...THEME_IDS].sort()).toEqual(ids.sort());
    expect(THEMES[DEFAULT_THEME]).toBeDefined();
  });
});

describe('contrast invariants', () => {
  // Rendered type. This is the assertion that the pre-contract palette failed:
  // fat #BE5540 as over-cap TEXT scored 3.63 on surface2.
  it.each(ids)('%s: every text colour clears 4.5:1 on every surface', (id) => {
    const t = THEMES[id];
    for (const s of SURFACES) {
      for (const [key, value] of Object.entries(t.text)) {
        const r = contrastRatio(value, t.surfaces[s]);
        expect(
          { theme: id, token: `text.${key}`, on: s, ratio: Number(r.toFixed(2)) }
        ).toMatchObject({ ratio: expect.any(Number) });
        expect(r).toBeGreaterThanOrEqual(INVARIANTS.minTextContrast);
      }
    }
  });

  it.each(ids)('%s: every fill colour clears 3.0:1 on every surface', (id) => {
    const t = THEMES[id];
    // accentOn/markOn are text drawn ON the fill, not marks meant to read
    // against the app's background surfaces — they're checked against their
    // own fill below, in "every on-colour is readable on its own fill".
    const skip = new Set(['accentOn', 'markOn', 'warnBg']);
    for (const s of SURFACES) {
      for (const [key, value] of Object.entries(t.fill)) {
        if (skip.has(key)) continue;
        // A theme whose accent IS a surface cannot be tested as a mark on that surface.
        if (key === 'accent' && t.accentRole === 'ground') continue;
        expect(contrastRatio(value, t.surfaces[s]))
          .toBeGreaterThanOrEqual(INVARIANTS.minFillContrast);
      }
    }
  });

  // Regression guard. Brutalist's accent is a ground (yellow) and its mark is black.
  // Before `mark`/`markOn` existed, a filled button took its fill from the mark and its
  // label from accentOn — both black. Contrast ratio 1.0. Invisible.
  it.each(ids)('%s: every on-colour is readable on its own fill', (id) => {
    const t = THEMES[id];
    expect(contrastRatio(t.fill.accentOn, t.fill.accent))
      .toBeGreaterThanOrEqual(INVARIANTS.minTextContrast);
    expect(contrastRatio(t.fill.markOn, t.fill.mark))
      .toBeGreaterThanOrEqual(INVARIANTS.minTextContrast);
  });
});

describe('sizing invariants', () => {
  it.each(ids)('%s: no type step below 11', (id) => {
    for (const v of Object.values(THEMES[id].typography.scale)) {
      expect(v).toBeGreaterThanOrEqual(INVARIANTS.minFontSize);
    }
  });

  it.each(ids)('%s: tappable rows clear 48dp', (id) => {
    expect(THEMES[id].expression.rowMinHeight)
      .toBeGreaterThanOrEqual(INVARIANTS.minTapTarget);
  });

  it.each(ids)('%s: over-cap never relies on colour alone', (id) => {
    // 'color' would fail WCAG 1.4.1 and the honesty rule that over-cap is stated plainly.
    expect(THEMES[id].expression.overCap).not.toBe('color');
  });

  it.each(ids)('%s: luminance-picked status-bar icons are legible on bg', (id) => {
    // The app derives status-bar icon color from bg luminance (App.tsx).
    // Hardcoded light icons shipped once — invisible clock on the paper themes.
    const bg = THEMES[id].surfaces.bg;
    const icons = relativeLuminance(bg) > 0.5 ? '#000000' : '#ffffff';
    expect(contrastRatio(icons, bg)).toBeGreaterThanOrEqual(INVARIANTS.minTextContrast);
  });
});
