import type { Theme } from '../contract';

/** Die-cut sticker — white halos, hard offsets, poster display type, the one
 *  tilted theme (mockup B5). Declares: elevation 'halo' (+params), tilt 1.5°,
 *  pastel domain grounds, uppercase labels, a yellow GROUND accent. */
export const sticker: Theme = {
  id: 'sticker',
  name: 'Sticker',
  description: 'White halos, tilted cards, poster type on sky.',
  isDark: false,
  accentRole: 'ground',

  surfaces: {
    bg: '#7FC8FF',
    surface: '#FFFFFF',
    surface2: '#E9F2FC',
    border: '#1B2340',
    borderStrong: '#1B2340',
  },

  text: {
    ink: '#1B2340',
    ink2: '#2E3A5C',
    mute: '#3A466C',
    faint: '#414D74',
    accent: '#1B2340',
    protein: '#8E2456',
    carbs: '#1B5424',
    fat: '#7A2610',
    recovery: '#1E4E8A',
    warn: '#7A2610',
  },

  fill: {
    accent: '#FFE14D',
    protein: '#A82C60',
    carbs: '#2E6E24',
    fat: '#B23A18',
    recovery: '#2558A0',
    warnBg: '#FFE9DB',
    accentOn: '#1B2340',
    mark: '#1B2340',
    markOn: '#FFFFFF',
    faint: '#47547E',
    domainGround: {
      protein: '#FF9FC2',
      carbs: '#B4F08C',
      fat: '#FF9A5B',
      recovery: '#9FD0FF',
    },
    domainGroundOn: {
      protein: '#1B2340',
      carbs: '#1B2340',
      fat: '#1B2340',
      recovery: '#1B2340',
    },
  },

  typography: {
    ui: 'Nunito',
    data: 'Nunito',
    display: 'Lilita One',
    scale: { xs: 11, sm: 12, base: 13.5, md: 16, lg: 20, xl: 32, hero: 52, mega: 64 },
    weight: { regular: 700, medium: 800, bold: 900 },
    tracking: { label: 0.06, body: 0, hero: 0 },
    labelCase: 'upper',
  },

  shape: {
    radius: { none: 0, sm: 12, md: 22, lg: 22, pill: 999 },
    tilt: 1.5,
    borderWidth: { hairline: 1.5, thin: 3, thick: 3 },
    container: 'card',
    elevation: 'halo',
    elevationParams: { offset: 4, blur: 0, alpha: 1, haloWidth: 4 },
    meter: 'bar',
    meterHeight: 12,
    meterRadius: 99,
    align: 'left',
  },

  expression: {
    overCap: 'all',
    emptyState: 'boxed',
    nav: 'label',
    rowMinHeight: 48,
  },
  motion: { duration: { fast: 120, base: 260, slow: 320 }, easing: 'ease-out', spring: { damping: 13, stiffness: 230 } },
};
