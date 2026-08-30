import type { Theme } from '../contract';

/** Warm, rounded, generous. Calm without being clinical.
 *  Contrast verified: all text.* >= 4.5:1 and all fill.* >= 3.0:1 on every surface. */
export const humanist: Theme = {
  id: 'humanist',
  name: 'Humanist',
  description: 'Warm, rounded, generous. Calm without being clinical.',
  isDark: false,
  accentRole: 'mark',

  surfaces: {
    bg: '#FBF7F1',
    surface: '#FFFFFF',
    surface2: '#F1E9DE',
    border: '#E7DED1',
    borderStrong: '#D8CCBA',
  },

  text: {
    ink: '#2E2822',
    ink2: '#4E463D',
    mute: '#655B50',
    faint: '#6B6156',
    accent: '#8A4F2C',
    protein: '#845020',
    carbs: '#356038',
    fat: '#983C25',
    recovery: '#3A5488',
    warn: '#983C25',
  },

  fill: {
    accent: '#8F5228',
    protein: '#8F5228',
    carbs: '#4E7A52',
    fat: '#A4432B',
    recovery: '#4E6FA8',
    warnBg: '#F7E4DC',
    accentOn: '#FFFFFF',
    mark: '#8F5228',
    markOn: '#FFFFFF',
    faint: '#655B50',
  },

  typography: {
    ui: 'Nunito',
    data: 'Nunito',
    display: 'Nunito',
    scale: { xs: 12, sm: 13, base: 15, md: 16, lg: 20, xl: 28, hero: 46, mega: 58 },
    weight: { regular: 400, medium: 700, bold: 800 },
    tracking: { label: 0.04, body: 0, hero: -0.02 },
    labelCase: 'none',
  },

  shape: {
    radius: { none: 0, sm: 12, md: 16, lg: 22 },
    borderWidth: { hairline: 1, thin: 1, thick: 2 },
    container: 'card',
    elevation: 'none',
    meter: 'pill',
    meterHeight: 11,
    meterRadius: 99,
    align: 'left',
  },

  expression: {
    overCap: 'word',
    emptyState: 'quiet',
    nav: 'label',
    rowMinHeight: 48,
  },
};
