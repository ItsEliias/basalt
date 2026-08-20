import { describe, it, expect } from 'vitest';
import { composeWeekReview, pickGap, type WeekReviewInput, type ReviewDay } from './week-review';

function day(n: number, partial: Partial<ReviewDay> = {}): ReviewDay {
  return {
    date: `2026-08-1${n}`,
    calories: null,
    proteinG: null,
    loggedFood: false,
    loggedTraining: false,
    steps: null,
    sleepMin: null,
    ...partial,
  };
}

const fullWeek: WeekReviewInput = {
  weekStartLabel: 'Mon 10',
  weekEndLabel: 'Sun 16',
  days: [
    day(0, { loggedFood: true, calories: 2100, proteinG: 180, steps: 9000, sleepMin: 430 }),
    day(1, { loggedFood: true, calories: 2200, proteinG: 175, steps: 8500, sleepMin: 445 }),
    day(2, { loggedFood: true, calories: 2150, proteinG: 182, steps: 9200, sleepMin: 440 }),
    day(3, { loggedFood: false }), // the gap
    day(4, { loggedFood: true, calories: 2050, proteinG: 178, steps: 8800, sleepMin: 425 }),
    day(5, { loggedFood: true, calories: 2300, proteinG: 168, steps: 9400, sleepMin: 460 }),
    day(6, { loggedFood: true, calories: 2120, proteinG: 181, steps: 8900, sleepMin: 450 }),
  ],
  sessionCount: 4,
  volumeKg: 24100,
  calorieTarget: 2340,
  proteinTarget: 180,
};

describe('composeWeekReview', () => {
  it('composes factual clauses with exactly one gap named', () => {
    const r = composeWeekReview(fullWeek);
    expect(r.lede).toContain('4 training sessions');
    expect(r.lede).toContain('food logged on 6 of 7 days');
    expect(r.lede).toContain('The one gap:');
    // Exactly one gap — the string appears once.
    expect(r.lede!.split('The one gap:').length).toBe(2);
    expect(r.gap).toContain('unlogged');
  });

  it('never cheers', () => {
    const r = composeWeekReview(fullWeek);
    for (const word of ['crushing', 'amazing', 'great job', 'awesome', 'keep it up', '!']) {
      expect(r.lede!.toLowerCase()).not.toContain(word);
    }
  });

  it('stats only carry dimensions with data', () => {
    const r = composeWeekReview(fullWeek);
    const keys = r.stats.map((s) => s.k);
    expect(keys).toContain('Volume');
    expect(keys).toContain('Deficit'); // mean ~2153 vs 2340 target
    expect(keys).toContain('Sleep');
    expect(keys).toContain('Steps');
    expect(r.stats.find((s) => s.k === 'Volume')?.v).toBe('24.1 t');
  });

  it('no sleep/steps data → those stats simply do not exist', () => {
    const input: WeekReviewInput = {
      ...fullWeek,
      days: fullWeek.days.map((d) => ({ ...d, steps: null, sleepMin: null })),
    };
    const keys = composeWeekReview(input).stats.map((s) => s.k);
    expect(keys).not.toContain('Sleep');
    expect(keys).not.toContain('Steps');
  });

  it('a surplus week states surplus, not a softened deficit', () => {
    const input: WeekReviewInput = {
      ...fullWeek,
      days: fullWeek.days.map((d) => (d.loggedFood ? { ...d, calories: 2600 } : d)),
    };
    const stat = composeWeekReview(input).stats.find((s) => s.k === 'Surplus');
    expect(stat).toBeTruthy();
    expect(stat!.v.startsWith('+')).toBe(true);
  });

  it('an empty week refuses to compose fiction', () => {
    const input: WeekReviewInput = {
      ...fullWeek,
      days: fullWeek.days.map((d) => day(0, { date: d.date })),
      sessionCount: 0,
      volumeKg: 0,
    };
    const r = composeWeekReview(input);
    expect(r.lede).toBeNull();
    expect(r.stats).toEqual([]);
  });
});

describe('pickGap — one gap, worst first, deterministic', () => {
  it('unlogged days outrank protein when proportionally worse', () => {
    const input: WeekReviewInput = {
      ...fullWeek,
      days: fullWeek.days.map((d, i) => (i < 4 ? day(i) : d)), // 4 unlogged
    };
    expect(pickGap(input)).toContain('unlogged');
  });

  it('no sessions is the gap for a food-only week', () => {
    const input: WeekReviewInput = {
      ...fullWeek,
      days: fullWeek.days.map((d) => ({ ...d, loggedFood: true, calories: 2100, proteinG: 185 })),
      sessionCount: 0,
    };
    expect(pickGap(input)).toBe('no training sessions were logged');
  });

  it('a clean week has no gap — and no invented one', () => {
    const input: WeekReviewInput = {
      ...fullWeek,
      days: fullWeek.days.map((d) => ({ ...d, loggedFood: true, calories: 2100, proteinG: 185 })),
    };
    expect(pickGap(input)).toBeNull();
    const r = composeWeekReview(input);
    expect(r.lede).not.toContain('The one gap:');
  });
});

describe('lastCompletedWeek', () => {
  it('a Thursday resolves to the previous Mon–Sun', async () => {
    const { lastCompletedWeek } = await import('./week-review-load');
    const w = lastCompletedWeek(new Date(2026, 7, 20)); // Thu 20 Aug 2026
    expect(w.startIso).toBe('2026-08-10');
    expect(w.endIso).toBe('2026-08-16');
  });

  it('a Monday still reviews the week just finished, not itself', async () => {
    const { lastCompletedWeek } = await import('./week-review-load');
    const w = lastCompletedWeek(new Date(2026, 7, 17)); // Mon 17 Aug 2026
    expect(w.startIso).toBe('2026-08-10');
    expect(w.endIso).toBe('2026-08-16');
  });

  it('a Sunday mid-week-in-progress reviews the prior completed week', async () => {
    const { lastCompletedWeek } = await import('./week-review-load');
    const w = lastCompletedWeek(new Date(2026, 7, 16)); // Sun 16 Aug 2026
    expect(w.startIso).toBe('2026-08-03');
    expect(w.endIso).toBe('2026-08-09');
  });
});
