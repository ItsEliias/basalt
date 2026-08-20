import { describe, it, expect } from 'vitest';
import { repPrMatrix, type PrSet } from './pr-matrix';
import { warmupSets } from './plates';

const s = (weightKg: number | null, reps: number | null, setType = 'normal', completedAt = '2026-08-01'): PrSet =>
  ({ setType, reps, weightKg, completedAt });

describe('repPrMatrix', () => {
  it('keeps the best weight per rep count with its date', () => {
    const prs = repPrMatrix([
      s(100, 5, 'normal', '2026-07-01'),
      s(105, 5, 'normal', '2026-08-01'),
      s(90, 8, 'normal', '2026-06-10'),
    ]);
    expect(prs).toEqual([
      { reps: 5, weightKg: 105, date: '2026-08-01' },
      { reps: 8, weightKg: 90, date: '2026-06-10' },
    ]);
  });

  it('real-or-hidden: untrained rep counts do not appear, nothing interpolated', () => {
    const prs = repPrMatrix([s(100, 5)]);
    expect(prs).toHaveLength(1);
    expect(prs.find((p) => p.reps === 6)).toBeUndefined();
  });

  it('warmups, unweighted and out-of-range sets are excluded', () => {
    const prs = repPrMatrix([
      s(60, 5, 'warmup'),
      s(null, 10),
      s(40, 30), // above maxReps 12
      s(0, 8),
    ]);
    expect(prs).toEqual([]);
  });
});

describe('warmupSets — the published ramp', () => {
  it('100 kg: bar ×10 · 55 ×5 · 70 ×3 · 85 ×1', () => {
    expect(warmupSets(100)).toEqual([
      { kg: 20, reps: 10, label: 'empty bar' },
      { kg: 55, reps: 5, label: '55%' },
      { kg: 70, reps: 3, label: '70%' },
      { kg: 85, reps: 1, label: '85%' },
    ]);
  });

  it('rounds each step to 2.5 kg', () => {
    const steps = warmupSets(87.5);
    for (const step of steps) expect((step.kg * 10) % 25).toBe(0);
  });

  it('a light working weight gets a shorter ramp, not fictional variety', () => {
    const steps = warmupSets(40);
    // 55% → 22.5, 70% → 27.5(28→27.5), 85% → 35(34→35); all distinct and < 40
    expect(steps.length).toBeGreaterThanOrEqual(2);
    const kgs = steps.map((x) => x.kg);
    expect(new Set(kgs).size).toBe(kgs.length); // no duplicate steps
    for (const kg of kgs) expect(kg).toBeLessThan(40);
  });

  it('at or below bar weight: just the empty bar', () => {
    expect(warmupSets(20)).toEqual([{ kg: 20, reps: 10, label: 'empty bar' }]);
  });
});
