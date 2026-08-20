import { describe, it, expect } from 'vitest';
import {
  ANDROID_PERMISSION_FOR, ANDROID_HEALTH_PERMISSIONS, ALL_HEALTH_PERMISSIONS,
  RECORD_TYPE_ACCOUNTING,
} from './manifest';

// The regression this file exists to prevent: the source app declared 1 of
// 28 Health Connect permissions and 27 readers silently failed at runtime.
// Basalt pins the complete mapping here so the manifest can never drift
// from the provider's permission surface unnoticed.

describe('Android Health Connect manifest', () => {
  it('covers all 26 permission tokens (28 record types — cadence rides READ_SPEED, mindfulness rides READ_EXERCISE)', () => {
    expect(ALL_HEALTH_PERMISSIONS).toHaveLength(26);
    expect(ANDROID_HEALTH_PERMISSIONS).toHaveLength(26);
  });

  it('every entry is a well-formed android.permission.health.READ_* string', () => {
    for (const perm of ANDROID_HEALTH_PERMISSIONS) {
      expect(perm).toMatch(/^android\.permission\.health\.READ_[A-Z0-9_]+$/);
    }
  });

  it('has no duplicate permission strings', () => {
    expect(new Set(ANDROID_HEALTH_PERMISSIONS).size).toBe(ANDROID_HEALTH_PERMISSIONS.length);
  });

  it('pins the exact permission set the app manifest must declare', () => {
    expect([...ANDROID_HEALTH_PERMISSIONS].sort()).toEqual([
      'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
      'android.permission.health.READ_BLOOD_GLUCOSE',
      'android.permission.health.READ_BLOOD_PRESSURE',
      'android.permission.health.READ_BODY_FAT',
      'android.permission.health.READ_BODY_TEMPERATURE',
      'android.permission.health.READ_BODY_WATER_MASS',
      'android.permission.health.READ_BONE_MASS',
      'android.permission.health.READ_DISTANCE',
      'android.permission.health.READ_ELEVATION_GAINED',
      'android.permission.health.READ_EXERCISE',
      'android.permission.health.READ_FLOORS_CLIMBED',
      'android.permission.health.READ_HEART_RATE',
      'android.permission.health.READ_HEART_RATE_VARIABILITY',
      'android.permission.health.READ_HYDRATION',
      'android.permission.health.READ_LEAN_BODY_MASS',
      'android.permission.health.READ_NUTRITION',
      'android.permission.health.READ_OXYGEN_SATURATION',
      'android.permission.health.READ_POWER',
      'android.permission.health.READ_RESPIRATORY_RATE',
      'android.permission.health.READ_RESTING_HEART_RATE',
      'android.permission.health.READ_SLEEP',
      'android.permission.health.READ_SPEED',
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_TOTAL_CALORIES_BURNED',
      'android.permission.health.READ_VO2_MAX',
      'android.permission.health.READ_WEIGHT',
    ]);
  });

  it('maps every HealthPermission token to a manifest string', () => {
    for (const token of ALL_HEALTH_PERMISSIONS) {
      expect(ANDROID_PERMISSION_FOR[token]).toBeTruthy();
    }
  });
});

describe('the 28-record-type accounting', () => {
  it('accounts for exactly 28 record types', () => {
    expect(RECORD_TYPE_ACCOUNTING).toHaveLength(28);
    expect(new Set(RECORD_TYPE_ACCOUNTING.map((r) => r.recordType)).size).toBe(28);
  });

  it('every accounted permission is actually declared in the manifest list', () => {
    const declared = new Set(ANDROID_HEALTH_PERMISSIONS);
    for (const r of RECORD_TYPE_ACCOUNTING) {
      expect(declared.has(r.permission), `${r.recordType} → ${r.permission}`).toBe(true);
    }
  });

  it('26 own + 1 shared + 1 nested = 28, resolving to the 26 declared strings', () => {
    const own = RECORD_TYPE_ACCOUNTING.filter((r) => r.coverage === 'own');
    const shared = RECORD_TYPE_ACCOUNTING.filter((r) => r.coverage === 'shared');
    const nested = RECORD_TYPE_ACCOUNTING.filter((r) => r.coverage === 'nested');
    expect(own).toHaveLength(26);
    expect(shared).toHaveLength(1);
    expect(nested).toHaveLength(1);
    // The own-permission types cover the declared list exactly, one-to-one.
    expect(new Set(own.map((r) => r.permission)).size).toBe(26);
    // Every non-own type documents its why.
    for (const r of [...shared, ...nested]) expect(r.note).toBeTruthy();
  });

  it('cadence rides READ_EXERCISE (the docs, not the old comment)', () => {
    const cadence = RECORD_TYPE_ACCOUNTING.find((r) => r.recordType === 'CyclingPedalingCadence')!;
    expect(cadence.permission).toBe('android.permission.health.READ_EXERCISE');
    expect(cadence.coverage).toBe('shared');
  });

  it('sleep stages are nested in SleepSession under READ_SLEEP', () => {
    const stages = RECORD_TYPE_ACCOUNTING.find((r) => r.recordType === 'SleepStage')!;
    expect(stages.permission).toBe('android.permission.health.READ_SLEEP');
    expect(stages.coverage).toBe('nested');
  });
});
