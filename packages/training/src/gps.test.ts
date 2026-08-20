import { describe, it, expect } from 'vitest';
import {
  haversineM, routeDistanceM, acceptFix, elevationGainM, simplifyRoute,
  computeSplits, summarizeWalk, MAX_ACCURACY_M, type GpsFix,
} from './gps';

// ~0.008983° of latitude ≈ 1000 m; walking "north" makes clean fixtures.
const LAT_PER_KM = 0.008983;

function fix(kmNorth: number, timeS: number, extra: Partial<GpsFix> = {}): GpsFix {
  return {
    lat: -37.8 + kmNorth * LAT_PER_KM,
    lng: 144.96,
    time: timeS * 1000,
    accuracy: 5,
    ...extra,
  };
}

describe('haversineM (ported)', () => {
  it('measures ~1000 m per 0.008983° latitude', () => {
    expect(haversineM(fix(0, 0), fix(1, 0))).toBeCloseTo(1000, -1);
  });
  it('zero for identical points', () => {
    expect(haversineM(fix(0, 0), fix(0, 0))).toBe(0);
  });
});

describe('acceptFix (ported filters)', () => {
  it('rejects fixes beyond the accuracy gate', () => {
    expect(acceptFix(null, fix(0, 0, { accuracy: MAX_ACCURACY_M + 1 }))).toBe(false);
    expect(acceptFix(null, fix(0, 0, { accuracy: 30 }))).toBe(true);
  });
  it('rejects standing-still jitter under 3 m from the last kept point', () => {
    const kept = fix(0, 0);
    const jitter = { ...kept, time: 1000, lat: kept.lat + 0.00001 }; // ~1.1 m
    expect(acceptFix(kept, jitter)).toBe(false);
    expect(acceptFix(kept, fix(0.005, 1))).toBe(true); // ~5 m
  });
});

describe('elevationGainM', () => {
  it('sums real climbs and ignores sub-2m noise', () => {
    const pts = [0, 1, 0.5, 4, 3.5, 10, 9].map((alt, i) => fix(i * 0.1, i * 60, { altitude: alt }));
    // deltas ≥2m from running reference: 0→4 (+4), 4→10 (+6) = 10
    expect(elevationGainM(pts)).toBe(10);
  });
  it('null with no altitude data — hidden, not zero', () => {
    expect(elevationGainM([fix(0, 0), fix(1, 600)])).toBeNull();
  });
});

describe('simplifyRoute (Douglas-Peucker)', () => {
  it('collapses collinear points to the endpoints', () => {
    const line = [0, 0.25, 0.5, 0.75, 1].map((km, i) => fix(km, i * 300));
    expect(simplifyRoute(line)).toHaveLength(2);
  });
  it('keeps a genuine corner', () => {
    const corner = [
      fix(0, 0),
      fix(0.5, 300),
      { ...fix(0.5, 600), lng: 144.97 }, // ~880 m east — a real turn
    ];
    expect(simplifyRoute(corner)).toHaveLength(3);
  });
  it('drops sub-epsilon wobble on a straight', () => {
    const wobble = [
      fix(0, 0),
      { ...fix(0.5, 300), lng: 144.96002 }, // ~1.8 m off the line
      fix(1, 600),
    ];
    expect(simplifyRoute(wobble, 5)).toHaveLength(2);
  });
});

describe('computeSplits', () => {
  it('cuts exact 1 km splits with per-split pace', () => {
    // 2.5 km at a steady 600 s/km.
    const pts = [0, 0.5, 1, 1.5, 2, 2.5].map((km) => fix(km, km * 600));
    const splits = computeSplits(pts);
    expect(splits).toHaveLength(3);
    expect(splits[0]?.km).toBe(1);
    expect(splits[0]?.distanceM).toBe(1000);
    expect(splits[0]?.paceSecPerKm).toBeCloseTo(600, -1);
    expect(splits[1]?.paceSecPerKm).toBeCloseTo(600, -1);
    expect(splits[2]?.km).toBe(3);
    expect(splits[2]?.distanceM).toBeCloseTo(500, -1);
    expect(splits[2]?.paceSecPerKm).toBeCloseTo(600, -1);
  });

  it('a faster second km shows in its pace', () => {
    const pts = [fix(0, 0), fix(1, 600), fix(2, 1080)]; // km2 in 480 s
    const splits = computeSplits(pts);
    expect(splits[0]?.paceSecPerKm).toBeCloseTo(600, -1);
    expect(splits[1]?.paceSecPerKm).toBeCloseTo(480, -1);
  });

  it('drops a trailing sliver under 50 m and handles empty input', () => {
    const pts = [fix(0, 0), fix(1, 600), fix(1.00002, 605)];
    expect(computeSplits(pts)).toHaveLength(1);
    expect(computeSplits([])).toEqual([]);
  });
});

describe('summarizeWalk', () => {
  it('produces the basalt_walks row shape from raw fixes', () => {
    const pts = [0, 0.5, 1, 1.5, 2].map((km) => fix(km, km * 540, { altitude: 10 + km * 5 }));
    const s = summarizeWalk(pts, 0, 2 * 540 * 1000);
    expect(s.distanceM).toBeCloseTo(2000, -1);
    expect(s.durationS).toBe(1080);
    expect(s.avgPaceSecPerKm).toBeCloseTo(540, -1);
    expect(s.elevationGainM).toBe(10);
    expect(s.splits).toHaveLength(2);
    expect(s.simplified.length).toBeLessThanOrEqual(pts.length);
    expect(s.simplified[0]).toHaveProperty('t');
  });

  it('a zero-distance walk reports null pace, not division fiction', () => {
    const s = summarizeWalk([fix(0, 0)], 0, 60000);
    expect(s.distanceM).toBe(0);
    expect(s.avgPaceSecPerKm).toBeNull();
  });
});

describe('routeDistanceM', () => {
  it('sums pairwise haversine', () => {
    expect(routeDistanceM([fix(0, 0), fix(1, 0), fix(2, 0)])).toBeCloseTo(2000, -1);
  });
});
