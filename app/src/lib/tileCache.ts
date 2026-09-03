import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineManager } from '@maplibre/maplibre-react-native';
import {
  tileCachingAllowed, routeBounds, packNameForWalk, buildWalkMapStyle,
  TILE_CACHE_RULES, DEV_TILES, type TileConfig, type RoutePt,
} from '@basalt/training';

// Corridor tile cache for saved walks (V3.1 H2). Provider-gated by the
// pure policy module; the pack downloads through MapLibre's offline
// manager and the native map serves it automatically when the network is
// gone. Budget enforcement is OURS on top of the provider's: a pack that
// blows the per-route ceiling is deleted, not kept — and the refusal is
// recorded so the UI can say so.

export const WALK_TILES: TileConfig =
  process.env.EXPO_PUBLIC_TILE_URL && process.env.EXPO_PUBLIC_TILE_ATTRIBUTION
    ? { url: process.env.EXPO_PUBLIC_TILE_URL, attribution: process.env.EXPO_PUBLIC_TILE_ATTRIBUTION }
    : DEV_TILES;

export type RouteCacheInfo =
  | { state: 'none' }
  | { state: 'downloading' }
  | { state: 'cached'; bytes: number }
  | { state: 'refused'; reason: string };

const KEY = (walkId: string) => `basalt.tilecache:${walkId}`;

export function offlineTilesAvailable(): boolean {
  return tileCachingAllowed(WALK_TILES.url);
}

export async function getRouteCacheInfo(walkId: string): Promise<RouteCacheInfo> {
  try {
    const raw = await AsyncStorage.getItem(KEY(walkId));
    return raw ? (JSON.parse(raw) as RouteCacheInfo) : { state: 'none' };
  } catch {
    return { state: 'none' };
  }
}

async function setInfo(walkId: string, info: RouteCacheInfo): Promise<void> {
  await AsyncStorage.setItem(KEY(walkId), JSON.stringify(info));
}

/** Download the corridor pack for a saved walk. No-op unless the provider allows it. */
export async function cacheRouteTiles(walkId: string, route: RoutePt[]): Promise<RouteCacheInfo> {
  if (!offlineTilesAvailable()) return { state: 'none' };
  const bounds = routeBounds(route);
  if (!bounds) return { state: 'none' };

  const info: RouteCacheInfo = { state: 'downloading' };
  await setInfo(walkId, info);
  // This style exists only to enumerate the tile URLs for the pack download —
  // its colours never render. Literals keep the static palette out of libs.
  const style = buildWalkMapStyle(route, { bg: '#000000', accent: '#ffffff' }, WALK_TILES);

  return new Promise((resolve) => {
    let settled = false;
    const done = async (final: RouteCacheInfo) => {
      if (settled) return;
      settled = true;
      await setInfo(walkId, final);
      resolve(final);
    };
    void OfflineManager.createPack(
      {
        name: packNameForWalk(walkId),
        mapStyle: JSON.stringify(style),
        bounds: [bounds[0], bounds[1], bounds[2], bounds[3]] as never,
        minZoom: TILE_CACHE_RULES.minZoom,
        maxZoom: TILE_CACHE_RULES.maxZoom,
      } as never,
      (_pack: unknown, status: any) => {
        const bytes = Number(status?.completedResourceSize ?? 0);
        if (bytes > TILE_CACHE_RULES.maxBytesPerRoute) {
          void OfflineManager.deletePack(packNameForWalk(walkId)).catch(() => {});
          void done({ state: 'refused', reason: `corridor exceeds the ${Math.round(TILE_CACHE_RULES.maxBytesPerRoute / 1048576)} MB per-route budget` });
          return;
        }
        if (Number(status?.percentage ?? 0) >= 100) {
          void done({ state: 'cached', bytes });
        }
      },
      () => void done({ state: 'refused', reason: 'download failed — will show route line only offline' }),
    ).catch(() => void done({ state: 'refused', reason: 'download failed — will show route line only offline' }));
  });
}

export async function deleteRoutePack(walkId: string): Promise<void> {
  try {
    await OfflineManager.deletePack(packNameForWalk(walkId));
  } catch { /* pack may not exist */ }
  await AsyncStorage.removeItem(KEY(walkId));
}
