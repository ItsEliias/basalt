import { describe, it, expect } from 'vitest';
import { stageFor, fastElapsed, FASTING_STAGES, FASTING_DISCLAIMER } from './fasting';

describe('fasting stages', () => {
  it('boundaries land where the documented ranges say', () => {
    expect(stageFor(0).label).toBe('Fed');
    expect(stageFor(3.9).label).toBe('Fed');
    expect(stageFor(4).label).toBe('Post-absorptive');
    expect(stageFor(12).label).toBe('Glycogen drawdown');
    expect(stageFor(16).label).toBe('Extended');
    expect(stageFor(24).label).toBe('Prolonged');
    expect(stageFor(72).label).toBe('Prolonged');
  });

  it('no pseudo-science vocabulary anywhere in the stages', () => {
    const text = FASTING_STAGES.map((s) => `${s.label} ${s.detail}`).join(' ').toLowerCase();
    for (const banned of ['detox', 'toxin', 'autophagy', 'miracle', 'boost', 'supercharge', 'cleanse']) {
      expect(text).not.toContain(banned);
    }
    expect(FASTING_DISCLAIMER).toContain('not medical advice');
  });

  it('the long tail points at medical guidance, not deeper fasting', () => {
    expect(stageFor(30).detail).toContain('medical guidance');
  });

  it('elapsed renders mono-style h:mm and never goes negative', () => {
    const start = '2026-08-21T06:00:00Z';
    expect(fastElapsed(start, Date.parse('2026-08-21T20:05:00Z')).text).toBe('14:05');
    expect(fastElapsed(start, Date.parse('2026-08-21T05:00:00Z')).text).toBe('0:00');
  });
});
