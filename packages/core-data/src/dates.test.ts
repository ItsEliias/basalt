import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isoDay, todayISO } from './dates';

describe('isoDay', () => {
  it('formats a date with zero-padded month and day', () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('formats the last day of the year correctly', () => {
    expect(isoDay(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('does not pad a two-digit month or day', () => {
    expect(isoDay(new Date(2026, 9, 21))).toBe('2026-10-21');
  });

  it('uses the local calendar day, ignoring time-of-day', () => {
    expect(isoDay(new Date(2026, 5, 15, 23, 59, 59))).toBe('2026-06-15');
    expect(isoDay(new Date(2026, 5, 15, 0, 0, 0))).toBe('2026-06-15');
  });
});

describe('todayISO', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('matches isoDay(new Date()) for the current instant', () => {
    vi.setSystemTime(new Date(2026, 7, 13, 10, 30, 0));
    expect(todayISO()).toBe('2026-08-13');
    expect(todayISO()).toBe(isoDay(new Date()));
  });

  it('rolls over at local midnight', () => {
    vi.setSystemTime(new Date(2026, 7, 13, 23, 59, 59));
    expect(todayISO()).toBe('2026-08-13');
    vi.setSystemTime(new Date(2026, 7, 14, 0, 0, 1));
    expect(todayISO()).toBe('2026-08-14');
  });
});
