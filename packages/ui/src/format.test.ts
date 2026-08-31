import { describe, it, expect } from 'vitest';
import { groupInt, capState, fillPct, mmss, paceText, hoursMinutes, approxValue, kgText, overCapSuffix, resolveFontFamily } from './format';
// Deep path, not the './theme' barrel: the barrel re-exports typeface.ts,
// which imports typography.ts, which imports react-native — and vitest's
// parser can't handle react-native's own Flow-syntax source. themes/index
// itself is pure data with no such dependency.
import { THEMES, THEME_IDS, type ThemeId } from './theme/themes';

describe('groupInt', () => {
  it('groups thousands and rounds', () => {
    expect(groupInt(2340)).toBe('2,340');
    expect(groupInt(612.4)).toBe('612');
    expect(groupInt(8412)).toBe('8,412');
  });
});

describe('capState — the honest over-state', () => {
  it('states an over-cap plainly with the exact overage', () => {
    // The prototype's canonical case: 41 / 36 g · 5 over.
    expect(capState(41, 36)).toEqual({ over: true, overBy: 5, fillPct: 100 });
  });

  it('is not over at exactly the cap', () => {
    const s = capState(36, 36);
    expect(s.over).toBe(false);
    expect(s.overBy).toBe(0);
    expect(s.fillPct).toBe(100);
  });

  it('reports partial fill under the cap', () => {
    const s = capState(1.6, 2.3);
    expect(s.over).toBe(false);
    expect(s.fillPct).toBeCloseTo(69.57, 1);
  });

  it('never reads "0 over" from display rounding', () => {
    // 36.04 displays as 36 — must not claim "over".
    expect(capState(36.04, 36).over).toBe(false);
  });
});

describe('fillPct', () => {
  it('clamps to 0–100', () => {
    expect(fillPct(142, 180)).toBeCloseTo(78.9, 1);
    expect(fillPct(200, 100)).toBe(100);
    expect(fillPct(-5, 100)).toBe(0);
  });
  it('handles a zero target without dividing by zero', () => {
    expect(fillPct(10, 0)).toBe(100);
    expect(fillPct(0, 0)).toBe(0);
  });
});

describe('mmss', () => {
  it('formats rest-timer style', () => {
    expect(mmss(84)).toBe('01:24');
    expect(mmss(0)).toBe('00:00');
    expect(mmss(600)).toBe('10:00');
  });
  it('never goes negative', () => {
    expect(mmss(-5)).toBe('00:00');
  });
});

describe('paceText', () => {
  it('formats seconds-per-km as M:SS', () => {
    expect(paceText(544)).toBe('9:04');
    expect(paceText(522)).toBe('8:42');
  });
  it('shows an em dash for unusable input instead of a fake number', () => {
    expect(paceText(0)).toBe('—');
    expect(paceText(NaN)).toBe('—');
    expect(paceText(Infinity)).toBe('—');
  });
});

describe('hoursMinutes', () => {
  it('splits sleep minutes', () => {
    expect(hoursMinutes(441)).toEqual({ h: 7, m: 21 });
    expect(hoursMinutes(0)).toEqual({ h: 0, m: 0 });
  });
});

describe('approxValue — the ~ rule', () => {
  it('wears the tilde until confirmed', () => {
    expect(approxValue(612, false)).toBe('~612');
    expect(approxValue(612, true)).toBe('612');
  });
});

describe('kgText', () => {
  it('drops fake decimals on whole values, keeps one on real ones', () => {
    expect(kgText(81.4)).toBe('81.4');
    expect(kgText(75)).toBe('75');
    expect(kgText(72.5)).toBe('72.5');
  });
});

// CapRow (packages/ui/src/components/macro.tsx) is the first component
// reading from the theme contract — this is the "does the contract
// actually work" test for its overCap branching, exercised for every
// theme's real value rather than eyeballed on-device per theme.
describe('overCapSuffix', () => {
  const fmt = (n: number) => n.toFixed(0);

  it('never appends anything when not over', () => {
    for (const style of ['all', 'word', 'fill', 'color'] as const) {
      expect(overCapSuffix(false, style, 5, fmt)).toBe('');
    }
  });

  it("'all' states the numeric delta", () => {
    expect(overCapSuffix(true, 'all', 5, fmt)).toBe(' · 5 over');
  });

  it("'word' states plainly, no delta", () => {
    expect(overCapSuffix(true, 'word', 5, fmt)).toBe(' — over');
  });

  it("'fill' carries the over-state through the fill alone — no text", () => {
    expect(overCapSuffix(true, 'fill', 5, fmt)).toBe('');
  });

  it("'color' (contractually forbidden, but the type allows it structurally) degrades to no text — never silently drops the visual fill/bar signal it would otherwise rely on alone", () => {
    expect(overCapSuffix(true, 'color', 5, fmt)).toBe('');
  });

  describe('against every real theme value', () => {
    const ids = Object.keys(THEMES) as ThemeId[];
    it.each(ids)('%s produces a non-empty suffix only for all/word', (id) => {
      const style = THEMES[id].expression.overCap;
      const suffix = overCapSuffix(true, style, 5, fmt);
      if (style === 'all' || style === 'word') {
        expect(suffix.length).toBeGreaterThan(0);
      } else {
        expect(suffix).toBe('');
      }
    });

    it('registry agrees with THEME_IDS (sanity — same guard as themeConformance)', () => {
      expect([...THEME_IDS].sort()).toEqual(ids.sort());
    });
  });
});

// resolveFontFamily is the Google-Fonts-naming half of resolveTypeface
// (packages/ui/src/theme/typeface.ts) — split out here because it's the
// pure part (no react-native import), so it's the part that can actually
// be unit-tested. The 'System'/'Mono' sentinel handling that wraps this
// lives in typeface.ts and isn't independently testable under this
// package's plain-Node vitest (see the deep-import note above).
describe('resolveFontFamily — bundled weight-specific family resolution', () => {
  // The exact named exports @expo-google-fonts/* ships for every weight a
  // theme actually references (confirmed against node_modules/@expo-google-
  // fonts/*/index.d.ts) — a mismatch here means expo-font won't find the
  // font and RN silently falls back to the system default.
  const INSTALLED = new Set([
    'Nunito_400Regular', 'Nunito_700Bold', 'Nunito_800ExtraBold',
    'Barlow_400Regular', 'Barlow_600SemiBold', 'Barlow_700Bold',
    'BarlowCondensed_400Regular', 'BarlowCondensed_600SemiBold', 'BarlowCondensed_700Bold',
    'Archivo_400Regular', 'Archivo_600SemiBold', 'Archivo_900Black',
    'ArchivoBlack_400Regular',
    'Manrope_400Regular', 'Manrope_600SemiBold', 'Manrope_800ExtraBold',
    'Jost_300Light', 'Jost_400Regular', 'Jost_500Medium',
    'IBMPlexMono_300Light', 'IBMPlexMono_400Regular', 'IBMPlexMono_500Medium',
    'CormorantGaramond_300Light', 'CormorantGaramond_400Regular', 'CormorantGaramond_500Medium',
  ]);

  it('builds the {Family}_{weight}{WeightName} string expo-font registers', () => {
    expect(resolveFontFamily('Nunito', 700)).toBe('Nunito_700Bold');
    expect(resolveFontFamily('Barlow Condensed', 600)).toBe('BarlowCondensed_600SemiBold');
    expect(resolveFontFamily('IBM Plex Mono', 300)).toBe('IBMPlexMono_300Light');
    expect(resolveFontFamily('Cormorant Garamond', 500)).toBe('CormorantGaramond_500Medium');
  });

  it('Archivo Black always resolves to its one shipped weight, regardless of the number requested', () => {
    expect(resolveFontFamily('Archivo Black', 400)).toBe('ArchivoBlack_400Regular');
    expect(resolveFontFamily('Archivo Black', 600)).toBe('ArchivoBlack_400Regular');
    expect(resolveFontFamily('Archivo Black', 900)).toBe('ArchivoBlack_400Regular');
  });

  describe('against every real theme value', () => {
    const ids = Object.keys(THEMES) as ThemeId[];
    const cases = ids.flatMap((id) => {
      const t = THEMES[id].typography;
      const roles: ('ui' | 'data' | 'display')[] = ['ui', 'data', 'display'];
      const weights: ('regular' | 'medium' | 'bold')[] = ['regular', 'medium', 'bold'];
      return roles.flatMap((role) =>
        weights
          .filter(() => t[role] !== 'System' && t[role] !== 'Mono') // sentinels are typeface.ts's job, not this function's
          .map((weightRole) => ({ id, role, family: t[role], weight: t.weight[weightRole] })),
      );
    });

    it.each(cases)('$id: $family @ $weight resolves to an installed font', ({ family, weight }) => {
      const resolved = resolveFontFamily(family, weight);
      expect(INSTALLED.has(resolved)).toBe(true);
    });
  });
});
