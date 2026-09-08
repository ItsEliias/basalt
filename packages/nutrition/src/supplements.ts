import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';

// Supplements checklist (supplements Extra) — the user's own list, ticked
// per day. The law, pinned by test: Basalt never suggests a product and
// never proposes a dose. dose_note is the user's words, stored verbatim
// and rendered verbatim.

export const SUPPLEMENTS_LAW =
  'Your list, your words — Basalt never suggests a product or proposes a dose.';

export type Supplement = {
  id: string;
  name: string;
  doseNote: string | null;
  createdAt: string;
};

const mapSupplement = (r: any): Supplement => ({
  id: r.id,
  name: r.name,
  doseNote: r.dose_note ?? null,
  createdAt: r.created_at,
});

/** Trim + collapse whitespace; empty means invalid. */
export function cleanSupplementName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  return name.length > 0 && name.length <= 80 ? name : null;
}

export async function listSupplements(client: SupabaseClient): Promise<Result<Supplement[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_supplements')
    .select('*')
    .eq('user_id', u.data)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) return err(error.message);
  return ok((data ?? []).map(mapSupplement));
}

export async function addSupplement(
  client: SupabaseClient,
  name: string,
  doseNote?: string,
): Promise<Result<Supplement>> {
  const cleaned = cleanSupplementName(name);
  if (!cleaned) return err('Give the supplement a name.');
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_supplements')
    .insert({ user_id: u.data, name: cleaned, dose_note: doseNote?.trim() || null })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not add it.');
  return ok(mapSupplement(data));
}

export async function archiveSupplement(client: SupabaseClient, id: string): Promise<Result<void>> {
  const { error } = await client
    .from('basalt_supplements')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return err(error.message);
  return ok(undefined);
}

/** The ticked supplement ids for one day. */
export async function checksForDay(client: SupabaseClient, dayIso: string): Promise<Result<Set<string>>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_supplement_checks')
    .select('supplement_id')
    .eq('user_id', u.data)
    .eq('day', dayIso);
  if (error) return err(error.message);
  return ok(new Set((data ?? []).map((r: any) => r.supplement_id as string)));
}

export async function setChecked(
  client: SupabaseClient,
  supplementId: string,
  dayIso: string,
  on: boolean,
): Promise<Result<void>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  if (on) {
    const { error } = await client
      .from('basalt_supplement_checks')
      .upsert({ user_id: u.data, supplement_id: supplementId, day: dayIso });
    if (error) return err(error.message);
    return ok(undefined);
  }
  const { error } = await client
    .from('basalt_supplement_checks')
    .delete()
    .eq('supplement_id', supplementId)
    .eq('day', dayIso);
  if (error) return err(error.message);
  return ok(undefined);
}
