import type { Theme } from '../contract';

/** Claymorphism — pressable pastel cards, extruded surfaces (mockup B4).
 *  Declares: elevation 'clay' (+params), pastel domain grounds, radius lg 24.
 *  Contrast verified by themeConformance — over-cap renders in words. */
export const clay: Theme = {
  id: 'clay',
  name: 'Clay',
  description: 'Pressable pastel cards, extruded surfaces.',
  isDark: false,
  accentRole: 'mark',

  surfaces: {
    bg: '#ECE8FF',
    surface: '#F6F3FF',
    surface2: '#E4DEFB',
    border: '#D9D2F5',
    borderStrong: '#C2B8E8',
  },

  text: {
    ink: '#2F2A4A',
    ink2: '#453E66',
    mute: '#524A78',
    faint: '#57507D',
    accent: '#4A38B8',
    protein: '#6A3AA8',
    carbs: '#1E6B4E',
    fat: '#A03A1C',
    recovery: '#2C4E9E',
    warn: '#A03A1C',
  },

  fill: {
    accent: '#6C57E8',
    protein: '#8A5CD8',
    carbs: '#2E8F6A',
    fat: '#C8532E',
    recovery: '#4E6FD8',
    warnBg: '#F7E0D6',
    accentOn: '#FFFFFF',
    mark: '#6C57E8',
    markOn: '#FFFFFF',
    faint: '#6F6795',
    domainGround: {
      protein: '#E5DDFF',
      carbs: '#DCF5EC',
      fat: '#FFE3D6',
      recovery: '#DCE8FB',
    },
    domainGroundOn: {
      protein: '#4A3486',
      carbs: '#1B5A42',
      fat: '#8A3418',
      recovery: '#28477E',
    },
  },

  typography: {
    ui: 'Baloo 2',
    data: 'Baloo 2',
    display: 'Baloo 2',
    scale: { xs: 11.5, sm: 12.5, base: 14.5, md: 16, lg: 20, xl: 30, hero: 48, mega: 60 },
    weight: { regular: 600, medium: 700, bold: 800 },
    tracking: { label: 0.02, body: 0, hero: -0.02 },
    labelCase: 'none',
  },

  shape: {
    radius: { none: 0, sm: 14, md: 20, lg: 24, pill: 999 },
    tilt: 0,
    borderWidth: { hairline: 1, thin: 1, thick: 2 },
    container: 'card',
    elevation: 'clay',
    elevationParams: { offset: 8, blur: 18, alpha: 0.18, inset: true },
    meter: 'bar',
    meterHeight: 16,
    meterRadius: 99,
    align: 'left',
  },

  expression: {
    overCap: 'all',
    emptyState: 'quiet',
    nav: 'label',
    rowMinHeight: 48,
  },
  motion: { duration: { fast: 130, base: 260, slow: 320 }, easing: 'ease-out', spring: { damping: 16, stiffness: 190 } },
};
