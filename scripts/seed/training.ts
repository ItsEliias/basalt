import { round1, clamp, jitter, type Rng } from './rng';
import type { DayPlan } from './plan';

// Per-lift progression: a smooth upward curve with two plateau windows,
// deload de-loading, and genuine PR spikes on the plan's flagged PR days.
// Not a straight line — plateaus are just the curve's derivative going flat
// for a few weeks, matching how real progression actually looks.

export type SetPlan = { setNumber: number; kg: number; reps: number; rir: number };

function weekProgressionFactor(weekIndex: number): number {
  // ~13 weeks total. Two plateau bands (weeks 3-4, weeks 8-9) where the
  // factor barely moves; steady ~0.8%/week the rest of the time.
  const bands = [
    [0, 0.0], [1, 0.011], [2, 0.022], [3, 0.026], [4, 0.028], // plateau starts
    [5, 0.0], // deload — handled separately via isDeloadWeek multiplier
    [6, 0.036], [7, 0.05], [8, 0.053], [9, 0.055], // plateau
    [10, 0.0], // deload
    [11, 0.07], [12, 0.086],
  ];
  const row = bands.find((b) => b[0] === weekIndex) ?? bands[bands.length - 1]!;
  return row[1]!;
}

export function buildSets(
  rng: Rng,
  lift: { name: string; startKg: number; reps: number },
  day: DayPlan,
): SetPlan[] {
  const progression = weekProgressionFactor(day.weekIndex);
  let workingKg = lift.startKg * (1 + progression);

  if (day.isDeloadWeek) workingKg *= 0.82;
  if (day.isTrainingPR) workingKg *= 1.06; // the spike above the smooth curve

  // Barbell plates round to 2.5kg; dumbbells/machines to whole kg.
  const roundTo = lift.startKg > 0 && lift.startKg % 2.5 === 0 ? 2.5 : 1;
  workingKg = Math.round(workingKg / roundTo) * roundTo;

  const setCount = day.isDeloadWeek ? 3 : 4;
  const sets: SetPlan[] = [];
  for (let i = 0; i < setCount; i++) {
    const fatigue = i * (day.isDeloadWeek ? 0.01 : 0.03); // later sets a touch lighter
    const kg = Math.max(0, round1(workingKg * (1 - fatigue) + jitter(rng, workingKg * 0.015)));
    const reps = Math.round(clamp(lift.reps + (day.isDeloadWeek ? 2 : 0) + jitter(rng, 1.2), 3, lift.reps + 4));
    const rir = day.isTrainingPR
      ? Math.round(clamp(0 + jitter(rng, 0.6), 0, 1))
      : day.isDeloadWeek
        ? Math.round(clamp(3.5 + jitter(rng, 0.8), 2, 5))
        : Math.round(clamp(2 + jitter(rng, 1.1), 0, 4));
    sets.push({ setNumber: i + 1, kg, reps, rir });
  }
  return sets;
}
