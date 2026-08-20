import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, isoDay, currentUserId, type Result } from '@basalt/core-data';
import { importHcHydration, importHcMeal } from '@basalt/nutrition';
import { encodeHcSource } from './origin';
import type { HealthProvider, SleepSessionSummary } from './types';

// Health Connect → ledger sync. Pulls the last N days of sleep (WITH stages
// — persisted at last, the gap the source app shipped for months), steps,
// weight, hydration and meals into the basalt_ tables, idempotently:
//   sleep    keyed on the HC session id (ext_id)
//   steps    upsert on (user_id, date) — HC owns the day's number when granted
//   weight   keyed on a synthesized `hc:<record time>` id (HC weight reads
//            carry no record id through the provider; record time is stable)
//   hydration / meals  via the nutrition importers' own ext-id dedupe
//
// The provider is injected, so the whole engine tests against fakes.

export type SyncReport = {
  sleepSessions: number;
  sleepStages: number;
  stepDays: number;
  weights: number;
  hydrationMl: number;
  meals: number;
  /** Permission tokens that were not granted, so their readers were skipped. */
  skipped: string[];
};

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
}

async function syncSleepNight(
  client: SupabaseClient,
  userId: string,
  session: SleepSessionSummary,
  date: string,
): Promise<{ sessions: number; stages: number } | { error: string }> {
  const existing = await client
    .from('basalt_sleep_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('ext_id', session.id)
    .maybeSingle();
  if (existing.error && existing.error.code !== 'PGRST116') return { error: existing.error.message };
  if (existing.data) return { sessions: 0, stages: 0 };

  const inserted = await client
    .from('basalt_sleep_sessions')
    .insert({
      user_id: userId,
      date,
      bedtime: session.startTime,
      waketime: session.endTime,
      source: encodeHcSource(session.dataOrigin),
      ext_id: session.id,
    })
    .select('id')
    .single();
  if (inserted.error || !inserted.data) return { error: inserted.error?.message ?? 'sleep insert failed' };

  let stages = 0;
  if (session.hasRealStages && session.stages.length > 0) {
    const { error } = await client.from('basalt_sleep_stages').insert(
      session.stages.map((s) => ({
        session_id: inserted.data.id,
        user_id: userId,
        stage: s.stage,
        start_time: s.startTime,
        end_time: s.endTime,
      })),
    );
    if (error) return { error: error.message };
    stages = session.stages.length;
  }
  return { sessions: 1, stages };
}

/**
 * One sync pass over the last `days` days (default 7). Reads only what was
 * granted; everything else lands in `skipped` rather than failing. Safe to
 * run repeatedly — every writer dedupes.
 */
export async function syncHealthData(
  client: SupabaseClient,
  provider: HealthProvider,
  options: { days?: number } = {},
): Promise<Result<SyncReport>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const userId = u.data;
  const days = options.days ?? 7;

  const avail = await provider.isAvailable();
  if (!avail.ok) return err(avail.error);
  if (avail.data !== 'available') {
    return ok({ sleepSessions: 0, sleepStages: 0, stepDays: 0, weights: 0, hydrationMl: 0, meals: 0, skipped: ['provider_unavailable'] });
  }
  const grantedR = await provider.getGrantedPermissions();
  if (!grantedR.ok) return err(grantedR.error);
  const granted = new Set(grantedR.data);

  const report: SyncReport = { sleepSessions: 0, sleepStages: 0, stepDays: 0, weights: 0, hydrationMl: 0, meals: 0, skipped: [] };
  for (const p of ['sleep', 'steps', 'weight', 'hydration', 'nutrition'] as const) {
    if (!granted.has(p)) report.skipped.push(p);
  }

  for (let n = 0; n < days; n++) {
    const date = dateNDaysAgo(n);

    if (granted.has('sleep')) {
      const s = await provider.getSleepSessionForNight(date);
      if (s.ok && s.data) {
        const r = await syncSleepNight(client, userId, s.data, date);
        if ('error' in r) return err(r.error);
        report.sleepSessions += r.sessions;
        report.sleepStages += r.stages;
      }
    }

    if (granted.has('steps')) {
      const s = await provider.getStepsForDay(date);
      if (s.ok && s.data > 0) {
        const { error } = await client.from('basalt_step_logs').upsert(
          { user_id: userId, date, steps: s.data, source: 'health_connect' },
          { onConflict: 'user_id,date' },
        );
        if (error) return err(error.message);
        report.stepDays += 1;
      }
    }

    if (granted.has('weight')) {
      const w = await provider.getWeightForDay(date);
      if (w.ok && w.data.length > 0) {
        const keyed = w.data.map((p) => ({ ...p, extId: `hc:${p.time}` }));
        const existing = await client
          .from('basalt_weight_entries')
          .select('ext_id')
          .eq('user_id', userId)
          .in('ext_id', keyed.map((k) => k.extId));
        if (existing.error) return err(existing.error.message);
        const seen = new Set((existing.data ?? []).map((r: any) => r.ext_id));
        const fresh = keyed.filter((k) => !seen.has(k.extId));
        if (fresh.length > 0) {
          const { error } = await client.from('basalt_weight_entries').insert(
            fresh.map((k) => ({
              user_id: userId,
              measured_at: k.time,
              weight_kg: k.kg,
              source: encodeHcSource(k.dataOrigin),
              ext_id: k.extId,
            })),
          );
          if (error) return err(error.message);
          report.weights += fresh.length;
        }
      }
    }

    if (granted.has('hydration')) {
      const h = await provider.getHydrationForDay(date);
      if (h.ok && h.data.records.length > 0) {
        const r = await importHcHydration(client, {
          records: h.data.records.map((rec) => ({ id: rec.id, ml: rec.ml, dataOrigin: rec.dataOrigin })),
          date,
        });
        if (!r.ok) return r;
        report.hydrationMl += r.data.addedMl;
      }
    }

    if (granted.has('nutrition')) {
      const m = await provider.getNutritionForDay(date);
      if (m.ok) {
        for (const entry of m.data) {
          const r = await importHcMeal(
            client,
            {
              mealType: entry.mealType,
              foodName: entry.name,
              calories: entry.calories,
              protein: entry.protein,
              carbs: entry.carbs,
              fat: entry.fat,
              fiber: entry.fiber,
              extId: entry.id,
              dataOrigin: entry.dataOrigin,
            },
            date,
          );
          if (!r.ok) return r;
          if (r.data === 'imported') report.meals += 1;
        }
      }
    }
  }

  return ok(report);
}
