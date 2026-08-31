import { describe, it, expect } from 'vitest';
import { routineToTemplates, routinePreviewLine, type OcrRoutine } from './routine-import';

const CATALOG = [
  { id: 'e1', name: 'Barbell Bench Press' },
  { id: 'e2', name: 'Barbell Back Squat' },
  { id: 'e3', name: 'Lat Pulldown' },
];

const ROUTINE: OcrRoutine = {
  name: 'PPL',
  days: [
    { label: 'Push', exercises: [
      { name: 'Bench Press', sets: 4, reps: 8, weight_kg: 80 },
      { name: 'Cable Flye', sets: 3, reps: 12, weight_kg: null },
    ]},
    { label: 'Legs', exercises: [
      { name: 'Back Squat', sets: 5, reps: 5, weight_kg: 100 },
    ]},
  ],
};

describe('routineToTemplates', () => {
  it('one template per day, day label in the name for multi-day routines', () => {
    const p = routineToTemplates(ROUTINE, CATALOG);
    expect(p.templates.map((t) => t.name)).toEqual(['PPL — Push', 'PPL — Legs']);
  });

  it('single-day routines keep the plain name', () => {
    const p = routineToTemplates({ name: 'Full body', days: [ROUTINE.days[1]!] }, CATALOG);
    expect(p.templates[0]!.name).toBe('Full body');
  });

  it('fuzzy-matches into the catalog and links the id', () => {
    const p = routineToTemplates(ROUTINE, CATALOG);
    const bench = p.templates[0]!.exercises[0]!;
    expect(bench.exerciseName).toBe('Barbell Bench Press');
    expect(bench.exerciseId).toBe('e1');
  });

  it('unmatched names import as written — the name is the record', () => {
    const p = routineToTemplates(ROUTINE, CATALOG);
    const flye = p.templates[0]!.exercises[1]!;
    expect(flye.exerciseName).toBe('Cable Flye');
    expect(flye.exerciseId).toBeNull();
    expect(p.unmatched).toEqual(['Cable Flye']);
  });

  it('manual overrides win over fuzzy matching', () => {
    const p = routineToTemplates(ROUTINE, CATALOG, { 'cable flye': 'Lat Pulldown' });
    const flye = p.templates[0]!.exercises[1]!;
    expect(flye.exerciseName).toBe('Lat Pulldown');
    expect(flye.exerciseId).toBe('e3');
    expect(p.unmatched).toEqual([]);
  });

  it('rows without a set count are skipped BY NAME, never silently', () => {
    const r: OcrRoutine = { name: 'X', days: [{ label: 'A', exercises: [
      { name: 'Bench Press', sets: 3, reps: 8, weight_kg: null },
      { name: 'Mystery Row', sets: 0, reps: null, weight_kg: null },
    ]}]};
    const p = routineToTemplates(r, CATALOG);
    expect(p.templates[0]!.exercises).toHaveLength(1);
    expect(p.skipped).toEqual(['A: Mystery Row (no set count)']);
  });

  it('a day with nothing usable vanishes rather than saving empty', () => {
    const r: OcrRoutine = { name: 'X', days: [{ label: 'A', exercises: [
      { name: 'Mystery', sets: 0, reps: null, weight_kg: null },
    ]}]};
    expect(routineToTemplates(r, CATALOG).templates).toEqual([]);
  });
});

describe('routinePreviewLine', () => {
  it('states days, exercises and unmatched count', () => {
    expect(routinePreviewLine(routineToTemplates(ROUTINE, CATALOG)))
      .toBe('2 days · 3 exercises · 1 unmatched name');
  });
});
