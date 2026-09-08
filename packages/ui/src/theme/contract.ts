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
/** V3.4 (forbidden-list split): softShadow/clay/halo/gloss are THEME-SCOPED
 *  EXPRESSION — legal only in a theme that declares them. The six original
 *  themes declare none and must render byte-identical to before the split. */
export type Elevation        = 'none' | 'border' | 'hardShadow' | 'blur'
                             | 'softShadow' | 'clay' | 'halo' | 'gloss';
export type MeterStyle       = 'bar' | 'pill' | 'line' | 'stepped'
                             | 'ticks' | 'ring' | 'dial' | 'blob';
export type Domain           = 'protein' | 'carbs' | 'fat' | 'recovery';
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
  /** Card-surface gradient (Gummy only). When declared, EVERY text colour
   *  must clear 4.5:1 against BOTH `from` and `to` — a gradient makes
   *  contrast vary across the tile, so both ends are the floor. */
  gradient?: { from: string; to: string; angle: number };
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
  /** Pastel GROUND per domain (a tile surface, not a mark) with its matching
   *  on-colour — the same pairing discipline as mark/markOn. Theme-scoped
   *  expression: only bubbly themes declare these; every pair must clear
   *  4.5:1 (the on-colour is text). */
  domainGround?: Record<Domain, string>;
  domainGroundOn?: Record<Domain, string>;
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
  radius: { none: number; sm: number; md: number; lg: number; pill: number };
  borderWidth: { hairline: number; thin: number; thick: number };
  container: ContainerStrategy;
  elevation: Elevation;
  /** Geometry for the theme-scoped elevations (softShadow/clay/halo/gloss).
   *  Undeclared for the four original elevations. `inset` marks the clay/
   *  soft inner-highlight pair; `haloWidth` is Sticker's white die-cut ring. */
  elevationParams?: { offset: number; blur: number; alpha: number; inset?: boolean; haloWidth?: number };
  /** Whole-card tilt in degrees (Sticker only). Conformance caps it at 2°
   *  and forces 0 on any theme whose data face is mono — tilted mono
   *  columns don't align. */
  tilt: number;
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
  /** Ambient radial-gradient glow rendered once behind the screen root —
   *  Depth's signature look (reference/themes-today.html's `.depth .scr`
   *  background: two colour blobs over a near-black base). cx/cy/rx/ry are
   *  fractions of the screen, mirroring CSS radial-gradient position/size
   *  semantics; `color` carries its own alpha. Undefined for every theme
   *  that doesn't need one — a plain `surfaces.bg` fill is the default. */
  groundGlow?: { cx: number; cy: number; rx: number; ry: number; color: string }[];
  /** Translucent glass fill + border for `elevation: 'blur'` containers
   *  (Depth only) — the rgba pair rendered inside a real BlurView, matching
   *  the CSS backdrop-filter recipe. Unused when elevation !== 'blur'. */
  glassFill?: string;
  glassBorder?: string;
}

export interface ThemeExpression {
  overCap: OverCapStyle;
  emptyState: EmptyStateStyle;
  nav: NavStyle;
  rowMinHeight: number;   // never below 48 for tappable rows
}

/** Motion (V4.1 §5b). THE RULES, enforced by conformance test + source
 *  scan: motion never delays a tap or hides a number; nothing runs longer
 *  than 400 ms except the splash; every animation has a reduced-motion
 *  path; meaning is never carried by motion alone. Components take every
 *  duration/spring from here — hard-coding a duration in a component is a
 *  lint failure. Personalities: snap themes omit `spring` (ease-out,
 *  160–220 ms); ease themes omit it too but sit at 220–280 ms; bubbly
 *  themes declare a spring with subtle overshoot (scale ≤ 1.04). */
export interface ThemeMotion {
  duration: { fast: number; base: number; slow: number };
  easing: 'ease-out' | 'ease-in-out';
  spring?: { damping: number; stiffness: number };
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
  motion: ThemeMotion;
}

/** Invariants asserted for every theme in __tests__/themeConformance.test.ts */
export const INVARIANTS = {
  minTextContrast: 4.5,
  minFillContrast: 3.0,
  minFontSize: 11,
  minTapTarget: 48,
  maxFontScale: 1.3,
} as const;
