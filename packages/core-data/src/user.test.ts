import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUserId } from './user';

// Minimal hand-rolled mock — only the `auth.getUser()` surface this
// function touches. No live Supabase, no network.
function mockClient(getUserResult: {
  data: { user: { id: string } | null };
  error: { message: string } | null;
}): SupabaseClient {
  return {
    auth: {
      getUser: async () => getUserResult,
    },
  } as unknown as SupabaseClient;
}

describe('currentUserId', () => {
  it('returns the user id on success', async () => {
    const client = mockClient({ data: { user: { id: 'user-1' } }, error: null });
    expect(await currentUserId(client)).toEqual({ ok: true, data: 'user-1' });
  });

  it('propagates the auth error message', async () => {
    const client = mockClient({ data: { user: null }, error: { message: 'network down' } });
    expect(await currentUserId(client)).toEqual({ ok: false, error: 'network down' });
  });

  it('returns "Not signed in." when there is no error but no user either', async () => {
    const client = mockClient({ data: { user: null }, error: null });
    expect(await currentUserId(client)).toEqual({ ok: false, error: 'Not signed in.' });
  });
});
