import type { Checkin } from './checkins';

// Wellbeing core (V4 Phase 7) — the daily check-in's scales, the 30-day
// strip, and the stress rule. Words, not faces: the scales render as
// plain words, no emoji, no mascot, no score. The stress rule proposes a
// LIGHTER week through the normal proposal path and its phrasing is
// pinned by test against second-person commentary and cheer.

export const SCALE_WORDS = ['Low', 'Flat', 'OK', 'Good', 'High'] as const;

export function scaleWord(value: number | null): string {
  if (value === null || value < 1 || value > 5) return '·';
  return SCALE_WORDS[value - 1]!;
}

/** One mono char per day for the 30-day strip; '·' = no check-in. */
export function stripChars(checkins: Checkin[], key: 'mood' | 'energy' | 'stress', days: number, today: string): string {
  const byDate = new Map(checkins.map((c) => [c.date, c]));
  const out: string[] = [];
  const end = new Date(today);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const v = byDate.get(d.toISOString().slice(0, 10))?.[key] ?? null;
    out.push(v === null ? '·' : String(SCALE_WORDS[v - 1]![0]));
  }
  return out.join('');
}

export type StressProposal = { text: string; reason: string };

/**
 * The stress rule, verbatim from the spec: stress 4–5 on four of the last
 * seven days, OR mood ≤ 2 on three of the last seven → one proposal for a
 * lighter session, phrased as fact + offer, never as commentary about the
 * person.
 */
export function stressProposal(checkins: Checkin[], today: string): StressProposal | null {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 6);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const week = checkins.filter((c) => c.date >= cutoffIso && c.date <= today);
  const highStress = week.filter((c) => (c.stress ?? 0) >= 4).length;
  const lowMood = week.filter((c) => c.mood !== null && c.mood <= 2).length;
  if (highStress < 4 && lowMood < 3) return null;
  const fact =
    highStress >= 4
      ? `Stress logged 4–5 on ${highStress} of the last 7 days.`
      : `Mood logged Low or Flat on ${lowMood} of the last 7 days.`;
  return {
    text: `${fact} Want next session swapped for a lighter one? Recovery is training too.`,
    reason: fact,
  };
}
