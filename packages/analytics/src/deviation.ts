// Vitals deviation — the outlier-only model: today's values against YOUR
// OWN 30-day range, nothing else. No score, no index, no interpretation
// beyond "outside your typical range". NO DIAGNOSIS LANGUAGE, EVER —
// pinned by test on every composed string.
//
// Published rules:
//   · A vital deviates when today's value falls outside the min–max of
//     your own last 30 days (today excluded).
//   · A vital with fewer than 7 baseline days is WITHHELD — not counted
//     as observed, not counted as fine.
//   · The quiet card appears at ≥2 observed vitals deviating; nothing
//     renders below that (one outlier is a Tuesday, not a pattern).
//   · Vitals observed today: HRV (rMSSD), resting heart rate, and sleep
//     duration — the ones this app actually persists. The rule extends
//     to new kinds as the sync grows; the copy always names its count.

export const DEVIATION_RULES = {
  baselineDays: 30,
  minBaselineDays: 7,
  cardAt: 2,
} as const;

export type VitalCheck = {
  key: string;
  label: string;
  today: number | null;
  band: { min: number; median: number; max: number } | null;
  /** null = unobservable today (no reading or no baseline). */
  deviates: boolean | null;
};

export function checkVital(
  key: string,
  label: string,
  today: number | null,
  baseline: number[],
): VitalCheck {
  if (today === null || baseline.length < DEVIATION_RULES.minBaselineDays) {
    return { key, label, today, band: null, deviates: null };
  }
  const band = {
    min: Math.min(...baseline),
    median: [...baseline].sort((a, b) => a - b)[Math.floor(baseline.length / 2)]!,
    max: Math.max(...baseline),
  };
  return { key, label, today, band, deviates: today < band.min || today > band.max };
}

export type DeviationReport = {
  observed: number;
  deviating: number;
  /** null = below the card threshold — nothing renders. */
  headline: string | null;
  lines: string[];
  srcnote: string;
};

export function composeDeviation(checks: VitalCheck[]): DeviationReport {
  const observed = checks.filter((c) => c.deviates !== null);
  const deviating = observed.filter((c) => c.deviates === true);

  const lines = deviating.map((c) => {
    const dir = c.today! > c.band!.max ? 'above' : 'below';
    return `${c.label} ${dir} your 30-day range (${Math.round(c.today!)} vs ${Math.round(c.band!.min)}–${Math.round(c.band!.max)})`;
  });

  const headline =
    deviating.length >= DEVIATION_RULES.cardAt
      ? `${deviating.length} of ${observed.length} vitals sit outside your typical range`
      : null;

  return {
    observed: observed.length,
    deviating: deviating.length,
    headline,
    lines,
    srcnote:
      'An observation from your own baselines, nothing more — how you actually feel is worth more than any number here',
  };
}
