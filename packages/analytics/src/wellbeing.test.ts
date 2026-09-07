import { describe, it, expect } from 'vitest';
import type { Checkin } from './checkins';
import { SCALE_WORDS, scaleWord, stressProposal, stripChars } from './wellbeing';

const day = (offset: number, over: Partial<Checkin>): Checkin => {
  const d = new Date('2026-09-07');
  d.setDate(d.getDate() - offset);
  return { date: d.toISOString().slice(0, 10), factors: [], mood: null, energy: null, stress: null, note: null, ...over };
};

describe('wellbeing scales — words, not faces', () => {
  it('the five words are exactly Low · Flat · OK · Good · High', () => {
    expect([...SCALE_WORDS]).toEqual(['Low', 'Flat', 'OK', 'Good', 'High']);
    expect(scaleWord(1)).toBe('Low');
    expect(scaleWord(5)).toBe('High');
    expect(scaleWord(null)).toBe('·');
  });

  it('no emoji or face characters anywhere in the module', () => {
    const src = require('node:fs').readFileSync(require.resolve('./wellbeing.ts'), 'utf8');
    expect(src).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it('the strip is one char per day, absent days as a middot', () => {
    const strip = stripChars([day(0, { mood: 4 }), day(2, { mood: 1 })], 'mood', 5, '2026-09-07');
    expect(strip).toBe('··L·G');
    expect(strip).toHaveLength(5);
  });
});

describe('the stress rule — fact + offer, no commentary about the person', () => {
  it('stress 4-5 on four of seven days proposes a lighter session', () => {
    const p = stressProposal([0, 1, 2, 3].map((i) => day(i, { stress: 4 })), '2026-09-07');
    expect(p?.text).toContain('4 of the last 7 days');
    expect(p?.text).toContain('lighter');
  });

  it('mood ≤2 on three of seven days proposes the same', () => {
    const p = stressProposal([0, 2, 4].map((i) => day(i, { mood: 2 })), '2026-09-07');
    expect(p?.text).toContain('3 of the last 7 days');
  });

  it('below both thresholds proposes nothing', () => {
    expect(stressProposal([0, 1, 2].map((i) => day(i, { stress: 5 })), '2026-09-07')).toBeNull();
    expect(stressProposal([0, 1].map((i) => day(i, { mood: 1 })), '2026-09-07')).toBeNull();
    expect(stressProposal([], '2026-09-07')).toBeNull();
  });

  it('forbidden phrasings are pinned out: no "you seem", no "cheer up", no "great job"', () => {
    const p = stressProposal([0, 1, 2, 3].map((i) => day(i, { stress: 5 })), '2026-09-07');
    for (const banned of [/you seem/i, /cheer up/i, /great job/i, /don.t worry/i, /!/]) {
      expect(p?.text).not.toMatch(banned);
    }
    const src = require('node:fs').readFileSync(require.resolve('./wellbeing.ts'), 'utf8');
    expect(src).not.toMatch(/you seem|cheer up|great job/i);
  });

  it('an old bad week outside the window does not fire', () => {
    expect(stressProposal([10, 11, 12, 13].map((i) => day(i, { stress: 5 })), '2026-09-07')).toBeNull();
  });
});
