import { describe, it, expect } from 'vitest';
import { bigThree } from './big-three';

describe('bigThree', () => {
  it('finds the competition lifts and totals only when all three exist', () => {
    const r = bigThree([
      { name: 'Barbell Back Squat', e1rm: 140 },
      { name: 'Barbell Bench Press', e1rm: 100 },
      { name: 'Deadlift', e1rm: 180 },
      { name: 'Front Squat', e1rm: 120 },
    ]);
    expect(r.squat!.e1rm).toBe(140);
    expect(r.total).toBe(420);
  });

  it('variations never pose as the competition lifts', () => {
    const r = bigThree([
      { name: 'Front Squat', e1rm: 120 },
      { name: 'Incline Bench Press', e1rm: 90 },
      { name: 'Romanian Deadlift', e1rm: 150 },
    ]);
    expect(r).toEqual({ squat: null, bench: null, deadlift: null, total: null });
  });

  it('sumo deadlift counts, as in the sport; no partial totals', () => {
    const r = bigThree([
      { name: 'Sumo Deadlift', e1rm: 200 },
      { name: 'Bench Press', e1rm: 110 },
    ]);
    expect(r.deadlift!.e1rm).toBe(200);
    expect(r.total).toBeNull();
  });
});
