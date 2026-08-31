import { describe, it, expect } from 'vitest';
import {
  MESOCYCLE, MESO_LENGTH_WEEKS, DELOAD_TRIGGERS,
  weekIndexFor, phaseFor, phaseLabel, weeklyVolumeTarget, periodize,
  deloadAdvised, stalledMainLifts, plannedRestDays, type Program,
} from './periodization';
import type { Suggestion } from './progression';

describe('block structure — published, pinned', () => {
  it('is 3 accumulation + 2 intensification + 1 deload = 6', () => {
    expect(MESOCYCLE).toEqual({ accumulationWeeks: 3, intensificationWeeks: 2, deloadWeeks: 1 });
    expect(MESO_LENGTH_WEEKS).toBe(6);
  });

  it('phases cycle across mesocycles', () => {
    expect(phaseFor(0).phase).toBe('accumulation');
    expect(phaseFor(2).phase).toBe('accumulation');
    expect(phaseFor(3).phase).toBe('intensification');
    expect(phaseFor(4).phase).toBe('intensification');
    expect(phaseFor(5).phase).toBe('deload');
    expect(phaseFor(6)).toEqual({ phase: 'accumulation', weekInPhase: 0, weekOfMeso: 0 });
  });

  it('labels read like the receipt they are', () => {
    expect(phaseLabel(phaseFor(4))).toBe('Week 5 of 6 · Intensification');
  });

  it('weekIndexFor counts whole weeks from the start date', () => {
    expect(weekIndexFor('2026-08-03', new Date(2026, 7, 3))).toBe(0);
    expect(weekIndexFor('2026-08-03', new Date(2026, 7, 10))).toBe(1);
    expect(weekIndexFor('2026-08-03', new Date(2026, 7, 31))).toBe(4);
  });
});

describe('weekly volume targets — real-or-hidden', () => {
  it('ramps through accumulation, holds, halves on deload', () => {
    expect(weeklyVolumeTarget(10, 'accumulation', 0)).toBe(10);
    expect(weeklyVolumeTarget(10, 'accumulation', 1)).toBe(11);
    expect(weeklyVolumeTarget(10, 'accumulation', 2)).toBe(12);
    expect(weeklyVolumeTarget(10, 'intensification', 0)).toBe(10);
    expect(weeklyVolumeTarget(10, 'deload', 0)).toBe(5);
  });

  it('no baseline → no target, nothing invented', () => {
    expect(weeklyVolumeTarget(null, 'accumulation', 1)).toBeNull();
    expect(weeklyVolumeTarget(0, 'deload', 0)).toBeNull();
  });
});

describe('periodize — layers over suggestNext, never replaces it', () => {
  const base: Suggestion = { kind: 'hold', weightKg: 80, reps: 10, basis: 'close to your limit last time (RIR ≤ 1) — repeat and consolidate' };

  it('first_time passes through untouched — no invented numbers, ever', () => {
    const first: Suggestion = { kind: 'first_time', weightKg: null, reps: null, basis: 'no history…' };
    const p = periodize(first, { phase: 'deload', weekInPhase: 0 });
    expect(p.weightKg).toBeNull();
    expect(p.reps).toBeNull();
    expect(p.basis).toBe('no history…');
  });

  it('deload takes 60% of the suggested load, one fewer set, and says why', () => {
    const p = periodize(base, { phase: 'deload', weekInPhase: 0 });
    expect(p.weightKg).toBe(47.5); // 80 × 0.6 = 48 → rounded to 2.5 step
    expect(p.setsDelta).toBe(-1);
    expect(p.basis).toContain('deload week');
    expect(p.basis).toContain('arrive fresh');
  });

  it('deload on bodyweight work cuts reps instead', () => {
    const bw: Suggestion = { kind: 'hold', weightKg: null, reps: 20, basis: 'x' };
    const p = periodize(bw, { phase: 'deload', weekInPhase: 0 });
    expect(p.reps).toBe(12);
    expect(p.weightKg).toBeNull();
  });

  it('intensification adds 2.5% to the suggested load and states it', () => {
    const p = periodize(base, { phase: 'intensification', weekInPhase: 0 });
    expect(p.weightKg).toBe(82.5); // 80 × 1.025 = 82 → step-rounded
    expect(p.setsDelta).toBe(0);
    expect(p.basis).toContain('+2.5%');
  });

  it('accumulation weeks 2–3 add a set over the recent norm', () => {
    expect(periodize(base, { phase: 'accumulation', weekInPhase: 0 }).setsDelta).toBe(0);
    const p = periodize(base, { phase: 'accumulation', weekInPhase: 1 });
    expect(p.setsDelta).toBe(1);
    expect(p.basis).toContain('one set more');
  });
});

describe('deload triggers — published, two of three', () => {
  it('one signal alone never advises', () => {
    expect(deloadAdvised({ tooHardFraction7d: 0.9, readinessMean7d: null, stalledLifts: 0 }).advised).toBe(false);
    expect(deloadAdvised({ tooHardFraction7d: null, readinessMean7d: 30, stalledLifts: 0 }).advised).toBe(false);
  });

  it('two signals advise, with both reasons named', () => {
    const r = deloadAdvised({ tooHardFraction7d: 0.5, readinessMean7d: 40, stalledLifts: 0 });
    expect(r.advised).toBe(true);
    expect(r.reasons).toHaveLength(2);
    expect(r.reasons[0]).toContain('too hard');
    expect(r.reasons[1]).toContain('readiness');
  });

  it('missing signals are absence, not evidence', () => {
    const r = deloadAdvised({ tooHardFraction7d: null, readinessMean7d: null, stalledLifts: 0 });
    expect(r.advised).toBe(false);
    expect(r.reasons).toHaveLength(0);
  });

  it('thresholds are pinned', () => {
    expect(DELOAD_TRIGGERS).toEqual({ tooHardFraction: 0.4, readinessMeanBelow: 45, stallWeeks: 2 });
  });
});

describe('stalledMainLifts', () => {
  it('flat-or-down across the stall window counts; growth resets', () => {
    expect(stalledMainLifts([{ name: 'Squat', weeklyBestE1rm: [100, 100, 99] }])).toBe(1);
    expect(stalledMainLifts([{ name: 'Squat', weeklyBestE1rm: [100, 102, 103] }])).toBe(0);
  });

  it('holiday weeks (no sessions → 0) are skipped, not counted as stalls', () => {
    expect(stalledMainLifts([{ name: 'Bench', weeklyBestE1rm: [80, 0, 80, 0, 79] }])).toBe(1);
  });

  it('too little history is no stall', () => {
    expect(stalledMainLifts([{ name: 'Deadlift', weeklyBestE1rm: [140, 140] }])).toBe(0);
  });
});

describe('plannedRestDays — the program feeds the streak rule', () => {
  const program: Program = { id: 'p1', startedOn: '2026-08-03', trainingDays: [1, 3, 5], active: true }; // Mon/Wed/Fri

  it('non-training weekdays inside the window are planned rest', () => {
    const rest = plannedRestDays(program, new Date(2026, 7, 3), new Date(2026, 7, 9));
    expect(rest.has('2026-08-04')).toBe(true);  // Tue
    expect(rest.has('2026-08-03')).toBe(false); // Mon — training day
    expect(rest.has('2026-08-05')).toBe(false); // Wed
    expect(rest.has('2026-08-08')).toBe(true);  // Sat
    expect(rest.has('2026-08-09')).toBe(true);  // Sun
  });

  it('days before the program started are not planned rest', () => {
    const rest = plannedRestDays(program, new Date(2026, 7, 1), new Date(2026, 7, 4));
    expect(rest.has('2026-08-01')).toBe(false);
    expect(rest.has('2026-08-02')).toBe(false);
    expect(rest.has('2026-08-04')).toBe(true);
  });
});
