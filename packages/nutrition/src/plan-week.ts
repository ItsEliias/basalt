import type { Recipe } from './recipes';
import type { MealType } from './food';
import type { TargetsRecord } from '@basalt/core-data';

// Meal-plan completeness (V4 Phase 8e) — the pure rules. The planner
// respects the PT intake (dislikes, cooking time, meals a day), offers
// swaps at similar macros, estimates an eaten-out meal as a RANGE, fills
// a week from batch-cooked recipes, and reports the plan's position
// against the fibre target and sugar/sodium caps — honestly absent where
// recipes don't carry the data.

export const QUICK_RECIPE_MAX_MIN = 20;

export type RecipeFlag = { kind: 'dislike' | 'diet-conflict' | 'slow-for-you'; text: string };

/** Annotate, never hide: the picker shows flags; the user decides. */
export function recipeFlags(
  recipe: Recipe,
  prefs: { dislikes?: string[]; cookingTime?: 'quick' | 'normal' | 'happy_to_cook' },
  conflictNotes: string[] = [],
): RecipeFlag[] {
  const flags: RecipeFlag[] = [];
  for (const d of prefs.dislikes ?? []) {
    if (d && recipe.title.toLowerCase().includes(d.toLowerCase())) {
      flags.push({ kind: 'dislike', text: `contains "${d}" — on your dislike list` });
    }
  }
  for (const c of conflictNotes) flags.push({ kind: 'diet-conflict', text: c });
  if (prefs.cookingTime === 'quick' && recipe.totalTimeMin !== null && recipe.totalTimeMin > QUICK_RECIPE_MAX_MIN) {
    flags.push({ kind: 'slow-for-you', text: `${recipe.totalTimeMin} min — longer than your quick preference` });
  }
  return flags;
}

/** Three alternatives at similar macros: closest kcal/serve, protein tie-break. */
export function swapAlternatives(recipes: Recipe[], current: Recipe, n = 3): Recipe[] {
  return recipes
    .filter((r) => r.id !== current.id)
    .sort((a, b) => {
      const ak = Math.abs(a.caloriesPerServe - current.caloriesPerServe);
      const bk = Math.abs(b.caloriesPerServe - current.caloriesPerServe);
      if (ak !== bk) return ak - bk;
      return Math.abs(a.proteinPerServe - current.proteinPerServe) - Math.abs(b.proteinPerServe - current.proteinPerServe);
    })
    .slice(0, n);
}

/** Published ate-out estimate: recipe kcal ±25%, or slot defaults ±35%. */
export const ATE_OUT_SLOT_DEFAULTS: Record<MealType, number> = {
  breakfast: 400, lunch: 600, dinner: 700, snacks: 250,
};

export function ateOutEstimate(recipe: Recipe | null, slot: MealType): {
  name: string; kcal: number; low: number; high: number; note: string;
} {
  const base = recipe ? recipe.caloriesPerServe : ATE_OUT_SLOT_DEFAULTS[slot];
  const spread = recipe ? 0.25 : 0.35;
  return {
    name: `Ate out — ${slot}`,
    kcal: Math.round(base),
    low: Math.round(base * (1 - spread)),
    high: Math.round(base * (1 + spread)),
    note: recipe
      ? `estimated from the planned ${recipe.title} ±25% — eating out is a range, not a number`
      : `slot default ±35% — no plan to anchor on; correct it if you know better`,
  };
}

/** Fill a week's lunches and dinners by cycling 2–3 batch-cooked recipes. */
export function batchCookWeek(
  recipeIds: string[],
  startIso: string,
  days = 7,
): { date: string; mealSlot: MealType; recipeId: string }[] {
  if (recipeIds.length < 2 || recipeIds.length > 3) return [];
  const out: { date: string; mealSlot: MealType; recipeId: string }[] = [];
  const start = new Date(`${startIso}T00:00:00`);
  let i = 0;
  for (let d = 0; d < days; d++) {
    const date = new Date(start);
    date.setDate(date.getDate() + d);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    for (const mealSlot of ['lunch', 'dinner'] as MealType[]) {
      out.push({ date: iso, mealSlot, recipeId: recipeIds[i % recipeIds.length]! });
      i++;
    }
  }
  return out;
}

/** The plan's position vs fibre target + sugar/sodium caps — absences stated. */
export function planCapsAdherence(
  plans: { recipeId: string | null; serves: number; date: string }[],
  recipesById: ReadonlyMap<string, Recipe>,
  targets: Pick<TargetsRecord, 'fiberG' | 'sugarCapG' | 'sodiumCapMg'> | null,
): string[] {
  if (!targets || plans.length === 0) return [];
  const dayFibre = new Map<string, number>();
  let unknownRecipes = 0;
  for (const p of plans) {
    const r = p.recipeId ? recipesById.get(p.recipeId) : undefined;
    if (!r) { unknownRecipes++; continue; }
    dayFibre.set(p.date, (dayFibre.get(p.date) ?? 0) + r.fiberPerServe * p.serves);
  }
  const lines: string[] = [];
  if (dayFibre.size > 0) {
    const avg = [...dayFibre.values()].reduce((a, b) => a + b, 0) / dayFibre.size;
    lines.push(`Planned fibre averages ${Math.round(avg)} g/day of your ${targets.fiberG} g target — from recipe ingredients, planned meals only.`);
  }
  lines.push('Sugar and sodium: recipes don’t carry them yet, so the plan can’t claim adherence — the day’s caps still track from what you actually log.');
  if (unknownRecipes > 0) lines.push(`${unknownRecipes} planned ${unknownRecipes === 1 ? 'meal has' : 'meals have'} no recipe attached — not counted, not guessed.`);
  return lines;
}
