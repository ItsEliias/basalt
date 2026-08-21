// Correlations — computed from the persisted daily series, shown only past
// the roadmap's honesty gates: |r| ≥ 0.45 AND ≥ 30 overlapping days. Every
// shown statement says "correlation, not cause" with its r and n; every
// checked pair that failed the gates is listed as checked-not-shown, so an
// empty card is evidence of checking, not of nothing existing.

export const CORRELATION_GATES = { minAbsR: 0.45, minDays: 30 } as const;

export type DailySeries = Record<string, Map<string, number>>;

export type CorrelationPair = {
  aKey: string;
  bKey: string;
  aLabel: string;
  bLabel: string;
  /** Days added to a's date when reading b — 1 = "the next day/night". */
  lag: number;
};

export type CorrelationResult = {
  pair: CorrelationPair;
  r: number | null;
  n: number;
  shown: boolean;
  statement: string | null;
};

/** Pearson r. Null when n < 2 or either side has zero variance. */
export function pearson(pairs: [number, number][]): number | null {
  const n = pairs.length;
  if (n < 2) return null;
  const meanA = pairs.reduce((s, p) => s + p[0], 0) / n;
  const meanB = pairs.reduce((s, p) => s + p[1], 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (const [a, b] of pairs) {
    cov += (a - meanA) * (b - meanB);
    varA += (a - meanA) ** 2;
    varB += (b - meanB) ** 2;
  }
  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

function shiftDate(iso: string, days: number): string {
  if (days === 0) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, m! - 1, d! + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function correlate(series: DailySeries, pair: CorrelationPair): CorrelationResult {
  const a = series[pair.aKey] ?? new Map<string, number>();
  const b = series[pair.bKey] ?? new Map<string, number>();
  const points: [number, number][] = [];
  for (const [date, av] of a) {
    const bv = b.get(shiftDate(date, pair.lag));
    if (bv !== undefined) points.push([av, bv]);
  }
  const n = points.length;
  const r = pearson(points);
  const shown = r !== null && Math.abs(r) >= CORRELATION_GATES.minAbsR && n >= CORRELATION_GATES.minDays;
  return {
    pair,
    r,
    n,
    shown,
    statement: shown
      ? `Higher-${pair.aLabel} days ↔ ${r! > 0 ? 'higher' : 'lower'} ${pair.bLabel} — correlation, not cause (r ${r!.toFixed(2)}, ${n} days)`
      : null,
  };
}

/** The checked pairs, fixed and published — nothing is fished for. */
export const CHECKED_PAIRS: CorrelationPair[] = [
  { aKey: 'sleepMin', bKey: 'steps', aLabel: 'sleep', bLabel: 'steps', lag: 0 },
  { aKey: 'sleepMin', bKey: 'intakeKcal', aLabel: 'sleep', bLabel: 'energy intake', lag: 0 },
  { aKey: 'steps', bKey: 'intakeKcal', aLabel: 'step', bLabel: 'energy intake', lag: 0 },
  { aKey: 'volumeKg', bKey: 'intakeKcal', aLabel: 'training-volume', bLabel: 'energy intake', lag: 0 },
  { aKey: 'proteinG', bKey: 'volumeKg', aLabel: 'protein', bLabel: 'training volume', lag: 0 },
  { aKey: 'volumeKg', bKey: 'sleepMin', aLabel: 'training-volume', bLabel: 'sleep that night', lag: 1 },
  // Check-in factors are evening facts; the night they could affect is the
  // sleep row dated the NEXT morning — hence lag 1. Mood pairs same-day
  // (today's mood against last night's sleep, which shares its date).
  { aKey: 'alcohol', bKey: 'sleepMin', aLabel: 'alcohol', bLabel: 'sleep that night', lag: 1 },
  { aKey: 'late_meal', bKey: 'sleepMin', aLabel: 'late-meal', bLabel: 'sleep that night', lag: 1 },
  { aKey: 'stress', bKey: 'sleepMin', aLabel: 'stress', bLabel: 'sleep that night', lag: 1 },
  { aKey: 'screens_late', bKey: 'sleepMin', aLabel: 'late-screens', bLabel: 'sleep that night', lag: 1 },
  { aKey: 'sleepMin', bKey: 'mood', aLabel: 'sleep', bLabel: 'mood', lag: 0 },
  { aKey: 'steps', bKey: 'mood', aLabel: 'step', bLabel: 'mood', lag: 0 },
];

export function computeCorrelations(series: DailySeries, pairs: CorrelationPair[] = CHECKED_PAIRS): {
  shown: CorrelationResult[];
  checkedNotShown: CorrelationResult[];
} {
  const results = pairs.map((p) => correlate(series, p));
  return {
    shown: results.filter((r) => r.shown),
    checkedNotShown: results.filter((r) => !r.shown),
  };
}
