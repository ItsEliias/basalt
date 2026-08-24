import { uniform, jitter, type Rng } from './rng';

// A synthetic out-and-back GPS trace, fed into @basalt/training's own
// summarizeWalk() so seeded basalt_walks rows go through the exact same
// distance/pace/elevation/simplification math a real device trace would —
// not hand-computed totals that could drift from what the app itself shows.

const ORIGIN = { lat: -33.8688, lng: 151.2093 }; // arbitrary, fixed for the whole run
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);

export type SeedGpsFix = { lat: number; lng: number; time: number; accuracy: number; altitude?: number | null };

/** ~`targetKm` out-and-back loop starting at `startedAtMs`, one fix every ~15s. */
export function buildWalkFixes(rng: Rng, startedAtMs: number, targetKm: number): SeedGpsFix[] {
  const paceMPerS = uniform(rng, 1.25, 1.55); // ~4.5-5.6 km/h walking pace
  const totalM = targetKm * 1000;
  const totalS = totalM / paceMPerS;
  const pointCount = Math.max(20, Math.round(totalS / 15));
  const headingOut = uniform(rng, 0, Math.PI * 2);
  const wobble = uniform(rng, 0.05, 0.18);

  const points: SeedGpsFix[] = [];
  for (let i = 0; i < pointCount; i++) {
    const t = i / (pointCount - 1);
    const leg = t < 0.5 ? t * 2 : (1 - t) * 2; // 0 -> 1 -> 0, out then back
    const distSoFarM = leg * (totalM / 2);
    const heading = headingOut + Math.sin(t * Math.PI * 3) * wobble; // a wandering path, not a ruler line
    const lat = ORIGIN.lat + (Math.sin(heading) * distSoFarM) / M_PER_DEG_LAT;
    const lng = ORIGIN.lng + (Math.cos(heading) * distSoFarM) / M_PER_DEG_LNG;
    points.push({
      lat: lat + jitter(rng, 0.00002),
      lng: lng + jitter(rng, 0.00002),
      time: startedAtMs + Math.round(t * totalS * 1000),
      accuracy: uniform(rng, 4, 14),
      altitude: 12 + jitter(rng, 3),
    });
  }
  return points;
}
