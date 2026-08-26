import { mono } from '../typography';

// A theme's typography.ui/data/display values are family NAMES, not always
// literal RN fontFamily strings — two are sentinels:
//   'System' -> platform default (RN's own resolution — pass undefined)
//   'Mono'   -> the existing platform monospace, not a bundled font
// Every other name is a real bundled family, registered via expo-font under
// this exact string (see the app's font-loading setup).

/** Resolves a theme typography family name to what RN should actually render. */
export function resolveTypeface(name: string): string | undefined {
  if (name === 'System') return undefined;
  if (name === 'Mono') return mono;
  return name;
}
