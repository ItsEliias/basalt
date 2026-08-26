import { mono } from '../typography';
import { resolveFontFamily } from '../format';

// A theme's typography.ui/data/display values are family NAMES, not always
// literal RN fontFamily strings — two are sentinels:
//   'System' -> platform default (RN's own resolution — pass undefined)
//   'Mono'   -> the existing platform monospace, not a bundled font
// Every other name is a real bundled family, registered per weight via
// expo-font — resolveFontFamily (packages/ui/src/format.ts, RN-free and
// unit-tested) does that naming. See app/App.tsx's useFonts() call for the
// exact set that's loaded.

/**
 * Resolves a theme typography family name + numeric weight (400/600/700...)
 * to what RN should actually render. Callers should also set the same
 * number as an explicit `fontWeight` style alongside this — for the
 * 'System'/'Mono' sentinels that's the only thing that expresses weight;
 * for a real bundled family it's redundant (the weight is already baked
 * into the resolved file) but harmless, since RN resolves an exact
 * custom-family match without trying to synthesize further.
 */
export function resolveTypeface(name: string, weight: number): string | undefined {
  if (name === 'System') return undefined;
  if (name === 'Mono') return mono;
  return resolveFontFamily(name, weight);
}
