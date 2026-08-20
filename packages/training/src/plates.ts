// Plate calculator — per-side barbell loading (Hevy/FitNotes pattern).
// Greedy from the heaviest plate, which is exact for standard plate sets.
// When the target isn't achievable with the available plates, the residual
// is stated plainly — never silently rounded.

export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
export const DEFAULT_BAR_KG = 20;

export type PlateBreakdown = {
  requestedKg: number;
  barKg: number;
  /** Heaviest-first pairs per side. */
  perSide: { plateKg: number; count: number }[];
  /** bar + 2 × Σ(per-side) — what actually ends up on the bar. */
  achievableKg: number;
  /** requested − achievable (0 when exact). */
  residualKg: number;
};

export function platesFor(
  targetKg: number,
  options: { barKg?: number; plates?: readonly number[] } = {},
): PlateBreakdown | null {
  const barKg = options.barKg ?? DEFAULT_BAR_KG;
  const plates = [...(options.plates ?? DEFAULT_PLATES_KG)].sort((a, b) => b - a);
  if (!isFinite(targetKg) || targetKg < barKg) return null;

  let perSideRemaining = (targetKg - barKg) / 2;
  const perSide: { plateKg: number; count: number }[] = [];
  for (const plate of plates) {
    const count = Math.floor((perSideRemaining + 1e-9) / plate);
    if (count > 0) {
      perSide.push({ plateKg: plate, count });
      perSideRemaining -= count * plate;
    }
  }

  const loaded = perSide.reduce((s, p) => s + p.plateKg * p.count, 0);
  const achievableKg = Math.round((barKg + loaded * 2) * 100) / 100;
  return {
    requestedKg: targetKg,
    barKg,
    perSide,
    achievableKg,
    residualKg: Math.round((targetKg - achievableKg) * 100) / 100,
  };
}

/** "25 + 15 per side · 20 kg bar" display line, or the empty-bar case. */
export function platesText(b: PlateBreakdown): string {
  if (b.perSide.length === 0) return `empty bar (${b.barKg} kg)`;
  const parts = b.perSide.flatMap((p) => Array.from({ length: p.count }, () => String(p.plateKg)));
  return `${parts.join(' + ')} per side · ${b.barKg} kg bar`;
}
