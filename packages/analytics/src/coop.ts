// 1-v-1 co-op — two people showing up, side by side. The ONLY shared
// signal is a boolean per day, computed by each person from their own
// ledger; no entries, numbers, or scores ever cross. There is no feed,
// no leaderboard, no points, and no comparison language — the forbidden
// list applies to this surface hardest of all, pinned by test.

export const COOP_DOT_RULE =
  'A day earns a dot when you logged anything real that day — food, a session, a walk, or a check-in. Dots are the only thing your partner sees.';

export const COOP_DAYS = 14;

export type CoopDay = {
  date: string;
  mine: boolean | null; // null = not published for that day
  theirs: boolean | null;
};

export type CoopReport = {
  days: CoopDay[];
  /** Facts about presence, one per person, never compared. */
  mineLine: string;
  theirsLine: string;
  srcnote: string;
};

function isoDaysBack(n: number, today: string): string[] {
  const out: string[] = [];
  const t = Date.parse(today);
  for (let i = n - 1; i >= 0; i--) out.push(new Date(t - i * 86400000).toISOString().slice(0, 10));
  return out;
}

function presenceLine(who: string, dots: Map<string, boolean>, dates: string[]): string {
  const known = dates.filter((d) => dots.has(d));
  if (known.length === 0) return `${who}: nothing published yet`;
  const active = known.filter((d) => dots.get(d)).length;
  return `${who}: ${active} of the last ${dates.length} days`;
}

export function composeCoop(
  mine: Map<string, boolean>,
  theirs: Map<string, boolean>,
  today: string,
): CoopReport {
  const dates = isoDaysBack(COOP_DAYS, today);
  return {
    days: dates.map((date) => ({
      date,
      mine: mine.has(date) ? mine.get(date)! : null,
      theirs: theirs.has(date) ? theirs.get(date)! : null,
    })),
    mineLine: presenceLine('You', mine, dates),
    theirsLine: presenceLine('Them', theirs, dates),
    srcnote:
      'Dots are booleans your phones each computed from their own ledgers — nothing else crosses. Either of you can end the pair at any time.',
  };
}
