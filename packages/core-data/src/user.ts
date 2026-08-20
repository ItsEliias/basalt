import type { SupabaseClient } from '@supabase/supabase-js';
import { type Result, ok, err } from './result';

// Same semantics as the source app's currentUserId() (byte-identical across 12
// service files), but takes the client as a parameter instead of
// importing a module-level singleton.
export async function currentUserId(client: SupabaseClient): Promise<Result<string>> {
  const { data, error } = await client.auth.getUser();
  if (error) return err(error.message);
  const id = data.user?.id;
  if (!id) return err('Not signed in.');
  return ok(id);
}
