import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, type Result } from './result';
import { currentUserId } from './user';

// Sharing — read-only grants per docs/SHARING-RLS-DESIGN.md. The server
// enforces everything through RLS; this module is the registry, the
// presets (client conveniences only), and the thin service.
//
// Laws, pinned by test where copy allows:
//   · nothing shared by default — every domain explicit on the grant
//   · cycle is its own domain and NO preset ever bundles it
//   · revocation is a timestamp; access dies at the grantee's next query

export const SHARE_DOMAINS = [
  { key: 'training', label: 'Training', includes: 'sessions, sets, templates, program, race plan' },
  { key: 'activity', label: 'Activity', includes: 'walks WITHOUT routes, shoes, steps' },
  { key: 'nutrition', label: 'Nutrition', includes: 'food entries, day totals, water, targets' },
  { key: 'body', label: 'Body', includes: 'weigh-ins' },
  { key: 'sleep', label: 'Sleep', includes: 'sleep sessions — stages stay private' },
  { key: 'vitals', label: 'Vitals', includes: 'HRV, resting HR, evening check-ins' },
  { key: 'cycle', label: 'Cycle', includes: 'cycle tracking — never in any preset' },
] as const;

export type ShareDomain = (typeof SHARE_DOMAINS)[number]['key'];
export type ShareRole = 'coach' | 'caregiver' | 'custom';

/** Presets are starting points the user edits — the grant stores the list. */
export const SHARE_PRESETS: Record<Exclude<ShareRole, 'custom'>, ShareDomain[]> = {
  coach: ['training', 'activity', 'body'],
  caregiver: ['body', 'sleep', 'vitals'],
};

export type ShareGrant = {
  id: string;
  ownerId: string;
  granteeId: string | null;
  role: ShareRole;
  domains: ShareDomain[];
  inviteCode: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

/** "coach · training, activity, body · claimed" / "…waiting · code ABC12345". */
export function grantLine(g: ShareGrant): string {
  const state = g.revokedAt
    ? 'revoked'
    : g.granteeId
      ? 'claimed'
      : Date.parse(g.expiresAt) < Date.now()
        ? 'code expired'
        : `waiting · code ${g.inviteCode}`;
  return `${g.role} · ${g.domains.join(', ')} · ${state}`;
}

function mapRow(r: any): ShareGrant {
  return {
    id: r.id,
    ownerId: r.owner_id,
    granteeId: r.grantee_id ?? null,
    role: r.role,
    domains: r.domains ?? [],
    inviteCode: r.invite_code,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at ?? null,
    createdAt: r.created_at,
  };
}

export async function createShareGrant(
  client: SupabaseClient,
  role: ShareRole,
  domains: ShareDomain[],
): Promise<Result<ShareGrant>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  if (domains.length === 0) return err('Pick at least one thing to share.');
  const { data, error } = await client
    .from('basalt_share_grants')
    .insert({ owner_id: u.data, role, domains })
    .select()
    .single();
  if (error || !data) return err(error?.message ?? 'Could not create the grant.');
  return ok(mapRow(data));
}

export async function listMyGrants(client: SupabaseClient): Promise<Result<ShareGrant[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_share_grants')
    .select('*')
    .eq('owner_id', u.data)
    .order('created_at', { ascending: false });
  if (error) return err(error.message);
  return ok((data ?? []).map(mapRow));
}

export async function listSharedWithMe(client: SupabaseClient): Promise<Result<ShareGrant[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_share_grants')
    .select('*')
    .eq('grantee_id', u.data)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) return err(error.message);
  return ok((data ?? []).map(mapRow));
}

export async function revokeShareGrant(client: SupabaseClient, grantId: string): Promise<Result<void>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { error } = await client
    .from('basalt_share_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', grantId)
    .eq('owner_id', u.data);
  if (error) return err(error.message);
  return ok(undefined);
}

export async function redeemShareCode(client: SupabaseClient, code: string): Promise<Result<string>> {
  const { data, error } = await client.rpc('basalt_redeem_share_code', { p_code: code });
  if (error) return err(error.message);
  return ok(String(data));
}
