import { describe, it, expect } from 'vitest';
import { composeMonthlyBehavior, MONTHLY_REPORT_RULES, type MonthlyBehaviorInput } from './monthly-report';
import type { CorrelationResult } from './correlations';

const shownCorr: CorrelationResult = {
  pair: { aKey: 'alcohol', bKey: 'sleep', aLabel: 'Alcohol', bLabel: 'Sleep', lag: 1 },
  r: -0.52, n: 41, shown: true,
  statement: 'Alcohol evenings ran with less sleep the next night — correlation, not cause (r −0.52, n 41)',
};
const hiddenCorr: CorrelationResult = {
  pair: { aKey: 'stress', bKey: 'steps', aLabel: 'Stressful day', bLabel: 'Steps', lag: 0 },
  r: 0.21, n: 55, shown: false, statement: null,
};

const base: MonthlyBehaviorInput = {
  monthLabel: 'August 2026',
  daysInMonth: 31,
  factorCounts: [
    { label: 'Alcohol', evenings: 6 },
    { label: 'Late meal', evenings: 0 },
    { label: 'Stressful day', evenings: 11 },
  ],
  moodMean: 3.4,
  moodDays: 18,
  daysWithCheckins: 20,
  shown: [shownCorr],
  checkedNotShown: [hiddenCorr],
};

describe('monthly behavior report — month facts + gated impact', () => {
  it('composes factual lines, worst-first factors, mood coverage named', () => {
    const r = composeMonthlyBehavior(base);
    expect(r.lede).toBe('Check-ins on 20 of 31 days, 2 factors logged · mood averaged 3.4 of 5 over 18 days.');
    expect(r.factorLines).toEqual(['Stressful day on 11 evenings', 'Alcohol on 6 evenings']);
    expect(r.impactLines).toEqual([shownCorr.statement]);
  });

  it('checked-not-shown is included — an empty impact list is evidence of checking', () => {
    const r = composeMonthlyBehavior({ ...base, shown: [] });
    expect(r.impactLines).toEqual([]);
    expect(r.checkedNotShownLines[0]).toBe('Stressful day × Steps — r 0.21, 55 d');
  });

  it('too few check-in days → no report, nothing composed', () => {
    const r = composeMonthlyBehavior({ ...base, daysWithCheckins: MONTHLY_REPORT_RULES.minCheckinDays - 1 });
    expect(r.lede).toBeNull();
    expect(r.factorLines).toEqual([]);
  });

  it('no cheerleading vocabulary anywhere — pinned', () => {
    const r = composeMonthlyBehavior(base);
    const all = [r.lede, ...r.factorLines, ...r.impactLines].join(' ').toLowerCase();
    for (const banned of ['great', 'awesome', 'crushing', 'amazing', 'keep it up', 'proud', 'nailed']) {
      expect(all).not.toContain(banned);
    }
  });

  it('zero-factor months still report the facts', () => {
    const r = composeMonthlyBehavior({ ...base, factorCounts: base.factorCounts.map((f) => ({ ...f, evenings: 0 })) });
    expect(r.lede).toContain('nothing flagged');
    expect(r.factorLines).toEqual([]);
  });
});
