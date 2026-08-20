import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as coreData from '@basalt/core-data';

vi.mock('@basalt/core-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@basalt/core-data')>();
  return { ...actual, currentUserId: vi.fn() };
});

import {
  startSession, endSession, addSessionExercise, logSet, setExerciseFeedback,
  getSessionDetail, getPrevExerciseSets, listRecentSessions,
} from './sessions';

const mockedCurrentUserId = vi.mocked(coreData.currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  mockedCurrentUserId.mockResolvedValue({ ok: true, data: 'user-1' });
});

const sessionRow = {
  id: 'sess-1', user_id: 'user-1', started_at: '2026-08-20T17:30:00Z', ended_at: null,
  notes: null, session_rpe: null, source: 'manual', created_at: '2026-08-20T17:30:00Z',
};

const setRow = {
  id: 'set-1', session_exercise_id: 'se-1', user_id: 'user-1', set_number: 1,
  set_type: 'normal', reps: 8, weight_kg: 75, duration_s: null, rir: 2, rpe: null,
  rest_s: null, comment: null, completed_at: '2026-08-20T17:35:00Z',
};

describe('startSession', () => {
  it('propagates auth errors without inserting', async () => {
    mockedCurrentUserId.mockResolvedValue({ ok: false, error: 'not signed in' });
    const insert = vi.fn();
    const client = { from: () => ({ insert }) } as unknown as SupabaseClient;
    expect(await startSession(client)).toEqual({ ok: false, error: 'not signed in' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts for the authed user and maps the row', async () => {
    const payloads: any[] = [];
    const client = {
      from: () => ({
        insert: (p: any) => { payloads.push(p); return { select: () => ({ single: async () => ({ data: sessionRow, error: null }) }) }; },
      }),
    } as unknown as SupabaseClient;

    const result = await startSession(client);
    expect(payloads).toEqual([{ user_id: 'user-1' }]);
    expect(result.ok && result.data.id).toBe('sess-1');
    expect(result.ok && result.data.endedAt).toBeNull();
  });
});

describe('endSession', () => {
  it('stamps ended_at and optional RPE', async () => {
    const payloads: any[] = [];
    const client = {
      from: () => ({
        update: (p: any) => { payloads.push(p); return { eq: () => ({ select: () => ({ single: async () => ({ data: { ...sessionRow, ended_at: '2026-08-20T18:22:00Z', session_rpe: 8 }, error: null }) }) }) }; },
      }),
    } as unknown as SupabaseClient;

    const result = await endSession(client, 'sess-1', { sessionRpe: 8 });
    expect(payloads[0].session_rpe).toBe(8);
    expect(typeof payloads[0].ended_at).toBe('string');
    expect(result.ok && result.data.sessionRpe).toBe(8);
  });
});

describe('logSet', () => {
  it('refuses a set with neither reps nor duration — no empty rows', async () => {
    const client = {} as unknown as SupabaseClient;
    expect(await logSet(client, 'se-1', { setNumber: 1 })).toEqual({
      ok: false, error: 'A set needs reps or a duration.',
    });
  });

  it('upserts on (session_exercise_id, set_number) so edits replace in place', async () => {
    const calls: { payload: any; opts: any }[] = [];
    const client = {
      from: () => ({
        upsert: (payload: any, opts: any) => {
          calls.push({ payload, opts });
          return { select: () => ({ single: async () => ({ data: setRow, error: null }) }) };
        },
      }),
    } as unknown as SupabaseClient;

    const result = await logSet(client, 'se-1', { setNumber: 1, reps: 8, weightKg: 75, rir: 2 });
    expect(calls[0]?.opts).toEqual({ onConflict: 'session_exercise_id,set_number' });
    expect(calls[0]?.payload).toMatchObject({
      session_exercise_id: 'se-1', user_id: 'user-1', set_number: 1,
      set_type: 'normal', reps: 8, weight_kg: 75, rir: 2,
    });
    expect(result.ok && result.data.weightKg).toBe(75);
  });

  it('accepts duration-only sets (timed exercises auto-log)', async () => {
    const calls: any[] = [];
    const client = {
      from: () => ({
        upsert: (payload: any) => { calls.push(payload); return { select: () => ({ single: async () => ({ data: { ...setRow, reps: null, duration_s: 50 }, error: null }) }) }; },
      }),
    } as unknown as SupabaseClient;

    const result = await logSet(client, 'se-1', { setNumber: 2, durationS: 50 });
    expect(calls[0].duration_s).toBe(50);
    expect(result.ok && result.data.durationS).toBe(50);
  });
});

describe('setExerciseFeedback', () => {
  it('writes the one-tap signal', async () => {
    const payloads: any[] = [];
    const client = {
      from: () => ({ update: (p: any) => { payloads.push(p); return { eq: async () => ({ error: null }) }; } }),
    } as unknown as SupabaseClient;
    expect(await setExerciseFeedback(client, 'se-1', 'too_hard')).toEqual({ ok: true, data: undefined });
    expect(payloads).toEqual([{ feedback: 'too_hard' }]);
  });
});

describe('getSessionDetail', () => {
  it('assembles session → exercises → ordered sets', async () => {
    const exRow = {
      id: 'se-1', session_id: 'sess-1', user_id: 'user-1', exercise_id: 'ex-1',
      exercise_name: 'Incline Bench Press', order_index: 0, superset_group: null,
      rest_seconds: 120, notes: null, feedback: null, created_at: '2026-08-20T17:31:00Z',
    };
    const client = {
      from: (table: string) => {
        if (table === 'basalt_workout_sessions') {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: sessionRow, error: null }) }) }) };
        }
        if (table === 'basalt_session_exercises') {
          return { select: () => ({ eq: () => ({ order: async () => ({ data: [exRow], error: null }) }) }) };
        }
        return { select: () => ({ in: () => ({ order: async () => ({ data: [setRow], error: null }) }) }) };
      },
    } as unknown as SupabaseClient;

    const result = await getSessionDetail(client, 'sess-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.exercises).toHaveLength(1);
      expect(result.data.exercises[0]?.restSeconds).toBe(120);
      expect(result.data.exercises[0]?.sets).toHaveLength(1);
      expect(result.data.exercises[0]?.sets[0]?.weightKg).toBe(75);
    }
  });
});

describe('getPrevExerciseSets — the Prev column', () => {
  it('returns null with no history — the UI ghosts nothing', async () => {
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }),
      }),
    } as unknown as SupabaseClient;
    expect(await getPrevExerciseSets(client, 'ex-1')).toEqual({ ok: true, data: null });
  });

  it('skips instances with no logged sets and returns the first with data', async () => {
    const instances = [
      { id: 'se-empty', rest_seconds: null, created_at: '2026-08-19T10:00:00Z' },
      { id: 'se-full', rest_seconds: 90, created_at: '2026-08-14T10:00:00Z' },
    ];
    const client = {
      from: (table: string) => {
        if (table === 'basalt_session_exercises') {
          return { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: instances, error: null }) }) }) }) }) };
        }
        return {
          select: () => ({
            eq: (_c: string, id: string) => ({
              order: async () => ({ data: id === 'se-full' ? [setRow] : [], error: null }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    const result = await getPrevExerciseSets(client, 'ex-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.restSeconds).toBe(90);
      expect(result.data?.sets).toHaveLength(1);
    }
  });
});

describe('listRecentSessions', () => {
  it('maps newest-first sessions for the authed user', async () => {
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [sessionRow], error: null }) }) }) }),
      }),
    } as unknown as SupabaseClient;
    const result = await listRecentSessions(client);
    expect(result.ok && result.data).toHaveLength(1);
    expect(result.ok && result.data[0]?.source).toBe('manual');
  });
});
