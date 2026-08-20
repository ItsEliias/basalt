import type { HealthPermission } from './types';

// The COMPLETE Android manifest permission list for every Health Connect
// record type this package reads. The source app declared only
// READ_STEPS — 27 of 28 readers failed at runtime (migration report §2.2).
// Basalt's app.json must declare every entry below; the test suite pins
// the mapping against the provider's permission surface so a new reader
// can never ship without its manifest entry again.
//
// The 28 → 26 accounting is spelled out record-type by record-type in
// RECORD_TYPE_ACCOUNTING below (and pinned by test): 26 record types carry
// their own read permission; CyclingPedalingCadenceRecord is read under
// READ_EXERCISE (verified against the HC data-types docs and
// react-native-health-connect's permission table — NOT READ_SPEED, as this
// file once claimed); sleep stages are not a record type of their own but
// the mandatory `stages` field of SleepSessionRecord, covered by READ_SLEEP.
// Mindfulness sessions are filtered ExerciseSession records — no extra type.

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

/**
 * The full 28-record-type ledger: every Health Connect record type this
 * package reads, with the manifest permission that covers it and how.
 * `own` = the type has its own read permission; `shared` = HC reads it
 * under another type's permission; `nested` = not a standalone record —
 * it arrives inside its parent record.
 */
export const RECORD_TYPE_ACCOUNTING: readonly {
  recordType: string;
  permission: string;
  coverage: 'own' | 'shared' | 'nested';
  note?: string;
}[] = [
  { recordType: 'Steps', permission: ANDROID_PERMISSION_FOR.steps, coverage: 'own' },
  { recordType: 'ActiveCaloriesBurned', permission: ANDROID_PERMISSION_FOR.activeCalories, coverage: 'own' },
  { recordType: 'TotalCaloriesBurned', permission: ANDROID_PERMISSION_FOR.totalCalories, coverage: 'own' },
  { recordType: 'Distance', permission: ANDROID_PERMISSION_FOR.distance, coverage: 'own' },
  { recordType: 'HeartRate', permission: ANDROID_PERMISSION_FOR.heartRate, coverage: 'own' },
  { recordType: 'RestingHeartRate', permission: ANDROID_PERMISSION_FOR.restingHeartRate, coverage: 'own' },
  { recordType: 'OxygenSaturation', permission: ANDROID_PERMISSION_FOR.spo2, coverage: 'own' },
  { recordType: 'SleepSession', permission: ANDROID_PERMISSION_FOR.sleep, coverage: 'own' },
  { recordType: 'SleepStage', permission: ANDROID_PERMISSION_FOR.sleep, coverage: 'nested', note: 'the mandatory stages field of SleepSessionRecord — not a standalone record type' },
  { recordType: 'ExerciseSession', permission: ANDROID_PERMISSION_FOR.exercise, coverage: 'own' },
  { recordType: 'CyclingPedalingCadence', permission: ANDROID_PERMISSION_FOR.exercise, coverage: 'shared', note: 'read under READ_EXERCISE per the HC data-types docs — it has no permission of its own' },
  { recordType: 'Weight', permission: ANDROID_PERMISSION_FOR.weight, coverage: 'own' },
  { recordType: 'Nutrition', permission: ANDROID_PERMISSION_FOR.nutrition, coverage: 'own' },
  { recordType: 'Hydration', permission: ANDROID_PERMISSION_FOR.hydration, coverage: 'own' },
  { recordType: 'HeartRateVariabilityRmssd', permission: ANDROID_PERMISSION_FOR.hrv, coverage: 'own' },
  { recordType: 'Vo2Max', permission: ANDROID_PERMISSION_FOR.vo2max, coverage: 'own' },
  { recordType: 'BodyFat', permission: ANDROID_PERMISSION_FOR.bodyFat, coverage: 'own' },
  { recordType: 'BoneMass', permission: ANDROID_PERMISSION_FOR.boneMass, coverage: 'own' },
  { recordType: 'LeanBodyMass', permission: ANDROID_PERMISSION_FOR.leanBodyMass, coverage: 'own' },
  { recordType: 'BodyWaterMass', permission: ANDROID_PERMISSION_FOR.bodyWaterMass, coverage: 'own' },
  { recordType: 'RespiratoryRate', permission: ANDROID_PERMISSION_FOR.respiratoryRate, coverage: 'own' },
  { recordType: 'BodyTemperature', permission: ANDROID_PERMISSION_FOR.bodyTemperature, coverage: 'own' },
  { recordType: 'BloodPressure', permission: ANDROID_PERMISSION_FOR.bloodPressure, coverage: 'own' },
  { recordType: 'BloodGlucose', permission: ANDROID_PERMISSION_FOR.bloodGlucose, coverage: 'own' },
  { recordType: 'FloorsClimbed', permission: ANDROID_PERMISSION_FOR.floors, coverage: 'own' },
  { recordType: 'ElevationGained', permission: ANDROID_PERMISSION_FOR.elevation, coverage: 'own' },
  { recordType: 'Speed', permission: ANDROID_PERMISSION_FOR.speed, coverage: 'own' },
  { recordType: 'Power', permission: ANDROID_PERMISSION_FOR.power, coverage: 'own' },
];
