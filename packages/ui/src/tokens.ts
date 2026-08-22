// Basalt design tokens — verbatim from docs/basalt-design-spec.md §1 and the
// prototype's :root. These values are the contract: do not add hues, do not
// brighten, do not use accents decoratively. An accent appears only when it
// encodes its domain or a state.

export const color = {
  bg: '#0F1115',        // app canvas (never pure black, never lighter)
  surface: '#16181D',   // cards
  surface2: '#1B1E24',  // nested/raised elements (timers, sheets, inputs)
  border: '#262B34',    // hairlines — 1px, solid, everywhere (OLED-safe floor)
  border2: '#2A2F38',   // interactive borders (buttons, inputs, chips)
  ink: '#F4F5F6',       // primary text & hero numerals
  ink2: '#C2C8D2',      // secondary text
  mute: '#9AA3AF',      // labels, units
  faint: '#7A828E',      // metadata, disabled, ghost values — clears 4.5:1 on bg AND surface (see tokens.test.ts)

  protein: '#C08432',   // protein · strength · training volume
  carbs: '#3E9B78',     // carbs · movement · positive delta · "on pace"
  fat: '#BE5540',       // fat · caloric load · caps exceeded · destructive
  recovery: '#5E72E4',  // recovery · sleep · water · mind
  recoveryDeep: '#3B4BC8',   // sleep stage: deep
  recoveryLight: '#8B99F0',  // sleep stage: light
  awake: '#3A4048',     // sleep stage: awake (prototype stage bar)
} as const;

export type ColorToken = keyof typeof color;

export const radius = {
  card: 14,
  tile: 14,
  input: 12,
  timer: 10,
  chip: 8,
  thumb: 7,
  bar: 2,
} as const;

export const space = {
  screen: 16,
  card: 16,
  cardGap: 12,
  rowV: 10,
} as const;

// Type scale — sizes and letter-spacing from the prototype CSS. React Native
// letterSpacing is in points, so em-values are pre-multiplied
// (e.g. 10px × .12em = 1.2).
// Legibility revision (device feedback: too small, too dim, too fiddly to
// tap). Type floor is 11px everywhere except the two named exceptions
// (srcnote footers, tab labels) which sit at 10.5 — still a full step up
// from their old 9.5. Hero/guided numerals are unchanged; they were never
// the problem. See tokens.test.ts for the pinned values and the contrast
// floor this unlocks.
export const type = {
  hero: { fontSize: 50, fontWeight: '640', letterSpacing: -1.5 },
  heroUnit: { fontSize: 15, fontWeight: '450' },
  tileValue: { fontSize: 23, fontWeight: '620', letterSpacing: -0.46 },
  title: { fontSize: 21, fontWeight: '650', letterSpacing: -0.21 },
  obQuestion: { fontSize: 24, fontWeight: '650', letterSpacing: -0.36 },
  body: { fontSize: 14 },
  rowName: { fontSize: 14, fontWeight: '480' },
  rowMeta: { fontSize: 11.5 },
  rowValue: { fontSize: 15 },
  microLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2 },
  srcNote: { fontSize: 10.5, letterSpacing: 0.285, lineHeight: 15 },
  chip: { fontSize: 11, letterSpacing: 0.95 },
  seg: { fontSize: 11, letterSpacing: 1.3 },
  tab: { fontSize: 10.5, letterSpacing: 0.6 },
  ratio: { fontSize: 12 },
  guidedNum: { fontSize: 64, fontWeight: '560', letterSpacing: -1.92 },
} as const;

/** The four semantic accents, CVD-validated on #16181D. */
export const accents = [color.protein, color.carbs, color.fat, color.recovery] as const;

export const tokens = { color, radius, space, type } as const;
export type BasaltTokens = typeof tokens;
