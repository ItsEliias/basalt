import * as Font from 'expo-font';
import type { ThemeId } from '@basalt/ui';

// The five V3.4 expressive themes' typefaces load HERE, on demand, when one
// of those themes activates — never in App.tsx's startup useFonts() set, so
// a Minimal user's first paint pays nothing for them. RN can't code-split a
// bundle, so the font ASSETS still ship in the binary; what's deferred is
// the expo-font registration work and its startup wait. The require() calls
// live inside the loaders for the same reason: no module init at boot.

type Loader = () => Record<string, Font.FontSource>;

const LOADERS: Partial<Record<ThemeId, Loader>> = {
  clay: () => {
    const m = require('@expo-google-fonts/baloo-2');
    return {
      Baloo2_600SemiBold: m.Baloo2_600SemiBold,
      Baloo2_700Bold: m.Baloo2_700Bold,
      Baloo2_800ExtraBold: m.Baloo2_800ExtraBold,
    };
  },
  gummy: () => {
    const m = require('@expo-google-fonts/baloo-2');
    return {
      Baloo2_600SemiBold: m.Baloo2_600SemiBold,
      Baloo2_700Bold: m.Baloo2_700Bold,
      Baloo2_800ExtraBold: m.Baloo2_800ExtraBold,
    };
  },
  sticker: () => {
    const nunito = require('@expo-google-fonts/nunito');
    const lilita = require('@expo-google-fonts/lilita-one');
    return {
      Nunito_900Black: nunito.Nunito_900Black,
      LilitaOne_400Regular: lilita.LilitaOne_400Regular,
    };
  },
  soft: () => {
    const m = require('@expo-google-fonts/poppins');
    return {
      Poppins_500Medium: m.Poppins_500Medium,
      Poppins_600SemiBold: m.Poppins_600SemiBold,
      Poppins_700Bold: m.Poppins_700Bold,
    };
  },
  candyRings: () => {
    const m = require('@expo-google-fonts/fredoka');
    return {
      Fredoka_500Medium: m.Fredoka_500Medium,
      Fredoka_600SemiBold: m.Fredoka_600SemiBold,
      Fredoka_700Bold: m.Fredoka_700Bold,
    };
  },
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
