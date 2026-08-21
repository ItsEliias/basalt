import { haversineM } from './gps';
import type { RoutePt } from './route-map';

// Matched-route detection — "your usual loop" from your own saved walks.
// Two routes match when, resampled to the same point count, their mean
// point-to-point distance is under the threshold in either direction
// (a loop walked clockwise matches itself walked anticlockwise).

export const ROUTE_MATCH = { samples: 32, thresholdM: 80, minWalks: 3 } as const;

export function resampleRoute(route: RoutePt[], n = ROUTE_MATCH.samples): RoutePt[] {
  if (route.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < route.length; i++) {
    cum.push(cum[i - 1]! + haversineM(route[i - 1]!, route[i]!));
  }
  const total = cum[cum.length - 1]!;
  if (total <= 0) return [];
  const out: RoutePt[] = [];
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total;
    let i = cum.findIndex((c) => c >= target);
    if (i <= 0) i = 1;
    const span = cum[i]! - cum[i - 1]!;
    const t = span > 0 ? (target - cum[i - 1]!) / span : 0;
    out.push({
      lat: route[i - 1]!.lat + (route[i]!.lat - route[i - 1]!.lat) * t,
      lng: route[i - 1]!.lng + (route[i]!.lng - route[i - 1]!.lng) * t,
    });
  }
  return out;
}

/** Mean point distance, direction-agnostic. Infinity when unresamplable. */
export function routeSimilarityM(a: RoutePt[], b: RoutePt[]): number {
  const ra = resampleRoute(a);
  const rb = resampleRoute(b);
  if (ra.length === 0 || rb.length === 0) return Infinity;
  const mean = (xs: RoutePt[], ys: RoutePt[]) =>
    xs.reduce((s, p, i) => s + haversineM(p, ys[i]!), 0) / xs.length;
  return Math.min(mean(ra, rb), mean(ra, [...rb].reverse()));
}

export type RouteWalk = { id: string; route: RoutePt[] | null; durationS: number };

export type RouteCluster = { walkIds: string[]; medianDurationS: number };

/** Greedy clustering: each walk joins the first cluster it matches. */
export function clusterRoutes(walks: RouteWalk[]): RouteCluster[] {
  const clusters: { rep: RoutePt[]; walkIds: string[]; durations: number[] }[] = [];
  for (const w of walks) {
    if (!w.route || w.route.length < 2) continue;
    const hit = clusters.find((c) => routeSimilarityM(c.rep, w.route!) < ROUTE_MATCH.thresholdM);
    if (hit) {
      hit.walkIds.push(w.id);
      hit.durations.push(w.durationS);
    } else {
      clusters.push({ rep: w.route, walkIds: [w.id], durations: [w.durationS] });
    }
  }
  return clusters.map((c) => {
    const sorted = [...c.durations].sort((a, b) => a - b);
    return { walkIds: c.walkIds, medianDurationS: sorted[Math.floor(sorted.length / 2)]! };
  });
}

/** The biggest cluster with enough walks to call it "usual" — else null. */
export function usualLoop(walks: RouteWalk[]): RouteCluster | null {
  const clusters = clusterRoutes(walks).filter((c) => c.walkIds.length >= ROUTE_MATCH.minWalks);
  if (clusters.length === 0) return null;
  return clusters.sort((a, b) => b.walkIds.length - a.walkIds.length)[0]!;
}
