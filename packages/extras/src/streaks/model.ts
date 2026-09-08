// Streaks with freezes — the published rules, as code. Day runs for
// logging, training and sleep-logged; TWO freezes per calendar week
// (Mon–Sun), auto-applied to missed days, never stacked beyond the
// week's budget. Rest days never break a training streak — the host
// passes rest-aware training days from the core engine (the V3 fix
// stays authoritative). Regression is visible: frozen days are listed,
// never silently painted over.

export const FREEZES_PER_WEEK = 2;

export const STREAK_RULES = [
  `A streak day is a calendar day with the thing done: anything logged (logging), a session or a marked rest day (training), a sleep record (sleep).`,
  `${FREEZES_PER_WEEK} freezes per calendar week (Mon–Sun), applied automatically to missed days, oldest first. No banking: unused freezes expire with the week.`,
  `Rest days never break a training streak.`,
  `A run ends when a missed day has no freeze left in its week. Frozen days are shown as frozen — a freeze is a patch, not a lie.`,
] as const;

const DAY_MS = 86_400_000;

export function isoDayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday-based week key, e.g. "2026-W37". */
export function isoWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const ftDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ftDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export type FreezeStreak = {
  current: number;
  longest: number;
  /** Days the current run survived only by freeze, newest first. */
  frozenDays: string[];
  /** Freezes already consumed in the current calendar week. */
  freezesUsedThisWeek: number;
};

/**
 * Freeze-aware current + longest over `windowDays`. Today counts when
 * done; an un-done today doesn't end the run (the day isn't over).
 */
export function freezeStreak(
  days: ReadonlySet<string>,
  today: Date = new Date(),
  windowDays = 180,
): FreezeStreak {
  const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const budget = new Map<string, number>();
  const take = (dayStr: string): boolean => {
    const wk = isoWeekKey(dayStr);
    const used = budget.get(wk) ?? 0;
    if (used >= FREEZES_PER_WEEK) return false;
    budget.set(wk, used + 1);
    return true;
  };

  // Current run: walk back from today (or yesterday when today is undone).
  // A freeze only ever BRIDGES two real days — pending freezes commit when
  // the walk reaches an earlier real day, and are dropped at the run's
  // start (a run neither starts nor is made of frozen days).
  const frozenDays: string[] = [];
  let current = 0;
  let pending: string[] = [];
  let cursor = new Date(t);
  if (!days.has(isoDayStr(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  for (let i = 0; i < windowDays; i++) {
    const dayStr = isoDayStr(cursor);
    if (days.has(dayStr)) {
      current += pending.length + 1;
      frozenDays.push(...pending);
      pending = [];
    } else if (current > 0 && take(dayStr)) {
      pending.push(dayStr);
    } else {
      break;
    }
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  // Longest run in the window, forward scan with per-week budgets.
  const longestBudget = new Map<string, number>();
  const takeL = (dayStr: string): boolean => {
    const wk = isoWeekKey(dayStr);
    const used = longestBudget.get(wk) ?? 0;
    if (used >= FREEZES_PER_WEEK) return false;
    longestBudget.set(wk, used + 1);
    return true;
  };
  let longest = 0;
  let run = 0;
  let pendingL = 0;
  for (let i = windowDays - 1; i >= 0; i--) {
    const dayStr = isoDayStr(new Date(t.getTime() - i * DAY_MS));
    if (days.has(dayStr)) {
      run += pendingL + 1;
      pendingL = 0;
      longest = Math.max(longest, run);
    } else if (run > 0 && takeL(dayStr)) {
      pendingL++; // counts only if a later real day lands
    } else {
      run = 0;
      pendingL = 0;
    }
  }

  const thisWeek = isoWeekKey(isoDayStr(t));
  return {
    current,
    longest: Math.max(longest, current),
    frozenDays,
    freezesUsedThisWeek: budget.get(thisWeek) ?? 0,
  };
}
