import { haversineM } from './gps';

// Haptic route deviation (V3 Phase 5) — while walking a generated loop,
// one vibration when you drift off it. Published numbers, off by default:
//   · off-route when the nearest point of the loop is further than
//     DEVIATION_ALERT_M (50 m — outside GPS noise, inside "wrong turn")
//   · the alert fires ONCE per excursion; it re-arms only after coming
//     back within DEVIATION_REARM_M (25 m), so a walk along the edge
//     never buzzes twice a minute.

export const DEVIATION_ALERT_M = 50;
export const DEVIATION_REARM_M = 25;

type Pt = { lat: number; lng: number };

/** Nearest distance from a point to the route's segments (local planar approx). */
export function distanceToRouteM(p: Pt, route: Pt[]): number {
  if (route.length === 0) return Infinity;
  if (route.length === 1) return haversineM(p, route[0]!);

  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const px = 0;
  const py = 0;
  const toXY = (q: Pt) => ({ x: (q.lng - p.lng) * mPerLng, y: (q.lat - p.lat) * mPerLat });

  let best = Infinity;
  for (let i = 1; i < route.length; i++) {
    const a = toXY(route[i - 1]!);
    const b = toXY(route[i]!);
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / len2));
    const dx = a.x + t * abx - px;
    const dy = a.y + t * aby - py;
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

export type DeviationState = { off: boolean };

/** Step the once-per-excursion state machine; returns whether to buzz NOW. */
export function stepDeviation(state: DeviationState, distanceM: number): boolean {
  if (!state.off && distanceM > DEVIATION_ALERT_M) {
    state.off = true;
    return true;
  }
  if (state.off && distanceM < DEVIATION_REARM_M) {
    state.off = false;
  }
  return false;
}
