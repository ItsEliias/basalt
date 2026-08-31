// Monthly behavior-impact report — the correlations engine at month scale.
// Same gates (|r| ≥ 0.45, n ≥ 30 — unchanged, unbent), same "correlation,
// not cause (r, n)" law, checked-not-shown included. The month contributes
// the FACTS (how often each factor was logged, mood coverage); the
// correlations contribute the IMPACT statements, computed over the same
// trailing window the Trends card uses, because a single calendar month
// cannot honestly clear an n ≥ 30 gate on lagged pairs.
//
// Week-in-Review discipline applies: factual sentences, no cheerleading
// vocabulary (pinned), and a month with too little behavior data says so
// instead of composing fiction.

import type { CorrelationResult } from './correlations';

export const MONTHLY_REPORT_RULES = {
  /** Fewer checked-in days than this → no report, honestly stated. */
  minCheckinDays: 8,
} as const;

export type MonthlyBehaviorInput = {
  monthLabel: string; // "August 2026"
  daysInMonth: number;
  /** Evenings each factor was logged this month, zero-count included. */
  factorCounts: { label: string; evenings: number }[];
  moodMean: number | null;
  moodDays: number;
  daysWithCheckins: number;
  /** Current engine output over its own window — gates already applied. */
  shown: CorrelationResult[];
  checkedNotShown: CorrelationResult[];
};

export type MonthlyBehaviorReport = {
  /** null = too little data to report honestly. */
  lede: string | null;
  factorLines: string[];
  impactLines: string[];
  checkedNotShownLines: string[];
  rangeLabel: string;
};

export function composeMonthlyBehavior(input: MonthlyBehaviorInput): MonthlyBehaviorReport {
  const rangeLabel = input.monthLabel;

  if (input.daysWithCheckins < MONTHLY_REPORT_RULES.minCheckinDays) {
    return {
      lede: null,
      factorLines: [],
      impactLines: [],
      checkedNotShownLines: [],
      rangeLabel,
    };
  }

  const logged = input.factorCounts.filter((f) => f.evenings > 0);
  const factorLines = logged
    .sort((a, b) => b.evenings - a.evenings)
    .map((f) => `${f.label} on ${f.evenings} ${f.evenings === 1 ? 'evening' : 'evenings'}`);

  const moodClause =
    input.moodMean !== null && input.moodDays > 0
      ? ` · mood averaged ${input.moodMean.toFixed(1)} of 5 over ${input.moodDays} days`
      : '';
  const lede =
    `Check-ins on ${input.daysWithCheckins} of ${input.daysInMonth} days` +
    (logged.length > 0 ? `, ${logged.length} ${logged.length === 1 ? 'factor' : 'factors'} logged` : ', nothing flagged') +
    moodClause +
    '.';

  const impactLines = input.shown
    .filter((c) => c.statement !== null)
    .map((c) => c.statement!);

  const checkedNotShownLines = input.checkedNotShown.map(
    (c) =>
      `${c.pair.aLabel} × ${c.pair.bLabel}${c.pair.lag ? ' (next day)' : ''} — ${
        c.r === null ? 'no signal' : `r ${c.r.toFixed(2)}`
      }, ${c.n} d`,
  );

  return { lede, factorLines, impactLines, checkedNotShownLines, rangeLabel };
}
