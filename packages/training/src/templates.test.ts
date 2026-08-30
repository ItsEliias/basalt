import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as coreData from '@basalt/core-data';

vi.mock('@basalt/core-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@basalt/core-data')>();
  return { ...actual, currentUserId: vi.fn() };
});

import { saveTemplate, listTemplates, getTemplateDetail, deleteTemplate, duplicateTemplate, startSessionFromTemplate } from './templates';

const mockedCurrentUserId = vi.mocked(coreData.currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  mockedCurrentUserId.mockResolvedValue({ ok: true, data: 'user-1' });
});

const templateRow = {
  id: 'tpl-1', user_id: 'user-1', name: 'Pull — Week 1', location: 'gym',
  notes: null, created_at: '2026-08-21T09:00:00Z',
};

const exerciseRows = [
  { id: 'te-1', template_id: 'tpl-1', user_id: 'user-1', exercise_id: 'ex-1', exercise_name: 'Lat Pulldown', order_index: 0, target_sets: 4, target_reps: 8, target_weight_kg: 60 },
  { id: 'te-2', template_id: 'tpl-1', user_id: 'user-1', exercise_id: null, exercise_name: 'Face Pull', order_index: 1, target_sets: 3, target_reps: 15, target_weight_kg: null },
];

/** Routes .from(table) calls to per-table handlers — mirrors the real client's shape closely enough for these services. */
function tableClient(handlers: Record<string, any>): SupabaseClient {
  return { from: (table: string) => handlers[table]() } as unknown as SupabaseClient;
}

describe('saveTemplate', () => {
  it('propagates auth errors without inserting', async () => {
    mockedCurrentUserId.mockResolvedValue({ ok: false, error: 'not signed in' });
    const insert = vi.fn();
    const client = tableClient({ basalt_workout_templates: () => ({ insert }) });
    expect(await saveTemplate(client, { name: 'X', location: 'gym', exercises: [] })).toEqual({ ok: false, error: 'not signed in' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts the template then its exercises in order', async () => {
    const templatePayloads: any[] = [];
    const exercisePayloads: any[] = [];
    const client = tableClient({
      basalt_workout_templates: () => ({
        insert: (p: any) => { templatePayloads.push(p); return { select: () => ({ single: async () => ({ data: templateRow, error: null }) }) }; },
      }),
      basalt_template_exercises: () => ({
        insert: async (p: any) => { exercisePayloads.push(p); return { error: null }; },
      }),
    });

    const result = await saveTemplate(client, {
      name: 'Pull — Week 1',
      location: 'gym',
      exercises: [
        { exerciseId: 'ex-1', exerciseName: 'Lat Pulldown', targetSets: 4, targetReps: 8, targetWeightKg: 60 },
        { exerciseName: 'Face Pull', targetSets: 3, targetReps: 15 },
      ],
    });

    expect(templatePayloads[0]).toEqual({ user_id: 'user-1', name: 'Pull — Week 1', location: 'gym', notes: null });
    expect(exercisePayloads[0]).toEqual([
      { template_id: 'tpl-1', user_id: 'user-1', exercise_id: 'ex-1', exercise_name: 'Lat Pulldown', order_index: 0, target_sets: 4, target_reps: 8, target_weight_kg: 60 },
      { template_id: 'tpl-1', user_id: 'user-1', exercise_id: null, exercise_name: 'Face Pull', order_index: 1, target_sets: 3, target_reps: 15, target_weight_kg: null },
    ]);
    expect(result.ok && result.data.id).toBe('tpl-1');
  });
});

describe('listTemplates', () => {
  it('maps rows for the authed user', async () => {
    const client = tableClient({
      basalt_workout_templates: () => ({
        select: () => ({ eq: () => ({ order: async () => ({ data: [templateRow], error: null }) }) }),
      }),
    });
    const result = await listTemplates(client);
    expect(result.ok && result.data).toHaveLength(1);
    expect(result.ok && result.data[0]!.location).toBe('gym');
  });
});

describe('getTemplateDetail', () => {
  it('joins the template with its ordered exercises', async () => {
    const client = tableClient({
      basalt_workout_templates: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: templateRow, error: null }) }) }) }),
      basalt_template_exercises: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: exerciseRows, error: null }) }) }) }),
    });
    const result = await getTemplateDetail(client, 'tpl-1');
    expect(result.ok && result.data.exercises).toHaveLength(2);
    expect(result.ok && result.data.exercises[0]).toMatchObject({ exerciseName: 'Lat Pulldown', targetSets: 4, targetReps: 8, targetWeightKg: 60 });
    expect(result.ok && result.data.exercises[1]).toMatchObject({ exerciseName: 'Face Pull', targetWeightKg: null });
  });

  it('errors when the template is not found', async () => {
    const client = tableClient({
      basalt_workout_templates: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: 'no rows' } }) }) }) }),
    });
    const result = await getTemplateDetail(client, 'missing');
    expect(result.ok).toBe(false);
  });
});

describe('deleteTemplate', () => {
  it('deletes by id', async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const client = tableClient({ basalt_workout_templates: () => ({ delete: () => ({ eq }) }) });
    expect(await deleteTemplate(client, 'tpl-1')).toEqual({ ok: true, data: undefined });
    expect(eq).toHaveBeenCalledWith('id', 'tpl-1');
  });
});

describe('duplicateTemplate — "duplicate a week"', () => {
  it('copies the source template exercises into a newly named template', async () => {
    const templatePayloads: any[] = [];
    const client = tableClient({
      basalt_workout_templates: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: templateRow, error: null }) }) }),
        insert: (p: any) => { templatePayloads.push(p); return { select: () => ({ single: async () => ({ data: { ...templateRow, id: 'tpl-2', name: 'Pull — Week 2' }, error: null }) }) }; },
      }),
      basalt_template_exercises: () => ({
        select: () => ({ eq: () => ({ order: async () => ({ data: exerciseRows, error: null }) }) }),
        insert: async () => ({ error: null }),
      }),
    });

    const result = await duplicateTemplate(client, 'tpl-1', 'Pull — Week 2');
    expect(templatePayloads[0].name).toBe('Pull — Week 2');
    expect(templatePayloads[0].location).toBe('gym');
    expect(result.ok && result.data.name).toBe('Pull — Week 2');
  });
});

describe('startSessionFromTemplate', () => {
  it('creates a session and returns the template exercises with targets for the caller to add', async () => {
    const client = tableClient({
      basalt_workout_templates: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: templateRow, error: null }) }) }) }),
      basalt_template_exercises: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: exerciseRows, error: null }) }) }) }),
      basalt_workout_sessions: () => ({
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'sess-1', user_id: 'user-1', started_at: '2026-08-21T09:00:00Z', ended_at: null, notes: null, session_rpe: null, source: 'manual', created_at: '2026-08-21T09:00:00Z' }, error: null }) }) }),
      }),
    });

    const result = await startSessionFromTemplate(client, 'tpl-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.session.id).toBe('sess-1');
    expect(result.data.exercises).toHaveLength(2);
    expect(result.data.exercises[0]).toMatchObject({ exerciseName: 'Lat Pulldown', targetSets: 4, targetReps: 8, targetWeightKg: 60 });
    expect(result.data.exercises[1]).toMatchObject({ exerciseName: 'Face Pull', targetWeightKg: null });
  });
});
