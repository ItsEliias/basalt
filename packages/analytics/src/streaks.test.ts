import { describe, it, expect } from 'vitest';
import { currentAndLongest, monthCells, restAwareDays, REST_ADVISED_BELOW } from './streaks';
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

describe('restAwareDays — rest maintains a run, never fabricates one', () => {
  it('a rest day between two trained days keeps the run contiguous', () => {
    const trained = new Set(['2026-08-10', '2026-08-12']);
    const rest = new Set(['2026-08-11']);
    const out = restAwareDays(trained, rest);
    expect(out).toEqual(new Set(['2026-08-10', '2026-08-11', '2026-08-12']));
    expect(currentAndLongest(out, new Date(2026, 7, 12)).current).toBe(3);
  });

  it('a run made only of rest days is no run at all', () => {
    const trained = new Set<string>();
    const rest = new Set(['2026-08-10', '2026-08-11', '2026-08-12']);
    expect(restAwareDays(trained, rest).size).toBe(0);
  });

  it('rest-only runs are dropped even when other runs contain training', () => {
    const trained = new Set(['2026-08-01']);
    const rest = new Set(['2026-08-10', '2026-08-11']); // detached from the trained run
    const out = restAwareDays(trained, rest);
    expect(out).toEqual(new Set(['2026-08-01']));
  });

  it('rest days extend a run at either end', () => {
    const trained = new Set(['2026-08-11']);
    const rest = new Set(['2026-08-10', '2026-08-12']);
    expect(restAwareDays(trained, rest)).toEqual(
      new Set(['2026-08-10', '2026-08-11', '2026-08-12']),
    );
  });

  it('a real gap (no session, no rest) still breaks the run — honesty holds', () => {
    const trained = new Set(['2026-08-10', '2026-08-13']);
    const rest = new Set(['2026-08-11']); // the 12th is a true gap
    const out = restAwareDays(trained, rest);
    const r = currentAndLongest(out, new Date(2026, 7, 13));
    expect(r.current).toBe(1);
    expect(r.longest).toBe(2);
  });

  it('month boundaries do not fake a gap', () => {
    const trained = new Set(['2026-07-31', '2026-08-02']);
    const rest = new Set(['2026-08-01']);
    expect(restAwareDays(trained, rest).size).toBe(3);
  });

  it('the rest-advised threshold is published and pinned', () => {
    expect(REST_ADVISED_BELOW).toBe(40);
  });
});
