import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';
import type { FoodEntryInput } from './food';

// Favorites / recents — basalt_food_favorites holds a nutrition snapshot per
// (food, brand) with use_count + last_used_at, powering 1-tap re-logs and
// the "Frequent at this hour" list.

export type FoodFavorite = {
  id: string;
  userId: string;
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
  useCount: number;
  lastUsedAt: string;
};

function mapRow(r: any): FoodFavorite {
  return {
    id: r.id,
    userId: r.user_id,
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
    useCount: Number(r.use_count ?? 1),
    lastUsedAt: r.last_used_at,
  };
}

/**
 * Record a use of this food — creates the favorite on first use, bumps
 * use_count + last_used_at on every one after. Call it whenever an entry
 * is logged so recents build themselves.
 */
export async function recordFoodUse(
  client: SupabaseClient,
  input: Omit<FoodEntryInput, 'mealType'>,
): Promise<Result<FoodFavorite>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  let lookup = client
    .from('basalt_food_favorites')
    .select('*')
    .eq('user_id', u.data)
    .eq('food_name', input.foodName);
  lookup = input.brand ? lookup.eq('brand', input.brand) : lookup.is('brand', null);
  const existing = await lookup.maybeSingle();
  if (existing.error && existing.error.code !== 'PGRST116') return err(existing.error.message);

  if (existing.data) {
    const { data, error } = await client
      .from('basalt_food_favorites')
      .update({ use_count: Number(existing.data.use_count ?? 1) + 1, last_used_at: new Date().toISOString() })
      .eq('id', existing.data.id)
      .select('*')
      .single();
    if (error || !data) return err(error?.message ?? 'Could not update favorite.');
    return ok(mapRow(data));
  }

  const { data, error } = await client
    .from('basalt_food_favorites')
    .insert({
      user_id: u.data,
      food_name: input.foodName,
      brand: input.brand ?? null,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      fiber: input.fiber,
      sugar: input.sugar ?? 0,
      sodium_mg: input.sodiumMg ?? 0,
      saturated_fat: input.saturatedFat ?? 0,
      serving_size: input.servingSize ?? 100,
      serving_unit: input.servingUnit ?? 'g',
      quantity: input.quantity ?? 1,
      barcode: input.barcode ?? null,
    })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not save favorite.');
  return ok(mapRow(data));
}

/** Most-used favorites, ties broken by recency. */
export async function listFavorites(client: SupabaseClient, limit = 30): Promise<Result<FoodFavorite[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_food_favorites')
    .select('*')
    .eq('user_id', u.data)
    .order('use_count', { ascending: false })
    .order('last_used_at', { ascending: false })
    .limit(limit);
  if (error) return err(error.message);
  return ok((data ?? []).map(mapRow));
}

// ─── "Frequent at this hour" — pure ranking over recent entries ─────────────

export type LoggedFood = { foodName: string; createdAt: string; calories: number };

export type FrequentFood = {
  foodName: string;
  count: number;
  calories: number;
  /** "usually 12:30–13:15" style range of past log times, device-local. */
  typicalRange: { fromMin: number; toMin: number } | null;
};

/**
 * Rank foods by how often they were logged within ±90 minutes of `hour` in
 * the entry history the caller provides (typically the last 60 days).
 * Pure — timezone handling stays with the caller's Date parsing.
 */
export function frequentAtHour(entries: LoggedFood[], hour: number, windowMinutes = 90): FrequentFood[] {
  const center = hour * 60;
  const near = entries.filter((e) => {
    const d = new Date(e.createdAt);
    const mins = d.getHours() * 60 + d.getMinutes();
    const dist = Math.min(Math.abs(mins - center), 1440 - Math.abs(mins - center));
    return dist <= windowMinutes;
  });

  const groups = new Map<string, { count: number; calories: number; times: number[] }>();
  for (const e of near) {
    const g = groups.get(e.foodName) ?? { count: 0, calories: e.calories, times: [] };
    const d = new Date(e.createdAt);
    g.count += 1;
    g.calories = e.calories;
    g.times.push(d.getHours() * 60 + d.getMinutes());
    groups.set(e.foodName, g);
  }

  return Array.from(groups.entries())
    .map(([foodName, g]) => ({
      foodName,
      count: g.count,
      calories: g.calories,
      typicalRange: g.times.length >= 2 ? { fromMin: Math.min(...g.times), toMin: Math.max(...g.times) } : null,
    }))
    .sort((a, b) => b.count - a.count);
}
