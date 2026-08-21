import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';

// Fasting — a window timer with documented metabolic stages, and nothing
// more. The stage descriptions stick to commonly described physiology
// ranges and say plainly that individual variation is large; no autophagy
// promises, no detox language, no claims the literature won't carry.
// The module is off by default (profiles.fasting_enabled).

export const FASTING_DISCLAIMER =
  'Commonly described ranges — individual variation is large. Information, not medical advice.';

export const FASTING_STAGES = [
  { fromH: 0, label: 'Fed', detail: 'digesting and absorbing the last meal' },
  { fromH: 4, label: 'Post-absorptive', detail: 'insulin declining, stored glycogen in use' },
  { fromH: 12, label: 'Glycogen drawdown', detail: 'liver glycogen falling, fat oxidation rising' },
  { fromH: 16, label: 'Extended', detail: 'ketone production commonly begins ramping' },
  { fromH: 24, label: 'Prolonged', detail: 'beyond typical daily-fasting evidence — consider medical guidance' },
] as const;

export type FastingStage = (typeof FASTING_STAGES)[number];

export function stageFor(elapsedH: number): FastingStage {
  let current: FastingStage = FASTING_STAGES[0];
  for (const s of FASTING_STAGES) {
    if (elapsedH >= s.fromH) current = s;
  }
  return current;
}

export function fastElapsed(startedAtIso: string, nowMs: number): { hours: number; text: string } {
  const ms = Math.max(0, nowMs - Date.parse(startedAtIso));
  const hours = ms / 3600_000;
  const h = Math.floor(hours);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return { hours, text: `${h}:${String(m).padStart(2, '0')}` };
}

export type Fast = { id: string; startedAt: string; endedAt: string | null };

const mapFast = (r: any): Fast => ({ id: r.id, startedAt: r.started_at, endedAt: r.ended_at ?? null });

export async function getActiveFast(client: SupabaseClient): Promise<Result<Fast | null>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_fasts')
    .select('*')
    .eq('user_id', u.data)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return err(error.message);
  return ok(data ? mapFast(data) : null);
}

export async function startFast(client: SupabaseClient, startedAtIso: string): Promise<Result<Fast>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const active = await getActiveFast(client);
  if (!active.ok) return active;
  if (active.data) return err('A fast is already running — end it first.');
  const { data, error } = await client
    .from('basalt_fasts')
    .insert({ user_id: u.data, started_at: startedAtIso })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not start the fast.');
  return ok(mapFast(data));
}

export async function endFast(client: SupabaseClient, id: string, endedAtIso: string): Promise<Result<void>> {
  const { error } = await client.from('basalt_fasts').update({ ended_at: endedAtIso }).eq('id', id);
  if (error) return err(error.message);
  return ok(undefined);
}

export async function listRecentFasts(client: SupabaseClient, limit = 5): Promise<Result<Fast[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_fasts')
    .select('*')
    .eq('user_id', u.data)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) return err(error.message);
  return ok((data ?? []).map(mapFast));
}
