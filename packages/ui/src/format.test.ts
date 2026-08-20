import { describe, it, expect } from 'vitest';
import { groupInt, capState, fillPct, mmss, paceText, hoursMinutes, approxValue, kgText } from './format';

describe('groupInt', () => {
  it('groups thousands and rounds', () => {
    expect(groupInt(2340)).toBe('2,340');
    expect(groupInt(612.4)).toBe('612');
    expect(groupInt(8412)).toBe('8,412');
  });
});

describe('capState — the honest over-state', () => {
  it('states an over-cap plainly with the exact overage', () => {
    // The prototype's canonical case: 41 / 36 g · 5 over.
    expect(capState(41, 36)).toEqual({ over: true, overBy: 5, fillPct: 100 });
  });

  it('is not over at exactly the cap', () => {
    const s = capState(36, 36);
    expect(s.over).toBe(false);
    expect(s.overBy).toBe(0);
    expect(s.fillPct).toBe(100);
  });

  it('reports partial fill under the cap', () => {
    const s = capState(1.6, 2.3);
    expect(s.over).toBe(false);
    expect(s.fillPct).toBeCloseTo(69.57, 1);
  });

  it('never reads "0 over" from display rounding', () => {
    // 36.04 displays as 36 — must not claim "over".
    expect(capState(36.04, 36).over).toBe(false);
  });
});

describe('fillPct', () => {
  it('clamps to 0–100', () => {
    expect(fillPct(142, 180)).toBeCloseTo(78.9, 1);
    expect(fillPct(200, 100)).toBe(100);
    expect(fillPct(-5, 100)).toBe(0);
  });
  it('handles a zero target without dividing by zero', () => {
    expect(fillPct(10, 0)).toBe(100);
    expect(fillPct(0, 0)).toBe(0);
  });
});

describe('mmss', () => {
  it('formats rest-timer style', () => {
    expect(mmss(84)).toBe('01:24');
    expect(mmss(0)).toBe('00:00');
    expect(mmss(600)).toBe('10:00');
  });
  it('never goes negative', () => {
    expect(mmss(-5)).toBe('00:00');
  });
});

describe('paceText', () => {
  it('formats seconds-per-km as M:SS', () => {
    expect(paceText(544)).toBe('9:04');
    expect(paceText(522)).toBe('8:42');
  });
  it('shows an em dash for unusable input instead of a fake number', () => {
    expect(paceText(0)).toBe('—');
    expect(paceText(NaN)).toBe('—');
    expect(paceText(Infinity)).toBe('—');
  });
});

describe('hoursMinutes', () => {
  it('splits sleep minutes', () => {
    expect(hoursMinutes(441)).toEqual({ h: 7, m: 21 });
    expect(hoursMinutes(0)).toEqual({ h: 0, m: 0 });
  });
});

describe('approxValue — the ~ rule', () => {
  it('wears the tilde until confirmed', () => {
    expect(approxValue(612, false)).toBe('~612');
    expect(approxValue(612, true)).toBe('612');
  });
});

describe('kgText', () => {
  it('drops fake decimals on whole values, keeps one on real ones', () => {
    expect(kgText(81.4)).toBe('81.4');
    expect(kgText(75)).toBe('75');
    expect(kgText(72.5)).toBe('72.5');
  });
});
