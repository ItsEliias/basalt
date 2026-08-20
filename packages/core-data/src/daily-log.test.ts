import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateDailyLog } from './daily-log';

type FoundResult = { data: any; error: { code?: string; message: string } | null };
type InsertedResult = { data: any; error: { message: string } | null };

// Minimal hand-rolled mock covering only the `.from('basalt_daily_logs')`
// chain findOrCreateDailyLog actually calls: select().eq().eq().maybeSingle()
// for the lookup, insert().select().single() for the create path. No live
// Supabase, no network.
function mockClient(opts: {
  userId?: string;
  userError?: { message: string };
  found: FoundResult;
  inserted?: InsertedResult;
}): { client: SupabaseClient; insertCalls: any[]; tables: string[] } {
  const insertCalls: any[] = [];
  const tables: string[] = [];
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: opts.userId ? { id: opts.userId } : null },
        error: opts.userError ?? null,
      }),
    },
    from: (table: string) => {
      tables.push(table);
      return {
        select: (_cols: string) => ({
          eq: (_c1: string, _v1: string) => ({
            eq: (_c2: string, _v2: string) => ({
              maybeSingle: async () => opts.found,
            }),
          }),
        }),
        insert: (payload: any) => {
          insertCalls.push(payload);
          return {
            select: (_cols: string) => ({
              single: async () => opts.inserted ?? { data: null, error: null },
            }),
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, insertCalls, tables };
}

const foundRow = {
  id: 'log-1',
  user_id: 'user-1',
  date: '2026-08-13',
  calories_eaten: 100,
  calories_burned: 0,
  synced_at: null,
  created_at: '2026-08-13T00:00:00.000Z',
};

describe('findOrCreateDailyLog — auth failure', () => {
  it('propagates a currentUserId error without touching the table', async () => {
    const { client, insertCalls } = mockClient({
      userError: { message: 'not signed in' },
      found: { data: null, error: null },
    });
    const result = await findOrCreateDailyLog(client, '2026-08-13');
    expect(result).toEqual({ ok: false, error: 'not signed in' });
    expect(insertCalls).toHaveLength(0);
  });
});

describe('findOrCreateDailyLog — found path', () => {
  it('maps and returns the existing row without inserting', async () => {
    const { client, insertCalls, tables } = mockClient({
      userId: 'user-1',
      found: { data: foundRow, error: null },
    });
    const result = await findOrCreateDailyLog(client, '2026-08-13');
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'log-1',
        userId: 'user-1',
        date: '2026-08-13',
        caloriesEaten: 100,
        caloriesBurned: 0,
        syncedAt: null,
        createdAt: '2026-08-13T00:00:00.000Z',
      },
    });
    expect(insertCalls).toHaveLength(0);
    expect(tables).toEqual(['basalt_daily_logs']);
  });

  it('returns an error for a lookup failure that is not "no rows" (PGRST116)', async () => {
    const { client } = mockClient({
      userId: 'user-1',
      found: { data: null, error: { code: 'OTHER', message: 'db unavailable' } },
    });
    const result = await findOrCreateDailyLog(client, '2026-08-13');
    expect(result).toEqual({ ok: false, error: 'db unavailable' });
  });
});

describe('findOrCreateDailyLog — create path', () => {
  it('creates a bare user_id + date row, relying on DB defaults', async () => {
    const { client, insertCalls, tables } = mockClient({
      userId: 'user-1',
      found: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
      inserted: { data: foundRow, error: null },
    });
    const result = await findOrCreateDailyLog(client, '2026-08-13');
    expect(insertCalls).toEqual([{ user_id: 'user-1', date: '2026-08-13' }]);
    expect(result.ok && result.data.id).toBe('log-1');
    expect(tables).toEqual(['basalt_daily_logs', 'basalt_daily_logs']);
  });

  it('returns the insert error message on failure', async () => {
    const { client } = mockClient({
      userId: 'user-1',
      found: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
      inserted: { data: null, error: { message: 'insert rejected' } },
    });
    const result = await findOrCreateDailyLog(client, '2026-08-13');
    expect(result).toEqual({ ok: false, error: 'insert rejected' });
  });

  it('falls back to a generic message when insert fails without one', async () => {
    const { client } = mockClient({
      userId: 'user-1',
      found: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
      inserted: { data: null, error: null },
    });
    const result = await findOrCreateDailyLog(client, '2026-08-13');
    expect(result).toEqual({ ok: false, error: 'Could not create daily log.' });
  });
});
