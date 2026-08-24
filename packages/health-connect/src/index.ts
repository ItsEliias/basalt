import { Platform } from 'react-native';
import { HealthProvider } from './types';
import { healthConnectProvider } from './healthConnectProvider';
import { stubProvider } from './stubProvider';

// Public entry point. Every screen / service in the app imports from here
// and never sees Health Connect or (later) HealthKit directly. Add iOS by
// dropping a `healthKitProvider.ts` next door and returning it below.

function pickProvider(): HealthProvider {
  if (Platform.OS === 'android') return healthConnectProvider;
  // Reserved: HealthKit provider goes here on iOS.
  return stubProvider;
}

export const healthService: HealthProvider = pickProvider();

// Re-export the type surface so callers don't need a second import.
export type {
  HealthAvailability, HealthPermission, HealthProvider, Result,
  HeartRateSamplePoint, SleepStageLabel, SleepStageSegment, SleepSessionSummary,
  ExerciseSessionSummary, WeightPoint, HydrationImport, HydrationRecordSample, NutritionEntry,
  HrvReading, Vo2MaxReading, BodyComposition, RespiratoryReading,
  BodyTemperatureReading, BloodPressureReading, BloodGlucoseReading,
  FloorsReading, ElevationReading, SpeedSample, PowerSample, MindfulnessSession,
} from './types';
// Origin helpers — encoding to / decoding from the `source` column, plus
// pretty labels for the ~15 most common HC record-writers.
export {
  encodeHcSource, isHcSource, packageFromSource, labelForPackage, labelForSource,
} from './origin';
// Shared constant so display-side filtering agrees with what the mindfulness
// reader includes.
export { MINDFULNESS_EXERCISE_TYPES } from './types';
// Full Android manifest permission list — the app's app.json must declare
// every entry (the source app's 1-of-28 manifest bug lives in infamy).
export { ANDROID_HEALTH_PERMISSIONS, ANDROID_PERMISSION_FOR, ALL_HEALTH_PERMISSIONS } from './manifest';
// Ledger sync — provider-injected, idempotent, tested against fakes.
export { syncHealthData, type SyncReport } from './sync';
// The fake provider itself — reusable anywhere a HealthProvider needs
// stubbing out (tests, seed scripts), not just internal to this package.
export { stubProvider } from './stubProvider';
