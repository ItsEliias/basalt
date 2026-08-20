// GPS capture core — ported from the quarry's walk tracker (haversine, the
// 30 m accuracy filter, the 3 m jitter filter) and extended with what the
// audit found missing entirely: Douglas-Peucker simplification before save,
// per-km splits, and elevation gain. All pure; the screen owns the sensors.

export type GpsFix = {
  lat: number;
  lng: number;
  /** ms epoch. */
  time: number;
  /** Reported horizontal accuracy in metres. */
  accuracy: number;
  /** Metres above sea level when the fix carries it. */
  altitude?: number | null;
};

/** Reject fixes worse than this — bad fixes inflate distance. */
export const MAX_ACCURACY_M = 30;
/** Reject consecutive points closer than this — standing-still jitter. */
export const MIN_MOVE_M = 3;
/** Altitude deltas smaller than this are barometric/GPS noise, not climbing. */
export const MIN_CLIMB_M = 2;

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function routeDistanceM(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineM(points[i - 1]!, points[i]!);
  return total;
}

/**
 * The fix filter: accept a new fix into the route? Ported semantics —
 * accuracy gate first, then the jitter gate against the last KEPT point.
 */
export function acceptFix(lastKept: GpsFix | null, next: GpsFix): boolean {
  if (next.accuracy > MAX_ACCURACY_M) return false;
  if (lastKept && haversineM(lastKept, next) < MIN_MOVE_M) return false;
  return true;
}

/** Σ positive altitude deltas ≥ MIN_CLIMB_M — honest climbing, not noise. */
export function elevationGainM(points: GpsFix[]): number | null {
  const alts = points.map((p) => p.altitude).filter((a): a is number => a != null && isFinite(a));
  if (alts.length < 2) return null;
  let gain = 0;
  let last = alts[0]!;
  for (const a of alts.slice(1)) {
    const delta = a - last;
    if (Math.abs(delta) >= MIN_CLIMB_M) {
      if (delta > 0) gain += delta;
      last = a;
    }
  }
  return Math.round(gain);
}

// ─── Douglas-Peucker ────────────────────────────────────────────────────────
// Planar approximation in metres (equirectangular, cos-scaled longitude) —
// exact enough at walking scale, cheap enough to run before every save.

function toXY(p: { lat: number; lng: number }, refLat: number): { x: number; y: number } {
  const R = 6371000;
  const rad = Math.PI / 180;
  return { x: p.lng * rad * R * Math.cos(refLat * rad), y: p.lat * rad * R };
}

function perpendicularDistanceM(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const refLat = (a.lat + b.lat) / 2;
  const P = toXY(p, refLat);
  const A = toXY(a, refLat);
  const B = toXY(b, refLat);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(P.x - A.x, P.y - A.y);
  const t = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2));
  return Math.hypot(P.x - (A.x + t * dx), P.y - (A.y + t * dy));
}

/** Simplify a route, keeping every point that deviates ≥ `epsilonM`. */
export function simplifyRoute<T extends { lat: number; lng: number }>(points: T[], epsilonM = 5): T[] {
  if (points.length <= 2) return [...points];
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistanceM(points[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist < epsilonM) return [first, last];
  const left = simplifyRoute(points.slice(0, maxIdx + 1), epsilonM);
  const right = simplifyRoute(points.slice(maxIdx), epsilonM);
  return [...left.slice(0, -1), ...right];
}

// ─── Splits ─────────────────────────────────────────────────────────────────

export type Split = {
  /** 1-based km number; the final partial split keeps its number. */
  km: number;
  /** Metres in this split (1000 except the last partial). */
  distanceM: number;
  /** Elapsed seconds within the split. */
  seconds: number;
  /** Pace in s/km, scaled from partial distance. */
  paceSecPerKm: number;
};

/** Per-km splits from timestamped points; a trailing partial < 50 m is dropped. */
export function computeSplits(points: GpsFix[]): Split[] {
  if (points.length < 2) return [];
  const splits: Split[] = [];
  let km = 1;
  let acc = 0;
  let splitStartTime = points[0]!.time;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    let segment = haversineM(prev, cur);
    let segStartTime = prev.time;
    const segDuration = cur.time - prev.time;

    while (acc + segment >= 1000) {
      const need = 1000 - acc;
      const frac = segment > 0 ? need / segment : 0;
      const crossTime = segStartTime + segDuration * frac;
      const seconds = Math.round((crossTime - splitStartTime) / 1000);
      splits.push({ km, distanceM: 1000, seconds, paceSecPerKm: seconds });
      km += 1;
      splitStartTime = crossTime;
      segStartTime = crossTime;
      segment -= need;
      acc = 0;
    }
    acc += segment;
  }

  if (acc >= 50) {
    const seconds = Math.round((points[points.length - 1]!.time - splitStartTime) / 1000);
    splits.push({
      km,
      distanceM: Math.round(acc),
      seconds,
      paceSecPerKm: Math.round(seconds / (acc / 1000)),
    });
  }
  return splits;
}

/** Whole-walk summary ready for the basalt_walks row. */
export function summarizeWalk(points: GpsFix[], startedAtMs: number, endedAtMs: number): {
  distanceM: number;
  durationS: number;
  avgPaceSecPerKm: number | null;
  elevationGainM: number | null;
  splits: Split[];
  simplified: { lat: number; lng: number; t: number }[];
} {
  const distanceM = Math.round(routeDistanceM(points));
  const durationS = Math.max(1, Math.round((endedAtMs - startedAtMs) / 1000));
  return {
    distanceM,
    durationS,
    avgPaceSecPerKm: distanceM > 0 ? Math.round(durationS / (distanceM / 1000)) : null,
    elevationGainM: elevationGainM(points),
    splits: computeSplits(points),
    simplified: simplifyRoute(points).map((p) => ({ lat: p.lat, lng: p.lng, t: p.time })),
  };
}
