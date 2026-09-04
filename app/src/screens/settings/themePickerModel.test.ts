import { describe, it, expect } from 'vitest';
import { THEME_IDS, THEMES, type ThemeId } from '@basalt/ui/src/theme/themes';
import {
  initialPicker, selectTheme, discard, confirmTheme, isTicked,
  strapFor, usesLine, rowAccessibilityLabel,
  SAMPLE_PREVIEW, previewDataFrom, previewCacheKey, previewPlan,
} from './themePickerModel';

const CURRENT: ThemeId = 'minimal';

describe('theme picker selection — nothing restyles until Confirm', () => {
  it('select stages a theme; the tick appears only on that row', () => {
    const s = selectTheme(initialPicker, 'clay', CURRENT);
    expect(s.selected).toBe('clay');
    expect(isTicked(s, 'clay')).toBe(true);
    for (const id of THEME_IDS.filter((t) => t !== 'clay')) {
      expect(isTicked(s, id)).toBe(false);
    }
  });

  it('reselecting another row replaces the staged selection', () => {
    let s = selectTheme(initialPicker, 'clay', CURRENT);
    s = selectTheme(s, 'gummy', CURRENT);
    expect(s.selected).toBe('gummy');
    expect(isTicked(s, 'clay')).toBe(false);
  });

  it('tapping the current theme clears the selection', () => {
    let s = selectTheme(initialPicker, 'soft', CURRENT);
    s = selectTheme(s, CURRENT, CURRENT);
    expect(s.selected).toBeNull();
  });

  it('tapping the staged row again clears it', () => {
    let s = selectTheme(initialPicker, 'soft', CURRENT);
    s = selectTheme(s, 'soft', CURRENT);
    expect(s.selected).toBeNull();
  });

  it('back discards the staged selection', () => {
    const s = discard(selectTheme(initialPicker, 'sticker', CURRENT));
    expect(s.selected).toBeNull();
    expect(confirmTheme(s)).toBeNull();
  });

  it('confirm returns the staged theme to persist', () => {
    const s = selectTheme(initialPicker, 'candyRings', CURRENT);
    expect(confirmTheme(s)).toBe('candyRings');
  });
});

describe('row metadata — derived from tokens for every theme, no throwing', () => {
  it.each([...THEME_IDS])('%s: strap, uses line and a11y label derive cleanly', (id) => {
    expect(strapFor(id)).toMatch(/ · /);
    const uses = usesLine(id);
    if (uses !== null) expect(uses).toMatch(/^Uses: /);
    expect(rowAccessibilityLabel(id, initialPicker, CURRENT)).toContain(THEMES[id].name);
  });

  it('the six originals declare no theme-scoped expression; the five do', () => {
    for (const id of ['minimal', 'humanist', 'athletic', 'brutalist', 'depth', 'atelier'] as const) {
      expect(usesLine(id)).toBeNull();
    }
    expect(usesLine('clay')).toContain('clay shadows');
    expect(usesLine('clay')).toContain('pastel domain grounds');
    expect(usesLine('sticker')).toContain('sticker halo');
    expect(usesLine('sticker')).toContain('tilt');
    expect(usesLine('gummy')).toContain('gloss');
    expect(usesLine('gummy')).toContain('gradients');
    expect(usesLine('soft')).toContain('soft shadows');
    expect(usesLine('soft')).toContain('dial meter');
    expect(usesLine('candyRings')).toContain('ring meters');
  });
});

describe('preview data — user numbers or the labelled sample', () => {
  it('an empty day falls back to the sample, and says so', () => {
    const d = previewDataFrom({
      calories: 0, targetCalories: 2794,
      protein: 0, proteinTarget: 210, carbs: 0, carbsTarget: 279,
      fat: 0, fatTarget: 93, entries: [],
    });
    expect(d).toEqual(SAMPLE_PREVIEW);
    expect(d.sample).toBe(true);
    // The sample carries the honest over-cap state the mockups use.
    expect(d.fat.value).toBeGreaterThan(d.fat.cap);
  });

  it("a real day uses the user's own numbers, unlabelled", () => {
    const d = previewDataFrom({
      calories: 3489, targetCalories: 2794,
      protein: 212, proteinTarget: 210, carbs: 386, carbsTarget: 279,
      fat: 107, fatTarget: 93,
      entries: [{ name: 'Oats & banana', kcal: 420 }, { name: 'Chicken & rice bowl', kcal: 610 }, { name: 'Extra', kcal: 1 }],
    });
    expect(d.sample).toBe(false);
    expect(d.over).toBe(true);
    expect(d.remaining).toBe(695);
    expect(d.rows).toHaveLength(2);
  });

  it.each([...THEME_IDS])('%s: the preview plan derives without throwing, fractions clamped', (id) => {
    const overDay = { ...SAMPLE_PREVIEW, remaining: 695, over: true, sample: false };
    for (const d of [SAMPLE_PREVIEW, overDay]) {
      const p = previewPlan(id, d);
      expect(['ring', 'dial', 'numeral']).toContain(p.meter);
      for (const f of [p.energyFrac, p.proteinFrac, p.carbsFrac]) {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      }
      // Over-cap is stated in words on EVERY meter variant, never colour-only.
      if (d.over) expect(p.heroLabel).toContain('over');
    }
  });

  it('the cache key changes when the totals change', () => {
    const a = previewDataFrom({
      calories: 1000, targetCalories: 2794, protein: 50, proteinTarget: 210,
      carbs: 100, carbsTarget: 279, fat: 30, fatTarget: 93, entries: [{ name: 'x', kcal: 1000 }],
    });
    const b = { ...a, protein: { ...a.protein, value: 60 } };
    expect(previewCacheKey('clay', a)).not.toBe(previewCacheKey('clay', b));
    expect(previewCacheKey('clay', a)).not.toBe(previewCacheKey('gummy', a));
  });
});
