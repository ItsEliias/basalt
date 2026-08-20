import { describe, it, expect } from 'vitest';
import { currentAndLongest, monthCells } from './streaks';
import { isoDay } from '@basalt/core-data';

function daysAgoSet(today: Date, offsets: number[]): Set<string> {
  return new Set(
    offsets.map((o) => {
      const d = new Date(today);
      d.setDate(d.getDate() - o);
      return isoDay(d);
    }),
  );
}

const TODAY = new Date(2026, 7, 20); // Wed 20 Aug 2026

describe('currentAndLongest', () => {
  it('walks back from today over consecutive active days', () => {
    const days = daysAgoSet(TODAY, [0, 1, 2, 3]);
    expect(currentAndLongest(days, TODAY)).toEqual({ current: 4, longest: 4 });
  });

  it("an unlogged today doesn't zero yesterday's run", () => {
    const days = daysAgoSet(TODAY, [1, 2, 3]);
    expect(currentAndLongest(days, TODAY).current).toBe(3);
  });

  it('a gap two days ago ends the current run but not the longest', () => {
    const days = daysAgoSet(TODAY, [0, 1, 4, 5, 6, 7, 8]);
    const r = currentAndLongest(days, TODAY);
    expect(r.current).toBe(2);
    expect(r.longest).toBe(5);
  });

  it('empty history is 0 / 0 — no fake day-one streak', () => {
    expect(currentAndLongest(new Set(), TODAY)).toEqual({ current: 0, longest: 0 });
  });

  it('longest never reads below current', () => {
    const days = daysAgoSet(TODAY, [0, 1, 2]);
    const r = currentAndLongest(days, TODAY);
    expect(r.longest).toBeGreaterThanOrEqual(r.current);
  });
});

describe('monthCells — the no-guilt calendar', () => {
  it('renders August 2026 Monday-first with honest states', () => {
    const full = new Set(['2026-08-05', '2026-08-06', '2026-08-10']);
    const partial = new Set(['2026-08-07']);
    const cells = monthCells(2026, 7, full, partial, TODAY);

    // Aug 2026 starts Saturday → 5 leading hidden cells.
    expect(cells.slice(0, 5)).toEqual(['hidden', 'hidden', 'hidden', 'hidden', 'hidden']);
    const day = (d: number) => cells[5 + d - 1];
    expect(day(5)).toBe('on');
    expect(day(6)).toBe('on');
    expect(day(7)).toBe('part');
    expect(day(8)).toBe('off');   // a gap stays gray — never red, never flames
    expect(day(20)).toBe('today');
    expect(day(21)).toBe('future');
    expect(cells.length % 7).toBe(0);
  });
});
