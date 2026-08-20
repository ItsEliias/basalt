import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeIlike, getExercises } from './exercises';

describe('escapeIlike (ported injection guard)', () => {
  it('escapes % and _ so they cannot act as wildcards', () => {
    expect(escapeIlike('100% bench_press')).toBe('100\\% bench\\_press');
    expect(escapeIlike('press')).toBe('press');
  });
});

describe('getExercises filter plumbing', () => {
  function recordingClient() {
    const calls: { method: string; args: any[] }[] = [];
    const chain: any = new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (prop === 'then') {
            return (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);
          }
          return (...args: any[]) => {
            calls.push({ method: prop, args });
            return chain;
          };
        },
      },
    );
    const client = { from: (table: string) => { calls.push({ method: 'from', args: [table] }); return chain; } };
    return { client: client as unknown as SupabaseClient, calls };
  }

  it('targets basalt_exercises and applies search + equipment filters', async () => {
    const { client, calls } = recordingClient();
    await getExercises(client, { search: '50%_press', equipment: ['barbell', 'dumbbell'], muscle: 'chest' });

    expect(calls.find((c) => c.method === 'from')?.args).toEqual(['basalt_exercises']);
    const ilike = calls.find((c) => c.method === 'ilike');
    expect(ilike?.args).toEqual(['name', '%50\\%\\_press%']);
    const inCall = calls.find((c) => c.method === 'in');
    expect(inCall?.args).toEqual(['equipment', ['barbell', 'dumbbell']]);
    const contains = calls.find((c) => c.method === 'contains');
    expect(contains?.args).toEqual(['primary_muscles', ['chest']]);
  });

  it('skips the ilike clause for blank search text', async () => {
    const { client, calls } = recordingClient();
    await getExercises(client, { search: '   ' });
    expect(calls.some((c) => c.method === 'ilike')).toBe(false);
  });
});
