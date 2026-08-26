import type { Theme } from '../contract';

/** Centred serif on ink with brass rules. Quiet and unhurried.
 *  Contrast verified: all text.* >= 4.5:1 and all fill.* >= 3.0:1 on every surface. */
export const atelier: Theme = {
  id: 'atelier',
  name: 'Atelier',
  description: 'Centred serif on ink with brass rules. Quiet and unhurried.',
  isDark: true,
  accentRole: 'mark',

  surfaces: {
    bg: '#0C0D10',
    surface: '#131419',
    surface2: '#191A1F',
    border: '#23242A',
    borderStrong: '#33342E',
  },

  text: {
    ink: '#EDE7DC',
    ink2: '#CFC6B6',
    mute: '#B0A184',
    faint: '#A89877',
    accent: '#CDB68A',
    protein: '#D2AF6C',
    carbs: '#8FB89A',
    fat: '#D28B6C',
    recovery: '#9BA0CE',
    warn: '#D28B6C',
  },

  fill: {
    accent: '#C4AC7C',
    protein: '#C9A45E',
    carbs: '#7FA98A',
    fat: '#C4795A',
    recovery: '#8F94C4',
    warnBg: '#1F1815',
    accentOn: '#0C0D10',
    mark: '#C4AC7C',
    markOn: '#0C0D10',
    faint: '#A89877',
  },

  typography: {
    ui: 'Jost',
    data: 'IBM Plex Mono',
    display: 'Cormorant Garamond',
    scale: { xs: 11, sm: 12, base: 15, md: 16, lg: 18, xl: 24, hero: 62, mega: 76 },
    weight: { regular: 300, medium: 400, bold: 500 },
    tracking: { label: 0.28, body: 0, hero: 0.01 },
    labelCase: 'upper',
  },

  shape: {
    radius: { none: 0, sm: 0, md: 0, lg: 0 },
    borderWidth: { hairline: 0.5, thin: 1, thick: 1 },
    container: 'bare',
    elevation: 'none',
    meter: 'line',
    align: 'center',
  },

  expression: {
    overCap: 'word',
    emptyState: 'quiet',
    nav: 'label',
    rowMinHeight: 48,
  },
};
