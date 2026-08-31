import { describe, it, expect } from 'vitest';
import {
  distanceToRouteM, stepDeviation, DEVIATION_ALERT_M, DEVIATION_REARM_M,
  type DeviationState,
} from './route-deviation';

// ~1° lat ≈ 111.32 km; 0.001° ≈ 111 m.
const route = [
  { lat: -37.8, lng: 145.0 },
  { lat: -37.8, lng: 145.01 }, // ~880 m east
];

describe('distanceToRouteM', () => {
  it('a point on the line is at ~0', () => {
    expect(distanceToRouteM({ lat: -37.8, lng: 145.005 }, route)).toBeLessThan(1);
  });

  it('perpendicular offset measures the offset, not the vertex distance', () => {
    // 0.0005° lat ≈ 55.7 m off the middle of the segment
    const d = distanceToRouteM({ lat: -37.8005, lng: 145.005 }, route);
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(62);
  });

  it('beyond the segment end it measures to the endpoint', () => {
    const d = distanceToRouteM({ lat: -37.8, lng: 145.0102 }, route);
    expect(d).toBeGreaterThan(15);
    expect(d).toBeLessThan(22);
  });

  it('an empty route is infinitely far — nothing to deviate from', () => {
    expect(distanceToRouteM({ lat: 0, lng: 0 }, [])).toBe(Infinity);
  });
});

describe('stepDeviation — once per excursion', () => {
  it(`pins the published thresholds: alert ${DEVIATION_ALERT_M} m, re-arm ${DEVIATION_REARM_M} m`, () => {
    expect(DEVIATION_ALERT_M).toBe(50);
    expect(DEVIATION_REARM_M).toBe(25);
  });

  it('buzzes once on crossing, stays silent while still off', () => {
    const s: DeviationState = { off: false };
    expect(stepDeviation(s, 60)).toBe(true);
    expect(stepDeviation(s, 80)).toBe(false);
    expect(stepDeviation(s, 55)).toBe(false);
  });

  it('hysteresis: edge-walking between 25 and 50 m never re-buzzes', () => {
    const s: DeviationState = { off: false };
    stepDeviation(s, 60); // buzz
    expect(stepDeviation(s, 40)).toBe(false); // between re-arm and alert — silent
    expect(stepDeviation(s, 49)).toBe(false);
    expect(stepDeviation(s, 20)).toBe(false); // re-armed, silently
    expect(stepDeviation(s, 60)).toBe(true); // a NEW excursion buzzes again
  });
});
