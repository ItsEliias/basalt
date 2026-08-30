import { describe, it, expect } from 'vitest';
import { color, accents, radius, type } from './tokens';

// The design contract is binding — these tests pin the exact palette and
// type scale so a well-meaning "brightness tweak" or "just shave a point
// off this label" can never slip through review unnoticed. Updated by the
// 2026-08-22 legibility & navigation revision (device feedback: too small,
// too dim, too fiddly to tap) — this is the current contract, not a
// deviation from it.

describe('palette pins (design contract §1)', () => {
  it('core surfaces', () => {
    expect(color.bg).toBe('#0F1115');
    expect(color.surface).toBe('#16181D');
    expect(color.surface2).toBe('#1B1E24');
    expect(color.border).toBe('#262B34');
    expect(color.border2).toBe('#2A2F38');
  });

  it('ink ramp', () => {
    expect(color.ink).toBe('#F4F5F6');
    expect(color.ink2).toBe('#C2C8D2');
    expect(color.mute).toBe('#9AA3AF');
    expect(color.faint).toBe('#7A828E');
  });

  it('the four CVD-validated accents — and only four', () => {
    expect(color.protein).toBe('#C08432');
    expect(color.carbs).toBe('#3E9B78');
    expect(color.fat).toBe('#BE5540');
    expect(color.recovery).toBe('#5E72E4');
    expect(accents).toHaveLength(4);
  });

  it('sleep-stage ramp', () => {
    expect(color.recoveryDeep).toBe('#3B4BC8');
    expect(color.recoveryLight).toBe('#8B99F0');
    expect(color.awake).toBe('#3A4048');
  });

  it('no new radii beyond the contract', () => {
    expect(radius.card).toBe(14);
    expect(radius.input).toBe(12);
    expect(radius.timer).toBe(10);
  });
});

describe('type scale pins (design contract §2, legibility revision)', () => {
  it('type floor is 11 except the two named exceptions', () => {
    expect(type.body.fontSize).toBe(14);
    expect(type.rowName.fontSize).toBe(14);
    expect(type.rowMeta.fontSize).toBe(11.5);
    expect(type.rowValue.fontSize).toBe(15);
    expect(type.microLabel.fontSize).toBe(11);
    expect(type.chip.fontSize).toBe(11);
    expect(type.seg.fontSize).toBe(11);
    // Named exceptions — deliberately below the 11 floor, still a full
    // step up from their pre-revision values (9.5).
    expect(type.srcNote.fontSize).toBe(10.5);
    expect(type.tab.fontSize).toBe(10.5);
  });

  it('srcnote line-height was bumped alongside its size', () => {
    expect(type.srcNote.lineHeight).toBe(15);
  });

  it('hero and guided numerals are unchanged — never the legibility problem', () => {
    expect(type.hero.fontSize).toBe(50);
    expect(type.guidedNum.fontSize).toBe(64);
  });
});

// WCAG relative-luminance contrast ratio — same formula as the W3C spec
// (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance /
// #dfn-contrast-ratio). Kept local rather than pulling in a dependency:
// it's ~15 lines and this is the one place in the repo that needs it.
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('contrast floor (design contract §1, legibility revision)', () => {
  const backgrounds = [color.bg, color.surface] as const;
  const textTokens = [
    ['ink', color.ink],
    ['ink2', color.ink2],
    ['mute', color.mute],
    ['faint', color.faint],
  ] as const;

  it.each(textTokens)('%s clears 4.5:1 on both bg and surface', (_name, hex) => {
    for (const bg of backgrounds) {
      expect(contrastRatio(hex, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('faint is the tightest margin by design — verify it is not accidentally generous or razor-thin', () => {
    const onBg = contrastRatio(color.faint, color.bg);
    const onSurface = contrastRatio(color.faint, color.surface);
    expect(onSurface).toBeLessThan(onBg); // surface is the harder background — confirms we tested the right constraint
    expect(onSurface).toBeGreaterThanOrEqual(4.5);
    expect(onSurface).toBeLessThan(5.5); // sanity: still "faint," not accidentally promoted to mute-level contrast
  });
});
