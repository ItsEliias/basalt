import { describe, it, expect } from 'vitest';
import { freezeStreak, isoWeekKey, FREEZES_PER_WEEK, STREAK_RULES } from './model';

// 2026-09-07 is a Monday — handy for week-boundary cases.
const TODAY = new Date('2026-09-07T12:00:00Z');
const d = (offset: number) => {
  const t = new Date(Date.UTC(2026, 8, 7) - -0); // base
  const x = new Date(Date.UTC(2026, 8, 7) + offset * 86_400_000);
  return x.toISOString().slice(0, 10);
};

function daySet(offsets: number[]): Set<string> {
  return new Set(offsets.map((o) => d(o)));
}

describe('freeze-aware streaks — the published rules, verified', () => {
  it('a clean run counts, today included when done', () => {
    const s = freezeStreak(daySet([0, -1, -2, -3]), TODAY);
    expect(s.current).toBe(4);
    expect(s.frozenDays).toEqual([]);
  });

  it('an undone today does not end the run', () => {
    const s = freezeStreak(daySet([-1, -2, -3]), TODAY);
    expect(s.current).toBe(3);
  });

  it('one missed day consumes a freeze and is listed, not hidden', () => {
    const s = freezeStreak(daySet([0, -1, -3, -4]), TODAY);
    expect(s.current).toBe(5);
    expect(s.frozenDays).toEqual([d(-2)]);
  });

  it(`a week holds at most ${FREEZES_PER_WEEK} freezes — the third miss breaks`, () => {
    // Sep 1 (Tue) – Sep 6 (Sun) share ISO week 2026-W36 with the gaps.
    const s = freezeStreak(daySet([0, -1, -3, -5, -7, -8]), TODAY);
    // walk: 7,6 logged · 5(-2? offsets) ... gaps at -2, -4, -6 → third gap
    // falls in the same Mon–Sun week as the first two → run stops there.
    expect(s.current).toBe(6);
    expect(s.frozenDays).toHaveLength(2);
  });

  it('freezes never fabricate a run out of nothing', () => {
    const s = freezeStreak(daySet([-10]), TODAY);
    expect(s.current).toBe(0);
  });

  it('longest survives freezes but respects the weekly budget too', () => {
    const offsets = [-20, -21, -23, -24, -25];
    const s = freezeStreak(daySet(offsets), TODAY);
    expect(s.longest).toBe(6); // -25..-20 with the -22 gap frozen
  });

  it('week keys are Monday-based ISO weeks', () => {
    expect(isoWeekKey('2026-09-07')).not.toBe(isoWeekKey('2026-09-06'));
    expect(isoWeekKey('2026-09-06')).toBe(isoWeekKey('2026-09-01'));
  });

  it('the rules are published, complete and name the numbers', () => {
    const joined = STREAK_RULES.join(' ');
    expect(joined).toContain(`${FREEZES_PER_WEEK} freezes`);
    expect(joined).toContain('Rest days never break');
    expect(joined).toContain('shown as frozen');
  });
});
