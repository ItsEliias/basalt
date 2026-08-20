import { describe, it, expect } from 'vitest';
import { adaptSession, adaptSummary, type AdaptItem, type AdaptExercise } from './adapt-session';

const ex = (name: string, partial: Partial<AdaptExercise> = {}): AdaptExercise => ({
  name,
  category: 'strength',
  primaryMuscles: ['quadriceps'],
  secondaryMuscles: [],
  equipment: 'barbell',
  difficulty: 'intermediate',
  ...partial,
});

const item = (id: string, exercise: AdaptExercise, committedSets = 0, plannedSets = 4): AdaptItem => ({
  id, committedSets, plannedSets, exercise,
});

const LIBRARY: AdaptExercise[] = [
  ex('Bodyweight Squat', { equipment: 'body only' }),
  ex('Pistol Squat', { equipment: 'body only', difficulty: 'expert' }),
  ex('Push-Up', { primaryMuscles: ['chest'], equipment: 'body only' }),
  ex('Wall Sit', { equipment: 'body only', category: 'stretching' }),
  ex('Goblet Squat', { equipment: 'dumbbell' }),
];

describe('adaptSession', () => {
  it('less time trims to 2 sets with the stimulus rationale; ≤2 kept', () => {
    const changes = adaptSession([item('a', ex('Back Squat'), 0, 4), item('b', ex('Front Squat'), 0, 2)], { kind: 'less_time' }, LIBRARY);
    expect(changes[0]).toMatchObject({ action: 'trim', toSets: 2 });
    expect(changes[0]!.why).toContain('two hard sets');
    expect(changes[1]!.action).toBe('keep');
  });

  it('no equipment swaps to a same-primary-muscle bodyweight movement, same category preferred', () => {
    const changes = adaptSession([item('a', ex('Back Squat'))], { kind: 'no_equipment' }, LIBRARY);
    expect(changes[0]).toMatchObject({ action: 'swap' });
    expect(changes[0]!.replacement!.name).toBe('Bodyweight Squat'); // strength beats stretching Wall Sit
    expect(changes[0]!.why).toContain('barbell unavailable');
  });

  it('no equipment with no bodyweight cover → drop, why stated', () => {
    const changes = adaptSession(
      [item('a', ex('Lat Pulldown', { primaryMuscles: ['lats'], equipment: 'cable' }))],
      { kind: 'no_equipment' },
      LIBRARY,
    );
    expect(changes[0]).toMatchObject({ action: 'drop' });
    expect(changes[0]!.why).toContain('lats');
  });

  it('quiet swaps impact movements and keeps the rest', () => {
    const changes = adaptSession(
      [item('a', ex('Box Jump', { category: 'plyometrics' })), item('b', ex('Back Squat'))],
      { kind: 'quiet' },
      LIBRARY,
    );
    expect(changes[0]!.action).toBe('swap');
    expect(changes[0]!.replacement!.name).toBe('Bodyweight Squat');
    expect(changes[1]!.action).toBe('keep');
  });

  it('exclude muscle drops primary hits and keeps everything else', () => {
    const changes = adaptSession(
      [item('a', ex('Back Squat')), item('b', ex('Bench Press', { primaryMuscles: ['chest'] }))],
      { kind: 'exclude_muscle', muscle: 'quadriceps' },
      LIBRARY,
    );
    expect(changes[0]).toMatchObject({ action: 'drop' });
    expect(changes[0]!.why).toContain('at your request');
    expect(changes[1]!.action).toBe('keep');
  });

  it('exercises with logged sets are NEVER touched — the ledger is history', () => {
    for (const mode of [{ kind: 'less_time' }, { kind: 'no_equipment' }, { kind: 'quiet' }, { kind: 'exclude_muscle', muscle: 'quadriceps' }] as const) {
      const changes = adaptSession([item('a', ex('Back Squat'), 3, 4)], mode, LIBRARY);
      expect(changes[0]!.action).toBe('keep');
      expect(changes[0]!.why).toContain('already logged');
    }
  });
});

describe('adaptSummary', () => {
  it('counts the change kinds plainly', () => {
    const changes = adaptSession(
      [item('a', ex('Back Squat'), 0, 4), item('b', ex('Front Squat'), 0, 2), item('c', ex('Leg Press'), 2, 3)],
      { kind: 'less_time' },
      LIBRARY,
    );
    expect(adaptSummary(changes)).toBe('1 trimmed · 2 kept');
  });
});
