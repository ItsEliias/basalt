import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';

// Walk persistence — the basalt_walks table the source app never created
// (its DDL lived in a code comment and saves failed silently; audit §2.3).
// Routes are Douglas-Peucker-simplified BEFORE they get here.

export type WalkRow = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  distanceM: number;
  durationS: number;
  elevationGainM: number | null;
  avgPaceSecPerKm: number | null;
  route: { lat: number; lng: number; t: number }[] | null;
  source: string;
};

function mapRow(r: any): WalkRow {
  return {
    id: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at ?? null,
    distanceM: Number(r.distance_m ?? 0),
    durationS: Number(r.duration_s ?? 0),
    elevationGainM: r.elevation_gain_m === null || r.elevation_gain_m === undefined ? null : Number(r.elevation_gain_m),
    avgPaceSecPerKm: r.avg_pace_s_per_km === null || r.avg_pace_s_per_km === undefined ? null : Number(r.avg_pace_s_per_km),
    route: r.route ?? null,
    source: r.source ?? 'manual',
  };
}

export async function saveWalk(
  client: SupabaseClient,
  input: {
    startedAt: string;
    endedAt: string;
    distanceM: number;
    durationS: number;
    elevationGainM: number | null;
    avgPaceSecPerKm: number | null;
    route: { lat: number; lng: number; t: number }[];
  },
): Promise<Result<WalkRow>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_walks')
    .insert({
      user_id: u.data,
      started_at: input.startedAt,
      ended_at: input.endedAt,
      distance_m: input.distanceM,
      duration_s: input.durationS,
      elevation_gain_m: input.elevationGainM,
      avg_pace_s_per_km: input.avgPaceSecPerKm,
      route: input.route,
      source: 'gps',
    })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not save the walk.');
  return ok(mapRow(data));
}

export async function listRecentWalks(client: SupabaseClient, limit = 10): Promise<Result<WalkRow[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  const { data, error } = await client
    .from('basalt_walks')
    .select('*')
    .eq('user_id', u.data)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) return err(error.message);
  return ok((data ?? []).map(mapRow));
}
