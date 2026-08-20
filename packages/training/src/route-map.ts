// Route → map primitives, all pure: GeoJSON for the line and endpoints, a
// deterministic camera fit (Web-Mercator math, no map ref timing), and the
// complete MapLibre style JSON for the walk tile — dark raster base, one
// accent route line, hollow start / filled end markers, per the prototype's
// map treatment. The RN component stays a thin shell around these.

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
 * OSM-data raster base in its dark rendering (CARTO dark_all — data
 * © OpenStreetMap contributors, tiles © CARTO), named in the source
 * attribution and echoed by the srcnote under the map.
 */
export const WALK_TILE_URL = 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png';
export const WALK_TILE_ATTRIBUTION = '© OpenStreetMap contributors · © CARTO';

export function buildWalkMapStyle(
  points: RoutePt[],
  colors: RouteMapColors,
  tileUrl: string = WALK_TILE_URL,
): object {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: TILE_SIZE,
        attribution: WALK_TILE_ATTRIBUTION,
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
