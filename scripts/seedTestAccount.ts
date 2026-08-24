import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseClient, saveProfile, saveTargets, addWeightEntry, getTargetsFor, type Result,
} from '@basalt/core-data';
import { addFoodEntry, addWater, recordFoodUse, importHcMeal, getDailyTotals, type FoodEntryInput } from '@basalt/nutrition';
import { startSession, addSessionExercise, logSet, endSession, getExercises, saveWalk, summarizeWalk } from '@basalt/training';

// Deep relative import — @basalt/health-connect's package index pulls in
// react-native's Platform at module scope (see scripts/seed/healthProvider.ts
// for the full explanation), which throws under plain Node. sync.ts itself
// has no such dependency, so importing it directly sidesteps the problem.
import { syncHealthData } from '../packages/health-connect/src/sync';

import { buildPlan, rngForDay, type DayPlan } from './seed/plan';
import { buildSets } from './seed/training';
import { buildSeedProvider } from './seed/healthProvider';
import { buildWalkFixes } from './seed/walk';
import { pick, chance, uniform, jitter, round1, clamp } from './seed/rng';
import {
  BREAKFASTS, LUNCHES, DINNERS, SNACKS, AI_PHOTO_MEALS, HC_MEALS, HC_DATA_ORIGINS,
  MAIN_LIFTS, MINDFULNESS_KINDS, type FoodTemplate,
} from './seed/data';

// Seeds a 90-day test account entirely through the app's own service layer
// (Result<T> everywhere — see food.ts's contract comment), so what lands in
// the DB is exactly what the app itself would have written. The one
// exception is basalt_mindfulness_sessions, which has no service function
// at all — the app's own RecoverScreen writes it with a raw insert, so this
// script mirrors that exact shape rather than inventing a new abstraction.
//
// Idempotency: rather than dedupe row-by-row against tables with no natural
// key (workout sessions, walks, mindfulness, plain food entries), every run
// wipes this one test user's existing basalt_ rows first, then regenerates
// from the same deterministic seed (scripts/seed/plan.ts's mulberry32 PRNG)
// — so re-running always converges on the identical 90-day dataset, just
// via wipe-and-regenerate rather than insert-time dedup.

const TEST_EMAIL = 'cody.liddell.01@gmail.com';
const TEST_PASSWORD = 'TEST123';

const SPLIT = ['push', 'pull', 'legs', 'rest', 'upper', 'rest', 'lower'] as const;
type SplitKey = Exclude<(typeof SPLIT)[number], 'rest'>;

type Macros = { calories: number; protein: number; carbs: number; fat: number; fiber: number; sugar?: number; sodiumMg?: number };

function scaledMacros(t: FoodTemplate, mult: number): Macros {
  const p = t.perServe;
  return {
    calories: Math.round(p.calories * mult),
    protein: round1(p.protein * mult),
    carbs: round1(p.carbs * mult),
    fat: round1(p.fat * mult),
    fiber: round1(p.fiber * mult),
    sugar: p.sugar !== undefined ? round1(p.sugar * mult) : undefined,
    sodiumMg: p.sodiumMg !== undefined ? Math.round(p.sodiumMg * mult) : undefined,
  };
}

/** A Date at hh:mm:ss on `dateISO`, in the machine's local timezone. */
function atTime(dateISO: string, hh: number, mm = 0, ss = 0): Date {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setHours(hh, mm, ss, 0);
  return d;
}

async function mustOk<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

// ─── Meal logging ────────────────────────────────────────────────────────────

async function logPoolMeal(
  client: SupabaseClient,
  dateISO: string,
  mealType: FoodEntryInput['mealType'],
  hh: number,
  mm: number,
  template: FoodTemplate,
  mult: number,
  rng: ReturnType<typeof rngForDay>,
): Promise<void> {
  const macros = scaledMacros(template, mult);
  const input: FoodEntryInput = {
    mealType,
    foodName: template.name,
    brand: template.brand,
    barcode: template.barcode,
    source: template.barcode ? 'barcode' : 'manual',
    ...macros,
  };
  const createdAt = atTime(dateISO, hh, clamp(mm + Math.round(jitter(rng, 10)), 0, 59)).toISOString();
  await mustOk(addFoodEntry(client, input, { date: dateISO, createdAt }));
  await mustOk(recordFoodUse(client, { foodName: input.foodName, brand: input.brand, barcode: input.barcode, ...macros }));
}

async function logPhotoMeal(
  client: SupabaseClient,
  dateISO: string,
  mealType: FoodEntryInput['mealType'],
  hh: number,
  mm: number,
  template: FoodTemplate,
  rng: ReturnType<typeof rngForDay>,
): Promise<void> {
  const macros = scaledMacros(template, 1);
  const createdAt = atTime(dateISO, hh, clamp(mm + Math.round(jitter(rng, 15)), 0, 59)).toISOString();
  await mustOk(addFoodEntry(client, { mealType, foodName: template.name, source: 'photo', ...macros }, { date: dateISO, createdAt }));
}

async function logHcMeal(
  client: SupabaseClient,
  dateISO: string,
  mealType: FoodEntryInput['mealType'],
  template: FoodTemplate,
  rng: ReturnType<typeof rngForDay>,
): Promise<void> {
  const macros = scaledMacros(template, 1);
  const dataOrigin = pick(rng, HC_DATA_ORIGINS);
  const extId = `seed-hc-meal-${dateISO}-${mealType}`;
  await mustOk(importHcMeal(client, { mealType, foodName: template.name, extId, dataOrigin, ...macros }, dateISO));
}

async function logMealSlot(
  client: SupabaseClient,
  dateISO: string,
  mealType: FoodEntryInput['mealType'],
  pool: FoodTemplate[],
  hh: number,
  mm: number,
  rng: ReturnType<typeof rngForDay>,
  overCapMult = 1,
): Promise<void> {
  const roll = rng();
  if (roll < 0.06) {
    await logHcMeal(client, dateISO, mealType, pick(rng, HC_MEALS), rng);
  } else if (roll < 0.14) {
    await logPhotoMeal(client, dateISO, mealType, hh, mm, pick(rng, AI_PHOTO_MEALS), rng);
  } else {
    await logPoolMeal(client, dateISO, mealType, hh, mm, pick(rng, pool), overCapMult, rng);
  }
}

/**
 * Guarantee an over-cap day actually reads as over-cap. A probabilistic
 * dinner-portion multiplier alone left most flagged days still under target
 * (generous calorie targets absorbed the boost) — so instead, read the
 * day's real totals back through the same service layer and, if still
 * short, log one more entry sized to clear the target by a visible margin.
 * Real macros on a real (backdated) entry, not a synthetic "over" flag.
 */
async function ensureOverCap(client: SupabaseClient, dateISO: string, rng: ReturnType<typeof rngForDay>): Promise<void> {
  const totals = await mustOk(getDailyTotals(client, dateISO));
  const target = await mustOk(getTargetsFor(client, dateISO));
  if (!target) return;

  const overBy = uniform(rng, 250, 500);
  const extraCalories = Math.round(target.calories + overBy - totals.calories);
  if (extraCalories < 50) return;

  await mustOk(
    addFoodEntry(
      client,
      {
        mealType: 'snacks',
        foodName: pick(rng, ['Dessert', 'Second helping', 'Late-night snack', 'Takeaway on the way home']),
        source: 'manual',
        calories: extraCalories,
        protein: round1((extraCalories * 0.06) / 4),
        carbs: round1((extraCalories * 0.55) / 4),
        fat: round1((extraCalories * 0.35) / 9),
        fiber: 1,
        sugar: round1((extraCalories * 0.28) / 4),
        sodiumMg: Math.round(extraCalories * 0.55),
      },
      { date: dateISO, createdAt: atTime(dateISO, 21, Math.round(uniform(rng, 0, 45))).toISOString() },
    ),
  );
}

// ─── Training ────────────────────────────────────────────────────────────────

async function logTrainingSession(
  client: SupabaseClient,
  plan: DayPlan,
  split: SplitKey,
  exerciseIds: Map<string, string>,
  rng: ReturnType<typeof rngForDay>,
): Promise<void> {
  const lifts = MAIN_LIFTS[split];
  const isWeekend = plan.dayOfWeek === 0 || plan.dayOfWeek === 6;
  const startHH = isWeekend ? uniform(rng, 9, 11) : uniform(rng, 17, 19.5);
  const startedAt = atTime(plan.dateISO, Math.floor(startHH), Math.round((startHH % 1) * 60));

  const session = await mustOk(startSession(client, { startedAt: startedAt.toISOString() }));

  // Every set needs its own backdated completedAt — without it, logSet's
  // completed_at falls back to the DB default (now()), which would land
  // every seeded set on today regardless of which day its session covers
  // and silently break any day-keyed analysis of training volume (this is
  // exactly what happened before completedAt was threaded through).
  let elapsedMin = 0;
  for (let i = 0; i < lifts.length; i++) {
    const lift = lifts[i]!;
    const sessionExercise = await mustOk(
      addSessionExercise(client, {
        sessionId: session.id,
        exerciseId: exerciseIds.get(lift.name) ?? null,
        exerciseName: lift.name,
        orderIndex: i,
        restSeconds: plan.isDeloadWeek ? 90 : 120,
      }),
    );
    for (const s of buildSets(rng, lift, plan)) {
      elapsedMin += uniform(rng, 1.8, 3.2);
      const completedAt = new Date(startedAt.getTime() + elapsedMin * 60000).toISOString();
      await mustOk(logSet(client, sessionExercise.id, { setNumber: s.setNumber, reps: s.reps, weightKg: s.kg, rir: s.rir, completedAt }));
    }
  }

  const durationMin = Math.round(uniform(rng, 40, 70));
  const endedAt = new Date(startedAt.getTime() + durationMin * 60000);
  const rpe = plan.isTrainingPR
    ? clamp(9 + jitter(rng, 0.5), 8, 10)
    : plan.isDeloadWeek
      ? clamp(5 + jitter(rng, 1), 3, 6)
      : clamp(7 + jitter(rng, 1), 5, 9);
  await mustOk(endSession(client, session.id, { endedAt: endedAt.toISOString(), sessionRpe: round1(rpe) }));
}

// ─── Walks ───────────────────────────────────────────────────────────────────

async function logWalk(client: SupabaseClient, plan: DayPlan, rng: ReturnType<typeof rngForDay>): Promise<void> {
  const hh = plan.hasTraining ? uniform(rng, 6.5, 8) : uniform(rng, 16, 19);
  const startedAt = atTime(plan.dateISO, Math.floor(hh), Math.round((hh % 1) * 60));
  const targetKm = round1(uniform(rng, 2, 6));
  const fixes = buildWalkFixes(rng, startedAt.getTime(), targetKm);
  const first = fixes[0]!;
  const last = fixes[fixes.length - 1]!;
  const summary = summarizeWalk(fixes, first.time, last.time);
  await mustOk(
    saveWalk(client, {
      startedAt: new Date(first.time).toISOString(),
      endedAt: new Date(last.time).toISOString(),
      distanceM: summary.distanceM,
      durationS: summary.durationS,
      elevationGainM: summary.elevationGainM,
      avgPaceSecPerKm: summary.avgPaceSecPerKm,
      route: summary.simplified,
    }),
  );
}

// ─── Mindfulness — no service function exists; mirrors RecoverScreen's own
// raw insert (packages/../app/src/screens/recover/RecoverScreen.tsx), a
// genuine service-layer gap surfaced by seeding, not worked around here. ──

async function logMindfulness(client: SupabaseClient, userId: string, plan: DayPlan, rng: ReturnType<typeof rngForDay>): Promise<void> {
  const kind = pick(rng, MINDFULNESS_KINDS);
  const minutes = Math.round(uniform(rng, 5, 20));
  const hh = uniform(rng, 7, 22);
  const startedAt = atTime(plan.dateISO, Math.floor(hh), Math.round((hh % 1) * 60));
  const endedAt = new Date(startedAt.getTime() + minutes * 60000);
  const { error } = await client.from('basalt_mindfulness_sessions').insert({
    user_id: userId,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    minutes,
    kind,
    source: 'manual',
  });
  if (error) throw new Error(`mindfulness insert failed: ${error.message}`);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

async function ensureTestUser(admin: SupabaseClient): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { seeded: true, seed_source: 'scripts/seedTestAccount.ts' },
  });
  if (created.data.user) return created.data.user.id;

  const msg = created.error?.message ?? '';
  if (!/already.*registered|already exists|duplicate/i.test(msg)) {
    throw new Error(`Could not create test user: ${msg}`);
  }

  // Already exists (this email pre-dates this script — first seen 2026-07-02,
  // password unknown to us). Force it to the documented test credentials so
  // sign-in is deterministic on every re-run, not just on first creation.
  let existingId: string | null = null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === TEST_EMAIL.toLowerCase());
    if (found) { existingId = found.id; break; }
    if (data.users.length < 200) break;
  }
  if (!existingId) throw new Error(`User ${TEST_EMAIL} reported as existing but could not be found via listUsers.`);

  const updated = await admin.auth.admin.updateUserById(existingId, { password: TEST_PASSWORD, email_confirm: true });
  if (updated.error) throw new Error(`Could not reset test user password: ${updated.error.message}`);
  return existingId;
}

// Same table list as supabase/functions/delete-account/index.ts — wiping
// with it (minus the auth/Arise-check steps, which only apply to real
// account deletion) doubles as a live check that the app's own teardown
// path actually covers everything this script seeds.
const WIPE_TABLES = [
  'basalt_set_entries', 'basalt_session_exercises', 'basalt_workout_sessions',
  'basalt_sleep_stages', 'basalt_sleep_sessions',
  'basalt_food_entries', 'basalt_food_favorites', 'basalt_daily_logs',
  'basalt_hydration_logs', 'basalt_mindfulness_sessions', 'basalt_walks',
  'basalt_step_logs', 'basalt_vitals', 'basalt_weight_entries', 'basalt_targets',
];

async function wipeSeedData(admin: SupabaseClient, userId: string): Promise<void> {
  for (const table of WIPE_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(`Wipe failed at ${table}: ${error.message}`);
  }
  const { error } = await admin.from('basalt_profiles').delete().eq('id', userId);
  if (error) throw new Error(`Wipe failed at basalt_profiles: ${error.message}`);
}

async function resolveExerciseIds(client: SupabaseClient): Promise<Map<string, string>> {
  const names = new Set<string>();
  for (const lifts of Object.values(MAIN_LIFTS)) for (const l of lifts) names.add(l.name);

  const map = new Map<string, string>();
  for (const name of names) {
    const r = await getExercises(client, { search: name, limit: 10 });
    if (!r.ok) throw new Error(`Exercise lookup failed for "${name}": ${r.error}`);
    const exact = r.data.find((e) => e.name === name);
    if (!exact) throw new Error(`Exercise "${name}" not found in basalt_exercises — check scripts/seed/data.ts.`);
    map.set(name, exact.id);
  }
  return map;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file — vars may already be present in the environment.
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Copy .env.example to .env and fill in SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard → Project Settings → API).');
    process.exit(1);
  }
  console.log(`Seeding against: ${SUPABASE_URL}`);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const userId = await ensureTestUser(admin);
  console.log(`Test user: ${TEST_EMAIL} (${userId})`);

  console.log('Wiping any existing seeded data for this user...');
  await wipeSeedData(admin, userId);

  const client = createSupabaseClient({ url: SUPABASE_URL, anonKey: SUPABASE_PUBLISHABLE_KEY });
  const signIn = await client.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (signIn.error) throw new Error(`Sign-in failed: ${signIn.error.message}`);

  console.log('Seeding profile...');
  await mustOk(
    saveProfile(client, {
      name: 'Test Account',
      biologicalSex: 'male',
      birthdate: '1994-03-15',
      ageYears: 32,
      heightCm: 178,
      activityLevel: 'moderate',
      goalTypes: ['lose_fat', 'build_muscle'],
      goalWeightKg: 80,
      weeklyTargetKg: -0.4,
      conditions: [],
      medications: [],
      habits: {},
      dietaryFlags: [],
      dietPatterns: [],
      trainLocation: 'gym',
      equipment: ['barbell', 'dumbbells', 'machines'],
      jobActivity: 'desk',
      exerciseFrequency: '4-6',
      typicalSleep: '7-8',
      stressLevel: 'moderate',
      motivations: ['health', 'strength'],
      checkinPreference: 'weekly',
      hideNumbers: false,
      fastingEnabled: false,
      challengeEnabled: false,
      useMetric: true,
      textScale: 'system',
      density: 'comfortable',
    }),
  );

  const plans = buildPlan();
  const plansByDate = new Map(plans.map((p) => [p.dateISO, p]));

  console.log('Seeding targets (2 versions)...');
  await mustOk(
    saveTargets(client, {
      effectiveDate: plans[0]!.dateISO,
      calories: 2350, proteinG: 185, carbsG: 210, fatG: 70, fiberG: 30,
      sugarCapG: 55, sodiumCapMg: 2300, waterMl: 3000, steps: 9000, sleepMin: 450,
      reason: 'Starting point — 500 kcal deficit off an estimated TDEE.',
    }),
  );
  await mustOk(
    saveTargets(client, {
      effectiveDate: plans[45]!.dateISO,
      calories: 2500, proteinG: 195, carbsG: 230, fatG: 78, fiberG: 32,
      sugarCapG: 55, sodiumCapMg: 2300, waterMl: 3000, steps: 9000, sleepMin: 450,
      reason: 'Six-week check-in — energy was flagging, eased the deficit back.',
    }),
  );

  console.log('Resolving exercise ids...');
  const exerciseIds = await resolveExerciseIds(client);

  console.log(`Seeding ${plans.length} days of food / water / training / walks / mindfulness / weight...`);
  for (const plan of plans) {
    const rng = rngForDay(plan.index);

    if (plan.foodCoverage !== 'none') {
      await logMealSlot(client, plan.dateISO, 'breakfast', BREAKFASTS, 7, 30, rng);

      if (plan.foodCoverage === 'full') {
        await logMealSlot(client, plan.dateISO, 'lunch', LUNCHES, 12, 30, rng);
        const dinnerMult = plan.isOverCap ? uniform(rng, 1.3, 1.6) : 1;
        await logMealSlot(client, plan.dateISO, 'dinner', DINNERS, 18, 45, rng, dinnerMult);
        if (chance(rng, 0.6)) await logMealSlot(client, plan.dateISO, 'snacks', SNACKS, 15, 30, rng);
        if (plan.isOverCap && chance(rng, 0.5)) await logMealSlot(client, plan.dateISO, 'snacks', SNACKS, 21, 0, rng);
      }

      if (plan.isOverCap) await ensureOverCap(client, plan.dateISO, rng);

      const waterEvents = Math.round(plan.foodCoverage === 'full' ? uniform(rng, 5, 8) : uniform(rng, 2, 4));
      for (let i = 0; i < waterEvents; i++) {
        const hh = Math.round(uniform(rng, 7, 22));
        const ml = Math.round(uniform(rng, 200, 450));
        const ts = atTime(plan.dateISO, hh, Math.round(uniform(rng, 0, 59))).toISOString();
        await mustOk(addWater(client, ml, plan.dateISO, ts));
      }
    }

    if (plan.hasTraining) {
      const split = SPLIT[plan.dayOfWeek];
      if (split && split !== 'rest') await logTrainingSession(client, plan, split, exerciseIds, rng);
    }

    if (plan.foodCoverage !== 'none' && chance(rng, plan.hasTraining ? 0.12 : 0.32)) {
      await logWalk(client, plan, rng);
    }

    if (chance(rng, 0.15)) {
      await logMindfulness(client, userId, plan, rng);
    }

    if (plan.weighIn !== null && plan.weightSource === 'manual') {
      const measuredAt = atTime(plan.dateISO, Math.round(uniform(rng, 6, 8)), Math.round(uniform(rng, 0, 59))).toISOString();
      await mustOk(addWeightEntry(client, plan.weighIn, { measuredAt, source: 'manual' }));
    }
  }

  console.log('Syncing Health-Connect-sourced sleep / steps / vitals / weight...');
  const provider = buildSeedProvider(plansByDate);
  const syncReport = await mustOk(syncHealthData(client, provider, { days: plans.length }));
  console.log('Sync report:', syncReport);

  console.log('\n--- Row counts (this test user) ---');
  const COUNT_TABLES = [
    'basalt_food_entries', 'basalt_food_favorites', 'basalt_hydration_logs',
    'basalt_workout_sessions', 'basalt_session_exercises', 'basalt_set_entries',
    'basalt_walks', 'basalt_sleep_sessions', 'basalt_sleep_stages',
    'basalt_mindfulness_sessions', 'basalt_weight_entries', 'basalt_vitals',
    'basalt_step_logs', 'basalt_targets', 'basalt_daily_logs',
  ];
  for (const table of COUNT_TABLES) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
    console.log(`${table.padEnd(34)} ${error ? `error: ${error.message}` : count}`);
  }

  console.log(`\nDone. Log in with ${TEST_EMAIL} / ${TEST_PASSWORD}.`);
}

main().catch((e) => {
  console.error('\nSeeding failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
