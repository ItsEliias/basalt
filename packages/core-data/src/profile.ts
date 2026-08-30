import type { SupabaseClient } from '@supabase/supabase-js';
import { type Result, ok, err } from './result';
import { currentUserId } from './user';
import { todayISO } from './dates';

// Identity & targets persistence — basalt_profiles (one row per user, every
// onboarding answer editable later) and basalt_targets (versioned rows so
// historical charts stay honest when targets change).

export type ProfileRecord = {
  name: string | null;
  biologicalSex: 'female' | 'male' | 'intersex' | 'prefer_not_to_say' | null;
  birthdate: string | null;
  ageYears: number | null;
  heightCm: number | null;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very' | 'extreme' | null;
  goalTypes: string[];
  goalWeightKg: number | null;
  weeklyTargetKg: number | null;
  conditions: string[];
  medications: string[];
  habits: Record<string, string>;
  dietaryFlags: string[];
  dietPatterns: string[];
  trainLocation: 'gym' | 'home' | 'both' | null;
  equipment: string[];
  jobActivity: string | null;
  exerciseFrequency: string | null;
  typicalSleep: string | null;
  stressLevel: string | null;
  motivations: string[];
  checkinPreference: 'quiet' | 'weekly' | 'daily' | null;
  /** ED-sensitive display mode: log everything, show no nutrition numbers. */
  hideNumbers: boolean;
  /** Fasting module opt-in — off by default. */
  fastingEnabled: boolean;
  /** Monthly-challenge opt-in — private, optional, off by default. */
  challengeEnabled: boolean;
  useMetric: boolean;
  /** Settings → Display. Layered on top of the OS accessibility text-size setting, not a replacement for it. */
  textScale: 'system' | 'plus1' | 'plus2';
  /** Settings → Display. Comfortable (+4dp row/card padding) is the default for new installs. */
  density: 'comfortable' | 'compact';
  /** Settings → Display. Six contrast-verified palettes (packages/ui/src/theme/themes) — 'minimal' for new and existing installs until changed. */
  theme: 'minimal' | 'humanist' | 'athletic' | 'brutalist' | 'depth' | 'atelier';
  /** Settings → Display. Today only in v1 (docs/basalt-layouts.md) — 'ledger' for new and existing installs until changed. */
  todayLayout: 'ledger' | 'tiles';
};

function mapProfile(r: any): ProfileRecord {
  return {
    name: r.name ?? null,
    biologicalSex: r.biological_sex ?? null,
    birthdate: r.birthdate ?? null,
    ageYears: r.age_years ?? null,
    heightCm: r.height_cm === null || r.height_cm === undefined ? null : Number(r.height_cm),
    activityLevel: r.activity_level ?? null,
    goalTypes: r.goal_types ?? [],
    goalWeightKg: r.goal_weight_kg === null || r.goal_weight_kg === undefined ? null : Number(r.goal_weight_kg),
    weeklyTargetKg: r.weekly_target_kg === null || r.weekly_target_kg === undefined ? null : Number(r.weekly_target_kg),
    conditions: r.conditions ?? [],
    medications: r.medications ?? [],
    habits: r.habits ?? {},
    dietaryFlags: r.dietary_flags ?? [],
    dietPatterns: r.diet_patterns ?? [],
    trainLocation: r.train_location ?? null,
    equipment: r.equipment ?? [],
    jobActivity: r.job_activity ?? null,
    exerciseFrequency: r.exercise_frequency ?? null,
    typicalSleep: r.typical_sleep ?? null,
    stressLevel: r.stress_level ?? null,
    motivations: r.motivations ?? [],
    checkinPreference: r.checkin_preference ?? null,
    hideNumbers: r.hide_numbers ?? false,
    fastingEnabled: r.fasting_enabled ?? false,
    challengeEnabled: r.challenge_enabled ?? false,
    useMetric: r.use_metric ?? true,
    textScale: r.text_scale ?? 'system',
    density: r.density ?? 'comfortable',
    theme: r.theme ?? 'minimal',
    todayLayout: r.today_layout ?? 'ledger',
  };
}

function profilePayload(p: Partial<ProfileRecord>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const map: [keyof ProfileRecord, string][] = [
    ['name', 'name'], ['biologicalSex', 'biological_sex'], ['birthdate', 'birthdate'],
    ['ageYears', 'age_years'], ['heightCm', 'height_cm'], ['activityLevel', 'activity_level'],
    ['goalTypes', 'goal_types'], ['goalWeightKg', 'goal_weight_kg'], ['weeklyTargetKg', 'weekly_target_kg'],
    ['conditions', 'conditions'], ['medications', 'medications'], ['habits', 'habits'],
    ['dietaryFlags', 'dietary_flags'], ['dietPatterns', 'diet_patterns'], ['trainLocation', 'train_location'],
    ['equipment', 'equipment'], ['jobActivity', 'job_activity'], ['exerciseFrequency', 'exercise_frequency'],
    ['typicalSleep', 'typical_sleep'], ['stressLevel', 'stress_level'], ['motivations', 'motivations'],
    ['checkinPreference', 'checkin_preference'], ['useMetric', 'use_metric'], ['hideNumbers', 'hide_numbers'], ['fastingEnabled', 'fasting_enabled'], ['challengeEnabled', 'challenge_enabled'],
    ['textScale', 'text_scale'], ['density', 'density'],
    ['theme', 'theme'], ['todayLayout', 'today_layout'],
  ];
  for (const [key, col] of map) {
    if (p[key] !== undefined) out[col] = p[key];
  }
  return out;
}

/** Upsert the caller's profile row (partial updates are fine). */
export async function saveProfile(
  client: SupabaseClient,
  profile: Partial<ProfileRecord>,
): Promise<Result<ProfileRecord>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_profiles')
    .upsert({ id: u.data, ...profilePayload(profile) }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not save profile.');
  return ok(mapProfile(data));
}

export async function getProfile(client: SupabaseClient): Promise<Result<ProfileRecord | null>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_profiles')
    .select('*')
    .eq('id', u.data)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') return err(error.message);
  return ok(data ? mapProfile(data) : null);
}

// ─── Versioned targets ───────────────────────────────────────────────────────

export type TargetsRecord = {
  effectiveDate: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarCapG: number | null;
  sodiumCapMg: number | null;
  waterMl: number | null;
  steps: number | null;
  sleepMin: number | null;
  /** The one-line "why" behind this version — shown, never hidden. */
  reason: string | null;
};

function mapTargets(r: any): TargetsRecord {
  return {
    effectiveDate: r.effective_date,
    calories: Number(r.calories),
    proteinG: Number(r.protein_g),
    carbsG: Number(r.carbs_g),
    fatG: Number(r.fat_g),
    fiberG: Number(r.fiber_g),
    sugarCapG: r.sugar_cap_g ?? null,
    sodiumCapMg: r.sodium_cap_mg ?? null,
    waterMl: r.water_ml ?? null,
    steps: r.steps ?? null,
    sleepMin: r.sleep_min ?? null,
    reason: r.reason ?? null,
  };
}

/** Write a new targets version effective from `effectiveDate` (default today). */
export async function saveTargets(
  client: SupabaseClient,
  targets: Omit<TargetsRecord, 'effectiveDate'> & { effectiveDate?: string },
): Promise<Result<TargetsRecord>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_targets')
    .upsert(
      {
        user_id: u.data,
        effective_date: targets.effectiveDate ?? todayISO(),
        calories: targets.calories,
        protein_g: targets.proteinG,
        carbs_g: targets.carbsG,
        fat_g: targets.fatG,
        fiber_g: targets.fiberG,
        sugar_cap_g: targets.sugarCapG,
        sodium_cap_mg: targets.sodiumCapMg,
        water_ml: targets.waterMl,
        steps: targets.steps,
        sleep_min: targets.sleepMin,
        reason: targets.reason,
      },
      { onConflict: 'user_id,effective_date' },
    )
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not save targets.');
  return ok(mapTargets(data));
}

/** The targets version in force on `date` — latest effective_date ≤ date. */
export async function getTargetsFor(
  client: SupabaseClient,
  date: string = todayISO(),
): Promise<Result<TargetsRecord | null>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_targets')
    .select('*')
    .eq('user_id', u.data)
    .lte('effective_date', date)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') return err(error.message);
  return ok(data ? mapTargets(data) : null);
}

// ─── Weight entries (feeds the adaptive TDEE loop) ──────────────────────────

export type WeightEntry = { id: string; measuredAt: string; weightKg: number; source: string };

export async function addWeightEntry(
  client: SupabaseClient,
  weightKg: number,
  options: { measuredAt?: string; source?: string } = {},
): Promise<Result<WeightEntry>> {
  if (!isFinite(weightKg) || weightKg <= 0) return err('Invalid weight.');
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_weight_entries')
    .insert({
      user_id: u.data,
      weight_kg: weightKg,
      measured_at: options.measuredAt ?? new Date().toISOString(),
      source: options.source ?? 'manual',
    })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not save weight.');
  return ok({ id: data.id, measuredAt: data.measured_at, weightKg: Number(data.weight_kg), source: data.source });
}

export async function listWeightEntries(
  client: SupabaseClient,
  sinceDays = 90,
): Promise<Result<WeightEntry[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const { data, error } = await client
    .from('basalt_weight_entries')
    .select('*')
    .eq('user_id', u.data)
    .gte('measured_at', since.toISOString())
    .order('measured_at', { ascending: true });
  if (error) return err(error.message);
  return ok((data ?? []).map((r: any) => ({
    id: r.id, measuredAt: r.measured_at, weightKg: Number(r.weight_kg), source: r.source,
  })));
}
