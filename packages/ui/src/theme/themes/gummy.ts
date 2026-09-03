import type { Theme } from '../contract';

/** Glossy dark — gradient lead card with a top sheen on deep violet
 *  (mockup B9). Declares: elevation 'gloss' (+params, lead-card glow),
 *  surfaces.gradient (both ends carry every text colour), gradient-derived
 *  flat domain grounds. */
export const gummy: Theme = {
  id: 'gummy',
  name: 'Gummy',
  description: 'Gradient tiles with a top sheen on violet.',
  isDark: true,
  accentRole: 'mark',

  surfaces: {
    bg: '#1B1233',
    surface: '#2A1F4D',
    surface2: '#241A42',
    border: '#3A2E66',
    borderStrong: '#4C3E82',
    // Lead-card gradient. Darker than the mockup's #8B5CF6 start — every
    // text colour must clear 4.5:1 at BOTH ends (conformance-checked).
    gradient: { from: '#5B3FD1', to: '#4326A8', angle: 160 },
  },

  text: {
    ink: '#FFFFFF',
    ink2: '#EAE3FA',
    mute: '#D8CDF2',
    faint: '#DCD2F5',
    accent: '#FFD84D',
    protein: '#FFC2D8',
    carbs: '#9FE8F0',
    fat: '#FFD0B2',
    recovery: '#D6CCFF',
    warn: '#FFD0B2',
  },

  fill: {
    accent: '#FFD84D',
    protein: '#F06598',
    carbs: '#3FB8CE',
    fat: '#E88A4A',
    recovery: '#8B78E8',
    warnBg: '#3A1E14',
    accentOn: '#1B1233',
    mark: '#F2ECFF',
    markOn: '#1B1233',
    faint: '#8578BC',
    domainGround: {
      protein: '#B82C5E',
      carbs: '#136B80',
      fat: '#A84A14',
      recovery: '#4C34B8',
    },
    domainGroundOn: {
      protein: '#FFFFFF',
      carbs: '#FFFFFF',
      fat: '#FFFFFF',
      recovery: '#FFFFFF',
    },
  },

  typography: {
    ui: 'Baloo 2',
    data: 'Baloo 2',
    display: 'Baloo 2',
    scale: { xs: 11.5, sm: 12.5, base: 14.5, md: 16, lg: 20, xl: 30, hero: 50, mega: 62 },
    weight: { regular: 600, medium: 700, bold: 800 },
    tracking: { label: 0.02, body: 0, hero: -0.02 },
    labelCase: 'none',
  },

  shape: {
    radius: { none: 0, sm: 14, md: 20, lg: 24, pill: 999 },
    tilt: 0,
    borderWidth: { hairline: 1, thin: 1, thick: 2 },
    container: 'card',
    elevation: 'gloss',
    elevationParams: { offset: 8, blur: 20, alpha: 0.35 },
    meter: 'bar',
    meterHeight: 14,
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
