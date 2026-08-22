import { createContext, useContext, type ReactNode } from 'react';
import { tokens, type BasaltTokens } from './tokens';

// Token-provider pattern from the quarry's ui-primitives (kept token-generic),
// with one deliberate difference: Basalt is editorial-dark only, so there is a
// single token set — no light/dark pair, no color-scheme switch.
//
// Settings → Display (density, text scale) rides this same context rather
// than a second one: it's still "how do the tokens resolve right now,"
// just two more inputs alongside the static palette/type scale.

export type Density = 'comfortable' | 'compact';
export type TextScale = 'system' | 'plus1' | 'plus2';

/** +4dp on row/card vertical padding — the only thing density changes. */
export const DENSITY_PAD: Record<Density, number> = { comfortable: 4, compact: 0 };

/** Layered on top of the OS accessibility text-size setting, not instead of it. */
export const TEXT_SCALE_MULTIPLIER: Record<TextScale, number> = { system: 1, plus1: 1.08, plus2: 1.16 };

export type ThemeValue = {
  tokens: BasaltTokens;
  density: Density;
  textScale: TextScale;
};

const defaultTheme: ThemeValue = { tokens, density: 'comfortable', textScale: 'system' };

const ThemeContext = createContext<ThemeValue>(defaultTheme);

export function ThemeProvider({
  value = tokens,
  density = 'comfortable',
  textScale = 'system',
  children,
}: {
  value?: BasaltTokens;
  density?: Density;
  textScale?: TextScale;
  children: ReactNode;
}) {
  return (
    <ThemeContext.Provider value={{ tokens: value, density, textScale }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
