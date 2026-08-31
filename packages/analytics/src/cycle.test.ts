import { describe, it, expect } from 'vitest';
import { groupPeriods, cycleLengths, composeCycle, CYCLE_RULES, type CycleEntry } from './cycle';

const flow = (date: string): CycleEntry => ({ date, flow: 'medium', symptoms: [] });

describe('groupPeriods', () => {
  it('consecutive flow days form one period', () => {
    const p = groupPeriods([flow('2026-08-01'), flow('2026-08-02'), flow('2026-08-03')]);
    expect(p).toEqual([{ start: '2026-08-01', end: '2026-08-03', days: 3 }]);
  });

  it('a single unlogged day inside a run bridges; two days split', () => {
    const bridged = groupPeriods([flow('2026-08-01'), flow('2026-08-03')]);
    expect(bridged).toHaveLength(1);
    const split = groupPeriods([flow('2026-08-01'), flow('2026-08-04')]);
    expect(split).toHaveLength(2);
  });
});

describe('cycleLengths', () => {
  const periods = groupPeriods([
    flow('2026-03-01'), flow('2026-03-29'), flow('2026-04-27'), flow('2026-05-24'),
  ]);

  it('start-to-start intervals', () => {
    expect(cycleLengths(periods)).toEqual([28, 29, 27]);
  });

  it('implausible intervals are dropped, not averaged in', () => {
    const withGap = groupPeriods([flow('2025-01-01'), flow('2025-06-01'), flow('2025-06-29')]);
    expect(cycleLengths(withGap)).toEqual([28]); // the 151-day gap is out
  });
});

describe('composeCycle', () => {
  const entries = [
    flow('2026-03-01'), flow('2026-03-02'),
    flow('2026-03-29'), flow('2026-03-30'),
    flow('2026-04-27'),
  ];

  it('cycle day is a fact counted from the last period start', () => {
    const r = composeCycle(entries, '2026-05-06');
    expect(r.cycleDay).toBe(10);
  });

  it('the estimate is a window from the user\'s own spread, labelled as an estimate', () => {
    const r = composeCycle(entries, '2026-05-06');
    expect(r.estimate).not.toBeNull();
    // lengths 28, 29 → median 29, spread low 1→floor 2, high 0→floor 2
    expect(r.estimate!.medianLen).toBe(29);
    expect(r.estimate!.windowStart).toBe('2026-05-24');
    expect(r.estimate!.windowEnd).toBe('2026-05-28');
    expect(r.estimate!.label).toMatch(/estimate, not a fact/i);
    expect(r.estimate!.basedOnCycles).toBe(2);
  });

  it(`under ${CYCLE_RULES.minCyclesForEstimate} complete cycles the future stays blank`, () => {
    const r = composeCycle([flow('2026-04-27'), flow('2026-04-28')], '2026-05-06');
    expect(r.cycleDay).toBe(10); // the fact still renders
    expect(r.estimate).toBeNull(); // the estimate does not
  });

  it('no entries → all facts null, no estimate, never a placeholder', () => {
    const r = composeCycle([], '2026-05-06');
    expect(r.cycleDay).toBeNull();
    expect(r.lastPeriod).toBeNull();
    expect(r.estimate).toBeNull();
  });

  it('NEVER names phases or advises training — pinned on every composed string', () => {
    const r = composeCycle(entries, '2026-05-06');
    const all = [r.srcnote, r.estimate?.label ?? ''].join(' ');
    expect(all).not.toMatch(/(follicular|luteal|ovulat|train harder|lift heavier|deload|adjust your training|phase)/i);
  });

  it('the srcnote states privacy: out of scores, out of sharing unless granted alone', () => {
    const r = composeCycle([], '2026-01-01');
    expect(r.srcnote).toMatch(/out of every score/i);
    expect(r.srcnote).toMatch(/unless you grant it by itself/i);
  });
});
