import { describe, it, expect } from 'vitest';
import { composeYearReview, type YearReviewInput } from './year-review';
import { computeMonthlyChallenge, type ChallengeInput } from './challenge';

const YEAR: YearReviewInput = {
  yearLabel: '2026 so far', totalDaysSoFar: 233, foodLoggedDays: 190, sessions: 96,
  volumeKg: 480000, walks: 40, walkKm: 178, sleepNights: 150, sleepAvgMin: 438,
  weightFirstKg: 86.0, weightLastKg: 82.4,
};

describe('composeYearReview', () => {
  it('composes factual clauses with year-scale stats and one gap', () => {
    const r = composeYearReview(YEAR);
    expect(r.lede).toContain('96 training sessions');
    expect(r.lede).toContain('food logged on 190 of 233 days');
    expect(r.lede!.split('The one gap:').length).toBe(2);
    expect(r.stats.find((s) => s.k === 'Volume')!.v).toBe('480.0 t');
    expect(r.stats.find((s) => s.k === 'Weight')!.v).toBe('−3.6 kg');
  });

  it('a thin year refuses to compose (needs 90 logged days or 45 sessions)', () => {
    const r = composeYearReview({ ...YEAR, foodLoggedDays: 40, sessions: 20 });
    expect(r.lede).toBeNull();
    expect(r.stats).toEqual([]);
  });

  it('never-persisted sleep is named as the gap when weakest', () => {
    const r = composeYearReview({ ...YEAR, foodLoggedDays: 233, sleepNights: 0, sleepAvgMin: null });
    expect(r.gap).toBe('sleep was never persisted');
  });

  it('never cheers', () => {
    const text = composeYearReview(YEAR).lede!.toLowerCase();
    for (const banned of ['crushing', 'amazing', 'awesome', '!', 'incredible']) {
      expect(text).not.toContain(banned);
    }
  });
});

describe('computeMonthlyChallenge', () => {
  const BASE: ChallengeInput = {
    monthLabel: 'August', daysInMonth: 31,
    stepsBaseline: Array(30).fill(9000), stepsThisMonth: [9900, 10000, 8000, 9905],
    sessionsPerWeekMedian: 3, sessionsThisMonth: 7,
  };

  it('steps path: median ×1.1 rounded to 500, 20 days, own-baseline basis', () => {
    const c = computeMonthlyChallenge(BASE)!;
    expect(c.kind).toBe('steps');
    expect(c.targetText).toBe('10,000 steps'); // 9900 → 10000
    expect(c.progress).toBe(1); // only the 10,000 day meets the 10,000 target
    expect(c.basis).toContain('your own baseline');
  });

  it('sessions path when steps baseline is thin; capped at 5/week', () => {
    const c = computeMonthlyChallenge({ ...BASE, stepsBaseline: [9000, 9500], sessionsPerWeekMedian: 6 })!;
    expect(c.kind).toBe('sessions');
    expect(c.targetText).toBe('5/week');
  });

  it('no baseline → no challenge, nothing invented', () => {
    expect(computeMonthlyChallenge({ ...BASE, stepsBaseline: [], sessionsPerWeekMedian: 0 })).toBeNull();
  });
});
