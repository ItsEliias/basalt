import type { Theme } from './contract';

// Sleep-stage fills, derived from the theme instead of the static Minimal
// palette. Stages are display-only by law (they never feed a score), so a
// deterministic ramp off `fill.recovery` is enough — the contract doesn't
// grow four tokens for a strictly decorative chart.

function mix(hex: string, withHex: string, amount: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(hex);
  const [r2, g2, b2] = p(withHex);
  const c = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return (
    '#' +
    [c(r1!, r2!), c(g1!, g2!), c(b1!, b2!)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

export type SleepStage = 'deep' | 'light' | 'rem' | 'awake' | 'sleeping' | 'unknown';

/** Indigo ramp + awake gray, per theme: deep darkest, rem the accent, light lightest. */
export function sleepStagePalette(theme: Theme): Record<SleepStage, string> {
  const rem = theme.fill.recovery;
  const deep = mix(rem, '#000000', 0.35);
  const light = mix(rem, '#ffffff', 0.45);
  const awake = theme.surfaces.borderStrong;
  return { deep, light, rem, awake, sleeping: light, unknown: awake };
}
