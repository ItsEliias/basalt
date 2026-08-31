import { describe, it, expect } from 'vitest';
import {
  parseCsv, parseStrongCsv, parseHevyCsv, parseGenericCsv, parseBasaltSectionedCsv,
  normalizeExerciseName, matchExerciseName, buildImportPreview, importExtId,
} from './import-csv';

describe('parseCsv', () => {
  it('handles quoted cells, embedded commas and doubled quotes', () => {
    const rows = parseCsv('a,b,c\n"1,5","say ""hi""",plain');
    expect(rows[1]).toEqual(['1,5', 'say "hi"', 'plain']);
  });

  it('sniffs semicolon delimiters from the header', () => {
    const rows = parseCsv('Date;Exercise Name;Reps\n2026-01-05;Squat;5');
    expect(rows[1]).toEqual(['2026-01-05', 'Squat', '5']);
  });

  it('drops blank lines and survives CRLF', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n\r\n3,4');
    expect(rows).toHaveLength(3);
  });
});

const STRONG = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2026-08-10 17:30:00,Push Day,1h 2m,Bench Press (Barbell),1,80,8,,,,,8
2026-08-10 17:30:00,Push Day,1h 2m,Bench Press (Barbell),2,80,7,,,,,9
2026-08-10 17:30:00,Push Day,1h 2m,Overhead Press (Barbell),1,40,10,,,,,
2026-08-12 06:15:00,Pull Day,55m,Deadlift (Barbell),1,140,5,,,,,8.5`;

describe('parseStrongCsv', () => {
  it('groups sets into sessions by date + workout name', () => {
    const sessions = parseStrongCsv(STRONG);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.name).toBe('Push Day');
    expect(sessions[0]!.exercises.map((e) => e.name)).toEqual([
      'Bench Press (Barbell)', 'Overhead Press (Barbell)',
    ]);
    expect(sessions[0]!.exercises[0]!.sets).toHaveLength(2);
    expect(sessions[0]!.exercises[0]!.sets[1]).toMatchObject({ setNumber: 2, weightKg: 80, reps: 7, rpe: 9 });
  });

  it('converts pounds when the header says lbs', () => {
    const lbs = STRONG.replace('Weight,', 'Weight (lbs),').replace(/,80,/g, ',176.37,');
    const sessions = parseStrongCsv(lbs);
    expect(sessions[0]!.exercises[0]!.sets[0]!.weightKg).toBeCloseTo(80, 1);
  });
});

const HEVY = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
"Leg Day","2026-08-11 18:00:00","2026-08-11 19:05:00",,"Squat (Barbell)",,,0,normal,100,5,,,8
"Leg Day","2026-08-11 18:00:00","2026-08-11 19:05:00",,"Squat (Barbell)",,,1,normal,100,5,,,9
"Leg Day","2026-08-11 18:00:00","2026-08-11 19:05:00",,"Plank",,,0,normal,,,,60,`;

describe('parseHevyCsv', () => {
  it('groups by title + start, converts 0-based set_index, keeps durations', () => {
    const sessions = parseHevyCsv(HEVY);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.endedAt).not.toBeNull();
    const squat = sessions[0]!.exercises[0]!;
    expect(squat.sets.map((s) => s.setNumber)).toEqual([1, 2]);
    const plank = sessions[0]!.exercises[1]!;
    expect(plank.sets[0]).toMatchObject({ durationS: 60, weightKg: null, reps: null });
  });
});

describe('parseGenericCsv', () => {
  it('maps arbitrary columns and applies the weight factor', () => {
    const csv = 'when,move,load,count\n2026-08-01,Squat,225,5\n2026-08-01,Squat,225,5';
    const sessions = parseGenericCsv(csv, { date: 0, exercise: 1, weight: 2, reps: 3, weightFactor: 0.45359237 });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.exercises[0]!.sets[0]!.weightKg).toBeCloseTo(102.06, 1);
    expect(sessions[0]!.exercises[0]!.sets[1]!.setNumber).toBe(2);
  });
});

describe('round-trip — what Basalt exports, Basalt re-imports losslessly', () => {
  const SECTIONED = `== basalt_workout_sessions ==
id,user_id,started_at,ended_at,notes,session_rpe,source,created_at
s1,u1,2026-08-10T07:30:00.000Z,2026-08-10T08:31:00.000Z,Push Day,8,manual,2026-08-10T07:30:00.000Z

== basalt_session_exercises ==
id,session_id,user_id,exercise_id,exercise_name,order_index
e1,s1,u1,x9,Bench Press,0
e2,s1,u1,,Cable Fly,1

== basalt_set_entries ==
id,session_exercise_id,user_id,set_number,set_type,reps,weight_kg,duration_s,rir,rpe
t1,e1,u1,1,normal,8,80,,2,
t2,e1,u1,2,normal,7,82.5,,1,9
t3,e2,u1,1,normal,12,25,,,

== basalt_walks ==
(no rows)
`;

  it('reconstructs sessions, exercise order, and every set value', () => {
    const sessions = parseBasaltSectionedCsv(SECTIONED);
    expect(sessions).toHaveLength(1);
    const s = sessions[0]!;
    expect(s.startedAt).toBe('2026-08-10T07:30:00.000Z');
    expect(s.endedAt).toBe('2026-08-10T08:31:00.000Z');
    expect(s.name).toBe('Push Day');
    expect(s.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Cable Fly']);
    expect(s.exercises[0]!.sets).toEqual([
      { setNumber: 1, weightKg: 80, reps: 8, durationS: null, rpe: null },
      { setNumber: 2, weightKg: 82.5, reps: 7, durationS: null, rpe: 9 },
    ]);
    expect(s.exercises[1]!.sets[0]!.weightKg).toBe(25);
  });
});

describe('exercise matching — published rule', () => {
  const CATALOG = ['Bench Press', 'Overhead Press', 'Romanian Deadlift', 'Squat'];

  it('strips parenthesised qualifiers and matches exactly', () => {
    expect(matchExerciseName('Bench Press (Barbell)', CATALOG)).toBe('Bench Press');
  });

  it('substring containment both ways, min 4 chars', () => {
    expect(matchExerciseName('Romanian Deadlift (Dumbbell)', CATALOG)).toBe('Romanian Deadlift');
    expect(matchExerciseName('Squat', CATALOG)).toBe('Squat');
  });

  it('no confident match stays unmatched — never silently guessed', () => {
    expect(matchExerciseName('Nordic Curl', CATALOG)).toBeNull();
    expect(matchExerciseName('Row', CATALOG)).toBeNull(); // 3 chars — too short to contain-match
  });

  it('normalization is stable', () => {
    expect(normalizeExerciseName('  Bench-Press (Barbell)! ')).toBe('bench press');
  });
});

describe('buildImportPreview', () => {
  it('counts sessions/sets, dates the range, splits matched from unmatched', () => {
    const sessions = parseStrongCsv(STRONG);
    const preview = buildImportPreview(sessions, ['Bench Press', 'Deadlift']);
    expect(preview.sessionCount).toBe(2);
    expect(preview.setCount).toBe(4);
    expect(preview.firstDate).toBe('2026-08-10');
    expect(preview.lastDate).toBe('2026-08-12');
    expect(preview.matched['Bench Press (Barbell)']).toBe('Bench Press');
    expect(preview.matched['Deadlift (Barbell)']).toBe('Deadlift');
    expect(preview.unmatched).toEqual(['Overhead Press (Barbell)']);
  });
});

describe('importExtId — the idempotency key', () => {
  it('is stable for the same session and distinct across sources', () => {
    const s = parseStrongCsv(STRONG)[0]!;
    expect(importExtId('strong', s)).toBe(importExtId('strong', s));
    expect(importExtId('strong', s)).not.toBe(importExtId('hevy', s));
  });
});
