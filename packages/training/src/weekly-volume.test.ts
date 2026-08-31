import { describe, it, expect } from 'vitest';
import { weeklyMuscleVolume, bandForPhase, volumeLine, WEEKLY_SET_BAND, SECONDARY_CREDIT } from './weekly-volume';

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
