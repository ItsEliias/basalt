import { HealthProvider, ok } from './types';

// Placeholder provider for platforms without a native implementation yet.
// iOS will replace this with a HealthKit provider implementing the SAME
// HealthProvider interface — no other file changes.

export const stubProvider: HealthProvider = {
  async isAvailable() { return ok('unsupported_platform'); },
  async requestPermissions() { return ok([]); },
  async getGrantedPermissions() { return ok([]); },
  async getStepsForDay() { return ok(0); },
  async getActiveCaloriesForDay() { return ok(0); },
  async getTotalCaloriesForDay() { return ok(0); },
  async getDistanceForDay() { return ok(0); },
  async getHeartRateSamplesForDay() { return ok([]); },
  async getRestingHeartRate() { return ok(null); },
  async getSpO2ForDay() { return ok([]); },
  async getSleepMinutesForDay() { return ok(0); },
  async getSleepSessionForNight() { return ok(null); },
  async getExerciseSessionsForDay() { return ok([]); },
  async getLatestWeight() { return ok(null); },
  async getWeightForDay() { return ok([]); },
  async getHydrationForDay() { return ok({ totalMl: 0, recordIds: [], records: [] }); },
  async getNutritionForDay() { return ok([]); },
  async getHrvForDay() { return ok([]); },
  async getVo2Max() { return ok(null); },
  async getBodyCompositionForDay() {
    return ok({ bodyFatPct: null, leanBodyMassKg: null, boneMassKg: null, bodyWaterMassKg: null, dataOrigin: '' });
  },
  async getRespiratoryRateForDay() { return ok([]); },
  async getBodyTemperatureForDay() { return ok([]); },
  async getBloodPressureForDay() { return ok([]); },
  async getBloodGlucoseForDay() { return ok([]); },
  async getFloorsForDay() { return ok({ count: 0, dataOrigin: '' }); },
  async getElevationForDay() { return ok({ gainedMeters: 0, dataOrigin: '' }); },
  async getSpeedForDay() { return ok([]); },
  async getPowerForDay() { return ok([]); },
  async getCyclingCadenceForDay() { return ok([]); },
  async getMindfulnessSessionsForDay() { return ok([]); },
};
