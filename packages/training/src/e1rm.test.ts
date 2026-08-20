import { describe, it, expect } from 'vitest';
import { e1rm, bestE1rm, isSetPr, sessionVolumeKg, setsByMuscle, prevSummary } from './e1rm';
import type { SetEntry } from './types';

function set(partial: Partial<SetEntry>): SetEntry {
  return {
    id: 's', sessionExerciseId: 'se', userId: 'u', setNumber: 1, setType: 'normal',
    reps: null, weightKg: null, durationS: null, rir: null, rpe: null, restS: null,
    comment: null, completedAt: '2026-08-20T10:00:00Z',
    ...partial,
  };
}

describe('e1rm (Epley, published formula)', () => {
  it('matches the prototype: 75 kg × 8 → 95, incline-bench territory', () => {
    expect(e1rm(75, 8)).toBe(95);
  });
  it('a single is its own 1RM', () => {
    expect(e1rm(100, 1)).toBe(100);
  });
  it('returns null instead of estimating from junk', () => {
    expect(e1rm(null, 8)).toBeNull();
    expect(e1rm(75, null)).toBeNull();
    expect(e1rm(0, 8)).toBeNull();
    expect(e1rm(75, 0)).toBeNull();
    expect(e1rm(60, 20)).toBeNull(); // beyond the rep cap — no fake precision
  });
});

describe('bestE1rm', () => {
  it('takes the best working set and ignores warm-ups', () => {
    const sets = [
      set({ setType: 'warmup', weightKg: 200, reps: 1 }),
      set({ weightKg: 75, reps: 8 }),   // e1RM 95
      set({ weightKg: 77.5, reps: 8 }), // e1RM 98.2 — the best
    ];
    expect(bestE1rm(sets)).toBe(e1rm(77.5, 8));
    expect(bestE1rm(sets)).toBe(98.2);
  });
  it('is null with no usable sets', () => {
    expect(bestE1rm([])).toBeNull();
    expect(bestE1rm([set({ durationS: 50 })])).toBeNull();
  });
});

describe('isSetPr — the quiet PR mark', () => {
  const history = [set({ weightKg: 72.5, reps: 8 })]; // e1RM 91.8

  it('marks a set that beats the historical best', () => {
    expect(isSetPr(set({ weightKg: 75, reps: 8 }), history)).toBe(true);
  });
  it('does not mark equal or lesser efforts', () => {
    expect(isSetPr(set({ weightKg: 72.5, reps: 8 }), history)).toBe(false);
    expect(isSetPr(set({ weightKg: 70, reps: 8 }), history)).toBe(false);
  });
  it('never marks warm-ups or first-ever sessions', () => {
    expect(isSetPr(set({ setType: 'warmup', weightKg: 100, reps: 5 }), history)).toBe(false);
    expect(isSetPr(set({ weightKg: 75, reps: 8 }), [])).toBe(false);
  });
});

describe('sessionVolumeKg', () => {
  it('sums weight × reps, skipping duration-only sets', () => {
    const sets = [
      set({ weightKg: 75, reps: 8 }),
      set({ weightKg: 75, reps: 8 }),
      set({ durationS: 50 }),
    ];
    expect(sessionVolumeKg(sets)).toBe(1200);
  });
});

describe('setsByMuscle — the body map, from real history', () => {
  it('counts working sets per primary muscle and skips warm-ups', () => {
    const rows = [
      { primaryMuscles: ['chest'], setType: 'normal' as const },
      { primaryMuscles: ['chest'], setType: 'normal' as const },
      { primaryMuscles: ['chest', 'triceps'], setType: 'dropset' as const },
      { primaryMuscles: ['chest'], setType: 'warmup' as const },
    ];
    expect(setsByMuscle(rows)).toEqual({ chest: 3, triceps: 1 });
  });
});

describe('prevSummary', () => {
  it('renders the prototype note: "4 × 8 @ 72.5 kg"', () => {
    const sets = [1, 2, 3, 4].map((n) => set({ setNumber: n, weightKg: 72.5, reps: 8 }));
    expect(prevSummary(sets)).toBe('4 × 8 @ 72.5 kg');
  });
  it('shows a rep range when top-weight reps varied', () => {
    const sets = [
      set({ setNumber: 1, weightKg: 30, reps: 10 }),
      set({ setNumber: 2, weightKg: 30, reps: 10 }),
      set({ setNumber: 3, weightKg: 30, reps: 9 }),
    ];
    expect(prevSummary(sets)).toBe('3 × 9–10 @ 30 kg');
  });
  it('returns null with no working history — the UI ghosts nothing', () => {
    expect(prevSummary([])).toBeNull();
    expect(prevSummary([set({ setType: 'warmup', weightKg: 40, reps: 10 })])).toBeNull();
  });
});
