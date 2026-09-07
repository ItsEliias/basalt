import { describe, it, expect } from 'vitest';
import { CORRIDOR_EXPLAINER, corridorFor, weeklyCheckin } from './checkin';
import { PROGRAMME_TEMPLATES, programmeTemplate, programmeWeek } from './templates';

const BASE = {
  targetRatePct: -0.25,
  observedRatePct: -0.3 as number | null,
  currentCalories: 2300,
  sessionsPlanned: 3,
  sessionsDone: 3,
};

describe('weekly check-in — exactly one proposal, rules in order', () => {
  it('a rate past the cap gets ONLY slow-down — no target change, no praise', () => {
    const p = weeklyCheckin({ ...BASE, observedRatePct: -1.6 });
    expect(p.kind).toBe('slow-down');
    expect(p.reason).toContain('Slow down');
    expect(p.reason).toContain('No other change proposed');
    expect(p.reason).not.toMatch(/great|well done|impressive/i);
    expect('deltaKcal' in p).toBe(false);
  });

  it('the gain cap fires the same rail', () => {
    expect(weeklyCheckin({ ...BASE, targetRatePct: 0.25, observedRatePct: 0.8 }).kind).toBe('slow-down');
  });

  it('half the sessions missed → swap lighter, never tighten food', () => {
    const p = weeklyCheckin({ ...BASE, sessionsDone: 1 });
    expect(p.kind).toBe('swap-lighter');
    expect(p.reason).toContain('1 of 3');
    expect(p.reason).toContain('rather than adjusting food');
  });

  it('no trend → hold with the honest why', () => {
    const p = weeklyCheckin({ ...BASE, observedRatePct: null });
    expect(p.kind).toBe('hold');
    expect(p.reason).toContain('Not enough weigh-ins');
  });

  it('off the rate by >0.15%/wk → one bounded 100–150 kcal step citing both numbers', () => {
    const p = weeklyCheckin({ ...BASE, observedRatePct: -0.6 });
    expect(p.kind).toBe('adjust');
    if (p.kind === 'adjust') {
      expect(Math.abs(p.deltaKcal)).toBeGreaterThanOrEqual(100);
      expect(Math.abs(p.deltaKcal)).toBeLessThanOrEqual(150);
      expect(p.deltaKcal).toBeGreaterThan(0); // losing too fast → eat more
      expect(p.reason).toContain('-0.60%/wk');
      expect(p.reason).toContain('-0.25%/wk');
      expect(p.reason).toContain('2,300');
    }
  });

  it('on track → hold, stating both rates', () => {
    const p = weeklyCheckin(BASE);
    expect(p.kind).toBe('hold');
    expect(p.reason).toContain('inside the line');
  });
});

describe('templates are data, and the corridor is published', () => {
  it('the three templates exist with stated lengths, structure and rates', () => {
    expect(PROGRAMME_TEMPLATES.map((t) => t.id)).toEqual(['recomp8', 'strength6', 'walkbase4']);
    expect(programmeTemplate('recomp8')?.weeks).toBe(8);
    expect(programmeTemplate('recomp8')?.ratePctPerWeek).toBe(-0.25);
    expect(programmeTemplate('strength6')?.trainingDays).toHaveLength(4);
    expect(programmeTemplate('walkbase4')?.walksPerWeek).toBe(5);
    expect(programmeTemplate('nope')).toBeNull();
  });

  it('programmeWeek counts 1-based and ends', () => {
    const now = new Date('2026-09-20T10:00:00Z');
    expect(programmeWeek('2026-09-07', 8, now)).toBe(2);
    expect(programmeWeek('2026-05-01', 8, now)).toBeNull();
    expect(programmeWeek('2026-10-01', 8, now)).toBeNull();
  });

  it('corridor moves at the rate with the stated band', () => {
    const w0 = corridorFor(82, -0.25, 0);
    expect(w0).toEqual({ low: 81.7, high: 82.3 });
    const w4 = corridorFor(82, -0.25, 4);
    expect(w4.low).toBeLessThan(w4.high);
    expect((w4.low + w4.high) / 2).toBeCloseTo(82 * (1 - 0.01), 1);
    expect(CORRIDOR_EXPLAINER).toContain('± 0.3 kg scale noise');
    expect(CORRIDOR_EXPLAINER).toContain('information, not failure');
  });
});
