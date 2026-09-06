import type { Theme } from '../contract';

/** Concentric rings — warm brights on white, bare container (mockup B2).
 *  Declares: meter 'ring' (energy/protein/carbs nested; fat NEVER rings —
 *  it lives in the warn strip in words, which conformance enforces via
 *  overCap 'all'). */
export const candyRings: Theme = {
  id: 'candyRings',
  name: 'Candy Rings',
  description: 'Nested rings, warm brights on white.',
  isDark: false,
  accentRole: 'mark',

  surfaces: {
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    surface2: '#F6F4FA',
    border: '#EFEDF4',
    borderStrong: '#D9D5E6',
  },

  text: {
    ink: '#2B2438',
    ink2: '#443C58',
    mute: '#575070',
    faint: '#5D5670',
    accent: '#C22E5E',
    protein: '#8A5A00',
    carbs: '#136B50',
    fat: '#A83415',
    recovery: '#2E4E9E',
    warn: '#A83415',
  },

  fill: {
    accent: '#C73362',
    protein: '#B87700',
    carbs: '#178F6B',
    fat: '#D9553C',
    recovery: '#4E6FD8',
    warnBg: '#FFF1E6',
    accentOn: '#FFFFFF',
    mark: '#C73362',
    markOn: '#FFFFFF',
    faint: '#837C96',
  },

  typography: {
    ui: 'Fredoka',
    data: 'Fredoka',
    display: 'Fredoka',
    scale: { xs: 11, sm: 12.5, base: 14, md: 16, lg: 22, xl: 28, hero: 44, mega: 56 },
    weight: { regular: 500, medium: 600, bold: 700 },
    tracking: { label: 0.02, body: 0, hero: 0 },
    labelCase: 'none',
  },

  shape: {
    radius: { none: 0, sm: 12, md: 16, lg: 18, pill: 999 },
    tilt: 0,
    borderWidth: { hairline: 1, thin: 1, thick: 2 },
    container: 'bare',
    elevation: 'none',
    meter: 'ring',
    meterHeight: 11,
    meterRadius: 99,
    align: 'left',
  },

  expression: {
    overCap: 'all',
    emptyState: 'quiet',
    nav: 'label',
    rowMinHeight: 48,
  },
};
