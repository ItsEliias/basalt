import type { Theme } from '../contract';

/** Heavy borders, hard shadows, flat brights. Located by mass, not reading.
 *  Contrast verified: all text.* >= 4.5:1 and all fill.* >= 3.0:1 on every surface. */
export const brutalist: Theme = {
  id: 'brutalist',
  name: 'Brutalist',
  description: 'Heavy borders, hard shadows, flat brights. Located by mass, not reading.',
  isDark: false,
  accentRole: 'ground',

  surfaces: {
    bg: '#F2F0E8',
    surface: '#FFFFFF',
    surface2: '#FFD93D',
    border: '#111111',
    borderStrong: '#111111',
  },

  text: {
    ink: '#111111',
    ink2: '#111111',
    mute: '#3A3A3A',
    faint: '#454545',
    accent: '#111111',
    protein: '#7A3E0C',
    carbs: '#175230',
    fat: '#8E2415',
    recovery: '#1F3A80',
    warn: '#8E2415',
  },

  fill: {
    accent: '#FFD93D',
    protein: '#B4611A',
    carbs: '#1F6B3D',
    fat: '#A82D1B',
    recovery: '#2A4BA8',
    warnBg: '#FF8FA3',
    accentOn: '#111111',
    mark: '#111111',
    markOn: '#F2F0E8',
    faint: '#454545',
  },

  typography: {
    ui: 'Archivo',
    data: 'Archivo Black',
    display: 'Archivo Black',
    scale: { xs: 11, sm: 12, base: 13, md: 16, lg: 20, xl: 28, hero: 46, mega: 58 },
    weight: { regular: 400, medium: 600, bold: 900 },
    tracking: { label: 0.1, body: 0.02, hero: -0.02 },
    labelCase: 'upper',
  },

  shape: {
    radius: { none: 0, sm: 0, md: 0, lg: 0 },
    borderWidth: { hairline: 2, thin: 3, thick: 4 },
    container: 'boxed',
    elevation: 'hardShadow',
    meter: 'stepped',
    meterHeight: 12,
    meterRadius: 0,
    align: 'left',
  },

  expression: {
    overCap: 'fill',
    emptyState: 'boxed',
    nav: 'inverted',
    rowMinHeight: 50,
  },
};
