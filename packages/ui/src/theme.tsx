import { createContext, useContext, type ReactNode } from 'react';
import { tokens, type BasaltTokens } from './tokens';

// Token-provider pattern from the quarry's ui-primitives (kept token-generic),
// with one deliberate difference: Basalt is editorial-dark only, so there is a
// single token set — no light/dark pair, no color-scheme switch.

const ThemeContext = createContext<BasaltTokens>(tokens);

export function ThemeProvider({
  value = tokens,
  children,
}: {
  value?: BasaltTokens;
  children: ReactNode;
}) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): BasaltTokens {
  return useContext(ThemeContext);
}
