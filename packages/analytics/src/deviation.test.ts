import { describe, it, expect } from 'vitest';
import { DEVIATION_RULES, checkVital, composeDeviation, type VitalCheck } from './deviation';

const baseline = (n: number, lo: number, hi: number) =>
  Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / Math.max(1, n - 1));

describe('checkVital — outside your own 30-day range, or nothing', () => {
  it('deviates only outside the min–max band, either side', () => {
    expect(checkVital('rhr', 'Resting HR', 72, baseline(30, 52, 61)).deviates).toBe(true);
    expect(checkVital('rhr', 'Resting HR', 45, baseline(30, 52, 61)).deviates).toBe(true);
    expect(checkVital('rhr', 'Resting HR', 57, baseline(30, 52, 61)).deviates).toBe(false);
  });

  it('withholds under 7 baseline days — not counted as observed', () => {
    expect(checkVital('hrv', 'HRV', 40, baseline(6, 45, 70)).deviates).toBeNull();
  });

  it('no reading today is unobservable, not fine', () => {
    expect(checkVital('hrv', 'HRV', null, baseline(30, 45, 70)).deviates).toBeNull();
  });
});

describe('composeDeviation — quiet card at 2+, silence below', () => {
  const dev = (label: string): VitalCheck => ({
    key: label, label, today: 100, band: { min: 50, median: 60, max: 70 }, deviates: true,
  });
  const fine = (label: string): VitalCheck => ({
    key: label, label, today: 60, band: { min: 50, median: 60, max: 70 }, deviates: false,
  });
  const absent = (label: string): VitalCheck => ({
    key: label, label, today: null, band: null, deviates: null,
  });

  it('one outlier renders nothing — a Tuesday, not a pattern', () => {
    const r = composeDeviation([dev('HRV'), fine('Resting HR'), fine('Sleep')]);
    expect(r.headline).toBeNull();
  });

  it('two of three deviating shows the count against the OBSERVED total', () => {
    const r = composeDeviation([dev('HRV'), dev('Resting HR'), fine('Sleep'), absent('SpO2')]);
    expect(r.headline).toBe('2 of 3 vitals sit outside your typical range');
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toContain('above your 30-day range');
  });

  it('no diagnosis language anywhere — pinned', () => {
    const r = composeDeviation([dev('HRV'), dev('Resting HR')]);
    const all = [r.headline, ...r.lines, r.srcnote].join(' ').toLowerCase();
    for (const banned of ['diagnos', 'sick', 'ill', 'infection', 'flu', 'covid', 'fever', 'disease', 'symptom']) {
      expect(all).not.toContain(banned);
    }
  });

  it('thresholds pinned', () => {
    expect(DEVIATION_RULES).toEqual({ baselineDays: 30, minBaselineDays: 7, cardAt: 2 });
  });
});
