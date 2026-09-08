import { describe, it, expect } from 'vitest';
import {
  HYDRATION_HOUR_CHOICES, hydrationContent, hydrationNotifId,
  hydrationSummary, parseHydrationHours,
} from './hydrationRemindersModel';

describe('hydration reminders model', () => {
  it('parses stored hours: sorted, unique, only offered hours survive', () => {
    expect(parseHydrationHours(JSON.stringify([16, 8, 16, 3, 25, 'x']))).toEqual([8, 16]);
    expect(parseHydrationHours(null)).toEqual([]);
    expect(parseHydrationHours('garbage')).toEqual([]);
    expect(parseHydrationHours(JSON.stringify({}))).toEqual([]);
  });

  it('offers waking-day hours only', () => {
    expect(HYDRATION_HOUR_CHOICES[0]).toBe(8);
    expect(HYDRATION_HOUR_CHOICES[HYDRATION_HOUR_CHOICES.length - 1]).toBe(22);
  });

  it('notification copy states the user asked and that nothing auto-logs', () => {
    const c = hydrationContent(8);
    expect(c.body).toBe('You asked for a reminder at 08:00. Nothing is logged unless you log it.');
    expect(c.body).not.toMatch(/great|keep it up|don.t forget|hydrate!/i);
  });

  it('ids are stable per hour', () => {
    expect(hydrationNotifId(14)).toBe('basalt.hydration.14');
  });

  it('summary is plain hours or an honest empty state', () => {
    expect(hydrationSummary([8, 14])).toBe('08:00 · 14:00');
    expect(hydrationSummary([])).toBe('no hours picked — no notifications');
  });
});
