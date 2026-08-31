import { describe, it, expect } from 'vitest';
import {
  bedtimeWindow, sleepConsistency, toClockAxis, fromClockAxis, clockText, BEDTIME_RULES,
} from './sleep-window';

const MIN = (h: number, m = 0) => h * 60 + m;

describe('clock axis — midnight never splits a pair', () => {
  it('round-trips and orders across midnight', () => {
    expect(fromClockAxis(toClockAxis(MIN(23, 50)))).toBe(MIN(23, 50));
    expect(fromClockAxis(toClockAxis(MIN(0, 10)))).toBe(MIN(0, 10));
    expect(toClockAxis(MIN(0, 10)) - toClockAxis(MIN(23, 50))).toBe(20);
  });

  it('clockText renders 12-hour with am/pm', () => {
    expect(clockText(MIN(22, 40))).toBe('10:40 pm');
    expect(clockText(MIN(0, 5))).toBe('12:05 am');
    expect(clockText(MIN(6, 55))).toBe('6:55 am');
  });
});

describe('bedtimeWindow', () => {
  const wakes = Array(7).fill(MIN(6, 40)); // usual 6:40 am wake

  it('hidden until the need is personal AND 7 wake samples exist', () => {
    expect(bedtimeWindow(480, false, 0, wakes)).toBeNull();
    expect(bedtimeWindow(480, true, 0, wakes.slice(0, 6))).toBeNull();
  });

  it('no debt: window ends exactly need before the usual wake', () => {
    const w = bedtimeWindow(470, true, 0, wakes)!; // need 7:50
    expect(clockText(w.endMin)).toBe('10:50 pm');
    expect(clockText(w.startMin)).toBe('10:20 pm');
    expect(w.line).toBe('To meet your need: in bed 10:20 pm–10:50 pm');
  });

  it('debt repays a third, capped at an hour, and the formula says so', () => {
    const w = bedtimeWindow(480, true, 90, wakes)!; // repay 30
    expect(w.targetSleepMin).toBe(510);
    expect(w.formulaLine).toContain('debt repay 0:30');
    const capped = bedtimeWindow(480, true, 600, wakes)!; // ⅓=200 → cap 60
    expect(capped.targetSleepMin).toBe(540);
  });

  it(`pins the published knobs: cap ${BEDTIME_RULES.debtRepayCapMin}, width ${BEDTIME_RULES.windowWidthMin}`, () => {
    expect(BEDTIME_RULES.debtRepayCapMin).toBe(60);
    expect(BEDTIME_RULES.windowWidthMin).toBe(30);
    expect(BEDTIME_RULES.minWakeSamples).toBe(7);
  });
});

describe('sleepConsistency', () => {
  it('±MAD around the median, wrap-safe', () => {
    const beds = [MIN(23, 50), MIN(0, 10), MIN(23, 30), MIN(0, 30), MIN(23, 50), MIN(0, 10), MIN(23, 55)];
    const c = sleepConsistency(beds)!;
    expect(c.line).toMatch(/^Bedtime varies ±\d+ min$/);
    expect(c.plusMinusMin).toBeLessThanOrEqual(30); // spread is ~20, never ~700
    expect(c.mathLine).toContain('median absolute deviation');
  });

  it('a rock-steady sleeper reads ±0', () => {
    const c = sleepConsistency(Array(10).fill(MIN(22, 45)))!;
    expect(c.plusMinusMin).toBe(0);
    expect(clockText(c.medianBedMin)).toBe('10:45 pm');
  });

  it('hidden under 7 nights — no spread from a handful', () => {
    expect(sleepConsistency([MIN(23, 0), MIN(23, 10)])).toBeNull();
  });
});
