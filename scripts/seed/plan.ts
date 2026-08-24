import { isoDay } from '@basalt/core-data';
import { makeRng, chance, uniform, jitter, round1, clamp, type Rng } from './rng';

// The 90-day plan — one pass of deterministic generation that every seeding
// step reads from, so weight/sleep/training/food all stay internally
// consistent (a deload week has lighter training AND slightly better sleep
// AND isn't also flagged as an over-cap day by coincidence-that-looks-fake).

export const DAYS = 90;
export const SEED = 20260822; // fixed — re-runs must regenerate identical data

export type FoodCoverage = 'none' | 'breakfast_only' | 'full';

export type DayPlan = {
  index: number; // 0 = 89 days ago … 89 = today
  dateISO: string;
  weekIndex: number; // 0-12
  dayOfWeek: number; // 0=Sun .. 6=Sat
  isDeloadWeek: boolean;
  foodCoverage: FoodCoverage;
  isOverCap: boolean;
  hasTraining: boolean;
  isTrainingPR: boolean; // this session includes a genuine PR
  sleepHours: number;
  sleepQuality: number; // 1-5
  weighIn: number | null; // kg, null = not weighed that day
  weightSource: 'manual' | 'health_connect' | null;
  restingHr: number;
  hrvMs: number;
  steps: number;
};

function dateForIndex(index: number): Date {
  // index counts up to "today" (89) — mirrors sync.ts's dateNDaysAgo, just
  // walking forward from 89 days ago instead of backward from today, so
  // local calendar-day arithmetic (DST-safe) stays identical to the app's.
  const d = new Date();
  d.setHours(12, 0, 0, 0); // noon avoids DST edge cases entirely
  d.setDate(d.getDate() - (DAYS - 1 - index));
  return d;
}

/** Smooth weight trend: gentle deficit with two plateau bands, not a straight line. */
function trendWeightKg(index: number, startKg: number): number {
  const t = index / (DAYS - 1);
  const linear = -4.2 * t; // ~4.2kg over 90 days
  const plateauWobble = 0.6 * Math.sin(t * Math.PI * 2.4) * (1 - t * 0.4);
  return startKg + linear + plateauWobble;
}

export function buildPlan(): DayPlan[] {
  const rng = makeRng(SEED);
  const startWeightKg = 88.4;
  const plans: DayPlan[] = [];

  for (let index = 0; index < DAYS; index++) {
    const date = dateForIndex(index);
    const dateISO = isoDay(date);
    const weekIndex = Math.floor(index / 7);
    const dayOfWeek = date.getDay();
    const isDeloadWeek = weekIndex === 5 || weekIndex === 10;

    // ── Logging behaviour — the honest gaps ──────────────────────────────
    const missedRoll = rng();
    const foodCoverage: FoodCoverage =
      missedRoll < 0.11 ? 'none' : missedRoll < 0.20 ? 'breakfast_only' : 'full';
    const isOverCap = foodCoverage !== 'none' && chance(rng, 0.22);

    // ── Training split ────────────────────────────────────────────────
    // Push/Pull/Legs/Rest/Upper/Rest/Lower, most weeks; skip a session
    // ~15% of the time even on a scheduled day (life happens), and only
    // 3 sessions/week during deload weeks.
    const scheduledSplit = ['push', 'pull', 'legs', 'rest', 'upper', 'rest', 'lower'][dayOfWeek];
    const scheduledTrainingDay = scheduledSplit !== 'rest';
    const deloadSkip = isDeloadWeek && dayOfWeek % 2 === 0;
    const hasTraining = scheduledTrainingDay && !deloadSkip && chance(rng, 0.85) && foodCoverage !== 'none';
    const isTrainingPR =
      hasTraining && !isDeloadWeek && [22, 23, 51, 52, 76, 77].includes(index) ? true : false;

    // ── Sleep ─────────────────────────────────────────────────────────
    const badNight = chance(rng, hasTraining ? 0.10 : 0.16);
    const sleepHours = round1(
      badNight ? uniform(rng, 4.2, 5.6) : clamp(uniform(rng, 6.6, 8.4) + jitter(rng, 0.3), 5.8, 9.2),
    );
    const sleepQuality = clamp(Math.round((sleepHours - 4) / 1.1 + jitter(rng, 0.6)), 1, 5);

    // ── Weigh-in ──────────────────────────────────────────────────────
    const weighInLogged = foodCoverage !== 'none' ? chance(rng, 0.78) : chance(rng, 0.35);
    const weighIn = weighInLogged
      ? round1(trendWeightKg(index, startWeightKg) + jitter(rng, 0.45))
      : null;
    const weightSource: DayPlan['weightSource'] = weighInLogged ? (chance(rng, 0.3) ? 'health_connect' : 'manual') : null;

    // ── Vitals — dip after a bad night or a hard/PR session the day before ──
    const prevHard = index > 0 && plans[index - 1]?.isTrainingPR;
    const restingHr = Math.round(clamp(58 + (badNight ? 6 : 0) + (prevHard ? 3 : 0) + jitter(rng, 4), 48, 78));
    const hrvMs = Math.round(clamp(52 - (badNight ? 10 : 0) - (prevHard ? 6 : 0) + jitter(rng, 8), 22, 78));
    const steps = Math.round(
      clamp(
        (hasTraining ? 8200 : 5600) + (dayOfWeek === 0 || dayOfWeek === 6 ? 1400 : 0) + jitter(rng, 2200),
        1800,
        16000,
      ),
    );

    plans.push({
      index, dateISO, weekIndex, dayOfWeek, isDeloadWeek,
      foodCoverage, isOverCap, hasTraining, isTrainingPR,
      sleepHours, sleepQuality, weighIn, weightSource,
      restingHr, hrvMs, steps,
    });
  }
  return plans;
}

/** A stable per-day RNG derived from the plan seed + index, for food/training detail generation. */
export function rngForDay(index: number): Rng {
  return makeRng(SEED + index * 7919); // 7919 is prime — decorrelates from the plan's own rolls
}
