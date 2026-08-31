// Fill the gap — suggest foods that close today's remaining macros.
// Published rules, all in this module, all deterministic:
//   · The gap is target − eaten, floored at zero per macro. A day with
//     under GAP_MIN_KCAL remaining renders nothing — real-or-hidden.
//   · Own foods rank first — things this user has actually logged.
//     Open Food Facts fills remaining slots only when fewer than
//     MAX_SUGGESTIONS own foods qualify, and every OFF row is
//     source-tagged so the provenance is visible.
//   · A food whose calories exceed the remaining energy is excluded
//     outright — something that doesn't fit the day is not a suggestion.
//     Among foods that fit, rank by macro-kcal of the gap closed;
//     closing nothing excludes.
//   · The reason line states the gap it closes ("28 g of your 40 g
//     protein gap") — a fact about arithmetic, never advice.

export const GAP_MIN_KCAL = 150;
export const MAX_SUGGESTIONS = 3;

export type MacroGap = { calories: number; protein: number; carbs: number; fat: number };

export type FillCandidate = {
  foodName: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'own' | 'off';
};

export type FillSuggestion = FillCandidate & {
  score: number;
  why: string;
};

/** Remaining macros for the day, floored at zero — over is over, not negative fuel. */
export function macroGap(
  targets: { calories: number; protein: number; carbs: number; fat: number },
  totals: { calories: number; protein: number; carbs: number; fat: number },
): MacroGap {
  const left = (t: number, c: number) => Math.max(0, Math.round(t - c));
  return {
    calories: left(targets.calories, totals.calories),
    protein: left(targets.protein, totals.protein),
    carbs: left(targets.carbs, totals.carbs),
    fat: left(targets.fat, totals.fat),
  };
}

const MACRO_KCAL = { protein: 4, carbs: 4, fat: 9 } as const;
type MacroKey = keyof typeof MACRO_KCAL;

/** The open macro with the most remaining energy — drives the OFF fallback query. */
export function scarcestMacro(gap: MacroGap): MacroKey | null {
  const open = (Object.keys(MACRO_KCAL) as MacroKey[])
    .filter((m) => gap[m] > 0)
    .sort((a, b) => gap[b] * MACRO_KCAL[b] - gap[a] * MACRO_KCAL[a]);
  return open[0] ?? null;
}

/** Published staple queries for the OFF fallback — generic terms, no brands. */
export const OFF_FALLBACK_QUERY: Record<MacroKey, string> = {
  protein: 'greek yogurt plain',
  carbs: 'rolled oats',
  fat: 'peanut butter natural',
};

function scoreOne(gap: MacroGap, c: FillCandidate): { score: number; why: string } {
  const closes: Record<MacroKey, number> = {
    protein: Math.min(c.protein, gap.protein),
    carbs: Math.min(c.carbs, gap.carbs),
    fat: Math.min(c.fat, gap.fat),
  };
  const covered = (Object.keys(closes) as MacroKey[]).reduce(
    (s, m) => s + closes[m] * MACRO_KCAL[m],
    0,
  );
  const score = c.calories > gap.calories ? -1 : covered;

  const dominant = (Object.keys(closes) as MacroKey[])
    .filter((m) => gap[m] > 0)
    .sort((a, b) => closes[b] * MACRO_KCAL[b] - closes[a] * MACRO_KCAL[a])[0];
  const why = dominant
    ? `${Math.round(closes[dominant])} g of your ${gap[dominant]} g ${dominant} gap`
    : `${Math.round(c.calories)} kcal of your ${gap.calories} remaining`;
  return { score, why };
}

/**
 * Rank candidates against the gap. Own foods first, always; OFF rows only
 * take slots own foods left empty. Nothing qualifies → empty array — the
 * card hides rather than invents.
 */
export function suggestFill(
  gap: MacroGap,
  own: FillCandidate[],
  off: FillCandidate[] = [],
  max: number = MAX_SUGGESTIONS,
): FillSuggestion[] {
  if (gap.calories < GAP_MIN_KCAL) return [];

  const rank = (list: FillCandidate[]) =>
    list
      .map((c) => ({ ...c, ...scoreOne(gap, c) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

  const picked: FillSuggestion[] = [];
  const seen = new Set<string>();
  for (const s of [...rank(own), ...rank(off)]) {
    const key = s.foodName.trim().toLowerCase();
    if (seen.has(key) || picked.length >= max) continue;
    seen.add(key);
    picked.push(s);
  }
  return picked;
}

/** "620 kcal · P 40 · C 55 · F 12 left" — the gap, stated plainly. */
export function gapLine(gap: MacroGap): string {
  return `${gap.calories.toLocaleString('en-US')} kcal · P ${gap.protein} · C ${gap.carbs} · F ${gap.fat} left`;
}
