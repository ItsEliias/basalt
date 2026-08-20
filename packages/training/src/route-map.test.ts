import { describe, it, expect } from 'vitest';
import {
  routeLineGeoJson, routeEndpointsGeoJson, cameraForRoute, buildWalkMapStyle,
  WALK_TILE_ATTRIBUTION,
} from './route-map';

const COLORS = { bg: '#0F1115', accent: '#3E9B78' };

// ~1.1 km diagonal in Sydney
const ROUTE = [
  { lat: -33.8688, lng: 151.2093 },
  { lat: -33.8660, lng: 151.2120 },
  { lat: -33.8630, lng: 151.2150 },
];

describe('geojson builders', () => {
  it('line follows the route in [lng, lat] order', () => {
    const f = routeLineGeoJson(ROUTE) as any;
    expect(f.geometry.type).toBe('LineString');
    expect(f.geometry.coordinates[0]).toEqual([151.2093, -33.8688]);
    expect(f.geometry.coordinates).toHaveLength(3);
  });

  it('endpoints carry kind start/end at the right coords', () => {
    const fc = routeEndpointsGeoJson(ROUTE) as any;
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].properties.kind).toBe('start');
    expect(fc.features[1].properties.kind).toBe('end');
    expect(fc.features[1].geometry.coordinates).toEqual([151.215, -33.863]);
  });

  it('a single fix yields only a start marker', () => {
    const fc = routeEndpointsGeoJson([ROUTE[0]!]) as any;
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties.kind).toBe('start');
  });
});

describe('cameraForRoute', () => {
  const VIEW = { widthPx: 358, heightPx: 240, paddingPx: 28 };

  it('centers on the bbox middle', () => {
    const cam = cameraForRoute(ROUTE, VIEW)!;
    expect(cam.center[0]).toBeCloseTo((151.2093 + 151.215) / 2, 4);
    expect(cam.center[1]).toBeCloseTo((-33.8688 + -33.863) / 2, 3);
  });

  it('zoom fits the tighter axis and lands in a sane street range', () => {
    const cam = cameraForRoute(ROUTE, VIEW)!;
    expect(cam.zoom).toBeGreaterThan(12);
    expect(cam.zoom).toBeLessThan(17);
  });

  it('a longer route zooms out relative to a shorter one', () => {
    const long = [ROUTE[0]!, { lat: -33.80, lng: 151.28 }];
    expect(cameraForRoute(long, VIEW)!.zoom).toBeLessThan(cameraForRoute(ROUTE, VIEW)!.zoom);
  });

  it('degenerate cases: empty → null, single point → fixed street zoom', () => {
    expect(cameraForRoute([], VIEW)).toBeNull();
    const cam = cameraForRoute([ROUTE[0]!], VIEW)!;
    expect(cam.zoom).toBe(16);
    expect(cam.center[0]).toBe(151.2093);
    expect(cam.center[1]).toBeCloseTo(-33.8688, 9); // mercator round-trip float noise
  });
});

describe('buildWalkMapStyle', () => {
  const style = buildWalkMapStyle(ROUTE, COLORS) as any;

  it('is a v8 style with basemap, route and endpoint sources', () => {
    expect(style.version).toBe(8);
    expect(Object.keys(style.sources)).toEqual(['basemap', 'route', 'endpoints']);
    expect(style.sources.basemap.attribution).toBe(WALK_TILE_ATTRIBUTION);
  });

  it('route line wears the single accent, rounded', () => {
    const line = style.layers.find((l: any) => l.id === 'route-line');
    expect(line.paint['line-color']).toBe('#3E9B78');
    expect(line.paint['line-width']).toBe(3);
    expect(line.layout['line-cap']).toBe('round');
  });

  it('start is hollow (bg fill, accent ring); end is filled accent', () => {
    const start = style.layers.find((l: any) => l.id === 'route-start');
    const end = style.layers.find((l: any) => l.id === 'route-end');
    expect(start.paint['circle-color']).toBe('#0F1115');
    expect(start.paint['circle-stroke-color']).toBe('#3E9B78');
    expect(end.paint['circle-color']).toBe('#3E9B78');
    expect(start.filter).toEqual(['==', ['get', 'kind'], 'start']);
  });

  it('background sits under the raster so tile gaps stay dark, not white', () => {
    expect(style.layers[0]).toMatchObject({ type: 'background' });
    expect(style.layers[0].paint['background-color']).toBe('#0F1115');
    expect(style.layers[1].type).toBe('raster');
  });
});
