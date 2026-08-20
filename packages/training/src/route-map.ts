// Route → map primitives, all pure: GeoJSON for the line and endpoints, a
// deterministic camera fit (Web-Mercator math, no map ref timing), and the
// complete MapLibre style JSON for the walk tile — dark raster base, one
// accent route line, hollow start / filled end markers, per the prototype's
// map treatment. The RN component stays a thin shell around these.

import { haversineM } from './gps';

export type RoutePt = { lat: number; lng: number };

export type RouteMapColors = {
  /** page background behind/under tiles */
  bg: string;
  /** the single accent for route + markers (carbs green in Basalt) */
  accent: string;
};

const TILE_SIZE = 256;

// ─── GeoJSON ────────────────────────────────────────────────────────────────

export function routeLineGeoJson(points: RoutePt[]): object {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
  };
}

export function routeEndpointsGeoJson(points: RoutePt[]): object {
  const features = [];
  if (points.length > 0) {
    const s = points[0]!;
    features.push({
      type: 'Feature',
      properties: { kind: 'start' },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    });
  }
  if (points.length > 1) {
    const e = points[points.length - 1]!;
    features.push({
      type: 'Feature',
      properties: { kind: 'end' },
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

// ─── Camera fit (Web Mercator) ──────────────────────────────────────────────

/** Latitude → world-unit Y in [0,1] (Web Mercator). */
function mercY(lat: number): number {
  const clamped = Math.max(-85.051129, Math.min(85.051129, lat));
  const phi = (clamped * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI);
}

function invMercY(y: number): number {
  return ((2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) * 180) / Math.PI;
}

export type RouteCamera = { center: [number, number]; zoom: number };

/**
 * Deterministic bounds fit: the zoom at which the route's bbox (plus padding)
 * fills the viewport, centered on the bbox middle. Null for an empty route.
 */
export function cameraForRoute(
  points: RoutePt[],
  viewport: { widthPx: number; heightPx: number; paddingPx?: number },
): RouteCamera | null {
  if (points.length === 0) return null;
  const pad = viewport.paddingPx ?? 28;
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const xMin = Math.min(...lngs) / 360 + 0.5;
  const xMax = Math.max(...lngs) / 360 + 0.5;
  const yTop = mercY(Math.max(...lats));
  const yBot = mercY(Math.min(...lats));

  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const centerLat = invMercY((yTop + yBot) / 2);

  const xSpan = xMax - xMin;
  const ySpan = yBot - yTop;
  if (xSpan === 0 && ySpan === 0) {
    return { center: [centerLng, centerLat], zoom: 16 };
  }
  const availW = Math.max(40, viewport.widthPx - 2 * pad);
  const availH = Math.max(40, viewport.heightPx - 2 * pad);
  const zx = xSpan > 0 ? Math.log2(availW / (TILE_SIZE * xSpan)) : Infinity;
  const zy = ySpan > 0 ? Math.log2(availH / (TILE_SIZE * ySpan)) : Infinity;
  const zoom = Math.max(1, Math.min(18, Math.min(zx, zy)));
  return { center: [centerLng, centerLat], zoom };
}

// ─── Style JSON ─────────────────────────────────────────────────────────────

/**
 * Tile provider — injectable so the app can supply a licensed commercial
 * provider via env without touching this package. The default is CARTO's
 * free dark_all raster (data © OpenStreetMap contributors): fine for
 * development, NOT licensed for a published commercial app — the swap is
 * on docs/SUBMISSION-CHECKLIST.md.
 *
 * Documented commercial options (both OSM-data, both dark, both raster —
 * drop the URL + key into app/.env as EXPO_PUBLIC_TILE_URL/_ATTRIBUTION):
 *
 *   Stadia Maps — Alidade Smooth Dark (closest match to Basalt's palette):
 *     https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}@2x.png?api_key=KEY
 *     attribution: © Stadia Maps © OpenMapTiles © OpenStreetMap contributors
 *
 *   MapTiler — Dataviz Dark:
 *     https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}@2x.png?key=KEY
 *     attribution: © MapTiler © OpenStreetMap contributors
 */
export type TileConfig = { url: string; attribution: string };

export const WALK_TILE_URL = 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png';
export const WALK_TILE_ATTRIBUTION = '© OpenStreetMap contributors · © CARTO';
export const DEV_TILES: TileConfig = { url: WALK_TILE_URL, attribution: WALK_TILE_ATTRIBUTION };

export function buildWalkMapStyle(
  points: RoutePt[],
  colors: RouteMapColors,
  tiles: TileConfig = DEV_TILES,
): object {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [tiles.url],
        tileSize: TILE_SIZE,
        attribution: tiles.attribution,
      },
      route: { type: 'geojson', data: routeLineGeoJson(points) },
      endpoints: { type: 'geojson', data: routeEndpointsGeoJson(points) },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': colors.bg } },
      { id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-opacity': 0.92 } },
      {
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': colors.accent, 'line-width': 3 },
      },
      {
        id: 'route-start',
        type: 'circle',
        source: 'endpoints',
        filter: ['==', ['get', 'kind'], 'start'],
        paint: {
          'circle-radius': 5,
          'circle-color': colors.bg,
          'circle-stroke-color': colors.accent,
          'circle-stroke-width': 2,
        },
      },
      {
        id: 'route-end',
        type: 'circle',
        source: 'endpoints',
        filter: ['==', ['get', 'kind'], 'end'],
        paint: {
          'circle-radius': 6.5,
          'circle-color': colors.accent,
          'circle-stroke-color': colors.bg,
          'circle-stroke-width': 2.5,
        },
      },
    ],
  };
}

// ─── Flat projection for the share card ─────────────────────────────────────
//
// The share card draws the route as pure geometry (no tiles): deterministic,
// capture-safe, and free of tile-attribution requirements on the image.

export type ProjectedRoute = {
  /** Route in card pixel space, aspect-correct, centered. */
  points: [number, number][];
  start: [number, number] | null;
  end: [number, number] | null;
  /** A round-number scale bar that fits the card. */
  scaleBar: { px: number; label: string } | null;
};

const NICE_METERS = [100, 250, 500, 1000, 2000, 5000];

export function projectRoute(
  route: RoutePt[],
  viewport: { widthPx: number; heightPx: number; padPx?: number },
): ProjectedRoute {
  if (route.length < 2) return { points: [], start: null, end: null, scaleBar: null };
  const pad = viewport.padPx ?? 16;
  const xs = route.map((p) => p.lng / 360 + 0.5);
  const ys = route.map((p) => {
    const phi = (Math.max(-85, Math.min(85, p.lat)) * Math.PI) / 180;
    return 0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI);
  });
  const xMin = Math.min(...xs);
  const yMin = Math.min(...ys);
  const xSpan = Math.max(1e-12, Math.max(...xs) - xMin);
  const ySpan = Math.max(1e-12, Math.max(...ys) - yMin);
  const availW = viewport.widthPx - 2 * pad;
  const availH = viewport.heightPx - 2 * pad;
  const scale = Math.min(availW / xSpan, availH / ySpan);
  const offX = pad + (availW - xSpan * scale) / 2;
  const offY = pad + (availH - ySpan * scale) / 2;
  const points = route.map((_, i) => [
    offX + (xs[i]! - xMin) * scale,
    offY + (ys[i]! - yMin) * scale,
  ] as [number, number]);

  // Meters-per-pixel from the real route span (haversine over the bbox width).
  const west = { lat: route[0]!.lat, lng: Math.min(...route.map((p) => p.lng)) };
  const east = { lat: route[0]!.lat, lng: Math.max(...route.map((p) => p.lng)) };
  const bboxMeters = haversineM(west, east);
  const mPerPx = bboxMeters > 0 ? bboxMeters / (xSpan * scale) : 0;
  let scaleBar: ProjectedRoute['scaleBar'] = null;
  if (mPerPx > 0) {
    for (const m of NICE_METERS) {
      const px = m / mPerPx;
      if (px >= 50 && px <= 140) {
        scaleBar = { px: Math.round(px), label: m >= 1000 ? `${m / 1000} km` : `${m} m` };
        break;
      }
    }
  }
  return { points, start: points[0] ?? null, end: points[points.length - 1] ?? null, scaleBar };
}
