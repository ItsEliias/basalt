import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';
import type { MealType } from './food';

// The weekly meal planner — plan-ahead rows that can be logged into the
// diary with one tap ("planned vs actually eaten" reconciliation is V1.x).

export type MealPlan = {
  id: string;
  date: string;
  mealSlot: MealType;
  recipeId: string | null;
  serves: number;
  note: string | null;
};

function mapRow(r: any): MealPlan {
  return {
    id: r.id,
    date: r.date,
    mealSlot: r.meal_slot,
    recipeId: r.recipe_id ?? null,
    serves: Number(r.serves ?? 1),
    note: r.note ?? null,
  };
}

export async function addMealPlan(
  client: SupabaseClient,
  input: { date: string; mealSlot: MealType; recipeId: string; serves?: number; note?: string },
): Promise<Result<MealPlan>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_meal_plans')
    .insert({
      user_id: u.data,
      date: input.date,
      meal_slot: input.mealSlot,
      recipe_id: input.recipeId,
      serves: input.serves ?? 1,
      note: input.note ?? null,
    })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not plan the meal.');
  return ok(mapRow(data));
}

export async function listMealPlans(
  client: SupabaseClient,
  fromDate: string,
  toDate: string,
): Promise<Result<MealPlan[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_meal_plans')
    .select('*')
    .eq('user_id', u.data)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true });
  if (error) return err(error.message);
  return ok((data ?? []).map(mapRow));
}

export async function deleteMealPlan(client: SupabaseClient, id: string): Promise<Result<void>> {
  const { error } = await client.from('basalt_meal_plans').delete().eq('id', id);
  if (error) return err(error.message);
  return ok(undefined);
}
