import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as coreData from '@basalt/core-data';

vi.mock('@basalt/core-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@basalt/core-data')>();
  return { ...actual, currentUserId: vi.fn() };
});

import { recordFoodUse, listFavorites, frequentAtHour } from './favorites';

const mockedCurrentUserId = vi.mocked(coreData.currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  mockedCurrentUserId.mockResolvedValue({ ok: true, data: 'user-1' });
});

const favRow = {
  id: 'fav-1', user_id: 'user-1', food_name: 'Protein shake', brand: null,
  calories: 244, protein: 48, carbs: 6, fat: 3, fiber: 0, sugar: 2, sodium_mg: 120,
  saturated_fat: 1, serving_size: 60, serving_unit: 'g', quantity: 2, barcode: null,
  use_count: 31, last_used_at: '2026-08-19T12:40:00Z', created_at: '2026-06-01T00:00:00Z',
};

describe('recordFoodUse', () => {
  it('creates the favorite on first use', async () => {
    const inserts: any[] = [];
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: null, error: null }) }), maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
        insert: (p: any) => { inserts.push(p); return { select: () => ({ single: async () => ({ data: { ...favRow, use_count: 1 }, error: null }) }) }; },
      }),
    } as unknown as SupabaseClient;

    const result = await recordFoodUse(client, {
      foodName: 'Protein shake', calories: 244, protein: 48, carbs: 6, fat: 3, fiber: 0,
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ user_id: 'user-1', food_name: 'Protein shake' });
    expect(result.ok && result.data.foodName).toBe('Protein shake');
  });

  it('bumps use_count + last_used_at on repeat use', async () => {
    const updates: any[] = [];
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: favRow, error: null }) }), maybeSingle: async () => ({ data: favRow, error: null }) }) }),
        }),
        update: (p: any) => { updates.push(p); return { eq: () => ({ select: () => ({ single: async () => ({ data: { ...favRow, use_count: 32 }, error: null }) }) }) }; },
      }),
    } as unknown as SupabaseClient;

    const result = await recordFoodUse(client, {
      foodName: 'Protein shake', calories: 244, protein: 48, carbs: 6, fat: 3, fiber: 0,
    });
    expect(updates[0]?.use_count).toBe(32);
    expect(typeof updates[0]?.last_used_at).toBe('string');
    expect(result.ok && result.data.useCount).toBe(32);
  });
});

describe('listFavorites', () => {
  it('maps rows ordered by the query (use_count desc)', async () => {
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit: async () => ({ data: [favRow], error: null }) }) }) }) }),
      }),
    } as unknown as SupabaseClient;
    const result = await listFavorites(client);
    expect(result.ok && result.data[0]?.useCount).toBe(31);
  });
});

describe('frequentAtHour — the "frequent at this hour" ranking', () => {
  const entries = [
    // Lunchtime bowl, logged repeatedly around 12:30–13:15 local.
    { foodName: 'Chicken & brown rice bowl', createdAt: '2026-08-01T12:30:00', calories: 638 },
    { foodName: 'Chicken & brown rice bowl', createdAt: '2026-08-03T12:48:00', calories: 638 },
    { foodName: 'Chicken & brown rice bowl', createdAt: '2026-08-05T13:15:00', calories: 638 },
    // Also at lunch, less often.
    { foodName: 'Tuna, avocado & rye', createdAt: '2026-08-02T12:10:00', calories: 486 },
    { foodName: 'Tuna, avocado & rye', createdAt: '2026-08-06T12:20:00', calories: 486 },
    // Breakfast food — must not rank at lunch.
    { foodName: 'Greek yoghurt & oats', createdAt: '2026-08-04T07:12:00', calories: 412 },
  ];

  it('ranks by frequency near the given hour and excludes other meal times', () => {
    const ranked = frequentAtHour(entries, 13);
    expect(ranked.map((r) => r.foodName)).toEqual(['Chicken & brown rice bowl', 'Tuna, avocado & rye']);
    expect(ranked[0]?.count).toBe(3);
  });

  it('reports the honest typical-time range from real logs', () => {
    const ranked = frequentAtHour(entries, 13);
    expect(ranked[0]?.typicalRange).toEqual({ fromMin: 12 * 60 + 30, toMin: 13 * 60 + 15 });
    // A single occurrence has no "usual" — range stays null instead of faking one.
    const one = frequentAtHour(entries, 7);
    expect(one[0]?.typicalRange).toBeNull();
  });

  it('handles the midnight wrap', () => {
    const late = [
      { foodName: 'Late snack', createdAt: '2026-08-01T23:50:00', calories: 200 },
      { foodName: 'Late snack', createdAt: '2026-08-02T00:20:00', calories: 200 },
    ];
    expect(frequentAtHour(late, 0)[0]?.count).toBe(2);
  });

  it('returns [] with no nearby history — the card hides itself', () => {
    expect(frequentAtHour(entries, 17)).toEqual([]);
  });
});
