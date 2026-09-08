// Social — the pure half. Invite codes, leaderboard math, the published
// challenge kinds and the one-line friends note for Today. Everything a
// friend ever sees is an aggregate the owner's device published; this
// module only shapes and sorts what the host loads.

export const CHALLENGE_KINDS = ['steps', 'sessions', 'logged_days'] as const;
export type ChallengeKind = (typeof CHALLENGE_KINDS)[number];

export const CHALLENGE_KIND_LABELS: Record<ChallengeKind, string> = {
  steps: 'Steps',
  sessions: 'Sessions',
  logged_days: 'Logged days',
};

export const SOCIAL_SHARED_COLUMNS_NOTE =
  'Friends see: your display name, per-day totals for challenges you join, and a logged-today yes/no. Never your entries, weights, sleep or food.';

/** 8 uppercase base32-ish chars, no lookalikes (0/O, 1/I). */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeInviteCode(randoms: number[]): string {
  if (randoms.length < 8) throw new Error('need 8 randoms');
  return randoms.slice(0, 8)
    .map((r) => INVITE_ALPHABET[Math.abs(Math.floor(r * INVITE_ALPHABET.length)) % INVITE_ALPHABET.length])
    .join('');
}

export function isValidInviteCode(code: string): boolean {
  return code.length === 8 && [...code].every((c) => INVITE_ALPHABET.includes(c));
}

export type ProgressRow = { userId: string; day: string; value: number };
export type MemberRow = { userId: string; displayName: string };

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  total: number;
  isSelf: boolean;
};

/** Sum per member, sorted descending; ties keep name order for stability. */
export function leaderboard(
  members: MemberRow[],
  progress: ProgressRow[],
  selfId: string,
): LeaderboardEntry[] {
  const totals = new Map<string, number>();
  for (const p of progress) totals.set(p.userId, (totals.get(p.userId) ?? 0) + p.value);
  return members
    .map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      total: totals.get(m.userId) ?? 0,
      isSelf: m.userId === selfId,
    }))
    .sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName));
}

/** "3 friends logged today" — plain fact, no cheer. */
export function friendsLoggedLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 friend logged today' : `${count} friends logged today`;
}

/** The value a device publishes for a day, given its own local numbers. */
export function progressValueFor(kind: ChallengeKind, day: {
  steps: number | null;
  sessions: number;
  loggedAnything: boolean;
}): number | null {
  switch (kind) {
    case 'steps': return day.steps; // null = no source, publish nothing
    case 'sessions': return day.sessions;
    case 'logged_days': return day.loggedAnything ? 1 : 0;
  }
}
