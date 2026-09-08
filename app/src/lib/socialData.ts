import type { SupabaseClient } from '@supabase/supabase-js';

// Social Extra data layer — every read/write here touches ONLY the five
// V4 social tables (aggregates the owner publishes; RLS does the rest).
// Loaded exclusively by hosts rendering inside <ExtraSlot id="social">.

export type FriendRow = { userA: string; userB: string; createdAt: string };
export type InviteRow = { code: string; expiresAt: string; redeemedAt: string | null };
export type ChallengeRow = {
  id: string; creatorId: string; kind: 'steps' | 'sessions' | 'logged_days';
  startsOn: string; endsOn: string;
};

export async function myUserId(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

export async function listFriends(client: SupabaseClient): Promise<FriendRow[]> {
  const { data } = await client.from('basalt_friends').select('user_a, user_b, created_at');
  return (data ?? []).map((r: Record<string, string>) => ({
    userA: r.user_a!, userB: r.user_b!, createdAt: r.created_at!,
  }));
}

export async function createInvite(client: SupabaseClient, code: string): Promise<InviteRow | null> {
  const uid = await myUserId(client);
  if (!uid) return null;
  const { data, error } = await client
    .from('basalt_friend_invites')
    .insert({ owner_id: uid, code })
    .select('code, expires_at, redeemed_at')
    .single();
  if (error || !data) return null;
  return { code: data.code, expiresAt: data.expires_at, redeemedAt: data.redeemed_at };
}

export async function redeemInvite(client: SupabaseClient, code: string): Promise<{ ok: boolean; message: string }> {
  const { error } = await client.rpc('basalt_redeem_friend_invite', { invite_code: code });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'Friend added.' };
}

export async function createChallenge(
  client: SupabaseClient,
  input: { kind: ChallengeRow['kind']; startsOn: string; endsOn: string; displayName: string },
): Promise<{ ok: boolean; message?: string }> {
  const uid = await myUserId(client);
  if (!uid) return { ok: false, message: 'Not signed in.' };
  const { data, error } = await client
    .from('basalt_challenges')
    .insert({ creator_id: uid, kind: input.kind, starts_on: input.startsOn, ends_on: input.endsOn })
    .select('id')
    .single();
  if (error || !data) return { ok: false, message: error?.message };
  const joined = await client
    .from('basalt_challenge_members')
    .insert({ challenge_id: data.id, user_id: uid, display_name: input.displayName });
  return joined.error ? { ok: false, message: joined.error.message } : { ok: true };
}

export async function myChallenges(client: SupabaseClient): Promise<ChallengeRow[]> {
  const { data } = await client
    .from('basalt_challenges')
    .select('id, creator_id, kind, starts_on, ends_on')
    .order('starts_on', { ascending: false })
    .limit(10);
  return (data ?? []).map((r: Record<string, string>) => ({
    id: r.id!, creatorId: r.creator_id!, kind: r.kind as ChallengeRow['kind'],
    startsOn: r.starts_on!, endsOn: r.ends_on!,
  }));
}

export async function challengeBoard(client: SupabaseClient, challengeId: string): Promise<{
  members: { userId: string; displayName: string }[];
  progress: { userId: string; day: string; value: number }[];
}> {
  const [{ data: members }, { data: progress }] = await Promise.all([
    client.from('basalt_challenge_members').select('user_id, display_name').eq('challenge_id', challengeId),
    client.from('basalt_challenge_progress').select('user_id, day, value').eq('challenge_id', challengeId),
  ]);
  return {
    members: (members ?? []).map((r: Record<string, string>) => ({ userId: r.user_id!, displayName: r.display_name! })),
    progress: (progress ?? []).map((r: Record<string, unknown>) => ({
      userId: String(r.user_id), day: String(r.day), value: Number(r.value),
    })),
  };
}

/** Publish today's aggregates: my logged-today boolean + per-challenge value. */
export async function publishToday(
  client: SupabaseClient,
  input: { day: string; loggedAnything: boolean; perChallenge: { challengeId: string; value: number }[] },
): Promise<void> {
  const uid = await myUserId(client);
  if (!uid) return;
  await client.from('basalt_friend_days').upsert(
    { user_id: uid, day: input.day, logged: input.loggedAnything, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,day' },
  );
  for (const c of input.perChallenge) {
    await client.from('basalt_challenge_progress').upsert(
      { challenge_id: c.challengeId, user_id: uid, day: input.day, value: c.value, updated_at: new Date().toISOString() },
      { onConflict: 'challenge_id,user_id,day' },
    );
  }
}

/** How many accepted friends logged today (self excluded). */
export async function friendsLoggedToday(client: SupabaseClient, day: string): Promise<number> {
  const uid = await myUserId(client);
  if (!uid) return 0;
  const { data } = await client
    .from('basalt_friend_days')
    .select('user_id, logged')
    .eq('day', day)
    .eq('logged', true);
  return (data ?? []).filter((r: Record<string, unknown>) => r.user_id !== uid).length;
}
