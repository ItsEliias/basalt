import { minimal } from './minimal';
import { humanist } from './humanist';
import { athletic } from './athletic';
import { brutalist } from './brutalist';
import { depth } from './depth';
import { atelier } from './atelier';
import { clay } from './clay';
import { sticker } from './sticker';
import { gummy } from './gummy';
import { soft } from './soft';
import { candyRings } from './candyRings';

import type { Theme } from '../contract';

export const THEME_IDS = [
  "minimal", "humanist", "athletic", "brutalist", "depth", "atelier",
  "clay", "sticker", "gummy", "soft", "candyRings",
] as const;
export type ThemeId = typeof THEME_IDS[number];

export const THEMES: Record<ThemeId, Theme> = {
  minimal,
  humanist,
  athletic,
  brutalist,
  depth,
  atelier,
  clay,
  sticker,
  gummy,
  soft,
  candyRings,
};

/** New and existing installs default here. Never change without a migration. */
export const DEFAULT_THEME: ThemeId = 'minimal';

export { minimal };
export { humanist };
export { athletic };
export { brutalist };
export { depth };
export { atelier };
export { clay };
export { sticker };
export { gummy };
export { soft };
export { candyRings };
