import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, todayISO, currentUserId, findOrCreateDailyLog, type Result } from '@basalt/core-data';

// ─── food — the reference template for real-data package services ────────────
//
// Contract goals (copy this shape for other package services):
//   • Every mutation returns a Result<T> — never throws into the UI layer.
//   • Callers pass their Supabase client explicitly (core-data pattern) — no
//     app-singleton import inside the package.
//   • Inserts that require a per-day parent row (basalt_daily_logs) run
//     find-or-create via @basalt/core-data's findOrCreateDailyLog, which also
//     resolves the authed user id.
//   • Every function is small, single-purpose, and side-effect free beyond the
//     Supabase writes it makes explicit.
//
// Schema recap (Basalt unified schema):
//   basalt_daily_logs   (id, user_id, date, calories_eaten, calories_burned, …)
//                       unique(user_id, date)
//   basalt_food_entries (id, log_id → basalt_daily_logs.id, user_id, meal_type,
//                        food_name, brand, calories, protein, fat, carbs,
//                        fiber, sugar, sodium_mg, saturated_fat, serving_size,
//                        serving_unit, quantity, barcode, source,
//                        ext_source, ext_id, created_at)
//
// RLS: both tables have `for all using (auth.uid() = user_id)`.

// ─── Types ───────────────────────────────────────────────────────────────────
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
/**
 * Health-Connect imports are stored as `health_connect:<packageName>` so
 * per-source granularity is kept without a schema change. The union stays
 * open via the `${string}` template so any HC origin fits.
 */
export type FoodSource =
  | 'search' | 'barcode' | 'quick_add' | 'photo' | 'manual'
  | 'health_connect'
  | `health_connect:${string}`;

export type FoodEntryInput = {
  mealType: MealType;
  foodName: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** Added sugar in grams — feeds the Today sugar cap. */
  sugar?: number;
  /** Sodium in milligrams — feeds the Today sodium cap. */
  sodiumMg?: number;
  saturatedFat?: number;
  servingSize?: number;   // default 100
  servingUnit?: string;   // default 'g'
  quantity?: number;      // default 1
  barcode?: string;
  source?: FoodSource;    // default 'manual'
  /** Micronutrients present in the SOURCE data only — never estimated. */
  micros?: Record<string, MicroValue>;
};

export type MicroValue = { amount?: number; unit?: string; pctTarget?: number };

export type FoodEntryRow = {
  id: string;
  logId: string;
  userId: string;
  mealType: MealType;
  foodName: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodiumMg: number;
  saturatedFat: number;
  servingSize: number;
  servingUnit: string;
  quantity: number;
  barcode: string | null;
  source: FoodSource;
  extSource: string | null;
  extId: string | null;
  micros: Record<string, MicroValue> | null;
  createdAt: string;
};

export type DailyTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodiumMg: number;
};

// ─── Row mapper ──────────────────────────────────────────────────────────────
function mapRow(r: any): FoodEntryRow {
  return {
    id: r.id,
    logId: r.log_id,
    userId: r.user_id,
    mealType: r.meal_type,
    foodName: r.food_name,
    brand: r.brand ?? null,
    calories: Number(r.calories ?? 0),
    protein: Number(r.protein ?? 0),
    carbs: Number(r.carbs ?? 0),
    fat: Number(r.fat ?? 0),
    fiber: Number(r.fiber ?? 0),
    sugar: Number(r.sugar ?? 0),
    sodiumMg: Number(r.sodium_mg ?? 0),
    saturatedFat: Number(r.saturated_fat ?? 0),
    servingSize: Number(r.serving_size ?? 100),
    servingUnit: r.serving_unit ?? 'g',
    quantity: Number(r.quantity ?? 1),
    barcode: r.barcode ?? null,
    source: r.source ?? 'manual',
    extSource: r.ext_source ?? null,
    extId: r.ext_id ?? null,
    micros: r.micros ?? null,
    createdAt: r.created_at,
  };
}

function insertPayloadFrom(input: FoodEntryInput, logId: string, userId: string): Record<string, unknown> {
  return {
    log_id: logId,
    user_id: userId,
    meal_type: input.mealType,
    food_name: input.foodName,
    brand: input.brand ?? null,
    calories: input.calories,
    protein: input.protein,
    fat: input.fat,
    carbs: input.carbs,
    fiber: input.fiber,
    sugar: input.sugar ?? 0,
    sodium_mg: input.sodiumMg ?? 0,
    saturated_fat: input.saturatedFat ?? 0,
    serving_size: input.servingSize ?? 100,
    serving_unit: input.servingUnit ?? 'g',
    quantity: input.quantity ?? 1,
    barcode: input.barcode ?? null,
    source: input.source ?? 'manual',
    micros: input.micros ?? null,
  };
}

// ─── Refresh cached totals on basalt_daily_logs ──────────────────────────────
async function refreshDailyLogTotals(client: SupabaseClient, logId: string): Promise<void> {
  const { data } = await client
    .from('basalt_food_entries')
    .select('calories')
    .eq('log_id', logId);
  const total = (data ?? []).reduce((s: number, e: any) => s + Number(e.calories ?? 0), 0);
  await client.from('basalt_daily_logs').update({ calories_eaten: total }).eq('id', logId);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Insert one food entry for the authed user, for today's date. Find-or-create
 * the day's `basalt_daily_logs` row first; use its id as the entry's `log_id`.
 */
export async function addFoodEntry(
  client: SupabaseClient,
  input: FoodEntryInput,
): Promise<Result<FoodEntryRow>> {
  const log = await findOrCreateDailyLog(client, todayISO());
  if (!log.ok) return log;

  const insert = await client
    .from('basalt_food_entries')
    .insert(insertPayloadFrom(input, log.data.id, log.data.userId))
    .select('*')
    .single();

  if (insert.error || !insert.data) {
    return err(insert.error?.message ?? 'Could not save meal.');
  }

  // Fire-and-forget total refresh — the returned entry is already useful.
  refreshDailyLogTotals(client, log.data.id).catch(() => {});

  return ok(mapRow(insert.data));
}

/**
 * Import a Health-Connect nutrition entry into basalt_food_entries, deduped
 * on the true HC record id: `ext_source = 'health_connect'`, `ext_id =
 * <record id>`. This replaces the source app's same-day/same-calorie
 * heuristic — the schema gap that forced it (no ext columns) is fixed in
 * the Basalt schema.
 */
export async function importHcMeal(
  client: SupabaseClient,
  input: FoodEntryInput & { extId: string; dataOrigin?: string },
  date: string = todayISO(),
): Promise<Result<'imported' | 'duplicate'>> {
  if (!input.extId) return err('Missing Health Connect record id.');
  const log = await findOrCreateDailyLog(client, date);
  if (!log.ok) return log;

  // Full source tag encodes the originating package name so per-source rules
  // can differentiate Samsung Health vs Google Fit vs a third-party tracker.
  const pkg = (input.dataOrigin ?? '').trim();
  const sourceTag = pkg ? `health_connect:${pkg}` : 'health_connect';

  // Key-based dedupe on the HC record id — re-syncs never double-count.
  const existing = await client
    .from('basalt_food_entries')
    .select('id')
    .eq('user_id', log.data.userId)
    .eq('ext_source', 'health_connect')
    .eq('ext_id', input.extId)
    .limit(1)
    .maybeSingle();
  if (existing.error && existing.error.code !== 'PGRST116') return err(existing.error.message);
  if (existing.data?.id) return ok('duplicate');

  const insert = await client
    .from('basalt_food_entries')
    .insert({
      ...insertPayloadFrom(input, log.data.id, log.data.userId),
      source: sourceTag,
      ext_source: 'health_connect',
      ext_id: input.extId,
    });
  if (insert.error) return err(insert.error.message);
  refreshDailyLogTotals(client, log.data.id).catch(() => {});
  return ok('imported');
}

/**
 * Fetch every food entry the authed user has for a given date. Newest first.
 * `date` defaults to today (device-local). Returns [] when no log exists.
 *
 * Two-step lookup: find the day's daily_log id, then fetch entries by log_id.
 * Portable across Supabase versions; avoids any ambiguity in embedded filters.
 */
export async function getFoodEntriesForDay(
  client: SupabaseClient,
  date: string = todayISO(),
): Promise<Result<FoodEntryRow[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const userId = u.data;

  const logRow = await client
    .from('basalt_daily_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (logRow.error && logRow.error.code !== 'PGRST116') {
    return err(logRow.error.message);
  }
  if (!logRow.data) {
    return ok([]); // No log for that day → no entries.
  }

  const { data, error } = await client
    .from('basalt_food_entries')
    .select('*')
    .eq('log_id', logRow.data.id)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return err(error.message);
  return ok((data ?? []).map(mapRow));
}

/**
 * Sum a day's entries into a totals block. Convenience helper for callers
 * that only need aggregates (energy hero / macro bars / cap rows).
 */
export async function getDailyTotals(
  client: SupabaseClient,
  date: string = todayISO(),
): Promise<Result<DailyTotals>> {
  const r = await getFoodEntriesForDay(client, date);
  if (!r.ok) return r;
  const totals = r.data.reduce<DailyTotals>(
    (t, e) => ({
      calories: t.calories + e.calories,
      protein: t.protein + e.protein,
      carbs: t.carbs + e.carbs,
      fat: t.fat + e.fat,
      fiber: t.fiber + e.fiber,
      sugar: t.sugar + e.sugar,
      sodiumMg: t.sodiumMg + e.sodiumMg,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodiumMg: 0 },
  );
  return ok(totals);
}

/** Delete one entry by id; refresh the parent log's cached calorie total. */
export async function deleteFoodEntry(client: SupabaseClient, id: string): Promise<Result<void>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  // Fetch log_id so we can update the parent's cached total afterwards.
  const found = await client
    .from('basalt_food_entries')
    .select('log_id')
    .eq('id', id)
    .single();

  const { error } = await client.from('basalt_food_entries').delete().eq('id', id);
  if (error) return err(error.message);

  if (found.data?.log_id) {
    refreshDailyLogTotals(client, found.data.log_id).catch(() => {});
  }
  return ok(undefined);
}
