import { describe, it, expect } from 'vitest';
import { growthScore, stageFor, scoreText, GROWTH_RULES, STAGE_THRESHOLDS, GROWTH_WINDOW_DAYS } from './model';

describe('pebble growth — one published score, five stages, regression visible', () => {
  it('score is the plain published ratio, inputs clamped to the window', () => {
    expect(growthScore({ loggingDays30: 30, trainingDays30: 30, sleepDays30: 30 })).toBe(1);
    expect(growthScore({ loggingDays30: 15, trainingDays30: 15, sleepDays30: 15 })).toBe(0.5);
    expect(growthScore({ loggingDays30: 99, trainingDays30: 0, sleepDays30: 0 })).toBeCloseTo(1 / 3, 5);
    expect(growthScore({ loggingDays30: -5, trainingDays30: 0, sleepDays30: 0 })).toBe(0);
  });

  it('stages flip exactly at the published thresholds — up AND down', () => {
    expect(stageFor(0)).toBe(1);
    expect(stageFor(0.199)).toBe(1);
    expect(stageFor(0.2)).toBe(2);
    expect(stageFor(0.4)).toBe(3);
    expect(stageFor(0.6)).toBe(4);
    expect(stageFor(0.8)).toBe(5);
    expect(stageFor(0.79)).toBe(4); // regression is just the same function
  });

  it('the rules name the window, the divisor and every threshold', () => {
    const joined = GROWTH_RULES.join(' ');
    expect(joined).toContain(String(GROWTH_WINDOW_DAYS * 3));
    for (const t of STAGE_THRESHOLDS.slice(1)) expect(joined).toContain(`${t * 100}%`);
    expect(joined).toContain('falls when the score falls');
  });

  it('score text is a plain rounded percent', () => {
    expect(scoreText(0.666)).toBe('67%');
  });
});
