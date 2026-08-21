import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as coreData from '@basalt/core-data';

vi.mock('@basalt/core-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@basalt/core-data')>();
  return {
    ...actual,
    findOrCreateDailyLog: vi.fn(),
    currentUserId: vi.fn(),
  };
});

import {
  addFoodEntry, importHcMeal, getFoodEntriesForDay, getDailyTotals, deleteFoodEntry,
} from './food';

const mockedFindOrCreateDailyLog = vi.mocked(coreData.findOrCreateDailyLog);
const mockedCurrentUserId = vi.mocked(coreData.currentUserId);

const logRow = {
  id: 'log-1',
  userId: 'user-1',
  date: '2026-08-13',
  caloriesEaten: 0,
  caloriesBurned: 0,
  syncedAt: null,
  createdAt: '2026-08-13T00:00:00.000Z',
};

const entryRow = {
  id: 'entry-1',
  log_id: 'log-1',
  user_id: 'user-1',
  meal_type: 'breakfast',
  food_name: 'Oatmeal',
  brand: null,
  calories: 300,
  protein: 10,
  fat: 5,
  carbs: 40,
  fiber: 6,
  sugar: 4,
  sodium_mg: 120,
  saturated_fat: 1,
  serving_size: 100,
  serving_unit: 'g',
  quantity: 1,
  barcode: null,
  source: 'manual',
  ext_source: null,
  ext_id: null,
  created_at: '2026-08-13T08:00:00.000Z',
};

const input = {
  mealType: 'breakfast' as const,
  foodName: 'Oatmeal',
  calories: 300,
  protein: 10,
  fat: 5,
  carbs: 40,
  fiber: 6,
  sugar: 4,
  sodiumMg: 120,
  saturatedFat: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addFoodEntry', () => {
  it('propagates a findOrCreateDailyLog error without inserting', async () => {
    mockedFindOrCreateDailyLog.mockResolvedValue({ ok: false, error: 'not signed in' });
    const insert = vi.fn();
    const client = { from: () => ({ insert }) } as unknown as SupabaseClient;

    const result = await addFoodEntry(client, input);
    expect(result).toEqual({ ok: false, error: 'not signed in' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('builds the insert payload from the resolved log + user id and maps the row back', async () => {
    mockedFindOrCreateDailyLog.mockResolvedValue({ ok: true, data: logRow });
    const insertPayloads: any[] = [];
    const tables: string[] = [];
    const client = {
      from: (table: string) => {
        tables.push(table);
        return {
          insert: (payload: any) => {
            insertPayloads.push(payload);
            return { select: () => ({ single: async () => ({ data: entryRow, error: null }) }) };
          },
          select: () => ({ eq: () => ({}) }),
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        };
      },
    } as unknown as SupabaseClient;

    const result = await addFoodEntry(client, input);

    expect(mockedFindOrCreateDailyLog).toHaveBeenCalledWith(client, expect.any(String));
    expect(tables[0]).toBe('basalt_food_entries');
    expect(insertPayloads).toEqual([{
      log_id: 'log-1',
      user_id: 'user-1',
      meal_type: 'breakfast',
      food_name: 'Oatmeal',
      brand: null,
      calories: 300,
      protein: 10,
      fat: 5,
      carbs: 40,
      fiber: 6,
      sugar: 4,
      sodium_mg: 120,
      saturated_fat: 1,
      serving_size: 100,
      serving_unit: 'g',
      quantity: 1,
      barcode: null,
      source: 'manual',
      micros: null,
      photo_path: null,
    }]);
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'entry-1', logId: 'log-1', userId: 'user-1', mealType: 'breakfast', foodName: 'Oatmeal',
        brand: null, calories: 300, protein: 10, fat: 5, carbs: 40, fiber: 6,
        sugar: 4, sodiumMg: 120, saturatedFat: 1,
        servingSize: 100, servingUnit: 'g', quantity: 1, barcode: null, source: 'manual',
        photoPath: null, extSource: null, extId: null, micros: null, createdAt: entryRow.created_at,
      },
    });
  });

  it('returns an error when the insert fails', async () => {
    mockedFindOrCreateDailyLog.mockResolvedValue({ ok: true, data: logRow });
    const client = {
      from: () => ({
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'insert rejected' } }) }) }),
      }),
    } as unknown as SupabaseClient;

    const result = await addFoodEntry(client, input);
    expect(result).toEqual({ ok: false, error: 'insert rejected' });
  });
});

describe('importHcMeal', () => {
  const hcInput = { ...input, extId: 'hc-rec-1', dataOrigin: 'com.sec.android.app.shealth' };

  function dedupeClient(existing: { id: string } | null, insertPayloads: any[]): SupabaseClient {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
            }),
          }),
        }),
        insert: (payload: any) => {
          insertPayloads.push(payload);
          return { error: null };
        },
        update: () => ({ eq: async () => ({ data: null, error: null }) }),
      }),
    } as unknown as SupabaseClient;
  }

  it('rejects a missing HC record id up front', async () => {
    const client = {} as unknown as SupabaseClient;
    const result = await importHcMeal(client, { ...input, extId: '' });
    expect(result).toEqual({ ok: false, error: 'Missing Health Connect record id.' });
    expect(mockedFindOrCreateDailyLog).not.toHaveBeenCalled();
  });

  it('tags source with the HC package and stores ext columns when inserting', async () => {
    mockedFindOrCreateDailyLog.mockResolvedValue({ ok: true, data: logRow });
    const insertPayloads: any[] = [];
    const client = dedupeClient(null, insertPayloads);

    const result = await importHcMeal(client, hcInput);
    expect(result).toEqual({ ok: true, data: 'imported' });
    expect(insertPayloads[0].source).toBe('health_connect:com.sec.android.app.shealth');
    expect(insertPayloads[0].ext_source).toBe('health_connect');
    expect(insertPayloads[0].ext_id).toBe('hc-rec-1');
  });

  it('falls back to the bare "health_connect" tag when no dataOrigin is given', async () => {
    mockedFindOrCreateDailyLog.mockResolvedValue({ ok: true, data: logRow });
    const insertPayloads: any[] = [];
    const client = dedupeClient(null, insertPayloads);

    await importHcMeal(client, { ...input, extId: 'hc-rec-2' });
    expect(insertPayloads[0].source).toBe('health_connect');
  });

  it('returns "duplicate" without inserting when the HC record id already exists', async () => {
    mockedFindOrCreateDailyLog.mockResolvedValue({ ok: true, data: logRow });
    const insertPayloads: any[] = [];
    const client = dedupeClient({ id: 'existing' }, insertPayloads);

    const result = await importHcMeal(client, hcInput);
    expect(result).toEqual({ ok: true, data: 'duplicate' });
    expect(insertPayloads).toHaveLength(0);
  });
});

describe('getFoodEntriesForDay', () => {
  it('returns [] when no daily log exists for the date', async () => {
    mockedCurrentUserId.mockResolvedValue({ ok: true, data: 'user-1' });
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: 'PGRST116', message: 'no rows' } }) }) }) }) }),
    } as unknown as SupabaseClient;

    const result = await getFoodEntriesForDay(client, '2026-08-13');
    expect(result).toEqual({ ok: true, data: [] });
  });

  it('propagates a currentUserId error', async () => {
    mockedCurrentUserId.mockResolvedValue({ ok: false, error: 'not signed in' });
    const client = {} as unknown as SupabaseClient;
    const result = await getFoodEntriesForDay(client);
    expect(result).toEqual({ ok: false, error: 'not signed in' });
  });

  it('maps entries newest-first when a log exists', async () => {
    mockedCurrentUserId.mockResolvedValue({ ok: true, data: 'user-1' });
    let call = 0;
    const client = {
      from: (table: string) => {
        if (table === 'basalt_daily_logs') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'log-1' }, error: null }) }) }) }) };
        }
        call++;
        return { select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [entryRow], error: null }) }) }) }) };
      },
    } as unknown as SupabaseClient;

    const result = await getFoodEntriesForDay(client, '2026-08-13');
    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toHaveLength(1);
    expect(result.ok && result.data[0]?.foodName).toBe('Oatmeal');
    expect(call).toBe(1);
  });
});

describe('getDailyTotals — macro totals math', () => {
  it('sums multiple entries into a single totals block including caps', async () => {
    mockedCurrentUserId.mockResolvedValue({ ok: true, data: 'user-1' });
    const secondEntry = { ...entryRow, id: 'entry-2', calories: 200, protein: 20, fat: 2, carbs: 10, fiber: 1, sugar: 6, sodium_mg: 80 };
    const client = {
      from: (table: string) => {
        if (table === 'basalt_daily_logs') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'log-1' }, error: null }) }) }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [entryRow, secondEntry], error: null }) }) }) }) };
      },
    } as unknown as SupabaseClient;

    const result = await getDailyTotals(client, '2026-08-13');
    expect(result).toEqual({
      ok: true,
      data: { calories: 500, protein: 30, carbs: 50, fat: 7, fiber: 7, sugar: 10, sodiumMg: 200 },
    });
  });

  it('returns a zeroed totals block for a day with no entries', async () => {
    mockedCurrentUserId.mockResolvedValue({ ok: true, data: 'user-1' });
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: 'PGRST116', message: 'no rows' } }) }) }) }) }),
    } as unknown as SupabaseClient;

    const result = await getDailyTotals(client, '2026-08-13');
    expect(result).toEqual({ ok: true, data: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodiumMg: 0 } });
  });
});

describe('deleteFoodEntry', () => {
  it('deletes the row and refreshes the parent log total', async () => {
    mockedCurrentUserId.mockResolvedValue({ ok: true, data: 'user-1' });
    const updatePayloads: any[] = [];
    const client = {
      from: (table: string) => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { log_id: 'log-1' }, error: null }) }) }),
        delete: () => ({ eq: async () => ({ data: null, error: null }) }),
        update: (payload: any) => {
          updatePayloads.push({ table, payload });
          return { eq: async () => ({ data: null, error: null }) };
        },
      }),
    } as unknown as SupabaseClient;

    const result = await deleteFoodEntry(client, 'entry-1');
    expect(result).toEqual({ ok: true, data: undefined });
    // refreshDailyLogTotals is fire-and-forget; flush microtasks.
    await new Promise((r) => setTimeout(r, 0));
    expect(updatePayloads.some((u) => u.table === 'basalt_daily_logs')).toBe(true);
  });

  it('returns an error when the delete fails', async () => {
    mockedCurrentUserId.mockResolvedValue({ ok: true, data: 'user-1' });
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { log_id: 'log-1' }, error: null }) }) }),
        delete: () => ({ eq: async () => ({ data: null, error: { message: 'delete rejected' } }) }),
      }),
    } as unknown as SupabaseClient;

    const result = await deleteFoodEntry(client, 'entry-1');
    expect(result).toEqual({ ok: false, error: 'delete rejected' });
  });
});
