import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import type { View } from 'react-native';
import type { Theme } from './contract';
import { THEMES, DEFAULT_THEME } from './themes';

// Token-provider pattern from the quarry's ui-primitives (kept theme-generic).
// A theme is a full, self-contained palette (Theme.isDark records which) —
// there's no separate light/dark toggle layered on top of a theme; picking
// a theme picks its whole palette.
//
// Settings → Display (density, text scale) rides this same context rather
// than a second one: it's still "how do the tokens resolve right now,"
// just two more inputs alongside the active theme.

export type Density = 'comfortable' | 'compact';
export type TextScale = 'system' | 'plus1' | 'plus2';

/** +4dp on row/card vertical padding — the only thing density changes. */
export const DENSITY_PAD: Record<Density, number> = { comfortable: 4, compact: 0 };

/** Layered on top of the OS accessibility text-size setting, not instead of it. */
export const TEXT_SCALE_MULTIPLIER: Record<TextScale, number> = { system: 1, plus1: 1.08, plus2: 1.16 };

export type ThemeValue = {
  theme: Theme;
  density: Density;
  textScale: TextScale;
};

const defaultThemeValue: ThemeValue = {
  theme: THEMES[DEFAULT_THEME],
  density: 'comfortable',
  textScale: 'system',
};

const ThemeContext = createContext<ThemeValue>(defaultThemeValue);

export function ThemeProvider({
  theme = THEMES[DEFAULT_THEME],
  density = 'comfortable',
  textScale = 'system',
  children,
}: {
  theme?: Theme;
  density?: Density;
  textScale?: TextScale;
  children: ReactNode;
}) {
  return (
    <ThemeContext.Provider value={{ theme, density, textScale }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

// expo-blur's Android blur (unlike iOS's UIVisualEffectView) can't sample
// "whatever's behind this view" automatically — it needs an explicit ref to
// a BlurTargetView wrapping the content to blur. app/App.tsx wraps
// GroundGlow in one and provides the ref here; Card/Tile read it via
// useBlurTarget() so they don't need to know where that view lives. null
// (the default) means "no blur target available" — BlurView still renders,
// just without anything real to blur on Android.
const BlurTargetContext = createContext<RefObject<View | null> | null>(null);

export function BlurTargetProvider({
  target, children,
}: { target: RefObject<View | null>; children: ReactNode }) {
  return <BlurTargetContext.Provider value={target}>{children}</BlurTargetContext.Provider>;
}

export function useBlurTarget(): RefObject<View | null> | null {
  return useContext(BlurTargetContext);
}
