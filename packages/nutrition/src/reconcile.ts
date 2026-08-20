import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';
import type { MealType } from './food';
import { listMealPlans, type MealPlan } from './planner';

// Planned vs eaten — reconciliation is a statement of fact, not a verdict.
// A swap is recorded as a swap, an unlogged day as unlogged; today stays
// pending until it's over. No outcome ever scolds.

export type PlanOutcome = 'as_planned' | 'moved' | 'different' | 'not_logged' | 'pending';

export type DayEntry = { mealType: MealType; foodName: string; source: string };

export function reconcilePlan(
  plan: { date: string; mealSlot: MealType; recipeTitle: string | null },
  dayEntries: DayEntry[],
  todayIso: string,
): PlanOutcome {
  if (plan.date > todayIso) return 'pending';

  const isPlanned = (e: DayEntry) =>
    e.source === 'recipe' && plan.recipeTitle !== null && e.foodName === plan.recipeTitle;

  const slotEntries = dayEntries.filter((e) => e.mealType === plan.mealSlot);
  if (slotEntries.some(isPlanned)) return 'as_planned';
  if (dayEntries.some(isPlanned)) return 'moved';
  if (slotEntries.length > 0) return 'different';
  return plan.date === todayIso ? 'pending' : 'not_logged';
}

/** The factual row text for each outcome — no praise, no blame. */
export const OUTCOME_TEXT: Record<PlanOutcome, string> = {
  as_planned: 'as planned',
  moved: 'eaten · different slot',
  different: 'something else logged',
  not_logged: 'not logged',
  pending: 'pending',
};

export type ReconciledPlan = MealPlan & { recipeTitle: string | null; outcome: PlanOutcome };

/**
 * Plans in [fromDate, toDate] with their outcomes, read from the diary.
 * `todayIso` is injected so the today/pending boundary is testable.
 */
export async function loadPlanOutcomes(
  client: SupabaseClient,
  fromDate: string,
  toDate: string,
  todayIso: string,
): Promise<Result<ReconciledPlan[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const plans = await listMealPlans(client, fromDate, toDate);
  if (!plans.ok) return plans;
  if (plans.data.length === 0) return ok([]);

  const recipeIds = Array.from(new Set(plans.data.map((p) => p.recipeId).filter(Boolean))) as string[];
  const titles = new Map<string, string>();
  if (recipeIds.length > 0) {
    const r = await client.from('basalt_recipes').select('id, title').in('id', recipeIds);
    if (r.error) return err(r.error.message);
    for (const row of r.data ?? []) titles.set((row as any).id, (row as any).title);
  }

  const logs = await client
    .from('basalt_daily_logs')
    .select('id, date')
    .eq('user_id', u.data)
    .gte('date', fromDate)
    .lte('date', toDate);
  if (logs.error) return err(logs.error.message);
  const dateForLog = new Map<string, string>((logs.data ?? []).map((l: any) => [l.id, l.date]));

  const entriesByDate = new Map<string, DayEntry[]>();
  if (dateForLog.size > 0) {
    const entries = await client
      .from('basalt_food_entries')
      .select('log_id, meal_type, food_name, source')
      .in('log_id', Array.from(dateForLog.keys()));
    if (entries.error) return err(entries.error.message);
    for (const e of entries.data ?? []) {
      const date = dateForLog.get((e as any).log_id);
      if (!date) continue;
      const list = entriesByDate.get(date) ?? [];
      list.push({
        mealType: (e as any).meal_type,
        foodName: (e as any).food_name,
        source: (e as any).source,
      });
      entriesByDate.set(date, list);
    }
  }

  return ok(
    plans.data.map((p) => {
      const recipeTitle = p.recipeId ? (titles.get(p.recipeId) ?? null) : null;
      return {
        ...p,
        recipeTitle,
        outcome: reconcilePlan(
          { date: p.date, mealSlot: p.mealSlot, recipeTitle },
          entriesByDate.get(p.date) ?? [],
          todayIso,
        ),
      };
    }),
  );
}
