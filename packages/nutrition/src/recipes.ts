import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';
import type { UrlRecipeImport } from './recipe-import';
import { addFoodEntry, type FoodEntryRow, type MealType } from './food';
import { aisleFor } from './grocery';
import { downloadAndUploadRecipeCover, removeRecipePhoto } from './recipe-photos';

// Recipes — persisted in Postgres at last (the source app kept them in
// AsyncStorage). Imports follow the AI rule: capture → editable suggestion →
// confirm; imported macros wear ~ until macros_confirmed flips.

export type Recipe = {
  id: string;
  title: string;
  description: string | null;
  serves: number;
  totalTimeMin: number | null;
  sourceUrl: string | null;
  source: string;
  caloriesPerServe: number;
  proteinPerServe: number;
  carbsPerServe: number;
  fatPerServe: number;
  fiberPerServe: number;
  macrosConfirmed: boolean;
  /** Storage path in the private basalt-recipe-photos bucket — never a public URL. */
  coverPath: string | null;
  createdAt: string;
};

export type RecipeIngredient = {
  id: string;
  position: number;
  qty: number | null;
  unit: string | null;
  name: string;
  aisle: string | null;
};

export type RecipeDetail = Recipe & { ingredients: RecipeIngredient[]; steps: string[] };

export type SaveRecipeInput = {
  title: string;
  description?: string;
  serves: number;
  totalTimeMin?: number | null;
  sourceUrl?: string | null;
  source?: string;
  caloriesPerServe: number;
  proteinPerServe: number;
  carbsPerServe: number;
  fatPerServe: number;
  fiberPerServe?: number;
  macrosConfirmed: boolean;
  /** Remote cover image URL to download into the private bucket at save time — never hotlinked. */
  sourceImageUrl?: string | null;
  ingredients: { qty: number | null; unit: string | null; name: string }[];
  steps: string[];
};

function mapRecipe(r: any): Recipe {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    serves: Number(r.serves ?? 1),
    totalTimeMin: r.total_time_min ?? null,
    sourceUrl: r.source_url ?? null,
    source: r.source ?? 'manual',
    caloriesPerServe: Number(r.calories_per_serve ?? 0),
    proteinPerServe: Number(r.protein_per_serve ?? 0),
    carbsPerServe: Number(r.carbs_per_serve ?? 0),
    fatPerServe: Number(r.fat_per_serve ?? 0),
    fiberPerServe: Number(r.fiber_per_serve ?? 0),
    macrosConfirmed: r.macros_confirmed ?? true,
    coverPath: r.cover_path ?? null,
    createdAt: r.created_at,
  };
}

// ─── Quantity parsing & scaling (pure) ──────────────────────────────────────

const VULGAR: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

/** "1 ½" / "½" / "1.5" / "1/2" → number, or null for prose amounts. */
export function parseQtyText(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  let total = 0;
  let matched = false;
  for (const part of t.split(/\s+/)) {
    if (VULGAR[part] !== undefined) {
      total += VULGAR[part]!;
      matched = true;
    } else if (/^\d+\/\d+$/.test(part)) {
      const [a, b] = part.split('/').map(Number);
      if (b) {
        total += a! / b;
        matched = true;
      }
    } else if (/^[\d.]+$/.test(part)) {
      total += parseFloat(part);
      matched = true;
    } else {
      return matched ? total : null;
    }
  }
  return matched && isFinite(total) ? Math.round(total * 1000) / 1000 : null;
}

/** Scale an ingredient quantity from the recipe's base serves to a target. */
export function scaleQty(qty: number | null, baseServes: number, targetServes: number): number | null {
  if (qty === null || baseServes <= 0) return null;
  return Math.round(((qty * targetServes) / baseServes) * 100) / 100;
}

/** "1.2 kg" / "700 ml" / "×2" / "4" display form. */
export function fmtQty(qty: number | null, unit: string | null): string {
  if (qty === null) return '';
  if (!unit) return `×${trimNum(qty)}`;
  const u = unit.toLowerCase();
  if (u === 'g' && qty >= 1000) return `${trimNum(qty / 1000)} kg`;
  if (u === 'ml' && qty >= 1000) return `${trimNum(qty / 1000)} l`;
  return `${trimNum(qty)} ${unit}`;
}

function trimNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

/**
 * Import → editable draft. JSON-LD nutrition is treated as per serving (the
 * schema.org convention); macrosConfirmed stays false so every value wears ~
 * until the user confirms.
 */
export function draftFromImport(imp: UrlRecipeImport): SaveRecipeInput {
  return {
    title: imp.title,
    description: imp.description || undefined,
    serves: Math.max(1, imp.servings),
    totalTimeMin: imp.prepMinutes + imp.cookMinutes || null,
    sourceUrl: imp.source,
    source: 'jsonld',
    caloriesPerServe: imp.estimatedMacros.calories,
    proteinPerServe: imp.estimatedMacros.protein,
    carbsPerServe: imp.estimatedMacros.carbs,
    fatPerServe: imp.estimatedMacros.fat,
    macrosConfirmed: false,
    sourceImageUrl: imp.imageUrl,
    ingredients: imp.ingredients.map((i) => ({
      qty: parseQtyText(i.quantity),
      unit: i.unit || null,
      name: i.name,
    })),
    steps: imp.steps,
  };
}

// ─── Dietary conflict scan over ingredient text ─────────────────────────────

const TEXT_PATTERNS: [RegExp, string[]][] = [
  [/\b(flour|wheat|barley|rye|pasta|bread|couscous|semolina|soy sauce)\b/i, ['Coeliac (strict GF)', 'Gluten sensitivity']],
  [/\b(milk|cream|butter|cheese|yoghurt|yogurt|ghee)\b/i, ['Dairy free', 'Lactose intolerant']],
  [/\b(almond|hazelnut|cashew|walnut|pecan|pistachio|macadamia)s?\b/i, ['Nut allergy']],
  [/\bpeanuts?\b/i, ['Peanut allergy', 'Nut allergy']],
  [/\b(prawn|shrimp|crab|lobster|mussel|oyster|squid|scallop)s?\b/i, ['Shellfish']],
  [/\b(salmon|tuna|cod|anchov\w*|sardine|fish sauce|fish)\b/i, ['Fish']],
  [/\beggs?\b/i, ['Egg']],
  [/\b(soy|soya|tofu|edamame|soy sauce)\b/i, ['Soy']],
  [/\bsesame|tahini\b/i, ['Sesame']],
];

export type IngredientConflict = { ingredient: string; flag: string };

/** Keyword scan of ingredient names against the user's dietary flags. */
export function ingredientConflicts(names: string[], userFlags: string[]): IngredientConflict[] {
  const out: IngredientConflict[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    for (const [pattern, flags] of TEXT_PATTERNS) {
      if (!pattern.test(name)) continue;
      for (const flag of flags) {
        const key = `${name}:${flag}`;
        if (userFlags.includes(flag) && !seen.has(key)) {
          seen.add(key);
          out.push({ ingredient: name, flag });
        }
      }
    }
  }
  return out;
}

// ─── Persistence ────────────────────────────────────────────────────────────

export async function saveRecipe(client: SupabaseClient, input: SaveRecipeInput): Promise<Result<Recipe>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  // Best-effort: a source image that fails to download never blocks saving
  // the recipe itself — it just saves without a cover.
  let coverPath: string | null = null;
  if (input.sourceImageUrl) {
    const dl = await downloadAndUploadRecipeCover(
      client,
      input.sourceImageUrl,
      Date.now(),
      Math.random().toString(36).slice(2),
    );
    if (dl.ok) coverPath = dl.data;
  }

  const { data, error } = await client
    .from('basalt_recipes')
    .insert({
      user_id: u.data,
      title: input.title,
      description: input.description ?? null,
      serves: input.serves,
      total_time_min: input.totalTimeMin ?? null,
      source_url: input.sourceUrl ?? null,
      source: input.source ?? 'manual',
      calories_per_serve: input.caloriesPerServe,
      protein_per_serve: input.proteinPerServe,
      carbs_per_serve: input.carbsPerServe,
      fat_per_serve: input.fatPerServe,
      fiber_per_serve: input.fiberPerServe ?? 0,
      macros_confirmed: input.macrosConfirmed,
      cover_path: coverPath,
    })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not save recipe.');

  if (input.ingredients.length > 0) {
    const { error: ie } = await client.from('basalt_recipe_ingredients').insert(
      input.ingredients.map((ing, i) => ({
        recipe_id: data.id,
        user_id: u.data,
        position: i,
        qty: ing.qty,
        unit: ing.unit,
        name: ing.name,
        aisle: aisleFor(ing.name),
      })),
    );
    if (ie) return err(ie.message);
  }
  if (input.steps.length > 0) {
    const { error: se } = await client.from('basalt_recipe_steps').insert(
      input.steps.map((text, i) => ({ recipe_id: data.id, user_id: u.data, position: i, text })),
    );
    if (se) return err(se.message);
  }
  return ok(mapRecipe(data));
}

export async function confirmRecipeMacros(client: SupabaseClient, recipeId: string): Promise<Result<void>> {
  const { error } = await client
    .from('basalt_recipes')
    .update({ macros_confirmed: true })
    .eq('id', recipeId);
  if (error) return err(error.message);
  return ok(undefined);
}

export async function listRecipes(client: SupabaseClient): Promise<Result<Recipe[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_recipes')
    .select('*')
    .eq('user_id', u.data)
    .order('created_at', { ascending: false });
  if (error) return err(error.message);
  return ok((data ?? []).map(mapRecipe));
}

export async function getRecipeDetail(client: SupabaseClient, id: string): Promise<Result<RecipeDetail>> {
  const r = await client.from('basalt_recipes').select('*').eq('id', id).single();
  if (r.error || !r.data) return err(r.error?.message ?? 'Recipe not found.');
  const ing = await client
    .from('basalt_recipe_ingredients')
    .select('*')
    .eq('recipe_id', id)
    .order('position', { ascending: true });
  if (ing.error) return err(ing.error.message);
  const steps = await client
    .from('basalt_recipe_steps')
    .select('text, position')
    .eq('recipe_id', id)
    .order('position', { ascending: true });
  if (steps.error) return err(steps.error.message);
  return ok({
    ...mapRecipe(r.data),
    ingredients: (ing.data ?? []).map((x: any) => ({
      id: x.id, position: x.position, qty: x.qty === null ? null : Number(x.qty),
      unit: x.unit ?? null, name: x.name, aisle: x.aisle ?? null,
    })),
    steps: (steps.data ?? []).map((s: any) => s.text),
  });
}

export async function deleteRecipe(client: SupabaseClient, id: string): Promise<Result<void>> {
  const found = await client.from('basalt_recipes').select('cover_path').eq('id', id).single();
  const { error } = await client.from('basalt_recipes').delete().eq('id', id);
  if (error) return err(error.message);
  if (found.data?.cover_path) {
    removeRecipePhoto(client, found.data.cover_path).catch(() => {});
  }
  return ok(undefined);
}

/** Log N serves of a recipe as a food entry (the ONE food write path). */
export async function logRecipeServing(
  client: SupabaseClient,
  recipe: Recipe,
  mealType: MealType,
  serves = 1,
): Promise<Result<FoodEntryRow>> {
  return addFoodEntry(client, {
    mealType,
    foodName: recipe.title,
    calories: Math.round(recipe.caloriesPerServe * serves),
    protein: Math.round(recipe.proteinPerServe * serves * 10) / 10,
    carbs: Math.round(recipe.carbsPerServe * serves * 10) / 10,
    fat: Math.round(recipe.fatPerServe * serves * 10) / 10,
    fiber: Math.round(recipe.fiberPerServe * serves * 10) / 10,
    quantity: serves,
    servingSize: 1,
    servingUnit: 'serve',
    source: 'recipe',
  });
}
