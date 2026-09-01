import { describe, it, expect } from 'vitest';
import {
  tileCachingAllowed, tileCachePolicyNote, routeBounds, mbText, packNameForWalk, TILE_CACHE_RULES,
} from './tile-cache';

describe('tile cache policy — provider-gated', () => {
  const stadia = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}@2x.png?api_key=KEY';
  const carto = 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png';

  it('Stadia with a key → allowed; keyless Stadia or CARTO → refused', () => {
    expect(tileCachingAllowed(stadia)).toBe(true);
    expect(tileCachingAllowed(stadia.replace('?api_key=KEY', ''))).toBe(false);
    expect(tileCachingAllowed(carto)).toBe(false);
  });

  it('both notes state the terms, not just the behaviour', () => {
    expect(tileCachePolicyNote(stadia)).toContain('Stadia');
    expect(tileCachePolicyNote(carto)).toMatch(/do not permit bulk download/);
    expect(tileCachePolicyNote(carto)).toMatch(/route line only/);
  });

  it('budgets published and inside Stadia\'s 100 MB/device allowance', () => {
    expect(TILE_CACHE_RULES.maxBytesPerRoute).toBe(40 * 1024 * 1024);
    expect(TILE_CACHE_RULES.maxDeviceBytes).toBeLessThan(100 * 1024 * 1024);
    expect(TILE_CACHE_RULES.minZoom).toBe(13);
    expect(TILE_CACHE_RULES.maxZoom).toBe(15);
  });
});

describe('routeBounds', () => {
  it('pads the bbox by metres in both axes', () => {
    const b = routeBounds([{ lat: -37.8, lng: 145.0 }, { lat: -37.81, lng: 145.02 }], 250)!;
    expect(b[0]).toBeLessThan(145.0);
    expect(b[1]).toBeLessThan(-37.81);
    expect(b[2]).toBeGreaterThan(145.02);
    expect(b[3]).toBeGreaterThan(-37.8);
    // ~250 m ≈ 0.00225° of latitude
    expect(-37.81 - b[1]).toBeCloseTo(250 / 111320, 4);
  });

  it('empty route → null, no pack for nothing', () => {
    expect(routeBounds([])).toBeNull();
  });
});

describe('formatting', () => {
  it('MB with one decimal; pack names are per-walk', () => {
    expect(mbText(12_945_408)).toBe('12.3 MB');
    expect(packNameForWalk('abc')).toBe('walk-abc');
  });
});
