import { describe, it, expect } from 'vitest';
import {
  initialState, nextStep, prevStep, buildProfile, buildTargetInput,
  weightKgFrom, heightCmFrom, activityLevelFrom, TOTAL_STEPS,
  CORE_STEPS, EXTRA_SCREENS, extraScreenAt,
  GOAL_OPTIONS, EQUIPMENT_OPTIONS, HABIT_ROWS, ALLERGY_OPTIONS, DIET_OPTIONS,
  CONDITION_OPTIONS, MEDICATION_OPTIONS, buildPtIntake, MEDICAL_LINE,
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
    expect(nextStep(7, s)).toBe(9);
    expect(prevStep(9, s)).toBe(7);
  });
  it('home/both walk through 7', () => {
    expect(nextStep(7, { ...initialState, place: 'home' })).toBe(8);
    expect(nextStep(7, { ...initialState, place: 'both' })).toBe(8);
    expect(prevStep(9, { ...initialState, place: 'home' })).toBe(8);
  });
  it('never leaves the 1..TOTAL_STEPS range', () => {
    expect(nextStep(TOTAL_STEPS, initialState)).toBe(TOTAL_STEPS);
    expect(prevStep(1, initialState)).toBe(1);
  });
  it('the theme step (11) then detail (12) follow life; extras steps follow them', () => {
    expect(CORE_STEPS).toBe(12);
    expect(TOTAL_STEPS).toBe(CORE_STEPS + EXTRA_SCREENS.length);
    expect(EXTRA_SCREENS.length).toBeGreaterThanOrEqual(1);
    expect(nextStep(10, { ...initialState, place: 'gym' })).toBe(11);
    expect(nextStep(10, { ...initialState, place: 'home' })).toBe(11);
    expect(prevStep(11, { ...initialState, place: 'gym' })).toBe(10);
  });

  it('extraScreenAt maps steps past the core to registry screens, in order', () => {
    expect(extraScreenAt(9)).toBeNull();
    expect(extraScreenAt(1)).toBeNull();
    for (let i = 0; i < EXTRA_SCREENS.length; i++) {
      expect(extraScreenAt(CORE_STEPS + 1 + i)).toBe(EXTRA_SCREENS[i]);
    }
    expect(extraScreenAt(TOTAL_STEPS + 1)).toBeNull();
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

  it('carries a picked theme, and omits the field when none was picked', () => {
    expect(buildProfile({ ...initialState, theme: 'gummy' }).theme).toBe('gummy');
    expect('theme' in buildProfile(initialState)).toBe(false);
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

describe('PT intake (V4 Phase 8a)', () => {
  it('builds the pt_intake blob from answered fields only', () => {
    const state = {
      ...initialState,
      experience: '1to3y' as const,
      daysPerWeek: '4', sessionMinutes: '60', weekdays: [5, 1, 3],
      dumbbellMaxKg: '20', kettlebellKg: '',
      equipment: ['Adjustable dumbbells'],
      limitationNote: '  left knee dislikes deep squats ',
      dislikes: 'mushrooms, olives, , celery',
      mealsPerDay: '3', cookingTime: 'quick' as const,
      waist: '84',
    };
    const intake = buildPtIntake(state)!;
    expect(intake.experience).toBe('1to3y');
    expect(intake.schedule).toEqual({ daysPerWeek: 4, sessionMinutes: 60, weekdays: [1, 3, 5] });
    expect(intake.inventory).toEqual({ dumbbellMaxKg: 20, adjustableDumbbells: true });
    expect(intake.limitations?.note).toBe('left knee dislikes deep squats');
    expect(intake.diet).toEqual({ dislikes: ['mushrooms', 'olives', 'celery'], mealsPerDay: 3, cookingTime: 'quick' });
    expect(intake.measurements?.waistCm).toBe(84);
  });

  it('a fully skipped intake produces null — an honest absence, not an empty object', () => {
    expect(buildPtIntake(initialState)).toBeNull();
  });

  it('imperial waist converts to cm', () => {
    const intake = buildPtIntake({ ...initialState, units: 'Imperial — lb · in', waist: '33' })!;
    expect(intake.measurements?.waistCm).toBeCloseTo(83.8, 1);
  });

  it('gym-only still skips the home-equipment step at the new numbering', () => {
    const gym = { ...initialState, place: 'gym' as const };
    expect(nextStep(7, gym)).toBe(9);
    expect(prevStep(9, gym)).toBe(7);
    expect(nextStep(7, { ...initialState, place: 'home' as const })).toBe(8);
  });

  it('the intake lands on the profile row', () => {
    const p = buildProfile({ ...initialState, experience: 'new' as const });
    expect(p.ptIntake?.experience).toBe('new');
  });

  it('the medical line exists and says doctor, once, plainly', () => {
    expect(MEDICAL_LINE).toContain('check with a doctor');
  });
});
