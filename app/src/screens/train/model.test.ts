import { describe, it, expect } from 'vitest';
import { equipmentTokens, prevCellText, parseNum, exerciseMetaText, defaultRowCount, elapsedText } from './model';
import type { SetEntry } from '@basalt/training';

function set(partial: Partial<SetEntry>): SetEntry {
  return {
    id: 's', sessionExerciseId: 'se', userId: 'u', setNumber: 1, setType: 'normal',
    reps: null, weightKg: null, durationS: null, rir: null, rpe: null, restS: null,
    comment: null, completedAt: '2026-08-20T10:00:00Z',
    ...partial,
  };
}

describe('equipmentTokens — onboarding inventory → library filter', () => {
  it('maps the common home kit', () => {
    const tokens = equipmentTokens(['Dumbbells', 'Resistance bands', 'Pull-up bar']);
    expect(tokens).toContain('dumbbell');
    expect(tokens).toContain('bands');
    expect(tokens).toContain('body only'); // always available
  });
  it('barbell + rack unlock barbell work', () => {
    const tokens = equipmentTokens(['Barbell + plates', 'Squat rack']);
    expect(tokens).toContain('barbell');
    expect(tokens).toContain('e-z curl bar');
  });
  it('bodyweight-only still trains', () => {
    expect(equipmentTokens(['Bodyweight only'])).toEqual(['body only']);
    expect(equipmentTokens([])).toEqual(['body only']);
  });
});

describe('prevCellText — ghost column', () => {
  const prev = [set({ weightKg: 72.5, reps: 8 }), set({ setNumber: 2, weightKg: 72.5, reps: 8 })];
  it('renders weight×reps per row index', () => {
    expect(prevCellText(prev, 0)).toBe('72.5×8');
    expect(prevCellText(prev, 1)).toBe('72.5×8');
  });
  it('renders durations for timed history and — beyond history', () => {
    expect(prevCellText([set({ durationS: 50 })], 0)).toBe('50 s');
    expect(prevCellText(prev, 5)).toBe('—');
    expect(prevCellText([], 0)).toBe('—');
  });
  it('bodyweight sets read bw×reps', () => {
    expect(prevCellText([set({ reps: 12 })], 0)).toBe('bw×12');
  });
});

describe('parseNum', () => {
  it('parses decimals with comma or dot; empty and junk are null', () => {
    expect(parseNum('72.5')).toBe(72.5);
    expect(parseNum('72,5')).toBe(72.5);
    expect(parseNum('')).toBeNull();
    expect(parseNum('abc')).toBeNull();
    expect(parseNum('-5')).toBeNull();
  });
});

describe('exerciseMetaText / defaultRowCount / elapsedText', () => {
  it('meta joins equipment and first muscle', () => {
    expect(exerciseMetaText(['chest', 'triceps'], 'barbell')).toBe('barbell · chest');
    expect(exerciseMetaText([], null)).toBe('');
  });
  it('row count follows the previous session, defaulting to 3', () => {
    expect(defaultRowCount([set({}), set({}), set({}), set({})])).toBe(4);
    expect(defaultRowCount([set({ setType: 'warmup' })])).toBe(3);
    expect(defaultRowCount([])).toBe(3);
  });
  it('elapsed reads mm:ss', () => {
    const start = '2026-08-20T17:30:00Z';
    expect(elapsedText(start, new Date('2026-08-20T17:52:14Z'))).toBe('22:14');
  });
});
