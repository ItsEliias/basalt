// Platform-agnostic health-data types. The app imports from `healthService`
// only; it never sees Health Connect or (future) HealthKit types directly.

import { type Result } from '@basalt/core-data';
export { ok, err, type Result } from '@basalt/core-data';

// Provider availability — one flat enum across platforms so UI switches on
// something stable.
export type HealthAvailability =
  | 'available'                    // reads should work
  | 'provider_update_required'     // Health Connect on-device app is too old
  | 'provider_not_installed'       // needs the Health Connect Play Store app
  | 'unsupported_platform';        // iOS today, web, etc.

export type HealthPermission =
  | 'steps'
  | 'activeCalories'
  | 'totalCalories'
  | 'heartRate'
  | 'restingHeartRate'
  | 'spo2'
  | 'sleep'
  | 'exercise'
  | 'weight'
  | 'distance'
  | 'nutrition'
  | 'hydration'
  // Feature 16 additions ────────────────────────────────────────────────
  | 'hrv'
  | 'vo2max'
  | 'bodyFat'
  | 'boneMass'
  | 'leanBodyMass'
  | 'bodyWaterMass'
  | 'respiratoryRate'
  | 'bodyTemperature'
  | 'bloodPressure'
  | 'bloodGlucose'
  | 'floors'
  | 'elevation'
  | 'speed'
  | 'power';

export interface HeartRateSamplePoint {
  bpm: number;
  time: string;
}

// Sleep stage labels — one per HC SleepStageType. `unknown` catches
// UNKNOWN/OUT_OF_BED which don't map to our fantasy stage rings.
export type SleepStageLabel = 'awake' | 'light' | 'deep' | 'rem' | 'sleeping' | 'unknown';

export interface SleepStageSegment {
  stage: SleepStageLabel;
  startTime: string;
  endTime: string;
  minutes: number;
}

export interface SleepSessionSummary {
  /** HC session record id — used as a stable dedupe key. */
  id: string;
  startTime: string;
  endTime: string;
  /** Session duration end-to-end in hours (endTime - startTime). */
  hours: number;
  /** Real HC stages when present; empty if the session was a plain block. */
  stages: SleepStageSegment[];
  /** True when `stages` came from HC directly (not derived from `hours`). */
  hasRealStages: boolean;
  /** Android package name of the app that recorded the session (e.g.
   *  'com.sec.android.app.shealth'). Empty when HC didn't attach one. */
  dataOrigin: string;
}

export interface ExerciseSessionSummary {
  /** HC record id — stable dedupe / merge key. */
  id: string;
  /** Raw HC ExerciseType constant. Callers use this to route sessions to
   *  the right screen — e.g. yoga/guided-breathing/pilates belong to the
   *  Meditation surface and should be excluded from Workout History. */
  exerciseType: number;
  /** Human-friendly exercise-type label (from HC ExerciseType constants). */
  typeLabel: string;
  title?: string;
  startTime: string;
  endTime: string;
  minutes: number;
  /** Populated from the linked ActiveCaloriesBurned records in the same window. */
  caloriesBurned: number;
  /** Originating app package name. */
  dataOrigin: string;
}

/**
 * Exercise types that the app routes to the Meditation surface instead of
 * Workout History (`getMindfulnessSessionsForDay` filters on these; the
 * Workout-History display merge excludes them to avoid double-display).
 * Kept as a constant so screen + provider agree on the same set.
 *
 * Product decision: only GUIDED_BREATHING is a mindfulness session. Yoga
 * and Pilates are workouts and flow through the normal ExerciseSession
 * path into Workout History like any other synced workout.
 */
export const MINDFULNESS_EXERCISE_TYPES: ReadonlySet<number> = new Set([
  33, // GUIDED_BREATHING
]);

export interface WeightPoint {
  kg: number;
  time: string;
  /** Originating app package name (empty when HC didn't attach one). */
  dataOrigin?: string;
}

export interface HydrationRecordSample {
  id: string;
  ml: number;
  dataOrigin: string;
}

export interface HydrationImport {
  /** Total ml recorded in HC across the day. */
  totalMl: number;
  /** Individual HC record ids so callers can dedupe on re-sync. */
  recordIds: string[];
  /** Per-record breakdown carrying the originating app package name for
   *  future per-source XP rules. Same order as `recordIds`. */
  records: HydrationRecordSample[];
}

export interface HrvReading {
  /** rMSSD in milliseconds. */
  ms: number;
  time: string;
  dataOrigin: string;
}

export interface Vo2MaxReading {
  /** ml/(kg·min). */
  vo2: number;
  time: string;
  /** HC Vo2MaxMeasurementMethod numeric code (kept as-is; UI ignores). */
  measurementMethod: number;
  dataOrigin: string;
}

export interface BodyComposition {
  /** Body-fat percentage (0-100). */
  bodyFatPct: number | null;
  leanBodyMassKg: number | null;
  boneMassKg: number | null;
  bodyWaterMassKg: number | null;
  /** Origin of the freshest reading in the day; empty when nothing present. */
  dataOrigin: string;
}

export interface RespiratoryReading {
  /** Breaths per minute. */
  rate: number;
  time: string;
  dataOrigin: string;
}

export interface BodyTemperatureReading {
  /** °C. */
  celsius: number;
  time: string;
  dataOrigin: string;
}

export interface BloodPressureReading {
  systolicMmHg: number;
  diastolicMmHg: number;
  time: string;
  dataOrigin: string;
}

export interface BloodGlucoseReading {
  /** mmol/L (SI). Divide by 18.018 if a caller wants mg/dL. */
  mmolPerL: number;
  time: string;
  dataOrigin: string;
}

export interface FloorsReading {
  count: number;
  dataOrigin: string;
}

export interface ElevationReading {
  gainedMeters: number;
  dataOrigin: string;
}

/**
 * Speed / power / cadence samples — provider-only for now. The GPS walker
 * consumer isn't wired yet; this is the surface it'll import.
 */
export interface SpeedSample {
  /** metres per second. */
  mps: number;
  time: string;
  dataOrigin: string;
}

export interface PowerSample {
  /** watts. */
  watts: number;
  time: string;
  dataOrigin: string;
}

export interface MindfulnessSession {
  id: string;
  /** GUIDED_BREATHING / YOGA / etc. */
  typeLabel: string;
  title?: string;
  startTime: string;
  endTime: string;
  minutes: number;
  dataOrigin: string;
}

export interface NutritionEntry {
  /** HC record id — stable dedupe key. */
  id: string;
  /** Meal name (falls back to a generated label). */
  name: string;
  /** breakfast/lunch/dinner/snacks, mapped from HC MealType constants. */
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** Originating app package name (e.g. 'com.sec.android.app.shealth'). */
  dataOrigin: string;
}

// The single shape every provider implements. Adding iOS later = a new file
// implementing this interface, plus one line in the platform switch.
export interface HealthProvider {
  isAvailable(): Promise<Result<HealthAvailability>>;
  requestPermissions(perms: HealthPermission[]): Promise<Result<HealthPermission[]>>;
  getGrantedPermissions(): Promise<Result<HealthPermission[]>>;

  /** Steps for the day (device-local midnight → midnight). */
  getStepsForDay(date?: string): Promise<Result<number>>;
  /** Active kcal burned across the day. */
  getActiveCaloriesForDay(date?: string): Promise<Result<number>>;
  /** Total kcal burned across the day (basal + active). */
  getTotalCaloriesForDay(date?: string): Promise<Result<number>>;
  /** Total distance in metres across the day. */
  getDistanceForDay(date?: string): Promise<Result<number>>;
  /** Individual heart-rate samples in the day. */
  getHeartRateSamplesForDay(date?: string): Promise<Result<HeartRateSamplePoint[]>>;
  /** Latest resting-heart-rate reading up to `date`. */
  getRestingHeartRate(date?: string): Promise<Result<number | null>>;
  /** Latest SpO2 readings for the day (raw samples 0-100). */
  getSpO2ForDay(date?: string): Promise<Result<number[]>>;
  /** Total sleep duration in minutes for the night ending on `date`. */
  getSleepMinutesForDay(date?: string): Promise<Result<number>>;
  /** Full sleep session (with real stage breakdown when HC has it). */
  getSleepSessionForNight(date?: string): Promise<Result<SleepSessionSummary | null>>;
  /** Exercise sessions started on `date`. Calorie sums come from linked
   *  ActiveCaloriesBurned records inside each session's time window. */
  getExerciseSessionsForDay(date?: string): Promise<Result<ExerciseSessionSummary[]>>;
  /** Latest weight reading up to `date`. */
  getLatestWeight(date?: string): Promise<Result<WeightPoint | null>>;
  /** Every weight reading on `date`. */
  getWeightForDay(date?: string): Promise<Result<WeightPoint[]>>;
  /** All hydration records for the day + their HC ids for dedupe. */
  getHydrationForDay(date?: string): Promise<Result<HydrationImport>>;
  /** All nutrition entries for the day, one per HC record. */
  getNutritionForDay(date?: string): Promise<Result<NutritionEntry[]>>;

  // ─── Feature 16 additions ────────────────────────────────────────────
  /** HRV samples for the day (rMSSD ms). */
  getHrvForDay(date?: string): Promise<Result<HrvReading[]>>;
  /** Latest VO₂max reading, or null. */
  getVo2Max(date?: string): Promise<Result<Vo2MaxReading | null>>;
  /** Body composition — latest reading per sub-metric, folded together. */
  getBodyCompositionForDay(date?: string): Promise<Result<BodyComposition>>;
  /** Respiratory-rate samples for the day. */
  getRespiratoryRateForDay(date?: string): Promise<Result<RespiratoryReading[]>>;
  /** Body-temperature samples for the day. */
  getBodyTemperatureForDay(date?: string): Promise<Result<BodyTemperatureReading[]>>;
  /** Blood-pressure readings for the day. */
  getBloodPressureForDay(date?: string): Promise<Result<BloodPressureReading[]>>;
  /** Blood-glucose readings for the day. */
  getBloodGlucoseForDay(date?: string): Promise<Result<BloodGlucoseReading[]>>;
  /** Floors climbed for the day (aggregate). */
  getFloorsForDay(date?: string): Promise<Result<FloorsReading>>;
  /** Elevation gained for the day (aggregate metres). */
  getElevationForDay(date?: string): Promise<Result<ElevationReading>>;
  /** Speed samples (provider-only — no UI yet). */
  getSpeedForDay(date?: string): Promise<Result<SpeedSample[]>>;
  /** Power samples (provider-only). */
  getPowerForDay(date?: string): Promise<Result<PowerSample[]>>;
  /** Cycling cadence samples (provider-only). */
  getCyclingCadenceForDay(date?: string): Promise<Result<{ rpm: number; time: string; dataOrigin: string }[]>>;
  /** Mindfulness sessions — filtered ExerciseSession records for
   *  GUIDED_BREATHING / YOGA. HC has no dedicated MindfulnessSession record
   *  in this SDK version, so we alias onto those. */
  getMindfulnessSessionsForDay(date?: string): Promise<Result<MindfulnessSession[]>>;
}
