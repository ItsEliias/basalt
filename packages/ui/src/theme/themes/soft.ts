import type { Theme } from '../contract';

/** Neumorphic — one pale material, extruded and inset by light (mockup B8).
 *  Declares: elevation 'softShadow' (+params, inset for wells), meter 'dial'.
 *  Over-cap is words only (dial can't draw 41/36), so scale.sm is 14 — the
 *  cap-row line renders at max(12.5, sm). */
export const soft: Theme = {
  id: 'soft',
  name: 'Soft',
  description: 'One pale material, extruded and inset.',
  isDark: false,
  accentRole: 'mark',

  surfaces: {
    bg: '#E9EAF3',
    surface: '#E9EAF3',
    surface2: '#DCDDE8',
    border: '#D0D1E0',
    borderStrong: '#B6B8CE',
  },

  text: {
    ink: '#2A2C3E',
    ink2: '#3D4058',
    mute: '#54577A',
    faint: '#565971',
    accent: '#4A3BC8',
    protein: '#8A4A10',
    carbs: '#1F6B4A',
    fat: '#A83820',
    recovery: '#31509E',
    warn: '#A83820',
  },

  fill: {
    accent: '#6C5CE0',
    protein: '#B06A1E',
    carbs: '#2E8A62',
    fat: '#C8502E',
    recovery: '#5470C8',
    warnBg: '#F3DCD6',
    accentOn: '#FFFFFF',
    mark: '#6C5CE0',
    markOn: '#FFFFFF',
    faint: '#6E7190',
  },

  typography: {
    ui: 'Poppins',
    data: 'Poppins',
    display: 'Poppins',
    scale: { xs: 11.5, sm: 14, base: 14.5, md: 16, lg: 20, xl: 30, hero: 44, mega: 56 },
    weight: { regular: 500, medium: 600, bold: 700 },
    tracking: { label: 0.03, body: 0, hero: -0.01 },
    labelCase: 'none',
  },

  shape: {
    radius: { none: 0, sm: 14, md: 20, lg: 20, pill: 999 },
    tilt: 0,
    borderWidth: { hairline: 1, thin: 1, thick: 2 },
    container: 'card',
    elevation: 'softShadow',
    elevationParams: { offset: 8, blur: 18, alpha: 0.22, inset: true },
    meter: 'dial',
    meterHeight: 12,
    meterRadius: 99,
    align: 'center',
  },

  expression: {
    overCap: 'word',
    emptyState: 'quiet',
    nav: 'label',
    rowMinHeight: 48,
  },
  motion: { duration: { fast: 140, base: 280, slow: 340 }, easing: 'ease-in-out', spring: { damping: 18, stiffness: 160 } },
};
