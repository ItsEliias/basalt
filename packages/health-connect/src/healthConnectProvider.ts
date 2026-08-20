import {
  initialize, getSdkStatus, requestPermission, getGrantedPermissions, readRecords,
  SdkAvailabilityStatus, SleepStageType, ExerciseType, MealType,
} from 'react-native-health-connect';
import {
  HealthAvailability, HealthPermission, HealthProvider, Result, ok, err,
  HeartRateSamplePoint, SleepSessionSummary, SleepStageLabel, SleepStageSegment,
  ExerciseSessionSummary, WeightPoint, HydrationImport, NutritionEntry,
  HydrationRecordSample,
  HrvReading, Vo2MaxReading, BodyComposition, RespiratoryReading,
  BodyTemperatureReading, BloodPressureReading, BloodGlucoseReading,
  FloorsReading, ElevationReading, SpeedSample, PowerSample, MindfulnessSession,
  MINDFULNESS_EXERCISE_TYPES,
} from './types';

// Extract the originating app package name from HC metadata (safe for any
// record shape). Used everywhere below so downstream layers get a clean
// `dataOrigin: string` field to fold into the DB `source` tag.
function originOf(record: any): string {
  return String(record?.metadata?.dataOrigin ?? '');
}

// Android · Health Connect provider. Everything HC-specific stays in this
// file — the rest of the app only ever sees the HealthProvider interface.

let initialized = false;

async function ensureInitialized(): Promise<Result<true>> {
  if (initialized) return ok(true);
  try {
    const success = await initialize();
    if (!success) return err('Health Connect SDK failed to initialize.');
    initialized = true;
    return ok(true);
  } catch (e: any) {
    return err(e?.message ?? 'Health Connect init failed.');
  }
}

type HCRecord =
  | 'Steps' | 'ActiveCaloriesBurned' | 'TotalCaloriesBurned' | 'Distance'
  | 'HeartRate' | 'RestingHeartRate' | 'OxygenSaturation'
  | 'SleepSession' | 'ExerciseSession'
  | 'Weight' | 'Nutrition' | 'Hydration'
  // Feature 16 ────────────────────────────────────────────────────────
  | 'HeartRateVariabilityRmssd' | 'Vo2Max'
  | 'BodyFat' | 'BoneMass' | 'LeanBodyMass' | 'BodyWaterMass'
  | 'RespiratoryRate' | 'BodyTemperature'
  | 'BloodPressure' | 'BloodGlucose'
  | 'FloorsClimbed' | 'ElevationGained'
  | 'Speed' | 'Power' | 'CyclingPedalingCadence';

// One-way mapping between our platform-agnostic permission tokens and the
// HC record types they translate to. New sensor = one new entry.
const PERMISSION_TO_RECORD: Record<HealthPermission, HCRecord> = {
  steps:            'Steps',
  activeCalories:   'ActiveCaloriesBurned',
  totalCalories:    'TotalCaloriesBurned',
  heartRate:        'HeartRate',
  restingHeartRate: 'RestingHeartRate',
  spo2:             'OxygenSaturation',
  sleep:            'SleepSession',
  exercise:         'ExerciseSession',
  weight:           'Weight',
  distance:         'Distance',
  nutrition:        'Nutrition',
  hydration:        'Hydration',
  hrv:              'HeartRateVariabilityRmssd',
  vo2max:           'Vo2Max',
  bodyFat:          'BodyFat',
  boneMass:         'BoneMass',
  leanBodyMass:     'LeanBodyMass',
  bodyWaterMass:    'BodyWaterMass',
  respiratoryRate:  'RespiratoryRate',
  bodyTemperature:  'BodyTemperature',
  bloodPressure:    'BloodPressure',
  bloodGlucose:     'BloodGlucose',
  floors:           'FloorsClimbed',
  elevation:        'ElevationGained',
  speed:            'Speed',
  power:            'Power',
};
const RECORD_TO_PERMISSION: Record<HCRecord, HealthPermission> = {
  Steps:                'steps',
  ActiveCaloriesBurned: 'activeCalories',
  TotalCaloriesBurned:  'totalCalories',
  HeartRate:            'heartRate',
  RestingHeartRate:     'restingHeartRate',
  OxygenSaturation:     'spo2',
  SleepSession:         'sleep',
  ExerciseSession:      'exercise',
  Weight:               'weight',
  Distance:             'distance',
  Nutrition:            'nutrition',
  Hydration:            'hydration',
  HeartRateVariabilityRmssd: 'hrv',
  Vo2Max:               'vo2max',
  BodyFat:              'bodyFat',
  BoneMass:             'boneMass',
  LeanBodyMass:         'leanBodyMass',
  BodyWaterMass:        'bodyWaterMass',
  RespiratoryRate:      'respiratoryRate',
  BodyTemperature:      'bodyTemperature',
  BloodPressure:        'bloodPressure',
  BloodGlucose:         'bloodGlucose',
  FloorsClimbed:        'floors',
  ElevationGained:      'elevation',
  Speed:                'speed',
  Power:                'power',
  // Cycling cadence piggybacks on the `speed` permission surface for now —
  // no separate HC permission exists and no UI consumes it yet.
  CyclingPedalingCadence: 'speed',
};

function toRecordType(p: HealthPermission): HCRecord {
  return PERMISSION_TO_RECORD[p];
}

function fromGrantedPermission(perm: any): HealthPermission | null {
  if (perm?.accessType !== 'read') return null;
  const rec = perm?.recordType as HCRecord | undefined;
  return rec && rec in RECORD_TO_PERMISSION ? RECORD_TO_PERMISSION[rec] : null;
}

// Map HC SleepStageType numeric constants back to our stage-label strings.
const STAGE_LABEL: Record<number, SleepStageLabel> = {
  [SleepStageType.UNKNOWN]:    'unknown',
  [SleepStageType.AWAKE]:      'awake',
  [SleepStageType.SLEEPING]:   'sleeping',
  [SleepStageType.OUT_OF_BED]: 'unknown',
  [SleepStageType.LIGHT]:      'light',
  [SleepStageType.DEEP]:       'deep',
  [SleepStageType.REM]:        'rem',
};

// Reverse lookup for ExerciseType: numeric → human label. HC exports 80+
// exercise types; we humanise the common ones and fall back to the raw
// underscored constant name for the rest.
const EXERCISE_LABEL: Record<number, string> = (() => {
  const map: Record<number, string> = {};
  for (const [name, id] of Object.entries(ExerciseType)) {
    if (typeof id !== 'number') continue;
    map[id] = name
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }
  return map;
})();

function hcMealTypeToOurs(n: number): 'breakfast' | 'lunch' | 'dinner' | 'snacks' {
  if (n === MealType.BREAKFAST) return 'breakfast';
  if (n === MealType.LUNCH) return 'lunch';
  if (n === MealType.DINNER) return 'dinner';
  return 'snacks';
}

function dayISO(date?: string): string {
  if (date) return date;
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Splits a 'YYYY-MM-DD' string into its numeric parts. Throws on malformed
// input rather than silently producing Invalid Date math (which previously
// surfaced as a RangeError out of toISOString() further downstream anyway).
function parseIsoDay(date: string): [number, number, number] {
  const parts = date.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) {
    throw new TypeError(`parseIsoDay: expected 'YYYY-MM-DD', got '${date}'`);
  }
  return [parts[0]!, parts[1]!, parts[2]!];
}

// Health Connect wants an absolute UTC time range. We use device-local
// midnight → midnight so the returned count matches what the phone would
// display for "today".
function dayRangeIso(date: string): { start: string; end: string } {
  const [y, m, d] = parseIsoDay(date);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString();
  return { start, end };
}

export const healthConnectProvider: HealthProvider = {
  async isAvailable(): Promise<Result<HealthAvailability>> {
    try {
      const status = await getSdkStatus();
      if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return ok('available');
      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        return ok('provider_update_required');
      }
      return ok('provider_not_installed');
    } catch (e: any) {
      return err(e?.message ?? 'Could not query Health Connect availability.');
    }
  },

  async requestPermissions(perms: HealthPermission[]): Promise<Result<HealthPermission[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    try {
      const request = perms.map((p) => ({ accessType: 'read' as const, recordType: toRecordType(p) }));
      const granted = await requestPermission(request);
      const mapped = granted
        .map((g) => fromGrantedPermission(g))
        .filter((v): v is HealthPermission => v !== null);
      return ok(mapped);
    } catch (e: any) {
      return err(e?.message ?? 'Permission request failed.');
    }
  },

  async getGrantedPermissions(): Promise<Result<HealthPermission[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    try {
      const list = await getGrantedPermissions();
      const mapped = list
        .map((g) => fromGrantedPermission(g))
        .filter((v): v is HealthPermission => v !== null);
      return ok(mapped);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read granted permissions.');
    }
  },

  async getStepsForDay(date?: string): Promise<Result<number>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const result = await readRecords('Steps', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const total = result.records.reduce((s: number, r: any) => s + Number(r.count ?? 0), 0);
      return ok(total);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read step records.');
    }
  },

  async getActiveCaloriesForDay(date?: string): Promise<Result<number>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const result = await readRecords('ActiveCaloriesBurned', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const kcal = result.records.reduce(
        (s: number, r: any) => s + Number(r?.energy?.inKilocalories ?? 0),
        0,
      );
      return ok(Math.round(kcal));
    } catch (e: any) {
      return err(e?.message ?? 'Could not read active calories.');
    }
  },

  async getHeartRateSamplesForDay(date?: string): Promise<Result<HeartRateSamplePoint[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const result = await readRecords('HeartRate', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const samples: HeartRateSamplePoint[] = [];
      for (const record of result.records as any[]) {
        for (const s of record.samples ?? []) {
          samples.push({ bpm: Number(s.beatsPerMinute), time: String(s.time) });
        }
      }
      return ok(samples);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read heart rate samples.');
    }
  },

  async getSleepMinutesForDay(date?: string): Promise<Result<number>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = sleepNightRangeIso(dayISO(date));
    try {
      const result = await readRecords('SleepSession', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const minutes = result.records.reduce((s: number, r: any) => {
        const durMs = new Date(r.endTime).getTime() - new Date(r.startTime).getTime();
        return s + Math.max(0, Math.round(durMs / 60000));
      }, 0);
      return ok(minutes);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read sleep sessions.');
    }
  },

  async getTotalCaloriesForDay(date?: string): Promise<Result<number>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const result = await readRecords('TotalCaloriesBurned', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const kcal = result.records.reduce(
        (s: number, r: any) => s + Number(r?.energy?.inKilocalories ?? 0), 0,
      );
      return ok(Math.round(kcal));
    } catch (e: any) {
      return err(e?.message ?? 'Could not read total calories.');
    }
  },

  async getDistanceForDay(date?: string): Promise<Result<number>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const result = await readRecords('Distance', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const metres = result.records.reduce(
        (s: number, r: any) => s + Number(r?.distance?.inMeters ?? 0), 0,
      );
      return ok(Math.round(metres));
    } catch (e: any) {
      return err(e?.message ?? 'Could not read distance.');
    }
  },

  async getRestingHeartRate(date?: string): Promise<Result<number | null>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const result = await readRecords('RestingHeartRate', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      if (!result.records.length) return ok(null);
      // Take the latest reading.
      const sorted = [...result.records].sort(
        (a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime(),
      );
      const latest = sorted[0] as any;
      return ok(Math.round(Number(latest.beatsPerMinute)));
    } catch (e: any) {
      return err(e?.message ?? 'Could not read resting heart rate.');
    }
  },

  async getSpO2ForDay(date?: string): Promise<Result<number[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const result = await readRecords('OxygenSaturation', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const samples = result.records
        .map((r: any) => Number(r.percentage))
        .filter((v: number) => Number.isFinite(v));
      return ok(samples);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read SpO2.');
    }
  },

  async getSleepSessionForNight(date?: string): Promise<Result<SleepSessionSummary | null>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = sleepNightRangeIso(dayISO(date));
    try {
      const result = await readRecords('SleepSession', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      if (!result.records.length) return ok(null);
      // Longest session in the window = "last night".
      const sessions = result.records as any[];
      sessions.sort((a, b) => {
        const da = new Date(a.endTime).getTime() - new Date(a.startTime).getTime();
        const db = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
        return db - da;
      });
      const s = sessions[0];
      const startMs = new Date(s.startTime).getTime();
      const endMs = new Date(s.endTime).getTime();
      const hours = Math.max(0, (endMs - startMs) / 3_600_000);

      const rawStages = Array.isArray(s.stages) ? s.stages : [];
      const stages: SleepStageSegment[] = rawStages.map((seg: any) => {
        const segStart = new Date(seg.startTime).getTime();
        const segEnd = new Date(seg.endTime).getTime();
        return {
          stage: STAGE_LABEL[Number(seg.stage)] ?? 'unknown',
          startTime: seg.startTime,
          endTime: seg.endTime,
          minutes: Math.max(0, Math.round((segEnd - segStart) / 60000)),
        };
      });

      return ok({
        id: String(s.metadata?.id ?? s.id ?? `${s.startTime}|${s.endTime}`),
        startTime: s.startTime,
        endTime: s.endTime,
        hours,
        stages,
        hasRealStages: stages.length > 0,
        dataOrigin: originOf(s),
      });
    } catch (e: any) {
      return err(e?.message ?? 'Could not read sleep session.');
    }
  },

  async getExerciseSessionsForDay(date?: string): Promise<Result<ExerciseSessionSummary[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      // Sessions inside the day window.
      const sessionsRes = await readRecords('ExerciseSession', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const sessions = sessionsRes.records as any[];

      // Active-calorie records that overlap the day, so we can sum kcal per
      // session by checking start/end containment. Cheap; the day slice is
      // small enough. Any failure here is non-fatal — sessions still list.
      let calRecords: any[] = [];
      try {
        const calRes = await readRecords('ActiveCaloriesBurned', {
          timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
        });
        calRecords = calRes.records as any[];
      } catch { /* permission not granted / not available — leave kcal at 0 */ }

      const out: ExerciseSessionSummary[] = sessions.map((s) => {
        const startMs = new Date(s.startTime).getTime();
        const endMs = new Date(s.endTime).getTime();
        const minutes = Math.max(0, Math.round((endMs - startMs) / 60000));
        const kcal = calRecords.reduce((sum, r) => {
          const rs = new Date(r.startTime).getTime();
          const re = new Date(r.endTime).getTime();
          const overlaps = rs < endMs && re > startMs;
          return overlaps ? sum + Number(r?.energy?.inKilocalories ?? 0) : sum;
        }, 0);
        return {
          id: String(s.metadata?.id ?? s.id ?? `${s.startTime}|${s.endTime}`),
          exerciseType: Number(s.exerciseType ?? 0),
          typeLabel: EXERCISE_LABEL[Number(s.exerciseType)] ?? 'Workout',
          title: s.title,
          startTime: s.startTime,
          endTime: s.endTime,
          minutes,
          caloriesBurned: Math.round(kcal),
          dataOrigin: originOf(s),
        };
      });
      return ok(out);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read exercise sessions.');
    }
  },

  async getLatestWeight(date?: string): Promise<Result<WeightPoint | null>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    // Look back 30 days so we always resolve a "latest" even if today has
    // no reading. Callers wanting today-only should use `getWeightForDay`.
    const iso = dayISO(date);
    const [y, m, d] = parseIsoDay(iso);
    const start = new Date(y, m - 1, d - 30, 0, 0, 0, 0).toISOString();
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString();
    try {
      const result = await readRecords('Weight', {
        timeRangeFilter: { operator: 'between', startTime: start, endTime: end },
      });
      if (!result.records.length) return ok(null);
      const sorted = [...result.records].sort(
        (a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime(),
      );
      const latest = sorted[0] as any;
      return ok({ kg: Number(latest.weight.inKilograms), time: latest.time, dataOrigin: originOf(latest) });
    } catch (e: any) {
      return err(e?.message ?? 'Could not read weight.');
    }
  },

  async getWeightForDay(date?: string): Promise<Result<WeightPoint[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const result = await readRecords('Weight', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const points = result.records.map((r: any) => ({
        kg: Number(r.weight.inKilograms),
        time: r.time,
        dataOrigin: originOf(r),
      }));
      return ok(points);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read weight for day.');
    }
  },

  async getHydrationForDay(date?: string): Promise<Result<HydrationImport>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const result = await readRecords('Hydration', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const recordIds: string[] = [];
      const records: HydrationRecordSample[] = [];
      let totalMl = 0;
      for (const r of result.records as any[]) {
        const ml = Number(r?.volume?.inMilliliters ?? 0);
        if (!Number.isFinite(ml) || ml <= 0) continue;
        totalMl += ml;
        const id = String(r.metadata?.id ?? r.id ?? `${r.startTime}|${ml}`);
        recordIds.push(id);
        records.push({ id, ml: Math.round(ml), dataOrigin: originOf(r) });
      }
      return ok({ totalMl: Math.round(totalMl), recordIds, records });
    } catch (e: any) {
      return err(e?.message ?? 'Could not read hydration.');
    }
  },

  async getNutritionForDay(date?: string): Promise<Result<NutritionEntry[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const result = await readRecords('Nutrition', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const out: NutritionEntry[] = (result.records as any[]).map((r) => ({
        id: String(r.metadata?.id ?? r.id ?? `${r.startTime}|${r.name ?? 'meal'}`),
        name: r.name ?? 'Meal',
        mealType: hcMealTypeToOurs(Number(r.mealType)),
        time: r.startTime,
        calories: Math.round(Number(r?.energy?.inKilocalories ?? 0)),
        protein: round1(Number(r?.protein?.inGrams ?? 0)),
        carbs: round1(Number(r?.totalCarbohydrate?.inGrams ?? 0)),
        fat: round1(Number(r?.totalFat?.inGrams ?? 0)),
        fiber: round1(Number(r?.dietaryFiber?.inGrams ?? 0)),
        dataOrigin: originOf(r),
      }));
      return ok(out);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read nutrition.');
    }
  },

  // ─── Feature 16 methods ────────────────────────────────────────────

  async getHrvForDay(date?: string): Promise<Result<HrvReading[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const res = await readRecords('HeartRateVariabilityRmssd', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const out: HrvReading[] = (res.records as any[]).map((r) => ({
        ms: Math.round(Number(r.heartRateVariabilityMillis ?? 0) * 10) / 10,
        time: r.time,
        dataOrigin: originOf(r),
      }));
      return ok(out);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read HRV.');
    }
  },

  async getVo2Max(date?: string): Promise<Result<Vo2MaxReading | null>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    // Look back 90 days so we always return a "latest" if one exists in the
    // window — VO₂ max isn't updated every day.
    const iso = dayISO(date);
    const [y, m, d] = parseIsoDay(iso);
    const start = new Date(y, m - 1, d - 90, 0, 0, 0, 0).toISOString();
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString();
    try {
      const res = await readRecords('Vo2Max', {
        timeRangeFilter: { operator: 'between', startTime: start, endTime: end },
      });
      if (!res.records.length) return ok(null);
      const sorted = [...res.records].sort(
        (a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime(),
      );
      const latest = sorted[0] as any;
      return ok({
        vo2: Math.round(Number(latest.vo2MillilitersPerMinuteKilogram ?? 0) * 10) / 10,
        time: latest.time,
        measurementMethod: Number(latest.measurementMethod ?? 0),
        dataOrigin: originOf(latest),
      });
    } catch (e: any) {
      return err(e?.message ?? 'Could not read VO2 max.');
    }
  },

  async getBodyCompositionForDay(date?: string): Promise<Result<BodyComposition>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    // Each sub-metric is a separate record type; read them in parallel and
    // fold the latest reading of each into one composite. A failure on any
    // individual read leaves that field null (permission not granted).
    const [fatRes, leanRes, boneRes, waterRes] = await Promise.all([
      readRecords('BodyFat', { timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end } }).catch(() => ({ records: [] as any[] })),
      readRecords('LeanBodyMass', { timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end } }).catch(() => ({ records: [] as any[] })),
      readRecords('BoneMass', { timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end } }).catch(() => ({ records: [] as any[] })),
      readRecords('BodyWaterMass', { timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end } }).catch(() => ({ records: [] as any[] })),
    ]);
    const pickLatest = (list: any[]) => {
      if (!list.length) return null;
      return [...list].sort(
        (a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime(),
      )[0];
    };
    const fat = pickLatest(fatRes.records);
    const lean = pickLatest(leanRes.records);
    const bone = pickLatest(boneRes.records);
    const water = pickLatest(waterRes.records);
    // Pick origin of whichever fresh reading exists first (fat → lean → bone).
    const originHost = fat ?? lean ?? bone ?? water;
    return ok({
      bodyFatPct: fat ? round1(Number(fat.percentage)) : null,
      leanBodyMassKg: lean ? round1(Number(lean.mass.inKilograms)) : null,
      boneMassKg: bone ? round1(Number(bone.mass.inKilograms)) : null,
      bodyWaterMassKg: water ? round1(Number(water.mass.inKilograms)) : null,
      dataOrigin: originHost ? originOf(originHost) : '',
    });
  },

  async getRespiratoryRateForDay(date?: string): Promise<Result<RespiratoryReading[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const res = await readRecords('RespiratoryRate', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const out: RespiratoryReading[] = (res.records as any[]).map((r) => ({
        rate: round1(Number(r.rate ?? 0)),
        time: r.time,
        dataOrigin: originOf(r),
      }));
      return ok(out);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read respiratory rate.');
    }
  },

  async getBodyTemperatureForDay(date?: string): Promise<Result<BodyTemperatureReading[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const res = await readRecords('BodyTemperature', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const out: BodyTemperatureReading[] = (res.records as any[]).map((r) => ({
        celsius: round1(Number(r?.temperature?.inCelsius ?? 0)),
        time: r.time,
        dataOrigin: originOf(r),
      }));
      return ok(out);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read body temperature.');
    }
  },

  async getBloodPressureForDay(date?: string): Promise<Result<BloodPressureReading[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const res = await readRecords('BloodPressure', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const out: BloodPressureReading[] = (res.records as any[]).map((r) => ({
        systolicMmHg: Math.round(Number(r?.systolic?.inMillimetersOfMercury ?? 0)),
        diastolicMmHg: Math.round(Number(r?.diastolic?.inMillimetersOfMercury ?? 0)),
        time: r.time,
        dataOrigin: originOf(r),
      }));
      return ok(out);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read blood pressure.');
    }
  },

  async getBloodGlucoseForDay(date?: string): Promise<Result<BloodGlucoseReading[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const res = await readRecords('BloodGlucose', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const out: BloodGlucoseReading[] = (res.records as any[]).map((r) => ({
        mmolPerL: round1(Number(r?.level?.inMillimolesPerLiter ?? 0)),
        time: r.time,
        dataOrigin: originOf(r),
      }));
      return ok(out);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read blood glucose.');
    }
  },

  async getFloorsForDay(date?: string): Promise<Result<FloorsReading>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const res = await readRecords('FloorsClimbed', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const count = (res.records as any[]).reduce((s, r) => s + Number(r?.floors ?? 0), 0);
      const first = res.records[0];
      return ok({ count: Math.round(count), dataOrigin: first ? originOf(first) : '' });
    } catch (e: any) {
      return err(e?.message ?? 'Could not read floors climbed.');
    }
  },

  async getElevationForDay(date?: string): Promise<Result<ElevationReading>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const res = await readRecords('ElevationGained', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const metres = (res.records as any[]).reduce(
        (s, r) => s + Number(r?.elevation?.inMeters ?? 0),
        0,
      );
      const first = res.records[0];
      return ok({ gainedMeters: Math.round(metres), dataOrigin: first ? originOf(first) : '' });
    } catch (e: any) {
      return err(e?.message ?? 'Could not read elevation.');
    }
  },

  async getSpeedForDay(date?: string): Promise<Result<SpeedSample[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const res = await readRecords('Speed', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const samples: SpeedSample[] = [];
      for (const r of res.records as any[]) {
        const origin = originOf(r);
        for (const s of r.samples ?? []) {
          samples.push({ mps: round1(Number(s.speed?.inMetersPerSecond ?? 0)), time: s.time, dataOrigin: origin });
        }
      }
      return ok(samples);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read speed.');
    }
  },

  async getPowerForDay(date?: string): Promise<Result<PowerSample[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const res = await readRecords('Power', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const samples: PowerSample[] = [];
      for (const r of res.records as any[]) {
        const origin = originOf(r);
        for (const s of r.samples ?? []) {
          samples.push({ watts: Math.round(Number(s.power?.inWatts ?? 0)), time: s.time, dataOrigin: origin });
        }
      }
      return ok(samples);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read power.');
    }
  },

  async getCyclingCadenceForDay(date?: string): Promise<Result<{ rpm: number; time: string; dataOrigin: string }[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      const res = await readRecords('CyclingPedalingCadence', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const samples: { rpm: number; time: string; dataOrigin: string }[] = [];
      for (const r of res.records as any[]) {
        const origin = originOf(r);
        for (const s of r.samples ?? []) {
          samples.push({ rpm: Math.round(Number(s.revolutionsPerMinute ?? 0)), time: s.time, dataOrigin: origin });
        }
      }
      return ok(samples);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read cycling cadence.');
    }
  },

  async getMindfulnessSessionsForDay(date?: string): Promise<Result<MindfulnessSession[]>> {
    const init = await ensureInitialized();
    if (!init.ok) return init;
    const range = dayRangeIso(dayISO(date));
    try {
      // HC has no dedicated MindfulnessSession record in this SDK version.
      // Real-world integrations (Samsung Health / Google Fit / Calm) write
      // meditation as ExerciseSession with `exerciseType` in a small set.
      // Filter down to those types here.
      const res = await readRecords('ExerciseSession', {
        timeRangeFilter: { operator: 'between', startTime: range.start, endTime: range.end },
      });
      const out: MindfulnessSession[] = [];
      for (const s of res.records as any[]) {
        const type = Number(s.exerciseType ?? 0);
        // Product decision: only GUIDED_BREATHING counts as mindfulness.
        // Yoga / Pilates are workouts and flow through the Workout History
        // synced merge instead. Filter set lives in one place —
        // MINDFULNESS_EXERCISE_TYPES — so screen + provider stay in sync.
        if (!MINDFULNESS_EXERCISE_TYPES.has(type)) continue;
        const startMs = new Date(s.startTime).getTime();
        const endMs = new Date(s.endTime).getTime();
        out.push({
          id: String(s.metadata?.id ?? s.id ?? `${s.startTime}|${s.endTime}`),
          typeLabel: EXERCISE_LABEL[type] ?? 'Mindfulness',
          title: s.title,
          startTime: s.startTime,
          endTime: s.endTime,
          minutes: Math.max(0, Math.round((endMs - startMs) / 60000)),
          dataOrigin: originOf(s),
        });
      }
      return ok(out);
    } catch (e: any) {
      return err(e?.message ?? 'Could not read mindfulness sessions.');
    }
  },
};

// Sleep sessions typically start the previous night — pull an 18:00 → 18:00
// window so a session crossing midnight is fully captured.
function sleepNightRangeIso(iso: string): { start: string; end: string } {
  const [y, m, d] = parseIsoDay(iso);
  const start = new Date(y, m - 1, d - 1, 18, 0, 0, 0).toISOString();
  const end = new Date(y, m - 1, d, 18, 0, 0, 0).toISOString();
  return { start, end };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
