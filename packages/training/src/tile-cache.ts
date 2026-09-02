// Offline route tiles (V3.1 H2) — corridor caching for saved walks,
// PROVIDER-GATED because tile terms differ and honesty extends to other
// people's servers:
//   · Stadia Maps: mobile offline caching is explicitly allowed up to
//     100 MB per device (their ToS §8, checked 2026-09-01) — with a
//     Stadia key configured, caching is ON within our own tighter budget
//   · CARTO's keyless dev tiles: bulk download is not permitted — with
//     the dev tiles, caching stays OFF and offline walks show the route
//     line only, which the srcnote says plainly
// Budgets published here; the per-route cost is shown in MB in the UI.

export const TILE_CACHE_RULES = {
  /** Our own per-route ceiling — well under Stadia's 100 MB/device. */
  maxBytesPerRoute: 40 * 1024 * 1024,
  /** Total cached across routes before we refuse new packs. */
  maxDeviceBytes: 90 * 1024 * 1024,
  /** Corridor zooms — overview, street, detail. */
  minZoom: 13,
  maxZoom: 15,
  /** Corridor padding around the route bbox, metres. */
  padM: 250,
} as const;

/** Caching is allowed only where the provider's terms allow it. */
export function tileCachingAllowed(tileUrl: string): boolean {
  return /stadiamaps\.com/.test(tileUrl) && /api_key=/.test(tileUrl);
}

export function tileCachePolicyNote(tileUrl: string): string {
  return tileCachingAllowed(tileUrl)
    ? `Offline tiles cached along this route (≤${Math.round(TILE_CACHE_RULES.maxBytesPerRoute / 1048576)} MB) — Stadia's terms allow mobile offline use`
    : 'Offline tile caching is off — the current dev tiles (CARTO) do not permit bulk download, so offline walks show the route line only';
}

/** Route bbox padded by metres → [west, south, east, north]. */
export function routeBounds(
  points: { lat: number; lng: number }[],
  padM: number = TILE_CACHE_RULES.padM,
): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  const midLat = (s + n) / 2;
  const dLat = padM / 111_320;
  const dLng = padM / (111_320 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));
  return [w - dLng, s - dLat, e + dLng, n + dLat];
}

export function mbText(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function packNameForWalk(walkId: string): string {
  return `walk-${walkId}`;
}
