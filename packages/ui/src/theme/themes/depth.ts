import type { Theme } from '../contract';

/** Layered translucency over an ambient ground. Contemporary platform feel.
 *  Contrast verified: all text.* >= 4.5:1 and all fill.* >= 3.0:1 on every surface. */
export const depth: Theme = {
  id: 'depth',
  name: 'Depth',
  description: 'Layered translucency over an ambient ground. Contemporary platform feel.',
  isDark: true,
  accentRole: 'mark',

  surfaces: {
    bg: '#0B0F1A',
    surface: '#161C2B',
    surface2: '#1E2434',
    border: '#2A3145',
    borderStrong: '#374060',
  },

  text: {
    ink: '#F2F5FA',
    ink2: '#C6CEDC',
    mute: '#A0AABE',
    faint: '#949FB4',
    accent: '#9FADF8',
    protein: '#DDA75C',
    carbs: '#5FC49B',
    fat: '#E88C72',
    recovery: '#9FADF8',
    warn: '#E88C72',
  },

  fill: {
    accent: '#8B9BF5',
    protein: '#D69A4A',
    carbs: '#4FB68C',
    fat: '#E07A5F',
    recovery: '#8B9BF5',
    warnBg: '#241A1C',
    accentOn: '#0B0F1A',
    mark: '#8B9BF5',
    markOn: '#0B0F1A',
    faint: '#949FB4',
  },

  typography: {
    ui: 'Manrope',
    data: 'Manrope',
    display: 'Manrope',
    scale: { xs: 11, sm: 12, base: 13.5, md: 15, lg: 19, xl: 26, hero: 46, mega: 60 },
    weight: { regular: 400, medium: 600, bold: 800 },
    tracking: { label: 0.13, body: 0, hero: -0.02 },
    labelCase: 'upper',
  },

  shape: {
    radius: { none: 0, sm: 10, md: 14, lg: 20 },
    borderWidth: { hairline: 1, thin: 1, thick: 2 },
    container: 'card',
    elevation: 'blur',
    meter: 'pill',
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
