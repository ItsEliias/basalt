// Cycle tracking — facts and labelled estimates, kept strictly apart.
//
// FACTS: the flow days the user logged, the periods they group into
// (consecutive flow days; a single unlogged day inside a run bridges),
// and today's cycle day counted from the last period start.
//
// ESTIMATES: the next-period window, derived ONLY from the user's own
// start-to-start history — median of the last 6 cycle lengths, window =
// that history's own min–max spread (floored at ±2 days). Under 2
// complete cycles there is NO estimate — facts render, the future stays
// blank. Every estimate line is labelled as one.
//
// NO PHASE-BASED TRAINING ADVICE. The evidence for phase-timed training
// prescriptions is weak and contested; this module never names cycle
// phases and never suggests changing training — pinned by test.

export type CycleEntry = {
  date: string; // ISO day
  flow: 'spotting' | 'light' | 'medium' | 'heavy' | null;
  symptoms: string[];
};

export const CYCLE_SYMPTOMS = [
  'cramps', 'headache', 'bloating', 'fatigue', 'breast tenderness', 'mood shift',
] as const;

export const CYCLE_RULES = {
  bridgeGapDays: 1,
  historyCycles: 6,
  minCyclesForEstimate: 2,
  windowFloorDays: 2,
  plausibleCycleMin: 15,
  plausibleCycleMax: 60,
} as const;

export type Period = { start: string; end: string; days: number };

const DAY = 86400000;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);

/** Group logged flow days into periods; a 1-day gap inside a run bridges. */
export function groupPeriods(entries: CycleEntry[]): Period[] {
  const flowDays = entries
    .filter((e) => e.flow !== null && e.flow !== undefined)
    .map((e) => e.date)
    .sort();
  const periods: Period[] = [];
  for (const d of flowDays) {
    const cur = periods[periods.length - 1];
    if (cur && dayDiff(cur.end, d) <= CYCLE_RULES.bridgeGapDays + 1) {
      cur.end = d;
    } else {
      periods.push({ start: d, end: d, days: 1 });
    }
  }
  for (const p of periods) p.days = dayDiff(p.start, p.end) + 1;
  return periods;
}

/** Start-to-start lengths, implausible intervals dropped (a fact filter, stated). */
export function cycleLengths(periods: Period[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < periods.length; i++) {
    const len = dayDiff(periods[i - 1]!.start, periods[i]!.start);
    if (len >= CYCLE_RULES.plausibleCycleMin && len <= CYCLE_RULES.plausibleCycleMax) out.push(len);
  }
  return out.slice(-CYCLE_RULES.historyCycles);
}

export type CycleEstimate = {
  /** Window start/end ISO days for the next period start. */
  windowStart: string;
  windowEnd: string;
  medianLen: number;
  basedOnCycles: number;
  label: string;
};

export type CycleReport = {
  periods: Period[];
  /** Fact: days since the last period started (1-based), null when none logged. */
  cycleDay: number | null;
  lastPeriod: Period | null;
  /** Labelled estimate, or null — under 2 cycles the future stays blank. */
  estimate: CycleEstimate | null;
  srcnote: string;
};

export function composeCycle(entries: CycleEntry[], today: string): CycleReport {
  const periods = groupPeriods(entries);
  const last = periods[periods.length - 1] ?? null;
  const cycleDay = last ? dayDiff(last.start, today) + 1 : null;

  const lens = cycleLengths(periods);
  let estimate: CycleEstimate | null = null;
  if (last && lens.length >= CYCLE_RULES.minCyclesForEstimate) {
    const sorted = [...lens].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const spreadLow = Math.max(CYCLE_RULES.windowFloorDays, median - sorted[0]!);
    const spreadHigh = Math.max(CYCLE_RULES.windowFloorDays, sorted[sorted.length - 1]! - median);
    estimate = {
      windowStart: addDays(last.start, median - spreadLow),
      windowEnd: addDays(last.start, median + spreadHigh),
      medianLen: median,
      basedOnCycles: lens.length,
      label: `Estimate, not a fact — the window is the spread of your own last ${lens.length} cycles`,
    };
  }

  return {
    periods,
    cycleDay,
    lastPeriod: last,
    estimate,
    srcnote:
      'Logged days are the record; the window is arithmetic on them. Nothing here changes any target or suggestion — cycle data stays out of every score, and out of sharing unless you grant it by itself.',
  };
}
