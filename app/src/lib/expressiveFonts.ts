import * as Font from 'expo-font';
import type { ThemeId } from '@basalt/ui';

// The five V3.4 expressive themes' typefaces load HERE, on demand, when one
// of those themes activates — never in App.tsx's startup useFonts() set, so
// a Minimal user's first paint pays nothing for them. RN can't code-split a
// bundle, so the font ASSETS still ship in the binary; what's deferred is
// the expo-font registration work and its startup wait. The require() calls
// live inside the loaders for the same reason: no module init at boot.

type Loader = () => Record<string, Font.FontSource>;

// Each require names the exact .ttf: requiring a package INDEX makes Metro
// bundle the whole family (every weight + italic — ~15 MB of dead assets in
// the release binary, found in the 0.1.0 AAB audit). Per-file requires ship
// only the eleven faces the themes actually declare.
const LOADERS: Partial<Record<ThemeId, Loader>> = {
  clay: () => ({
    Baloo2_600SemiBold: require('@expo-google-fonts/baloo-2/600SemiBold/Baloo2_600SemiBold.ttf'),
    Baloo2_700Bold: require('@expo-google-fonts/baloo-2/700Bold/Baloo2_700Bold.ttf'),
    Baloo2_800ExtraBold: require('@expo-google-fonts/baloo-2/800ExtraBold/Baloo2_800ExtraBold.ttf'),
  }),
  gummy: () => ({
    Baloo2_600SemiBold: require('@expo-google-fonts/baloo-2/600SemiBold/Baloo2_600SemiBold.ttf'),
    Baloo2_700Bold: require('@expo-google-fonts/baloo-2/700Bold/Baloo2_700Bold.ttf'),
    Baloo2_800ExtraBold: require('@expo-google-fonts/baloo-2/800ExtraBold/Baloo2_800ExtraBold.ttf'),
  }),
  sticker: () => ({
    Nunito_900Black: require('@expo-google-fonts/nunito/900Black/Nunito_900Black.ttf'),
    LilitaOne_400Regular: require('@expo-google-fonts/lilita-one/400Regular/LilitaOne_400Regular.ttf'),
  }),
  soft: () => ({
    Poppins_500Medium: require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf'),
    Poppins_600SemiBold: require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
    Poppins_700Bold: require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf'),
  }),
  candyRings: () => ({
    Fredoka_500Medium: require('@expo-google-fonts/fredoka/500Medium/Fredoka_500Medium.ttf'),
    Fredoka_600SemiBold: require('@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf'),
    Fredoka_700Bold: require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf'),
  }),
};

const loaded = new Set<ThemeId>();

/** True when `id` needs no extra fonts, or they're already registered. */
export function expressiveFontsReady(id: ThemeId): boolean {
  return !LOADERS[id] || loaded.has(id);
}

export async function loadExpressiveFonts(id: ThemeId): Promise<void> {
  const loader = LOADERS[id];
  if (!loader || loaded.has(id)) return;
  await Font.loadAsync(loader());
  loaded.add(id);
}
