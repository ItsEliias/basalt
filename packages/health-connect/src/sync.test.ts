import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as coreData from '@basalt/core-data';
import * as nutrition from '@basalt/nutrition';

vi.mock('@basalt/core-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@basalt/core-data')>();
  return { ...actual, currentUserId: vi.fn() };
});
vi.mock('@basalt/nutrition', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@basalt/nutrition')>();
  return { ...actual, importHcHydration: vi.fn(), importHcMeal: vi.fn() };
});

import { syncHealthData } from './sync';
import { stubProvider } from './stubProvider';
import type { HealthProvider } from './types';

const mockedCurrentUserId = vi.mocked(coreData.currentUserId);
const mockedHydration = vi.mocked(nutrition.importHcHydration);
const mockedMeal = vi.mocked(nutrition.importHcMeal);

beforeEach(() => {
  vi.clearAllMocks();
  mockedCurrentUserId.mockResolvedValue({ ok: true, data: 'user-1' });
  mockedHydration.mockResolvedValue({ ok: true, data: { addedMl: 0, total: 0 } });
  mockedMeal.mockResolvedValue({ ok: true, data: 'imported' });
});

const SLEEP = {
  id: 'hc-sleep-1',
  startTime: '2026-08-20T13:41:00Z',
  endTime: '2026-08-20T21:02:00Z',
  hours: 7.35,
  hasRealStages: true,
  dataOrigin: 'com.sec.android.app.shealth',
  stages: [
    { stage: 'deep' as const, startTime: '2026-08-20T13:41:00Z', endTime: '2026-08-20T14:53:00Z', minutes: 72 },
    { stage: 'light' as const, startTime: '2026-08-20T14:53:00Z', endTime: '2026-08-20T18:00:00Z', minutes: 187 },
    { stage: 'rem' as const, startTime: '2026-08-20T18:00:00Z', endTime: '2026-08-20T21:02:00Z', minutes: 182 },
  ],
};

/** A provider granting everything, returning data for day 0 only. */
function fakeProvider(overrides: Partial<HealthProvider> = {}): HealthProvider {
  let sleepServed = false;
  let stepsServed = false;
  let weightServed = false;
  return {
    ...stubProvider,
    isAvailable: async () => ({ ok: true, data: 'available' }),
    getGrantedPermissions: async () => ({ ok: true, data: ['sleep', 'steps', 'weight', 'hydration', 'nutrition'] }),
    getSleepSessionForNight: async () => {
      if (sleepServed) return { ok: true, data: null };
      sleepServed = true;
      return { ok: true, data: SLEEP };
    },
    getStepsForDay: async () => {
      if (stepsServed) return { ok: true, data: 0 };
      stepsServed = true;
      return { ok: true, data: 8412 };
    },
    getWeightForDay: async () => {
      if (weightServed) return { ok: true, data: [] };
      weightServed = true;
      return { ok: true, data: [{ kg: 81.4, time: '2026-08-20T20:00:00Z', dataOrigin: 'com.withings.wiscale2' }] };
    },
    getHydrationForDay: async () => ({ ok: true, data: { totalMl: 0, recordIds: [], records: [] } }),
    getNutritionForDay: async () => ({ ok: true, data: [] }),
    ...overrides,
  };
}

/** Stateful fake of the three tables sync writes directly. */
function fakeDb(seed: { sleepExtIds?: string[]; weightExtIds?: string[] } = {}) {
  const writes = { sleep: [] as any[], stages: [] as any[], steps: [] as any[], weights: [] as any[] };
  const sleepExtIds = new Set(seed.sleepExtIds ?? []);
  const weightExtIds = new Set(seed.weightExtIds ?? []);

  const client = {
    from: (table: string) => {
      if (table === 'basalt_sleep_sessions') {
        return {
          select: () => ({
            eq: () => ({
              eq: (_c: string, extId: string) => ({
                maybeSingle: async () => ({ data: sleepExtIds.has(extId) ? { id: 'existing' } : null, error: null }),
              }),
            }),
          }),
          insert: (payload: any) => {
            writes.sleep.push(payload);
            return { select: () => ({ single: async () => ({ data: { id: 'sess-new' }, error: null }) }) };
          },
        };
      }
      if (table === 'basalt_sleep_stages') {
        return { insert: async (rows: any[]) => { writes.stages.push(...rows); return { error: null }; } };
      }
      if (table === 'basalt_step_logs') {
        return { upsert: async (payload: any) => { writes.steps.push(payload); return { error: null }; } };
      }
      if (table === 'basalt_weight_entries') {
        return {
          select: () => ({
            eq: () => ({
              in: async (_c: string, ids: string[]) => ({
                data: ids.filter((i) => weightExtIds.has(i)).map((i) => ({ ext_id: i })),
                error: null,
              }),
            }),
          }),
          insert: async (rows: any[]) => { writes.weights.push(...rows); return { error: null }; },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  return { client, writes };
}

describe('syncHealthData', () => {
  it('persists a sleep night WITH its stages, steps, and weight', async () => {
    const { client, writes } = fakeDb();
    const r = await syncHealthData(client, fakeProvider(), { days: 2 });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.sleepSessions).toBe(1);
    expect(r.data.sleepStages).toBe(3);
    expect(r.data.stepDays).toBe(1);
    expect(r.data.weights).toBe(1);
    expect(r.data.skipped).toEqual([]);

    expect(writes.sleep[0]).toMatchObject({
      user_id: 'user-1', ext_id: 'hc-sleep-1',
      source: 'health_connect:com.sec.android.app.shealth',
    });
    expect(writes.stages.map((s) => s.stage)).toEqual(['deep', 'light', 'rem']);
    expect(writes.stages.every((s) => s.session_id === 'sess-new' && s.user_id === 'user-1')).toBe(true);
    expect(writes.steps[0]).toMatchObject({ steps: 8412, source: 'health_connect' });
    expect(writes.weights[0]).toMatchObject({
      weight_kg: 81.4, ext_id: 'hc:2026-08-20T20:00:00Z',
      source: 'health_connect:com.withings.wiscale2',
    });
  });

  it('re-sync is a no-op when ext ids already exist (idempotent)', async () => {
    const { client, writes } = fakeDb({
      sleepExtIds: ['hc-sleep-1'],
      weightExtIds: ['hc:2026-08-20T20:00:00Z'],
    });
    const r = await syncHealthData(client, fakeProvider(), { days: 1 });
    expect(r.ok && r.data.sleepSessions).toBe(0);
    expect(r.ok && r.data.weights).toBe(0);
    expect(writes.sleep).toHaveLength(0);
    expect(writes.stages).toHaveLength(0);
    expect(writes.weights).toHaveLength(0);
  });

  it('skips ungranted readers and reports them instead of failing', async () => {
    const provider = fakeProvider({
      getGrantedPermissions: async () => ({ ok: true, data: ['steps'] }),
    });
    const { client, writes } = fakeDb();
    const r = await syncHealthData(client, provider, { days: 1 });
    expect(r.ok && r.data.skipped.sort()).toEqual(['hydration', 'nutrition', 'sleep', 'weight']);
    expect(r.ok && r.data.stepDays).toBe(1);
    expect(writes.sleep).toHaveLength(0);
  });

  it('an unavailable provider reports itself and writes nothing', async () => {
    const provider = fakeProvider({ isAvailable: async () => ({ ok: true, data: 'provider_not_installed' }) });
    const { client, writes } = fakeDb();
    const r = await syncHealthData(client, provider, { days: 3 });
    expect(r.ok && r.data.skipped).toEqual(['provider_unavailable']);
    expect(writes.steps).toHaveLength(0);
  });

  it('routes hydration and meals through the nutrition importers with real ids', async () => {
    const provider = fakeProvider({
      getHydrationForDay: async () => ({
        ok: true,
        data: { totalMl: 300, recordIds: ['h1'], records: [{ id: 'h1', ml: 300, dataOrigin: 'com.google.android.apps.fitness' }] },
      }),
      getNutritionForDay: async () => ({
        ok: true,
        data: [{
          id: 'n1', name: 'Synced lunch', mealType: 'lunch' as const, time: '2026-08-20T02:00:00Z',
          calories: 600, protein: 40, carbs: 60, fat: 20, fiber: 5, dataOrigin: 'com.myfitnesspal.android',
        }],
      }),
    });
    mockedHydration.mockResolvedValue({ ok: true, data: { addedMl: 300, total: 300 } });
    const { client } = fakeDb();
    const r = await syncHealthData(client, provider, { days: 1 });

    expect(r.ok && r.data.hydrationMl).toBe(300);
    expect(r.ok && r.data.meals).toBe(1);
    expect(mockedHydration.mock.calls[0]?.[1]).toMatchObject({ records: [{ id: 'h1', ml: 300 }] });
    expect(mockedMeal.mock.calls[0]?.[1]).toMatchObject({ extId: 'n1', foodName: 'Synced lunch' });
  });

  it('propagates auth failure', async () => {
    mockedCurrentUserId.mockResolvedValue({ ok: false, error: 'not signed in' });
    const { client } = fakeDb();
    expect(await syncHealthData(client, fakeProvider())).toEqual({ ok: false, error: 'not signed in' });
  });
});
