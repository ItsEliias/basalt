// XP, levels, badges — every number here derives from real ledger counts
// through a formula printed in-app, verbatim from these constants. No
// bonuses, no multipliers, no mystery. Confetti is not in this file's
// gift: it fires only on a PR the training engine already detects.

export const XP_RULES = [
  'Food entry logged · 5 XP',
  'Training session finished · 25 XP',
  'Walk recorded · 15 XP',
  'Sleep record · 10 XP',
] as const;

export const XP_PER = { entry: 5, session: 25, walk: 15, sleep: 10 } as const;

export type XpCounts = {
  entries: number;
  sessions: number;
  walks: number;
  sleepRecords: number;
};

export function totalXp(c: XpCounts): number {
  return c.entries * XP_PER.entry + c.sessions * XP_PER.session
    + c.walks * XP_PER.walk + c.sleepRecords * XP_PER.sleep;
}

export function xpBreakdown(c: XpCounts): { label: string; count: number; xp: number }[] {
  return [
    { label: 'Food entries', count: c.entries, xp: c.entries * XP_PER.entry },
    { label: 'Sessions', count: c.sessions, xp: c.sessions * XP_PER.session },
    { label: 'Walks', count: c.walks, xp: c.walks * XP_PER.walk },
    { label: 'Sleep records', count: c.sleepRecords, xp: c.sleepRecords * XP_PER.sleep },
  ];
}

/**
 * The level curve, written down: level n starts at 250·n·(n−1) XP.
 * L1 0 · L2 500 · L3 1,500 · L4 3,000 · L5 5,000 — quadratic, no caps.
 */
export const LEVEL_RULE = 'Level n starts at 250 × n × (n − 1) XP (L2 500, L3 1,500, L4 3,000…).';

export function levelThreshold(level: number): number {
  return 250 * level * (level - 1);
}

export function levelFor(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  while (levelThreshold(level + 1) <= xp) level++;
  const start = levelThreshold(level);
  return { level, into: xp - start, span: levelThreshold(level + 1) - start };
}

// ── Badges — real milestones only ───────────────────────────────────────

export type BadgeInputs = XpCounts & {
  totalWalkKm: number;
  /** Longest run of days with complete logs (the core engine's number). */
  longestCompleteLogRun: number;
};

export type Badge = { id: string; title: string; how: string; earned: boolean };

export function badges(i: BadgeInputs): Badge[] {
  return [
    {
      id: 'sessions-10',
      title: 'First 10 sessions',
      how: '10 finished training sessions',
      earned: i.sessions >= 10,
    },
    {
      id: 'walk-100km',
      title: 'First 100 km',
      how: '100 km of recorded walks, summed',
      earned: i.totalWalkKm >= 100,
    },
    {
      id: 'month-complete',
      title: 'A complete month',
      how: '30 consecutive days of complete logs',
      earned: i.longestCompleteLogRun >= 30,
    },
  ];
}
