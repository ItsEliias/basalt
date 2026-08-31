import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';
import type { RaceKey } from './race-plans';

// Persistence for race plans — only the INPUTS live in the table (race,
// date, the one basis result, ticked keys). The plan itself recomputes
// from the published engine every time; storing it would let a stale copy
// disagree with the formula.

export type RacePlanRecord = {
  id: string;
  raceKey: RaceKey;
  raceDate: string;
  basisDistM: number;
  basisSeconds: number;
  done: string[];
  createdAt: string;
};

function mapRow(r: any): RacePlanRecord {
  return {
    id: r.id,
    raceKey: r.race_key,
    raceDate: r.race_date,
    basisDistM: Number(r.basis_dist_m),
    basisSeconds: Number(r.basis_seconds),
    done: Array.isArray(r.done) ? r.done.map(String) : [],
    createdAt: r.created_at,
  };
}

export async function getActiveRacePlan(client: SupabaseClient): Promise<Result<RacePlanRecord | null>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_race_plans')
    .select('*')
    .eq('user_id', u.data)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return err(error.message);
  return ok(data ? mapRow(data) : null);
}

export async function startRacePlan(
  client: SupabaseClient,
  input: { raceKey: RaceKey; raceDate: string; basisDistM: number; basisSeconds: number },
): Promise<Result<RacePlanRecord>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const retire = await client
    .from('basalt_race_plans')
    .update({ active: false })
    .eq('user_id', u.data)
    .eq('active', true);
  if (retire.error) return err(retire.error.message);
  const { data, error } = await client
    .from('basalt_race_plans')
    .insert({
      user_id: u.data,
      race_key: input.raceKey,
      race_date: input.raceDate,
      basis_dist_m: input.basisDistM,
      basis_seconds: input.basisSeconds,
    })
    .select()
    .single();
  if (error || !data) return err(error?.message ?? 'Could not start the plan.');
  return ok(mapRow(data));
}

/** Tick or untick one session key ("w3s1"); returns the new done set. */
export async function setRaceSessionDone(
  client: SupabaseClient,
  planId: string,
  sessionKey: string,
  done: boolean,
): Promise<Result<string[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const current = await client
    .from('basalt_race_plans')
    .select('done')
    .eq('id', planId)
    .eq('user_id', u.data)
    .single();
  if (current.error) return err(current.error.message);
  const set = new Set<string>((current.data.done ?? []).map(String));
  if (done) set.add(sessionKey);
  else set.delete(sessionKey);
  const next = [...set];
  const { error } = await client
    .from('basalt_race_plans')
    .update({ done: next })
    .eq('id', planId)
    .eq('user_id', u.data);
  if (error) return err(error.message);
  return ok(next);
}

export async function stopRacePlan(client: SupabaseClient, planId: string): Promise<Result<void>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { error } = await client
    .from('basalt_race_plans')
    .update({ active: false })
    .eq('id', planId)
    .eq('user_id', u.data);
  if (error) return err(error.message);
  return ok(undefined);
}
