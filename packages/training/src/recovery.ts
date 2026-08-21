import type { BodyRegion } from './muscle-map';

// Per-muscle recovery — a published heuristic over the user's own sets,
// stated as one. The rules, in full:
//
//   · A region's recovery window opens 48 h after its last hard set.
//   · Volume extends it: +6 h per 4 hard sets beyond 8 in the last 72 h,
//     capped at +24 h.
//   · A short persisted night (< 6 h) extends every open window by 20%.
//   · A manual override ("feels fresh") marks the region fresh for the day
//     and is labeled as the user's own call — the model never argues.
//
// This is a heuristic, not physiology-as-fact: the why string on every
// region says which rule produced it, and the UI presents it as a lens on
// your own history, never a prescription.

export const RECOVERY_RULES = {
  baseHours: 48,
  volumeStepSets: 4,
  volumeStepHours: 6,
  volumeFreeSets: 8,
  volumeCapHours: 24,
  shortSleepFactor: 1.2,
  shortSleepMinutes: 360,
  windowMs: 72 * 3600_000,
} as const;

export type RegionSetEvent = { region: BodyRegion; atMs: number; sets: number };

export type RegionRecovery = {
  region: BodyRegion;
  status: 'fresh' | 'recovering' | 'loaded' | 'overridden';
  readyAtMs: number | null;
  hardSets72h: number;
  why: string;
};

export function computeRecovery(
  events: RegionSetEvent[],
  opts: { nowMs: number; shortSleep: boolean; overrides?: BodyRegion[] },
): RegionRecovery[] {
  const R = RECOVERY_RULES;
  const byRegion = new Map<BodyRegion, RegionSetEvent[]>();
  for (const e of events) {
    if (opts.nowMs - e.atMs > R.windowMs || e.atMs > opts.nowMs) continue;
    const list = byRegion.get(e.region) ?? [];
    list.push(e);
    byRegion.set(e.region, list);
  }

  const out: RegionRecovery[] = [];
  for (const [region, list] of byRegion) {
    const hardSets = list.reduce((s, e) => s + e.sets, 0);
    const lastAt = Math.max(...list.map((e) => e.atMs));

    if (opts.overrides?.includes(region)) {
      out.push({
        region, status: 'overridden', readyAtMs: null, hardSets72h: hardSets,
        why: 'you marked this fresh — your call stands',
      });
      continue;
    }

    const extraSets = Math.max(0, hardSets - R.volumeFreeSets);
    const volumeH = Math.min(R.volumeCapHours, Math.floor(extraSets / R.volumeStepSets) * R.volumeStepHours);
    let hours = R.baseHours + volumeH;
    const sleepNote = opts.shortSleep ? ' · short night extends it 20%' : '';
    if (opts.shortSleep) hours *= R.shortSleepFactor;
    const readyAtMs = lastAt + hours * 3600_000;

    const elapsed = (opts.nowMs - lastAt) / (readyAtMs - lastAt);
    const status: RegionRecovery['status'] =
      opts.nowMs >= readyAtMs ? 'fresh' : elapsed >= 0.5 ? 'recovering' : 'loaded';
    const volNote = volumeH > 0 ? ` +${Math.round(volumeH * (opts.shortSleep ? R.shortSleepFactor : 1))} h for ${hardSets} sets` : '';
    out.push({
      region, status, readyAtMs, hardSets72h: hardSets,
      why:
        status === 'fresh'
          ? `${hardSets} hard sets in 72 h — window passed`
          : `48 h base${volNote}${sleepNote}`,
    });
  }
  return out.sort((a, b) => b.hardSets72h - a.hardSets72h);
}

/** Figure intensity: loadedness, not praise — untouched regions stay quiet. */
export function recoveryIntensity(recovery: RegionRecovery[]): Partial<Record<BodyRegion, number>> {
  const out: Partial<Record<BodyRegion, number>> = {};
  for (const r of recovery) {
    out[r.region] =
      r.status === 'loaded' ? 1 : r.status === 'recovering' ? 0.55 : r.status === 'overridden' ? 0.2 : 0.25;
  }
  return out;
}

// ─── Manual override persistence (pure half) ────────────────────────────────

/** Overrides are valid for one calendar day only — yesterday's call expires. */
export function parseOverrides(json: string, todayIso: string): BodyRegion[] {
  try {
    const parsed = JSON.parse(json);
    if (parsed?.date !== todayIso || !Array.isArray(parsed?.regions)) return [];
    return parsed.regions.filter((r: unknown): r is BodyRegion => typeof r === 'string');
  } catch {
    return [];
  }
}

export function serializeOverrides(regions: BodyRegion[], todayIso: string): string {
  return JSON.stringify({ date: todayIso, regions });
}
