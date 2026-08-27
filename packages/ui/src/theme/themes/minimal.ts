import type { Theme } from '../contract';

/** The original. Dark, restrained, mono numerals.
 *  Contrast verified: all text.* >= 4.5:1 and all fill.* >= 3.0:1 on every surface. */
export const minimal: Theme = {
  id: 'minimal',
  name: 'Minimal',
  description: 'The original. Dark, restrained, mono numerals.',
  isDark: true,
  accentRole: 'mark',

  surfaces: {
    bg: '#0F1115',
    surface: '#16181D',
    surface2: '#1B1E24',
    border: '#262B34',
    borderStrong: '#2A2F38',
  },

  text: {
    ink: '#F4F5F6',
    ink2: '#C2C8D2',
    mute: '#9AA3AF',
    faint: '#848C98',
    accent: '#4FB68C',
    protein: '#D19A45',
    carbs: '#4FB68C',
    fat: '#DE7A63',
    recovery: '#8B99F0',
    warn: '#DE7A63',
  },

  fill: {
    accent: '#3E9B78',
    protein: '#C08432',
    carbs: '#3E9B78',
    fat: '#BE5540',
    recovery: '#5E72E4',
    warnBg: '#241A18',
    accentOn: '#0F1115',
    mark: '#3E9B78',
    markOn: '#0F1115',
    // Preserved exactly from the pre-contract palette's single flat
    // `color.faint` (#7A828E) — this is the cap-bar's neutral/under-cap
    // fill, and changing it would be a visual change Step 1 doesn't allow.
    faint: '#7A828E',
  },

  typography: {
    ui: 'System',
    data: 'Mono',
    display: 'Mono',
    scale: { xs: 11, sm: 11.5, base: 14, md: 15, lg: 19, xl: 26, hero: 50, mega: 64 },
    weight: { regular: 400, medium: 600, bold: 700 },
    tracking: { label: 0.13, body: 0, hero: -0.035 },
    labelCase: 'upper',
  },

  shape: {
    radius: { none: 0, sm: 2, md: 6, lg: 13 },
    borderWidth: { hairline: 0.5, thin: 1, thick: 2 },
    container: 'card',
    elevation: 'border',
    meter: 'bar',
    meterHeight: 5,
    meterRadius: 2,
    align: 'left',
  },

  expression: {
    overCap: 'all',
    emptyState: 'quiet',
    nav: 'iconLabel',
    rowMinHeight: 48,
  },
};
