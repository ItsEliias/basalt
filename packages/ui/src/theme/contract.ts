/**
 * Basalt theme contract.
 *
 * THE RULE: if a theme needs a component override, this contract is missing a token.
 * Add the token. Never branch the component.
 *
 * Colour is split by USE, not by name:
 *   fill.*  graphical marks (bars, dots, tiles)  -> must clear 3.0:1 on every surface
 *   text.*  rendered type                        -> must clear 4.5:1 on every surface
 * The same hue usually needs two values. This split exists because `fat` as an
 * over-cap value is TYPE, and the graphical threshold is not sufficient for it.
 */

export type ContainerStrategy = 'card' | 'bare' | 'boxed';
export type Elevation        = 'none' | 'border' | 'hardShadow' | 'blur';
export type MeterStyle       = 'bar' | 'pill' | 'line' | 'stepped';
export type Align            = 'left' | 'center';
export type OverCapStyle     = 'color' | 'fill' | 'word' | 'all';
export type EmptyStateStyle  = 'quiet' | 'ruled' | 'boxed';
export type NavStyle         = 'label' | 'iconLabel' | 'inverted';
export type LabelCase        = 'upper' | 'none';
export type AccentRole       = 'mark' | 'ground';
export type TodayLayout      = 'ledger' | 'tiles';

export interface ThemeSurfaces {
  bg: string; surface: string; surface2: string;
  border: string; borderStrong: string;
}

/** Rendered type. Every value must clear 4.5:1 on bg, surface AND surface2. */
export interface ThemeTextColours {
  ink: string; ink2: string; mute: string; faint: string;
  accent: string;
  protein: string; carbs: string; fat: string; recovery: string;
  warn: string;
}

/** Graphical marks. Every value must clear 3.0:1 on every surface,
 *  except `accent` when accentRole === 'ground' (it IS a surface). */
export interface ThemeFillColours {
  /** The accent. When accentRole is 'ground' this is a SURFACE, not a mark. */
  accent: string;
  /** Text drawn on top of `accent`. Must clear 4.5:1 against it. */
  accentOn: string;
  /** Filled interactive elements: meters, primary buttons, active chips, active nav.
   *  Usually identical to `accent` — but NOT when the accent is a ground. Brutalist's
   *  accent is yellow (a surface); its mark is black. Keeping these separate is what
   *  stops a filled button rendering its label in the same colour as its own fill. */
  mark: string;
  /** Text drawn on top of `mark`. Must clear 4.5:1 against it. */
  markOn: string;
  /** The neutral/unfilled state of a graphical mark (e.g. a cap bar's track
   *  before it's over) — distinct from `text.faint` because a mark only
   *  needs 3.0:1, not 4.5:1, and reusing the text value can be a stronger
   *  visual change than necessary. */
  faint: string;
  protein: string; carbs: string; fat: string; recovery: string;
  warnBg: string;
}

export interface ThemeTypography {
  ui: string;       // labels, names, chrome
  data: string;     // numerals, tables, timestamps
  display: string;  // hero numeral only
  scale: { xs: number; sm: number; base: number; md: number;
           lg: number; xl: number; hero: number; mega: number };
  weight: { regular: number; medium: number; bold: number };
  tracking: { label: number; body: number; hero: number };
  labelCase: LabelCase;
}

export interface ThemeShape {
  radius: { none: number; sm: number; md: number; lg: number };
  borderWidth: { hairline: number; thin: number; thick: number };
  container: ContainerStrategy;
  elevation: Elevation;
  meter: MeterStyle;
  /** Progress-bar track/fill geometry (reference/themes-today.html's
   *  `.meter`/`.meter i`) — every theme has its own; nothing derives these
   *  from `meter` alone (Minimal and Athletic are both 'bar' but share no
   *  other value). The track colour is always `surfaces.surface2` and the
   *  fill colour is always whatever the caller passes (macro/cap rows keep
   *  their own semantic colours) — only geometry lives here. */
  meterHeight: number;
  meterRadius: number;
  align: Align;
}

export interface ThemeExpression {
  overCap: OverCapStyle;
  emptyState: EmptyStateStyle;
  nav: NavStyle;
  rowMinHeight: number;   // never below 48 for tappable rows
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  isDark: boolean;
  accentRole: AccentRole;
  surfaces: ThemeSurfaces;
  text: ThemeTextColours;
  fill: ThemeFillColours;
  typography: ThemeTypography;
  shape: ThemeShape;
  expression: ThemeExpression;
}

/** Invariants asserted for every theme in __tests__/themeConformance.test.ts */
export const INVARIANTS = {
  minTextContrast: 4.5,
  minFillContrast: 3.0,
  minFontSize: 11,
  minTapTarget: 48,
  maxFontScale: 1.3,
} as const;
