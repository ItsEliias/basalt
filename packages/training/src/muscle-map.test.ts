import { describe, it, expect } from 'vitest';
import { REGION_FOR_MUSCLE, regionsFor, intensityFor } from './muscle-map';

// The dataset's full muscle vocabulary — every value must have a region.
const FREE_EXERCISE_DB_MUSCLES = [
  'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest',
  'forearms', 'glutes', 'hamstrings', 'lats', 'lower back', 'middle back',
  'neck', 'quadriceps', 'shoulders', 'traps', 'triceps',
];

describe('muscle → region mapping', () => {
  it('covers every free-exercise-db muscle value — nothing highlights nothing', () => {
    for (const m of FREE_EXERCISE_DB_MUSCLES) {
      expect(REGION_FOR_MUSCLE[m], m).toBeDefined();
    }
  });

  it('primary wins over secondary in the same region', () => {
    const r = regionsFor({ primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'] });
    expect(r.arms).toBe('primary');
  });

  it('bench press: chest primary, shoulders + arms secondary', () => {
    const r = regionsFor({ primaryMuscles: ['chest'], secondaryMuscles: ['shoulders', 'triceps'] });
    expect(r).toEqual({ chest: 'primary', shoulders: 'secondary', arms: 'secondary' });
  });

  it('unknown muscle names are ignored, not crashed on', () => {
    expect(regionsFor({ primaryMuscles: ['mystery'], secondaryMuscles: [] })).toEqual({});
  });

  it('intensity: primary solid (1), secondary faded (0.4)', () => {
    expect(intensityFor({ chest: 'primary', arms: 'secondary' })).toEqual({ chest: 1, arms: 0.4 });
  });
});
