import type { MealType } from './food';

// Per-meal budgets — a published split of the day's remaining energy over
// the meals still to come. Suggestions, never mandates: eaten meals show
// what happened, upcoming meals show what's available, a skipped window's
// share flows forward and the note says so. Nothing here scolds.

/** Published split of a day's energy across meals. */
export const MEAL_SPLIT: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  dinner: 0.3,
  snacks: 0.15,
};

/** A meal window "passes" at this hour if nothing was logged in it. */
export const MEAL_WINDOW_END: Record<MealType, number> = {
  breakfast: 10,
  lunch: 15,
  dinner: 21,
  snacks: 24,
};

export type MealBudgetRow = {
  meal: MealType;
  state: 'eaten' | 'upcoming' | 'passed';
  eatenKcal: number;
  /** Suggested for upcoming meals; null otherwise (real-or-hidden). */
  suggestedKcal: number | null;
};

export type MealBudgets = { rows: MealBudgetRow[]; note: string };

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export function mealBudgets(
  dayTargetKcal: number,
  eatenByMeal: Partial<Record<MealType, number>>,
  hour: number,
): MealBudgets {
  const eatenTotal = MEALS.reduce((s, m) => s + (eatenByMeal[m] ?? 0), 0);
  const remaining = Math.max(0, dayTargetKcal - eatenTotal);

  const state = (m: MealType): MealBudgetRow['state'] => {
    if ((eatenByMeal[m] ?? 0) > 0) return 'eaten';
    return hour >= MEAL_WINDOW_END[m] ? 'passed' : 'upcoming';
  };
  const upcoming = MEALS.filter((m) => state(m) === 'upcoming');
  const upcomingSplit = upcoming.reduce((s, m) => s + MEAL_SPLIT[m], 0);

  const rows: MealBudgetRow[] = MEALS.map((m) => ({
    meal: m,
    state: state(m),
    eatenKcal: Math.round(eatenByMeal[m] ?? 0),
    suggestedKcal:
      state(m) === 'upcoming' && upcomingSplit > 0
        ? Math.round((remaining * MEAL_SPLIT[m]) / upcomingSplit)
        : null,
  }));

  const passed = rows.filter((r) => r.state === 'passed').length;
  const note =
    upcoming.length === 0
      ? 'every meal window is done for today'
      : passed > 0
        ? `a skipped window's share flows into what's left — ${Math.round(remaining)} kcal across ${upcoming.length} ${upcoming.length === 1 ? 'meal' : 'meals'}`
        : `${Math.round(remaining)} kcal left across ${upcoming.length} ${upcoming.length === 1 ? 'meal' : 'meals'} · published split, suggestion only`;
  return { rows, note };
}

/**
 * Training-day adjustment — the eat-back suggestion, stated as one.
 * The stored targets are never touched; this is display arithmetic.
 */
export function trainingDayTarget(
  baseKcal: number,
  activeKcal: number,
): { kcal: number; note: string | null } {
  if (activeKcal <= 0) return { kcal: baseKcal, note: null };
  const bump = Math.round(activeKcal);
  return {
    kcal: baseKcal + bump,
    note: `training day — +${bump} kcal available if you eat back today's activity · a suggestion, never a mandate`,
  };
}
