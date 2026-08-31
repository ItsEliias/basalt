import { describe, it, expect } from 'vitest';
import {
  riegelPredict, trainingPaces, buildRacePlan, rampBack, raceTimeText,
  RIEGEL_EXPONENT, PACE_MULTIPLIERS, PLAN_WEEKS_MIN, PLAN_WEEKS_MAX,
  RACE_DISTANCES_M, LONG_RUN_KM,
} from './race-plans';

describe('riegelPredict', () => {
  it('pins the published exponent', () => {
    expect(RIEGEL_EXPONENT).toBe(1.06);
  });

  it('25:00 5k → ~52:06 10k (the classic Riegel check)', () => {
    const t = riegelPredict(5000, 25 * 60, 10000);
    expect(t).toBeGreaterThan(51.5 * 60);
    expect(t).toBeLessThan(52.5 * 60);
  });

  it('same distance returns the same time — the model is anchored', () => {
    expect(riegelPredict(5000, 1500, 5000)).toBe(1500);
  });
});

describe('trainingPaces', () => {
  it('published multiples of predicted race pace', () => {
    const p = trainingPaces(5000, 25 * 60, '5k');
    expect(p.raceSecPerKm).toBe(300);
    expect(p.easySecPerKm).toBe(Math.round(300 * PACE_MULTIPLIERS.easy));
    expect(p.steadySecPerKm).toBe(Math.round(300 * PACE_MULTIPLIERS.steady));
  });
});

describe('buildRacePlan', () => {
  const paces = trainingPaces(5000, 25 * 60, '10k');

  it('clamps to the published 6–16 week band', () => {
    expect(buildRacePlan('10k', 2, paces)).toHaveLength(PLAN_WEEKS_MIN);
    expect(buildRacePlan('10k', 40, paces)).toHaveLength(PLAN_WEEKS_MAX);
  });

  it('three sessions a week, long run builds to peak then tapers', () => {
    const plan = buildRacePlan('10k', 8, paces);
    expect(plan.every((w) => w.sessions.length === 3)).toBe(true);
    const longKm = (i: number) => Number(plan[i]!.sessions[2]!.label.match(/(\d+) km/)![1]);
    expect(longKm(0)).toBe(LONG_RUN_KM['10k'].start);
    expect(longKm(6)).toBe(LONG_RUN_KM['10k'].peak);       // second-to-last = peak
    expect(plan[7]!.taper).toBe(true);
    expect(longKm(7)).toBe(Math.round(LONG_RUN_KM['10k'].peak * 0.6));
  });

  it('session details carry the derived pace, marked ~', () => {
    const plan = buildRacePlan('10k', 8, paces);
    expect(plan[0]!.sessions[0]!.detail).toMatch(/^~\d+:\d{2}\/km/);
  });
});

describe('rampBack — the published catch-up rule', () => {
  it('on schedule or ahead → continue', () => {
    expect(rampBack(3, 2)).toEqual({ action: 'continue' });
    expect(rampBack(3, 3)).toEqual({ action: 'continue' });
  });

  it('one week behind → repeat the last completed week', () => {
    const r = rampBack(4, 2);
    expect(r.action).toBe('repeat');
    expect((r as any).week).toBe(2);
  });

  it('more than a week behind → step back two weeks from the stop point', () => {
    const r = rampBack(6, 2);
    expect(r.action).toBe('step_back');
    expect((r as any).week).toBe(1);
  });

  it('never scolds — notes state the rule, not a judgement', () => {
    const banned = /(should have|failed|lazy|shame|behind schedule!)/i;
    expect((rampBack(4, 2) as any).note).not.toMatch(banned);
    expect((rampBack(9, 2) as any).note).not.toMatch(banned);
  });

  it('fresh plan with nothing done stays at week 0', () => {
    expect(rampBack(0, -1)).toEqual({ action: 'continue' });
    const r = rampBack(3, -1);
    expect((r as any).week).toBe(0);
  });
});

describe('raceTimeText', () => {
  it('mm:ss under the hour, h:mm:ss over', () => {
    expect(raceTimeText(52 * 60 + 6)).toBe('52:06');
    expect(raceTimeText(3 * 3600 + 44 * 60 + 2)).toBe('3:44:02');
  });
});

describe('published tables', () => {
  it('four races with real distances', () => {
    expect(RACE_DISTANCES_M.half).toBeCloseTo(21097.5);
    expect(RACE_DISTANCES_M.marathon).toBe(42195);
  });
});
