import type { BodyRegion, RegionEmphasis } from './muscle-map';
import type { BlockPhase } from './periodization';

// Weekly per-muscle volume vs a published band (V3 Phase 5, after the
// periodization engine landed). Counting rule, stated in full:
//   · a completed set counts 1.0 toward every region its exercise hits
//     as PRIMARY and 0.5 as SECONDARY — half-credit is stated, not hidden
//   · the band is the widely published 10–20 hard-sets-per-muscle-per-week
//     range; a deload week halves it (5–10) because that's what a deload
//     is. The band is guidance to compare against, never a prescription.

export const WEEKLY_SET_BAND = { low: 10, high: 20 } as const;
export const SECONDARY_CREDIT = 0.5;

export type RegionVolume = {
  region: BodyRegion;
  sets: number;
  bandLow: number;
  bandHigh: number;
  /** 'below' | 'inside' | 'above' — a position, not a grade. */
  position: 'below' | 'inside' | 'above';
};

export function bandForPhase(phase: BlockPhase | null): { low: number; high: number } {
  if (phase === 'deload') {
    return { low: Math.round(WEEKLY_SET_BAND.low / 2), high: Math.round(WEEKLY_SET_BAND.high / 2) };
  }
  return WEEKLY_SET_BAND;
}

/**
 * Sum a week's completed sets into per-region volume. `setsByExercise`
 * pairs each exercise's region emphasis with its completed set count.
 */
export function weeklyMuscleVolume(
  setsByExercise: { emphasis: RegionEmphasis; sets: number }[],
  phase: BlockPhase | null = null,
): RegionVolume[] {
  const band = bandForPhase(phase);
  const totals = new Map<BodyRegion, number>();
  for (const { emphasis, sets } of setsByExercise) {
    for (const [region, kind] of Object.entries(emphasis) as [BodyRegion, 'primary' | 'secondary'][]) {
      const credit = kind === 'primary' ? 1 : SECONDARY_CREDIT;
      totals.set(region, (totals.get(region) ?? 0) + sets * credit);
    }
  }
  return [...totals.entries()]
    .map(([region, sets]) => ({
      region,
      sets: Math.round(sets * 10) / 10,
      bandLow: band.low,
      bandHigh: band.high,
      position: (sets < band.low ? 'below' : sets > band.high ? 'above' : 'inside') as RegionVolume['position'],
    }))
    .sort((a, b) => b.sets - a.sets);
}

/** "12.5 of 10–20 sets · inside the band" — a position, never a grade. */
export function volumeLine(v: RegionVolume): string {
  const n = Number.isInteger(v.sets) ? String(v.sets) : v.sets.toFixed(1);
  return `${n} of ${v.bandLow}–${v.bandHigh} sets · ${v.position === 'inside' ? 'inside the band' : `${v.position} the band`}`;
}
