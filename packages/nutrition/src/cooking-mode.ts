// Cooking mode — cook several recipes at once with one merged timeline.
// The engine reads durations that are actually WRITTEN in the steps
// ("simmer 20 min"); it never invents times. Steps with no stated time
// keep their order but are unscheduled — counted and said, not guessed.
// Ranges ("10–12 minutes") take the LOWER bound: you check early, food
// doesn't uncook. Recipes are offset so everything finishes together —
// the longest starts at zero, the rest join late.

export type CookRecipe = { title: string; steps: string[] };

export type TimelineEntry = {
  /** Minutes after the cook starts. */
  atMin: number;
  recipeIndex: number;
  recipeTitle: string;
  stepIndex: number;
  text: string;
  /** Parsed from the step text; null when the step states no time. */
  durationMin: number | null;
};

export type CookPlan = {
  entries: TimelineEntry[];
  totalMin: number;
  /** Steps that carry no stated time — sequenced, not scheduled. */
  unscheduledCount: number;
};

const HOUR_RE = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i;
const MIN_RE = /(\d+(?:\.\d+)?)(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*(?:minutes?|mins?|m)\b/i;
const SEC_RE = /(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i;

/** The stated duration of a step, in minutes; null when none is written. */
export function stepMinutes(text: string): number | null {
  const h = HOUR_RE.exec(text);
  const m = MIN_RE.exec(text);
  const s = SEC_RE.exec(text);
  if (!h && !m && !s) return null;
  let total = 0;
  if (h) total += Number(h[1]) * 60;
  if (m) total += Number(m[1]);
  if (s && !h && !m) total += Number(s[1]) / 60;
  return Math.round(total * 10) / 10;
}

/** Everything finishes together: the longest recipe starts at zero. */
export function mergeTimelines(recipes: CookRecipe[]): CookPlan {
  const parsed = recipes.map((r) =>
    r.steps.map((text) => ({ text, durationMin: stepMinutes(text) })),
  );
  const totals = parsed.map((steps) =>
    steps.reduce((sum, s) => sum + (s.durationMin ?? 0), 0),
  );
  const totalMin = Math.max(0, ...totals);

  const entries: TimelineEntry[] = [];
  let unscheduledCount = 0;
  parsed.forEach((steps, recipeIndex) => {
    let t = totalMin - totals[recipeIndex]!;
    steps.forEach((s, stepIndex) => {
      if (s.durationMin === null) unscheduledCount++;
      entries.push({
        atMin: Math.round(t * 10) / 10,
        recipeIndex,
        recipeTitle: recipes[recipeIndex]!.title,
        stepIndex,
        text: s.text,
        durationMin: s.durationMin,
      });
      t += s.durationMin ?? 0;
    });
  });

  entries.sort((a, b) => a.atMin - b.atMin || a.recipeIndex - b.recipeIndex || a.stepIndex - b.stepIndex);
  return { entries, totalMin, unscheduledCount };
}

/** "+0:00" / "+1:24" timeline markers. */
export function atText(atMin: number): string {
  const total = Math.round(atMin);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `+${h}:${String(m).padStart(2, '0')} h` : `+${m} min`;
}
