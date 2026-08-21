// free-exercise-db muscle names → body-figure regions. The mapping is
// published here in full; every one of the dataset's 17 muscle values has
// a home, so no exercise silently highlights nothing.

export type BodyRegion =
  | 'chest' | 'core' | 'arms' | 'shoulders' | 'quads' | 'calves'
  | 'back' | 'glutes' | 'hamstrings';

export const REGION_FOR_MUSCLE: Record<string, BodyRegion> = {
  chest: 'chest',
  abdominals: 'core',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  shoulders: 'shoulders',
  traps: 'shoulders',
  neck: 'shoulders',
  quadriceps: 'quads',
  abductors: 'glutes',
  adductors: 'quads',
  calves: 'calves',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
};

export type RegionEmphasis = Partial<Record<BodyRegion, 'primary' | 'secondary'>>;

/** Primary muscles win over secondary when both map to one region. */
export function regionsFor(ex: { primaryMuscles: string[]; secondaryMuscles: string[] }): RegionEmphasis {
  const out: RegionEmphasis = {};
  for (const m of ex.secondaryMuscles) {
    const region = REGION_FOR_MUSCLE[m.toLowerCase()];
    if (region) out[region] = 'secondary';
  }
  for (const m of ex.primaryMuscles) {
    const region = REGION_FOR_MUSCLE[m.toLowerCase()];
    if (region) out[region] = 'primary';
  }
  return out;
}

/** Emphasis → figure fill intensity (primary solid, secondary faded). */
export function intensityFor(emphasis: RegionEmphasis): Partial<Record<BodyRegion, number>> {
  const out: Partial<Record<BodyRegion, number>> = {};
  for (const [region, kind] of Object.entries(emphasis) as [BodyRegion, 'primary' | 'secondary'][]) {
    out[region] = kind === 'primary' ? 1 : 0.4;
  }
  return out;
}
