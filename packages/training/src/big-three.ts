// Big-Three (squat / bench / deadlift) detection — a published name matcher
// over the user's own records, nothing configured, nothing guessed. The
// exclusion lists keep variations (front squat, incline bench, RDL) from
// posing as the competition lifts; sumo deadlift counts, as in the sport.

export type BigThree = {
  squat: { name: string; e1rm: number } | null;
  bench: { name: string; e1rm: number } | null;
  deadlift: { name: string; e1rm: number } | null;
  /** Sum of the three, only when all three exist — no partial totals. */
  total: number | null;
};

const RULES: { key: keyof Omit<BigThree, 'total'>; match: RegExp; exclude: RegExp }[] = [
  { key: 'squat', match: /squat/i, exclude: /front|goblet|split|bulgarian|pistol|hack|overhead|jump|sissy|belt/i },
  { key: 'bench', match: /bench press/i, exclude: /incline|decline|close[- ]grip|dumbbell|floor|board|pin/i },
  { key: 'deadlift', match: /deadlift/i, exclude: /romanian|stiff|straight[- ]leg|single|deficit|rack|snatch[- ]grip|rdl/i },
];

export function bigThree(records: { name: string; e1rm: number }[]): BigThree {
  const out: BigThree = { squat: null, bench: null, deadlift: null, total: null };
  for (const rule of RULES) {
    for (const r of records) {
      if (!rule.match.test(r.name) || rule.exclude.test(r.name)) continue;
      if (!out[rule.key] || r.e1rm > out[rule.key]!.e1rm) out[rule.key] = { name: r.name, e1rm: r.e1rm };
    }
  }
  if (out.squat && out.bench && out.deadlift) {
    out.total = Math.round((out.squat.e1rm + out.bench.e1rm + out.deadlift.e1rm) * 10) / 10;
  }
  return out;
}

/** Which main lift a name is, per the same published matcher — or null.
 *  Used by the periodization stall detector to group weekly bests. */
export function mainLiftKey(name: string): 'squat' | 'bench' | 'deadlift' | null {
  for (const rule of RULES) {
    if (rule.match.test(name) && !rule.exclude.test(name)) return rule.key;
  }
  return null;
}
