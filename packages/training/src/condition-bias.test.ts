import { describe, it, expect } from 'vitest';
import { biasOrder, conditionBiasFor, type BiasableExercise } from './condition-bias';

const ex = (partial: Partial<BiasableExercise> & { name: string }): BiasableExercise => ({
  category: 'strength',
  primaryMuscles: [],
  secondaryMuscles: [],
  difficulty: 'intermediate',
  ...partial,
});

const OHP = ex({ name: 'Overhead Press', primaryMuscles: ['shoulders'] });
const SQUAT = ex({ name: 'Barbell Back Squat', primaryMuscles: ['quadriceps'] });
const DEADLIFT = ex({ name: 'Deadlift', primaryMuscles: ['lower back', 'hamstrings'] });
const CURL = ex({ name: 'Bicep Curl', primaryMuscles: ['biceps'] });
const BOXJUMP = ex({ name: 'Box Jump', category: 'plyometrics', primaryMuscles: ['quadriceps'] });

describe('conditionBiasFor', () => {
  it('biases by muscle and by movement keywords', () => {
    expect(conditionBiasFor(OHP, ['Shoulder injury'])).toEqual({
      down: true, reason: 'loads the shoulder', condition: 'Shoulder injury',
    });
    expect(conditionBiasFor(SQUAT, ['Knee injury']).down).toBe(true);
    expect(conditionBiasFor(DEADLIFT, ['Lower-back issues']).reason).toBe('loads the lower back');
    expect(conditionBiasFor(BOXJUMP, ['Limited mobility']).down).toBe(true);
  });

  it('no conditions → no bias; unrelated exercise → no bias', () => {
    expect(conditionBiasFor(OHP, []).down).toBe(false);
    expect(conditionBiasFor(CURL, ['Shoulder injury', 'Knee injury']).down).toBe(false);
  });

  it('medical conditions never bias — that would be advice', () => {
    const all = [OHP, SQUAT, DEADLIFT, BOXJUMP];
    for (const c of ['High blood pressure', 'Heart condition', 'Type 2 diabetes', 'Asthma', 'Pregnant']) {
      for (const e of all) expect(conditionBiasFor(e, [c]).down).toBe(false);
    }
  });
});

describe('biasOrder', () => {
  it('is a stable partition — nothing hidden, order within groups kept', () => {
    const ordered = biasOrder([OHP, SQUAT, DEADLIFT, CURL], ['Shoulder injury', 'Lower-back issues']);
    expect(ordered.map((e) => e.name)).toEqual([
      'Barbell Back Squat', 'Bicep Curl', 'Overhead Press', 'Deadlift',
    ]);
    expect(ordered).toHaveLength(4); // never fewer
  });

  it('annotates each row so the UI can state the why', () => {
    const ordered = biasOrder([OHP], ['Shoulder injury']);
    expect(ordered[0]!.bias).toMatchObject({ reason: 'loads the shoulder', condition: 'Shoulder injury' });
  });

  it('with no conditions the list is untouched', () => {
    const list = [DEADLIFT, OHP, SQUAT];
    expect(biasOrder(list, []).map((e) => e.name)).toEqual(list.map((e) => e.name));
  });
});
