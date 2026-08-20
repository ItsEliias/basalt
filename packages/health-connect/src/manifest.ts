import type { HealthPermission } from './types';

// The COMPLETE Android manifest permission list for every Health Connect
// record type this package reads. The source app declared only
// READ_STEPS — 27 of 28 readers failed at runtime (migration report §2.2).
// Basalt's app.json must declare every entry below; the test suite pins
// the mapping against the provider's permission surface so a new reader
// can never ship without its manifest entry again.
//
// Note: CyclingPedalingCadence has no separate HC permission — it is
// covered by READ_SPEED (see healthConnectProvider.ts) — and mindfulness
// sessions are ExerciseSession records, covered by READ_EXERCISE. That is
// how 28 record types resolve to 26 permission strings.

export const ANDROID_PERMISSION_FOR: Record<HealthPermission, string> = {
  steps:            'android.permission.health.READ_STEPS',
  activeCalories:   'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  totalCalories:    'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  heartRate:        'android.permission.health.READ_HEART_RATE',
  restingHeartRate: 'android.permission.health.READ_RESTING_HEART_RATE',
  spo2:             'android.permission.health.READ_OXYGEN_SATURATION',
  sleep:            'android.permission.health.READ_SLEEP',
  exercise:         'android.permission.health.READ_EXERCISE',
  weight:           'android.permission.health.READ_WEIGHT',
  distance:         'android.permission.health.READ_DISTANCE',
  nutrition:        'android.permission.health.READ_NUTRITION',
  hydration:        'android.permission.health.READ_HYDRATION',
  hrv:              'android.permission.health.READ_HEART_RATE_VARIABILITY',
  vo2max:           'android.permission.health.READ_VO2_MAX',
  bodyFat:          'android.permission.health.READ_BODY_FAT',
  boneMass:         'android.permission.health.READ_BONE_MASS',
  leanBodyMass:     'android.permission.health.READ_LEAN_BODY_MASS',
  bodyWaterMass:    'android.permission.health.READ_BODY_WATER_MASS',
  respiratoryRate:  'android.permission.health.READ_RESPIRATORY_RATE',
  bodyTemperature:  'android.permission.health.READ_BODY_TEMPERATURE',
  bloodPressure:    'android.permission.health.READ_BLOOD_PRESSURE',
  bloodGlucose:     'android.permission.health.READ_BLOOD_GLUCOSE',
  floors:           'android.permission.health.READ_FLOORS_CLIMBED',
  elevation:        'android.permission.health.READ_ELEVATION_GAINED',
  speed:            'android.permission.health.READ_SPEED',
  power:            'android.permission.health.READ_POWER',
};

/** Every permission token the provider understands, in one place. */
export const ALL_HEALTH_PERMISSIONS = Object.keys(ANDROID_PERMISSION_FOR) as HealthPermission[];

/** The full Android manifest list — paste-ready for app.json. */
export const ANDROID_HEALTH_PERMISSIONS: readonly string[] = Object.values(ANDROID_PERMISSION_FOR);
