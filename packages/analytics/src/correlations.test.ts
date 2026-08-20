import { describe, it, expect } from 'vitest';
import {
  pearson, correlate, computeCorrelations, CORRELATION_GATES, CHECKED_PAIRS,
  type DailySeries, type CorrelationPair,
} from './correlations';

function seriesOf(days: number, f: (i: number) => [number, number]): DailySeries {
  const a = new Map<string, number>();
  const b = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const date = `2026-06-${String((i % 28) + 1).padStart(2, '0')}`;
    const key = i < 28 ? date : `2026-07-${String((i - 28) + 1).padStart(2, '0')}`;
    const [av, bv] = f(i);
    a.set(key, av);
    b.set(key, bv);
  }
  return { a, b };
}

const PAIR: CorrelationPair = { aKey: 'a', bKey: 'b', aLabel: 'sleep', bLabel: 'steps', lag: 0 };

describe('pearson', () => {
  it('is exact on known data', () => {
    expect(pearson([[1, 2], [2, 4], [3, 6]])).toBeCloseTo(1, 10);
    expect(pearson([[1, 6], [2, 4], [3, 2]])).toBeCloseTo(-1, 10);
    expect(pearson([[1, 1], [2, 1], [1, 2], [2, 2]])).toBeCloseTo(0, 10);
  });

  it('refuses to divide by nothing: n<2 or zero variance → null', () => {
    expect(pearson([[1, 1]])).toBeNull();
    expect(pearson([[1, 5], [1, 9], [1, 2]])).toBeNull();
  });
});

describe('honesty gates', () => {
  it('strong r over enough days → shown, with r, n and the disclaimer', () => {
    const s = seriesOf(40, (i) => [400 + i * 3 + (i % 5), 8000 + i * 40]);
    const res = correlate(s, PAIR);
    expect(res.shown).toBe(true);
    expect(res.statement).toContain('correlation, not cause');
    expect(res.statement).toMatch(/r [01]\.\d\d, 40 days/);
  });

  it('strong r over too few days → checked, not shown', () => {
    const s = seriesOf(20, (i) => [400 + i * 3, 8000 + i * 40]);
    const res = correlate(s, PAIR);
    expect(res.n).toBe(20);
    expect(res.shown).toBe(false);
    expect(res.statement).toBeNull();
  });

  it('weak r over many days → checked, not shown', () => {
    // alternate direction so r stays near 0
    const s = seriesOf(60, (i) => [i % 2 ? 400 : 500, i % 3 ? 9000 : 7000]);
    const res = correlate(s, PAIR);
    expect(res.shown).toBe(false);
  });

  it('negative correlations state "lower", direction from the sign', () => {
    const s = seriesOf(40, (i) => [400 + i * 3, 12000 - i * 60]);
    const res = correlate(s, PAIR);
    expect(res.statement).toContain('lower steps');
  });

  it('gate constants are the roadmap values', () => {
    expect(CORRELATION_GATES).toEqual({ minAbsR: 0.45, minDays: 30 });
  });
});

describe('lagged pairs', () => {
  it('lag 1 pairs a-day with b-the-next-day', () => {
    const a = new Map([['2026-06-01', 100], ['2026-06-02', 200]]);
    const b = new Map([['2026-06-02', 10], ['2026-06-03', 20], ['2026-06-01', 999]]);
    const res = correlate({ a, b }, { ...PAIR, lag: 1 });
    expect(res.n).toBe(2); // 01→02 and 02→03; b['2026-06-01'] is never used
    expect(res.r).toBeCloseTo(1, 10);
  });

  it('lag crosses month boundaries correctly', () => {
    const a = new Map([['2026-06-30', 1]]);
    const b = new Map([['2026-07-01', 2]]);
    expect(correlate({ a, b }, { ...PAIR, lag: 1 }).n).toBe(1);
  });
});

describe('computeCorrelations', () => {
  it('every checked pair lands in exactly one bucket — nothing vanishes', () => {
    const empty: DailySeries = {};
    const { shown, checkedNotShown } = computeCorrelations(empty);
    expect(shown.length + checkedNotShown.length).toBe(CHECKED_PAIRS.length);
    expect(shown).toHaveLength(0);
  });
});
