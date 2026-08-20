import { describe, it, expect } from 'vitest';
import { PROTOCOLS, cycleSeconds, phaseAt, weeklyWeightRate, sparkPoints } from './model';

const box = PROTOCOLS[0]!;
const downshift = PROTOCOLS[1]!;

describe('breathing protocols', () => {
  it('carries the three prototype protocols with their timings', () => {
    expect(box.phases).toEqual([4, 4, 4, 4]);
    expect(downshift.phases).toEqual([4, 7, 8, 0]);
    expect(cycleSeconds(box)).toBe(16);
    expect(cycleSeconds(downshift)).toBe(19);
  });

  it('phaseAt walks inhale → hold → exhale → hold', () => {
    expect(phaseAt(box, 0)).toEqual({ label: 'Inhale', remaining: 4 });
    expect(phaseAt(box, 4)).toEqual({ label: 'Hold', remaining: 4 });
    expect(phaseAt(box, 9)).toEqual({ label: 'Exhale', remaining: 3 });
    expect(phaseAt(box, 15)).toEqual({ label: 'Hold', remaining: 1 });
    expect(phaseAt(box, 16)).toEqual({ label: 'Inhale', remaining: 4 }); // wraps
  });

  it('skips zero-length phases (4-7-8 has no post-exhale hold)', () => {
    expect(phaseAt(downshift, 18.5).label).toBe('Exhale');
    expect(phaseAt(downshift, 19).label).toBe('Inhale');
  });
});

describe('weeklyWeightRate', () => {
  const day = (n: number, kg: number) => ({
    measuredAt: new Date(Date.now() - n * 86_400_000).toISOString(),
    weightKg: kg,
  });

  it('reads a steady loss as a negative weekly rate', () => {
    const entries = [day(13, 82.3), day(10, 82.0), day(7, 81.9), day(4, 81.6), day(1, 81.4)];
    const rate = weeklyWeightRate(entries);
    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(0);
    expect(rate!).toBeGreaterThan(-0.8);
  });

  it('two dots make a line, not a trend — null under 3 points or 7 days', () => {
    expect(weeklyWeightRate([day(1, 81), day(0, 80)])).toBeNull();
    expect(weeklyWeightRate([day(2, 81), day(1, 81.1), day(0, 80.9)])).toBeNull();
  });
});

describe('sparkPoints', () => {
  it('normalizes to 0–1 and handles a flat series', () => {
    expect(sparkPoints([{ weightKg: 80 }, { weightKg: 82 }, { weightKg: 81 }])).toEqual([0, 1, 0.5]);
    expect(sparkPoints([{ weightKg: 80 }, { weightKg: 80 }])).toEqual([0.5, 0.5]);
    expect(sparkPoints([{ weightKg: 80 }])).toEqual([]);
  });
});
