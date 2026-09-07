// Daily narrative — the one Extra whose whole point is narration, and it
// says so: the label below is rendered with every summary, unconditionally
// (the component takes no flag to hide it). Laws pinned here and by test:
// morning-after only, never a notification, never on Trends.

export const NARRATIVE_LABEL = 'Generated summary';
export const NARRATIVE_SUBLABEL =
  'Written by AI from yesterday’s numbers · shown here only, never sent as a notification';

export type NarrativeDayNumbers = {
  date: string;
  calories: number | null;
  targetCalories: number | null;
  proteinG: number | null;
  entryCount: number;
  sessionCount: number;
  walkKm: number | null;
  sleepHours: number | null;
};

/** The summary is for YESTERDAY, shown this morning. */
export function narrativeDateFor(now: Date): string {
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
}

/**
 * A day with nothing in it gets no narration at all — an empty ledger is
 * an honest empty state, not a paragraph about absence.
 */
export function narrativeWorthwhile(day: NarrativeDayNumbers): boolean {
  return day.entryCount > 0 || day.sessionCount > 0
    || (day.walkKm ?? 0) > 0 || day.sleepHours !== null;
}

export const NARRATIVE_CACHE_PREFIX = 'basalt.narrative.';
