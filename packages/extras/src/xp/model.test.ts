import { describe, it, expect } from 'vitest';
import { totalXp, xpBreakdown, levelFor, levelThreshold, badges, XP_RULES, LEVEL_RULE, XP_PER } from './model';

const C = { entries: 100, sessions: 20, walks: 10, sleepRecords: 30 };

describe('XP — the printed formula is the code', () => {
  it('total is exactly the published sum', () => {
    expect(totalXp(C)).toBe(100 * 5 + 20 * 25 + 10 * 15 + 30 * 10);
  });
  it('the published rules name the same numbers the code uses', () => {
    const joined = XP_RULES.join(' ');
    for (const v of Object.values(XP_PER)) expect(joined).toContain(`${v} XP`);
  });
  it('breakdown sums to the total', () => {
    expect(xpBreakdown(C).reduce((s, r) => s + r.xp, 0)).toBe(totalXp(C));
  });
});

describe('levels — the written-down curve', () => {
  it('thresholds match the rule text (250·n·(n−1))', () => {
    expect(levelThreshold(2)).toBe(500);
    expect(levelThreshold(3)).toBe(1500);
    expect(levelThreshold(4)).toBe(3000);
    expect(LEVEL_RULE).toContain('250');
  });
  it('levelFor is exact at boundaries', () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(499).level).toBe(1);
    expect(levelFor(500)).toEqual({ level: 2, into: 0, span: 1000 });
    expect(levelFor(1500).level).toBe(3);
  });
});

describe('badges — real milestones only, honest predicates', () => {
  it('earn exactly at the stated line', () => {
    const base = { ...C, sessions: 9, totalWalkKm: 99.9, longestCompleteLogRun: 29 };
    expect(badges(base).every((b) => !b.earned)).toBe(true);
    const earned = badges({ ...C, sessions: 10, totalWalkKm: 100, longestCompleteLogRun: 30 });
    expect(earned.every((b) => b.earned)).toBe(true);
  });
  it('every badge states how it is earned', () => {
    for (const b of badges({ ...C, totalWalkKm: 0, longestCompleteLogRun: 0 })) {
      expect(b.how.length).toBeGreaterThan(5);
    }
  });
});
