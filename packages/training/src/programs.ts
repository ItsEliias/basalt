import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, isoDay, type Result } from '@basalt/core-data';
import type { Program } from './periodization';

// Programs service — one active program at a time, the user's own declared
// week structure. Starting a new one retires the old (history stays).

function mapProgram(r: any): Program {
  return {
    id: r.id,
    startedOn: r.started_on,
    trainingDays: (r.training_days ?? []).map((d: any) => Number(d)),
    active: !!r.active,
    templateId: r.template_id ?? null,
    weeks: r.weeks === null || r.weeks === undefined ? null : Number(r.weeks),
    ratePct: r.rate_pct === null || r.rate_pct === undefined ? null : Number(r.rate_pct),
  };
}

export async function getActiveProgram(client: SupabaseClient): Promise<Result<Program | null>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { data, error } = await client
    .from('basalt_programs')
    .select('*')
    .eq('user_id', u.data)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return err(error.message);
  return ok(data ? mapProgram(data) : null);
}

export async function startProgram(
  client: SupabaseClient,
  trainingDays: number[],
  startedOn: string = isoDay(new Date()),
  template?: { id: string; weeks: number; ratePct: number },
): Promise<Result<Program>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const days = Array.from(new Set(trainingDays)).filter((d) => d >= 0 && d <= 6).sort();
  if (days.length === 0 && !template) return err('Pick at least one training day.');

  const retired = await client
    .from('basalt_programs')
    .update({ active: false })
    .eq('user_id', u.data)
    .eq('active', true);
  if (retired.error) return err(retired.error.message);

  const { data, error } = await client
    .from('basalt_programs')
    .insert({
      user_id: u.data,
      started_on: startedOn,
      training_days: days,
      ...(template ? { template_id: template.id, weeks: template.weeks, rate_pct: template.ratePct } : {}),
    })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not start the program.');
  return ok(mapProgram(data));
}

export async function stopProgram(client: SupabaseClient): Promise<Result<void>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const { error } = await client
    .from('basalt_programs')
    .update({ active: false })
    .eq('user_id', u.data)
    .eq('active', true);
  if (error) return err(error.message);
  return ok(undefined);
}
