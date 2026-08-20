// Recover view-model — pure. Breathing protocols and the weight trend math.

export type BreathProtocol = {
  key: 'box' | '478' | 'coherent';
  name: string;
  /** inhale, hold, exhale, hold — seconds (0 = skipped phase). */
  phases: [number, number, number, number];
  meta: string;
};

export const PROTOCOLS: BreathProtocol[] = [
  { key: 'box', name: 'Box breathing', phases: [4, 4, 4, 4], meta: '4-4-4-4 · state regulation · any time' },
  { key: '478', name: '4-7-8 downshift', phases: [4, 7, 8, 0], meta: 'pre-sleep · long exhale bias' },
  { key: 'coherent', name: 'Coherent 5.5', phases: [5.5, 0, 5.5, 0], meta: '5.5 breaths/min · HRV-oriented' },
];

const PHASE_LABELS = ['Inhale', 'Hold', 'Exhale', 'Hold'] as const;

export function cycleSeconds(p: BreathProtocol): number {
  return p.phases.reduce((s, x) => s + x, 0);
}

/** Where in the protocol a session clock lands: label + seconds remaining. */
export function phaseAt(p: BreathProtocol, tSeconds: number): { label: string; remaining: number } {
  const cycle = cycleSeconds(p);
  let t = ((tSeconds % cycle) + cycle) % cycle;
  for (let i = 0; i < 4; i++) {
    const len = p.phases[i]!;
    if (len === 0) continue;
    if (t < len) return { label: PHASE_LABELS[i]!, remaining: Math.ceil(len - t) };
    t -= len;
  }
  return { label: PHASE_LABELS[0]!, remaining: Math.ceil(p.phases[0]!) };
}

/**
 * Weekly weight rate from recent entries (least squares over up to `days`
 * days). Needs ≥3 points across ≥7 days — otherwise null: two dots make a
 * line, not a trend.
 */
export function weeklyWeightRate(
  entries: { measuredAt: string; weightKg: number }[],
  days = 14,
): number | null {
  const cutoff = Date.now() - days * 86_400_000;
  const pts = entries
    .filter((e) => Date.parse(e.measuredAt) >= cutoff)
    .map((e) => ({ x: Date.parse(e.measuredAt) / 86_400_000, y: e.weightKg }));
  if (pts.length < 3) return null;
  const span = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
  if (span < 7) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const denom = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (denom === 0) return null;
  const slopePerDay = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / denom;
  return Math.round(slopePerDay * 7 * 100) / 100;
}

/** Normalize weights to 0–1 for the sparkline (min–max over the window). */
export function sparkPoints(entries: { weightKg: number }[]): number[] {
  if (entries.length < 2) return [];
  const values = entries.map((e) => e.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}
