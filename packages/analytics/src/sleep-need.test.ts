import { describe, it, expect } from 'vitest';
import {
  SLEEP_NEED_RULES, personalSleepNeed, strainAdjustedNeed, sleepDebt,
  lastNightLine, debtLine,
} from './sleep-need';

describe('personal sleep need — your own median or an honest default', () => {
  it('under 14 nights: the published default, and it says so', () => {
    const n = personalSleepNeed([450, 470, 480]);
    expect(n.needMin).toBe(480);
    expect(n.personal).toBe(false);
    expect(n.basis).toContain('published default');
    expect(n.basis).toContain('3 so far');
  });

  it('14+ nights: the median of your own history', () => {
    const nights = Array(14).fill(450);
    const n = personalSleepNeed(nights);
    expect(n.needMin).toBe(450);
    expect(n.personal).toBe(true);
    expect(n.basis).toContain('median of your last 14 nights');
  });

  it('clamps to the published band and states the clamp', () => {
    expect(personalSleepNeed(Array(14).fill(360)).needMin).toBe(SLEEP_NEED_RULES.clampMin);
    expect(personalSleepNeed(Array(14).fill(700)).needMin).toBe(SLEEP_NEED_RULES.clampMax);
    expect(personalSleepNeed(Array(14).fill(700)).basis).toContain('clamped');
  });

  it('zero-length nights are absence, not data', () => {
    const n = personalSleepNeed([0, 0, ...Array(13).fill(480)]);
    expect(n.personal).toBe(false); // only 13 real nights
  });

  it('rules are pinned', () => {
    expect(SLEEP_NEED_RULES.defaultNeedMin).toBe(480);
    expect(SLEEP_NEED_RULES.minNightsForPersonal).toBe(14);
    expect(SLEEP_NEED_RULES.debtWindowDays).toBe(14);
    expect(SLEEP_NEED_RULES.strainExtraMin).toBe(30);
  });
});

describe('strain adjustment — reuses the readiness load framing', () => {
  it('a P75-heavy prior day adds 30 minutes', () => {
    expect(strainAdjustedNeed(480, 12000, 10000)).toEqual({ needMin: 510, strained: true });
  });

  it('lighter days and unknown baselines change nothing', () => {
    expect(strainAdjustedNeed(480, 8000, 10000)).toEqual({ needMin: 480, strained: false });
    expect(strainAdjustedNeed(480, 8000, null)).toEqual({ needMin: 480, strained: false });
  });
});

describe('sleep debt — surplus repays, floor at zero, absence stays absent', () => {
  it('accumulates shortfall against need', () => {
    const d = sleepDebt([
      { sleptMin: 420, needMin: 480 },
      { sleptMin: 420, needMin: 480 },
    ]);
    expect(d.debtMin).toBe(120);
    expect(d.nightsSeen).toBe(2);
  });

  it('surplus nights repay debt', () => {
    const d = sleepDebt([
      { sleptMin: 420, needMin: 480 },
      { sleptMin: 540, needMin: 480 },
    ]);
    expect(d.debtMin).toBe(0);
  });

  it('never goes below zero — sleep is not bankable credit', () => {
    expect(sleepDebt([{ sleptMin: 600, needMin: 480 }]).debtMin).toBe(0);
  });

  it('only the last 14 nights count', () => {
    const nights = Array(20).fill({ sleptMin: 450, needMin: 480 });
    const d = sleepDebt(nights);
    expect(d.nightsSeen).toBe(14);
    expect(d.debtMin).toBe(14 * 30);
  });
});

describe('the phrasing — need/debt words, never a score', () => {
  it('states what you got against what you needed', () => {
    expect(lastNightLine(410, 490)).toBe('You got 6:50 of the 8:10 your body needed');
  });

  it('debt lines name the visible nights', () => {
    expect(debtLine({ debtMin: 95, nightsSeen: 12, windowDays: 14 })).toBe(
      '1:35 behind across the last 12 of 14 nights recorded',
    );
    expect(debtLine({ debtMin: 0, nightsSeen: 14, windowDays: 14 })).toContain('No sleep debt');
    expect(debtLine({ debtMin: 0, nightsSeen: 0, windowDays: 14 })).toContain('no debt number without nights');
  });
});
