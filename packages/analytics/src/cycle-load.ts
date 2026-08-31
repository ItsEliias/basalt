import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, type Result } from '@basalt/core-data';
import { composeCycle, type CycleEntry, type CycleReport } from './cycle';

// Ledger → cycle report, plus the one write path. Eight months of
// entries feed the engine — enough for the 6-cycle history window.

export async function loadCycle(
  client: SupabaseClient,
  today: Date = new Date(),
): Promise<Result<CycleReport & { today: CycleEntry | null }>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const from = new Date(today);
  from.setMonth(from.getMonth() - 8);
  const { data, error } = await client
    .from('basalt_cycle_entries')
    .select('date, flow, symptoms')
    .eq('user_id', u.data)
    .gte('date', isoDay(from))
    .order('date');
  if (error) return err(error.message);
  const entries: CycleEntry[] = (data ?? []).map((r: any) => ({
    date: r.date,
    flow: r.flow ?? null,
    symptoms: r.symptoms ?? [],
  }));
  const todayIso = isoDay(today);
  return ok({
    ...composeCycle(entries, todayIso),
    today: entries.find((e) => e.date === todayIso) ?? null,
  });
}

/** Upsert one day. flow null + no symptoms deletes the row — no ghost days. */
export async function saveCycleDay(
  client: SupabaseClient,
  date: string,
  flow: CycleEntry['flow'],
  symptoms: string[],
): Promise<Result<void>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  if (flow === null && symptoms.length === 0) {
    const { error } = await client
      .from('basalt_cycle_entries')
      .delete()
      .eq('user_id', u.data)
      .eq('date', date);
    if (error) return err(error.message);
    return ok(undefined);
  }
  const { error } = await client
    .from('basalt_cycle_entries')
    .upsert({ user_id: u.data, date, flow, symptoms }, { onConflict: 'user_id,date' });
  if (error) return err(error.message);
  return ok(undefined);
}
