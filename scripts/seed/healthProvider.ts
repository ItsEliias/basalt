// Deep relative imports, deliberately bypassing @basalt/health-connect's
// package index: that entry file imports `Platform` from react-native at
// module load time (to pick the platform provider), which throws under
// plain Node. stubProvider.ts and types.ts have no such dependency, so
// importing them directly sidesteps the problem entirely.
import { stubProvider } from '../../packages/health-connect/src/stubProvider';
import type { HealthProvider, SleepStageSegment } from '../../packages/health-connect/src/types';
import { ok } from '@basalt/core-data';
import type { DayPlan } from './plan';
import { rngForDay } from './plan';
import { uniform, clamp, type Rng } from './rng';

// A fake HealthProvider, same seam the package's own tests use ("the whole
// engine tests against fakes" — packages/health-connect/src/sync.ts). Real
// syncHealthData() drives it day-by-day and writes through the exact same
// code path a genuine Health Connect sync would, so sleep_sessions,
// sleep_stages, step_logs, basalt_vitals, and the HC-sourced subset of
// weight_entries all go through the service layer, not a raw insert.

const HC_ORIGIN = 'com.google.android.apps.healthdata';

function sleepStagesFor(bedtime: Date, hours: number, rng: Rng): SleepStageSegment[] {
  const totalMin = Math.round(hours * 60);
  const shares = { awake: 0.05, light: 0.52, deep: 0.20, rem: 0.23 } as const;
  let cursor = new Date(bedtime);
  const stages: SleepStageSegment[] = [];
  // 4-6 alternating chunks per stage share, rather than one giant block per
  // stage, so it reads like real HC data (stages cycle through the night).
  const order: (keyof typeof shares)[] = ['light', 'deep', 'light', 'rem', 'light', 'deep', 'rem', 'light', 'awake'];
  const weights = order.map((s) => shares[s]);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < order.length; i++) {
    const stage = order[i]!;
    const minutes = Math.max(3, Math.round((totalMin * weights[i]!) / weightSum + uniform(rng, -4, 4)));
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + minutes * 60000);
    stages.push({ stage, startTime: start.toISOString(), endTime: end.toISOString(), minutes });
    cursor = end;
  }
  return stages;
}

/** Builds a fake provider whose reads are keyed by ISO date, from the plan. */
export function buildSeedProvider(plansByDate: Map<string, DayPlan>): HealthProvider {
  return {
    ...stubProvider,
    async isAvailable() {
      return ok('available');
    },
    async getGrantedPermissions() {
      return ok(['sleep', 'steps', 'weight', 'hydration', 'hrv', 'restingHeartRate']);
    },

    async getSleepSessionForNight(date) {
      const plan = date ? plansByDate.get(date) : undefined;
      if (!plan || plan.foodCoverage === 'none') return ok(null); // a missed day skipped the watch too, sometimes
      const rng = rngForDay(plan.index + 5000);
      // Bedtime the *previous* local evening, waking on `date`.
      const wake = new Date(`${date}T00:00:00`);
      wake.setHours(6, Math.round(uniform(rng, 0, 50)), 0, 0);
      const bedtime = new Date(wake.getTime() - plan.sleepHours * 3600000);
      const stages = sleepStagesFor(bedtime, plan.sleepHours, rng);
      return ok({
        id: `seed-sleep-${plan.dateISO}`,
        startTime: bedtime.toISOString(),
        endTime: wake.toISOString(),
        hours: plan.sleepHours,
        stages,
        hasRealStages: true,
        dataOrigin: HC_ORIGIN,
      });
    },

    async getStepsForDay(date) {
      const plan = date ? plansByDate.get(date) : undefined;
      return ok(plan ? plan.steps : 0);
    },

    async getHrvForDay(date) {
      const plan = date ? plansByDate.get(date) : undefined;
      if (!plan) return ok([]);
      const rng = rngForDay(plan.index + 6000);
      const n = 3 + Math.floor(uniform(rng, 0, 3));
      const readings = Array.from({ length: n }, (_, i) => ({
        ms: Math.round(clamp(plan.hrvMs + uniform(rng, -4, 4), 15, 90)),
        time: new Date(`${date}T0${2 + i}:00:00`).toISOString(),
        dataOrigin: HC_ORIGIN,
      }));
      return ok(readings);
    },

    async getRestingHeartRate(date) {
      const plan = date ? plansByDate.get(date) : undefined;
      return ok(plan ? plan.restingHr : null);
    },

    async getWeightForDay(date) {
      const plan = date ? plansByDate.get(date) : undefined;
      if (!plan || !plan.weighIn || plan.weightSource !== 'health_connect') return ok([]);
      return ok([{ kg: plan.weighIn, time: new Date(`${date}T07:15:00`).toISOString(), dataOrigin: HC_ORIGIN }]);
    },

    // Hydration and nutrition sync stay off here — the seed script logs
    // those itself via addWater/importHcMeal directly, with finer control
    // over per-event timing and source mix than the day-granular provider
    // shape would allow.
    async getHydrationForDay() {
      return ok({ totalMl: 0, recordIds: [], records: [] });
    },
    async getNutritionForDay() {
      return ok([]);
    },
  };
}
