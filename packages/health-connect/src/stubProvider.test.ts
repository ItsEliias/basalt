import { describe, it, expect } from 'vitest';
import { stubProvider } from './stubProvider';

// The stub is what iOS ships until the HealthKit provider lands. The honesty
// rules make its contract precise: it must report the platform as
// unsupported and empty-handed — and the UI's real-or-hidden rule turns
// those empties into CONNECT states, never fake zeros presented as data.

describe('stubProvider honesty contract', () => {
  it('reports the platform as unsupported', async () => {
    expect(await stubProvider.isAvailable()).toEqual({ ok: true, data: 'unsupported_platform' });
  });

  it('grants no permissions', async () => {
    expect(await stubProvider.requestPermissions(['steps'])).toEqual({ ok: true, data: [] });
    expect(await stubProvider.getGrantedPermissions()).toEqual({ ok: true, data: [] });
  });

  it('returns null (not fabricated values) for latest-reading lookups', async () => {
    expect(await stubProvider.getRestingHeartRate()).toEqual({ ok: true, data: null });
    expect(await stubProvider.getSleepSessionForNight()).toEqual({ ok: true, data: null });
    expect(await stubProvider.getLatestWeight()).toEqual({ ok: true, data: null });
    expect(await stubProvider.getVo2Max()).toEqual({ ok: true, data: null });
  });

  it('returns empty collections for sample lookups', async () => {
    for (const fn of [
      stubProvider.getHeartRateSamplesForDay, stubProvider.getSpO2ForDay,
      stubProvider.getExerciseSessionsForDay, stubProvider.getWeightForDay,
      stubProvider.getNutritionForDay, stubProvider.getHrvForDay,
      stubProvider.getRespiratoryRateForDay, stubProvider.getBodyTemperatureForDay,
      stubProvider.getBloodPressureForDay, stubProvider.getBloodGlucoseForDay,
      stubProvider.getSpeedForDay, stubProvider.getPowerForDay,
      stubProvider.getCyclingCadenceForDay, stubProvider.getMindfulnessSessionsForDay,
    ]) {
      expect(await fn()).toEqual({ ok: true, data: [] });
    }
  });

  it('returns an empty hydration import (no ids, no ml)', async () => {
    expect(await stubProvider.getHydrationForDay()).toEqual({
      ok: true,
      data: { totalMl: 0, recordIds: [], records: [] },
    });
  });

  it('body composition reads as all-null with no origin', async () => {
    expect(await stubProvider.getBodyCompositionForDay()).toEqual({
      ok: true,
      data: { bodyFatPct: null, leanBodyMassKg: null, boneMassKg: null, bodyWaterMassKg: null, dataOrigin: '' },
    });
  });
});
