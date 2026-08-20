import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as coreData from '@basalt/core-data';

vi.mock('@basalt/core-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@basalt/core-data')>();
  return {
    ...actual,
    currentUserId: vi.fn(),
  };
});

import { addWater, undoLastWater, getWaterForDay, getHydrationLogsForDay, importHcHydration, resetWater } from './water';

const mockedCurrentUserId = vi.mocked(coreData.currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  mockedCurrentUserId.mockResolvedValue({ ok: true, data: 'user-1' });
});

// A stateful in-memory fake of the basalt_hydration_logs table covering the
// exact query chains water.ts uses. Rows carry {id, user_id, ts, date, ml,
// source, ext_id}.
function fakeTable(seed: any[] = []) {
  let rows = seed.map((r, i) => ({ id: `row-${i}`, ts: `2026-08-13T0${i}:00:00Z`, ext_id: null, source: 'manual', user_id: 'user-1', ...r }));
  let nextId = seed.length;
  const applyFilters = (data: any[], filters: [string, any][]) =>
    data.filter((r) => filters.every(([col, val]) => r[col] === val));

  const client = {
    from: (_table: string) => {
      const filters: [string, any][] = [];
      let inFilter: [string, any[]] | null = null;
      const chain: any = {
        select: (_cols: string) => chain,
        eq: (col: string, val: any) => { filters.push([col, val]); return chain; },
        in: (col: string, vals: any[]) => { inFilter = [col, vals]; return chain; },
        order: (_c: string, _o: any) => chain,
        limit: (_n: number) => chain,
        maybeSingle: async () => {
          let data = applyFilters(rows, filters);
          if (inFilter) data = data.filter((r) => inFilter![1].includes(r[inFilter![0]]));
          return { data: data.length ? data[data.length - 1] : null, error: null };
        },
        then: (resolve: any) => {
          // Awaiting the chain directly (select paths without maybeSingle).
          let data = applyFilters(rows, filters);
          if (inFilter) data = data.filter((r) => inFilter![1].includes(r[inFilter![0]]));
          return Promise.resolve({ data, error: null }).then(resolve);
        },
        insert: (payload: any) => {
          rows.push({ id: `row-${nextId}`, ts: `2026-08-13T1${nextId}:00:00Z`, ext_id: null, ...payload });
          nextId++;
          return Promise.resolve({ error: null });
        },
        upsert: (payloads: any[], _opts: any) => {
          for (const p of payloads) {
            if (p.ext_id && rows.some((r) => r.user_id === p.user_id && r.ext_id === p.ext_id)) continue;
            rows.push({ id: `row-${nextId}`, ts: `2026-08-13T1${nextId}:00:00Z`, ...p });
            nextId++;
          }
          return Promise.resolve({ error: null });
        },
        delete: () => {
          const delChain: any = {
            eq: (col: string, val: any) => { filters.push([col, val]); return delChain; },
            then: (resolve: any) => {
              const doomed = new Set(applyFilters(rows, filters).map((r) => r.id));
              rows = rows.filter((r) => !doomed.has(r.id));
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
          return delChain;
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;

  return { client, rows: () => rows };
}

describe('addWater', () => {
  it('rejects a non-finite amount without touching the table', async () => {
    const { client, rows } = fakeTable();
    const result = await addWater(client, NaN);
    expect(result).toEqual({ ok: false, error: 'Invalid amount.' });
    expect(rows()).toHaveLength(0);
  });

  it('rejects zero and negative amounts — no negative water', async () => {
    const { client, rows } = fakeTable();
    expect(await addWater(client, 0)).toEqual({ ok: false, error: 'Invalid amount.' });
    expect(await addWater(client, -250)).toEqual({ ok: false, error: 'Invalid amount.' });
    expect(rows()).toHaveLength(0);
  });

  it('inserts a manual event row and returns the day total', async () => {
    const { client, rows } = fakeTable([{ date: '2026-08-13', ml: 500 }]);
    const result = await addWater(client, 250.4, '2026-08-13');
    expect(result).toEqual({ ok: true, data: 750 });
    expect(rows()).toHaveLength(2);
    expect(rows()[1]).toMatchObject({ ml: 250, source: 'manual', date: '2026-08-13' });
  });
});

describe('getWaterForDay', () => {
  it('returns 0 when nothing is logged', async () => {
    const { client } = fakeTable();
    expect(await getWaterForDay(client, '2026-08-13')).toEqual({ ok: true, data: 0 });
  });

  it('sums the day rows and ignores other days', async () => {
    const { client } = fakeTable([
      { date: '2026-08-13', ml: 250 },
      { date: '2026-08-13', ml: 500 },
      { date: '2026-08-12', ml: 999 },
    ]);
    expect(await getWaterForDay(client, '2026-08-13')).toEqual({ ok: true, data: 750 });
  });
});

describe('undoLastWater', () => {
  it('removes the latest manual row only', async () => {
    const { client, rows } = fakeTable([
      { date: '2026-08-13', ml: 250, source: 'manual' },
      { date: '2026-08-13', ml: 300, source: 'health_connect', ext_id: 'hc-1' },
      { date: '2026-08-13', ml: 250, source: 'manual' },
    ]);
    const result = await undoLastWater(client, '2026-08-13');
    expect(result).toEqual({ ok: true, data: 550 });
    expect(rows().filter((r) => r.source === 'manual')).toHaveLength(1);
    expect(rows().some((r) => r.ext_id === 'hc-1')).toBe(true);
  });

  it('is a no-op when there is no manual row', async () => {
    const { client } = fakeTable([{ date: '2026-08-13', ml: 300, source: 'health_connect', ext_id: 'hc-1' }]);
    expect(await undoLastWater(client, '2026-08-13')).toEqual({ ok: true, data: 300 });
  });
});

describe('importHcHydration', () => {
  it('imports only unseen record ids and reports an honest addedMl', async () => {
    const { client, rows } = fakeTable([
      { date: '2026-08-13', ml: 100, source: 'health_connect', ext_id: 'a' },
    ]);
    const result = await importHcHydration(client, {
      records: [
        { id: 'a', ml: 100 },
        { id: 'b', ml: 150, dataOrigin: 'com.sec.android.app.shealth' },
        { id: 'c', ml: 50 },
      ],
      date: '2026-08-13',
    });
    expect(result).toEqual({ ok: true, data: { addedMl: 200, total: 300 } });
    expect(rows()).toHaveLength(3);
    expect(rows().find((r) => r.ext_id === 'b')?.source).toBe('health_connect:com.sec.android.app.shealth');
    expect(rows().find((r) => r.ext_id === 'c')?.source).toBe('health_connect');
  });

  it('re-import of the same records adds nothing (idempotent)', async () => {
    const { client, rows } = fakeTable();
    const input = { records: [{ id: 'a', ml: 100 }, { id: 'b', ml: 150 }], date: '2026-08-13' };
    await importHcHydration(client, input);
    const second = await importHcHydration(client, input);
    expect(second).toEqual({ ok: true, data: { addedMl: 0, total: 250 } });
    expect(rows()).toHaveLength(2);
  });

  it('skips invalid records (no id / non-positive ml) without failing', async () => {
    const { client, rows } = fakeTable();
    const result = await importHcHydration(client, {
      records: [{ id: '', ml: 100 }, { id: 'x', ml: 0 }, { id: 'y', ml: NaN }],
      date: '2026-08-13',
    });
    expect(result).toEqual({ ok: true, data: { addedMl: 0, total: 0 } });
    expect(rows()).toHaveLength(0);
  });

  it('manual taps still add on top of imported records', async () => {
    const { client } = fakeTable();
    await importHcHydration(client, { records: [{ id: 'a', ml: 300 }], date: '2026-08-13' });
    const after = await addWater(client, 250, '2026-08-13');
    expect(after).toEqual({ ok: true, data: 550 });
  });
});

describe('resetWater', () => {
  it('deletes all of the day rows and returns 0', async () => {
    const { client, rows } = fakeTable([
      { date: '2026-08-13', ml: 250 },
      { date: '2026-08-13', ml: 300, source: 'health_connect', ext_id: 'a' },
      { date: '2026-08-12', ml: 400 },
    ]);
    const result = await resetWater(client, '2026-08-13');
    expect(result).toEqual({ ok: true, data: 0 });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.date).toBe('2026-08-12');
  });
});

describe('getHydrationLogsForDay', () => {
  it('maps rows for the day', async () => {
    const { client } = fakeTable([
      { date: '2026-08-13', ml: 250 },
      { date: '2026-08-12', ml: 400 },
    ]);
    const result = await getHydrationLogsForDay(client, '2026-08-13');
    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toHaveLength(1);
    expect(result.ok && result.data[0]).toMatchObject({ ml: 250, date: '2026-08-13', source: 'manual', extId: null });
  });
});

describe('auth failures', () => {
  it('propagate from currentUserId on every entry point', async () => {
    mockedCurrentUserId.mockResolvedValue({ ok: false, error: 'not signed in' });
    const { client } = fakeTable();
    expect(await addWater(client, 250)).toEqual({ ok: false, error: 'not signed in' });
    expect(await getWaterForDay(client)).toEqual({ ok: false, error: 'not signed in' });
    expect(await importHcHydration(client, { records: [{ id: 'a', ml: 1 }] })).toEqual({ ok: false, error: 'not signed in' });
    expect(await resetWater(client)).toEqual({ ok: false, error: 'not signed in' });
  });
});
