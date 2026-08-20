import { describe, it, expect } from 'vitest';
import {
  initialState, nextStep, prevStep, buildProfile, buildTargetInput,
  weightKgFrom, heightCmFrom, activityLevelFrom, TOTAL_STEPS,
  GOAL_OPTIONS, EQUIPMENT_OPTIONS, HABIT_ROWS, ALLERGY_OPTIONS, DIET_OPTIONS,
  CONDITION_OPTIONS, MEDICATION_OPTIONS,
} from './model';
import { ctaReachableAt, COMMON_VIEWPORT_HEIGHTS, fixedChromeHeight, OB_LAYOUT } from './layout';

describe('step content matches the prototype', () => {
  it('carries all six goals, sixteen equipment items, seven habit rows', () => {
    expect(GOAL_OPTIONS).toHaveLength(6);
    expect(EQUIPMENT_OPTIONS).toHaveLength(16);
    expect(HABIT_ROWS).toHaveLength(7);
    expect(ALLERGY_OPTIONS).toHaveLength(12);
    expect(DIET_OPTIONS).toHaveLength(9);
    expect(CONDITION_OPTIONS).toContain('Recovering from surgery');
    expect(MEDICATION_OPTIONS.some((m) => m.startsWith('GLP-1'))).toBe(true);
  });
});

describe('conditional flow — gym skips the equipment step', () => {
  it('gym: 6 → 8, and back 8 → 6', () => {
    const s = { ...initialState, place: 'gym' as const };
    expect(nextStep(6, s)).toBe(8);
    expect(prevStep(8, s)).toBe(6);
  });
  it('home/both walk through 7', () => {
    expect(nextStep(6, { ...initialState, place: 'home' })).toBe(7);
    expect(nextStep(6, { ...initialState, place: 'both' })).toBe(7);
    expect(prevStep(8, { ...initialState, place: 'home' })).toBe(7);
  });
  it('never leaves the 1..8 range', () => {
    expect(nextStep(TOTAL_STEPS, initialState)).toBe(TOTAL_STEPS);
    expect(prevStep(1, initialState)).toBe(1);
  });
});

describe('unit conversion', () => {
  it('metric passes through', () => {
    const s = { ...initialState, weight: '81.4', height: '181' };
    expect(weightKgFrom(s)).toBe(81.4);
    expect(heightCmFrom(s)).toBe(181);
  });
  it('imperial converts lb → kg and in → cm', () => {
    const s = { ...initialState, units: 'Imperial — lb · in', weight: '180', height: '71' };
    expect(weightKgFrom(s)).toBeCloseTo(81.6, 1);
    expect(heightCmFrom(s)).toBeCloseTo(180.3, 1);
  });
  it('junk input yields null, never NaN', () => {
    expect(weightKgFrom({ ...initialState, weight: 'abc' })).toBeNull();
    expect(weightKgFrom({ ...initialState, weight: '-5' })).toBeNull();
  });
});

describe('buildProfile', () => {
  it('strips the "nothing" sentinels and gym equipment', () => {
    const p = buildProfile({
      ...initialState,
      conditions: ['Nothing to note', 'Asthma'],
      medications: ['None / skip'],
      place: 'gym',
      equipment: ['Dumbbells'],
    });
    expect(p.conditions).toEqual(['Asthma']);
    expect(p.medications).toEqual([]);
    expect(p.equipment).toEqual([]);
  });

  it('maps chip labels to engine keys', () => {
    const p = buildProfile({
      ...initialState,
      sex: 'Prefer not to say',
      job: 'On your feet',
      exercising: '3–4×',
      checkin: 'Weekly digest only',
      units: 'Imperial — lb · in',
    });
    expect(p.biologicalSex).toBe('prefer_not_to_say');
    expect(p.jobActivity).toBe('feet');
    expect(p.activityLevel).toBe('moderate');
    expect(p.checkinPreference).toBe('weekly');
    expect(p.useMetric).toBe(false);
  });
});

describe('buildTargetInput — honest absence over guessed targets', () => {
  const complete = {
    ...initialState,
    age: '30', height: '181', weight: '81.4', sex: 'Male',
    goals: ['lose' as const, 'health' as const],
    exercising: '3–4×', job: 'At a desk',
    habits: { sugaryDrinks: 'Daily', alcohol: 'Social' },
    diets: ['Low sodium'],
  };

  it('produces engine input from a complete intake', () => {
    const t = buildTargetInput(complete);
    expect(t).toMatchObject({
      biologicalSex: 'male', age: 30, heightCm: 181, weightKg: 81.4,
      activityLevel: 'moderate', goals: ['lose', 'health'],
      habits: { sugaryDrinks: 'daily', alcohol: 'social' },
      dietPatterns: ['Low sodium'], jobActivity: 'desk',
    });
  });

  it('returns null when essentials were skipped — no fabricated targets', () => {
    expect(buildTargetInput({ ...complete, weight: '' })).toBeNull();
    expect(buildTargetInput({ ...complete, sex: null })).toBeNull();
    expect(buildTargetInput({ ...complete, age: '' })).toBeNull();
  });
});

describe('activity mapping (ported brackets)', () => {
  it('maps every option', () => {
    expect(activityLevelFrom('Not yet')).toBe('sedentary');
    expect(activityLevelFrom('1–2× a week')).toBe('light');
    expect(activityLevelFrom('3–4×')).toBe('moderate');
    expect(activityLevelFrom('5+')).toBe('very');
    expect(activityLevelFrom(null)).toBe('sedentary');
  });
});

describe('CTA-reachability contract (the bug that shipped once)', () => {
  it('the fixed chrome + usable scroll area fit every common viewport', () => {
    for (const h of COMMON_VIEWPORT_HEIGHTS) {
      expect(ctaReachableAt(h), `CTA must be on-screen at ${h}px`).toBe(true);
    }
  });

  it('chrome stays under the smallest common viewport minus the scroll floor', () => {
    expect(fixedChromeHeight()).toBeLessThanOrEqual(568 - OB_LAYOUT.minScrollArea);
  });

  it('would catch a regression that bloats the fixed chrome', () => {
    const bloated = { ...OB_LAYOUT, question: OB_LAYOUT.question + 120 };
    expect(ctaReachableAt(568, bloated)).toBe(false);
  });
});
