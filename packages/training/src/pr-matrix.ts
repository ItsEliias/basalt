// Rep-PR matrix — best real weight at each rep count, from the user's own
// working-set history. Real-or-hidden: rep counts never trained simply don't
// appear; nothing is interpolated.

export type PrSet = {
  setType: string;
  reps: number | null;
  weightKg: number | null;
  completedAt: string;
};

export type RepPr = { reps: number; weightKg: number; date: string };

export function repPrMatrix(sets: PrSet[], maxReps = 12): RepPr[] {
  const best = new Map<number, { weightKg: number; date: string }>();
  for (const s of sets) {
    if (s.setType === 'warmup') continue;
    if (s.reps === null || s.reps < 1 || s.reps > maxReps) continue;
    if (s.weightKg === null || s.weightKg <= 0) continue;
    const cur = best.get(s.reps);
    if (!cur || s.weightKg > cur.weightKg) {
      best.set(s.reps, { weightKg: s.weightKg, date: s.completedAt });
    }
  }
  return Array.from(best.entries())
    .map(([reps, v]) => ({ reps, weightKg: v.weightKg, date: v.date }))
    .sort((a, b) => a.reps - b.reps);
}
