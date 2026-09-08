import { describe, it, expect } from 'vitest';
import { weeklyMuscleVolume, bandForPhase, isHardSet, volumeLine, volumeProposals, WEEKLY_SET_BAND, SECONDARY_CREDIT, type RegionVolume } from './weekly-volume';

describe('weeklyMuscleVolume', () => {
  it('primary sets count 1.0, secondary 0.5 — half-credit published', () => {
    expect(SECONDARY_CREDIT).toBe(0.5);
    const v = weeklyMuscleVolume([
      { emphasis: { chest: 'primary', shoulders: 'secondary' }, sets: 10 },
    ]);
    expect(v.find((x) => x.region === 'chest')!.sets).toBe(10);
    expect(v.find((x) => x.region === 'shoulders')!.sets).toBe(5);
  });

  it('position is below / inside / above — a position, not a grade', () => {
    const v = weeklyMuscleVolume([
      { emphasis: { chest: 'primary' }, sets: 8 },
      { emphasis: { back: 'primary' }, sets: 15 },
      { emphasis: { quads: 'primary' }, sets: 25 },
    ]);
    expect(v.find((x) => x.region === 'chest')!.position).toBe('below');
    expect(v.find((x) => x.region === 'back')!.position).toBe('inside');
    expect(v.find((x) => x.region === 'quads')!.position).toBe('above');
  });

  it('regions sort by volume, most-trained first', () => {
    const v = weeklyMuscleVolume([
      { emphasis: { chest: 'primary' }, sets: 3 },
      { emphasis: { back: 'primary' }, sets: 9 },
    ]);
    expect(v.map((x) => x.region)).toEqual(['back', 'chest']);
  });

  it('an untrained region simply is not in the list — omission, not zero', () => {
    const v = weeklyMuscleVolume([{ emphasis: { chest: 'primary' }, sets: 5 }]);
    expect(v.some((x) => x.region === 'hamstrings')).toBe(false);
  });
});

describe('bandForPhase', () => {
  it(`the published band is ${WEEKLY_SET_BAND.low}–${WEEKLY_SET_BAND.high}; a deload halves it`, () => {
    expect(bandForPhase(null)).toEqual({ low: 10, high: 20 });
    expect(bandForPhase('accumulation')).toEqual({ low: 10, high: 20 });
    expect(bandForPhase('deload')).toEqual({ low: 5, high: 10 });
  });

  it('deload volume positions against the halved band', () => {
    const v = weeklyMuscleVolume([{ emphasis: { chest: 'primary' }, sets: 7 }], 'deload');
    expect(v[0]!.position).toBe('inside');
  });
});

describe('volumeLine', () => {
  it('states the count, the band, and the position — never advice', () => {
    const v = weeklyMuscleVolume([
      { emphasis: { chest: 'primary', shoulders: 'secondary' }, sets: 11 },
    ]);
    expect(volumeLine(v.find((x) => x.region === 'shoulders')!)).toBe('5.5 of 10–20 sets · below the band');
    expect(volumeLine(v.find((x) => x.region === 'chest')!)).toBe('11 of 10–20 sets · inside the band');
  });
});

describe('hard sets + the two-week rule (8-0)', () => {
  it('RIR ≤ 3 is hard; unknown counts as hard; RIR 4+ is not', () => {
    expect(isHardSet(0)).toBe(true);
    expect(isHardSet(3)).toBe(true);
    expect(isHardSet(null)).toBe(true);
    expect(isHardSet(undefined)).toBe(true);
    expect(isHardSet(4)).toBe(false);
  });

  const rv = (region: string, sets: number): RegionVolume => ({
    region: region as RegionVolume['region'], sets,
    bandLow: 10, bandHigh: 20,
    position: sets < 10 ? 'below' : sets > 20 ? 'above' : 'inside',
  });

  it('one odd week proposes nothing', () => {
    expect(volumeProposals([rv('chest', 6)], [rv('chest', 14)])).toEqual([]);
  });

  it('two weeks under → add a set, citing both weeks', () => {
    const p = volumeProposals([rv('chest', 7)], [rv('chest', 6)]);
    expect(p).toHaveLength(1);
    expect(p[0]!.kind).toBe('add-set');
    expect(p[0]!.reason).toContain('6, then 7');
  });

  it('two weeks over → drop a set, no scolding', () => {
    const p = volumeProposals([rv('back', 24)], [rv('back', 23)]);
    expect(p[0]!.kind).toBe('drop-set');
    expect(p[0]!.reason).not.toMatch(/too much|stop|excessive!/i);
  });

  it('inside weeks propose nothing', () => {
    expect(volumeProposals([rv('quads', 14)], [rv('quads', 15)])).toEqual([]);
  });
});
