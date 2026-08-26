import type { Theme } from '../contract';

/** Black, condensed, one electric accent. Legible across a gym.
 *  Contrast verified: all text.* >= 4.5:1 and all fill.* >= 3.0:1 on every surface. */
export const athletic: Theme = {
  id: 'athletic',
  name: 'Athletic',
  description: 'Black, condensed, one electric accent. Legible across a gym.',
  isDark: true,
  accentRole: 'mark',

  surfaces: {
    bg: '#000000',
    surface: '#0C0C0E',
    surface2: '#1A1A1A',
    border: '#2A2A2A',
    borderStrong: '#3A3A3A',
  },

  text: {
    ink: '#FFFFFF',
    ink2: '#D8D8D8',
    mute: '#9A9A9A',
    faint: '#8E8E8E',
    accent: '#D7FF3E',
    protein: '#E8A33C',
    carbs: '#4ED18C',
    fat: '#FF7A5A',
    recovery: '#8FA0FF',
    warn: '#FF7A5A',
  },

  fill: {
    accent: '#D7FF3E',
    protein: '#E8A33C',
    carbs: '#4ED18C',
    fat: '#FF6B4A',
    recovery: '#8FA0FF',
    warnBg: '#1E0E0A',
    accentOn: '#000000',
    mark: '#D7FF3E',
    markOn: '#000000',
    faint: '#8E8E8E',
  },

  typography: {
    ui: 'Barlow',
    data: 'Barlow Condensed',
    display: 'Barlow Condensed',
    scale: { xs: 11, sm: 12, base: 13, md: 15, lg: 19, xl: 30, hero: 74, mega: 92 },
    weight: { regular: 400, medium: 600, bold: 700 },
    tracking: { label: 0.1, body: 0.04, hero: -0.02 },
    labelCase: 'upper',
  },

  shape: {
    radius: { none: 0, sm: 2, md: 2, lg: 4 },
    borderWidth: { hairline: 1, thin: 2, thick: 3 },
    container: 'bare',
    elevation: 'border',
    meter: 'bar',
    align: 'left',
  },

  expression: {
    overCap: 'all',
    emptyState: 'ruled',
    nav: 'label',
    rowMinHeight: 48,
  },
};
