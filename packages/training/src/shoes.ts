import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';

// Shoe mileage — walks attribute distance to a named shoe; the wear
// threshold is the USER'S number. The app's whole editorial voice on the
// subject is the one srcnote below: published guidance, your call, no
// nagging — pinned by test.

export const SHOE_GUIDANCE =
  'Most published guidance suggests replacing running shoes around 500–800 km — set your own threshold; past it this row states the fact and nothing else.';

export type Shoe = {
  id: string;
  name: string;
  thresholdKm: number | null;
  retired: boolean;
  createdAt: string;
};

export type ShoeWithKm = Shoe & { km: number };

/** "612 km · past your 600 km threshold" — a fact, never an instruction. */
export function shoeStatusLine(km: number, thresholdKm: number | null): string {
  const base = `${Math.round(km)} km`;
  if (thresholdKm === null) return base;
  return km >= thresholdKm
    ? `${base} · past your ${Math.round(thresholdKm)} km threshold`
    : `${base} of your ${Math.round(thresholdKm)} km threshold`;
}

function mapRow(r: any): Shoe {
  return {
    id: r.id,
    name: r.name,
    thresholdKm: r.threshold_km === null || r.threshold_km === undefined ? null : Number(r.threshold_km),
    retired: !!r.retired,
    createdAt: r.created_at,
  };
}

/** Active shoes with lifetime km summed from their attributed walks. */
export async function listShoesWithKm(client: SupabaseClient): Promise<Result<ShoeWithKm[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const [shoes, walks] = await Promise.all([
    client.from('basalt_shoes').select('*').eq('user_id', u.data).eq('retired', false).order('created_at'),
    client.from('basalt_walks').select('shoe_id, distance_m').eq('user_id', u.data).not('shoe_id', 'is', null),
  ]);
  if (shoes.error) return err(shoes.error.message);
  if (walks.error) return err(walks.error.message);
  const kmByShoe = new Map<string, number>();
  for (const w of walks.data ?? []) {
    const r = w as any;
    kmByShoe.set(r.shoe_id, (kmByShoe.get(r.shoe_id) ?? 0) + Number(r.distance_m ?? 0) / 1000);
  }
  return ok((shoes.data ?? []).map((r) => ({ ...mapRow(r), km: kmByShoe.get((r as any).id) ?? 0 })));
}

export async function addShoe(client: SupabaseClient, name: string): Promise<Result<Shoe>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const trimmed = name.trim();
  if (!trimmed) return err('Give the shoe a name.');
  const { data, error } = await client
    .from('basalt_shoes')
    .insert({ user_id: u.data, name: trimmed })
    .select()
    .single();
  if (error || !data) return err(error?.message ?? 'Could not add the shoe.');
  return ok(mapRow(data));
}

export async function setShoeThreshold(
  client: SupabaseClient,
  shoeId: string,
  thresholdKm: number | null,
): Promise<Result<void>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { error } = await client
    .from('basalt_shoes')
    .update({ threshold_km: thresholdKm })
    .eq('id', shoeId)
    .eq('user_id', u.data);
  if (error) return err(error.message);
  return ok(undefined);
}

export async function retireShoe(client: SupabaseClient, shoeId: string): Promise<Result<void>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { error } = await client
    .from('basalt_shoes')
    .update({ retired: true })
    .eq('id', shoeId)
    .eq('user_id', u.data);
  if (error) return err(error.message);
  return ok(undefined);
}
