import { describe, it, expect } from 'vitest';
import { computeReadiness, baselineBand, median, p75 } from './readiness';

const base = {
  todayHrv: 60, hrvBaseline: Array(30).fill(60),
  todayRhr: 55, rhrBaseline: Array(30).fill(55),
  lastNightSleepMin: 480, sleepTargetMin: 480,
  priorDayVolumeKg: 0, volumeBaseline: [8000, 10000, 12000, 9000, 11000, 10000, 9500, 10500],
};

describe('computeReadiness — the published formula', () => {
  it('a perfectly average day with full sleep and rest scores high, with the math shown', () => {
    const r = computeReadiness(base);
    // hrv ratio 1.0 → 12.5→13; rhr 13; sleep 25; load 25 → (76/100)*100
    expect(r.score).toBe(76);
    expect(r.components.find((c) => c.key === 'hrv')!.detail).toContain('ratio 1.00');
    expect(r.components.find((c) => c.key === 'load')!.detail).toBe('rest day — full points');
  });

  it('better-than-usual HRV and RHR raise the score; a heavy prior day lowers it', () => {
    const up = computeReadiness({ ...base, todayHrv: 84, todayRhr: 46 }); // ratios ~1.4 → 25s
    expect(up.score).toBeGreaterThan(90);
    const heavy = computeReadiness({ ...base, priorDayVolumeKg: 12000 });
    expect(heavy.score).toBe(51); // load component → 0
  });

  it('real-or-hidden: fewer than 3 components → no number at all', () => {
    const r = computeReadiness({
      ...base, todayHrv: null, hrvBaseline: [], todayRhr: null, rhrBaseline: [], lastNightSleepMin: null,
    });
    expect(r.score).toBeNull();
    expect(r.note).toContain('no number');
  });

  it('thin baselines refuse to pretend: <7 days of HRV → component null with the why', () => {
    const r = computeReadiness({ ...base, hrvBaseline: [60, 61, 59] });
    const hrv = r.components.find((c) => c.key === 'hrv')!;
    expect(hrv.points).toBeNull();
    expect(hrv.detail).toContain('7+ baseline days');
  });

  it('3-of-4 days rescale honestly and the note names it', () => {
    const r = computeReadiness({ ...base, todayHrv: null });
    expect(r.score).toBe(84); // (13+25+25)/75
    expect(r.note).toContain('3 of 4');
  });
});

describe('baseline helpers', () => {
  it('median and p75 are exact', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(p75([1, 2, 3, 4])).toBe(4);
  });

  it('bands need 7 real days — no band from thin air', () => {
    expect(baselineBand([50, 52])).toBeNull();
    expect(baselineBand([50, 52, 54, 56, 58, 60, 62])).toEqual({ min: 50, median: 56, max: 62 });
  });
});
