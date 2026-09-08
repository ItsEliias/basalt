// Detail level (V4 Phase 8h) — pure model. THE LAW: detail changes what
// is SHOWN, never what is computed. Every number visible in Simple is
// the same number Full shows (Simple may display it rounder); everything
// hidden stays one tap away behind a "more" affordance, and "why" taps
// work at every level.

export type DetailLevel = 'simple' | 'standard' | 'full';

const ORDER: Record<DetailLevel, number> = { simple: 0, standard: 1, full: 2 };

export function atLeast(level: DetailLevel, min: DetailLevel): boolean {
  return ORDER[level] >= ORDER[min];
}

export const DETAIL_OPTIONS: { key: DetailLevel; title: string; quote: string }[] = [
  { key: 'simple', title: 'Simple', quote: '“Just tell me what to do.”' },
  { key: 'standard', title: 'Standard', quote: '“Show me the numbers.”' },
  { key: 'full', title: 'Full', quote: '“Show me the maths.”' },
];

/** Simple shows the hero rounded to the nearest 10 — same number, rounder. */
export function heroDisplay(remaining: number, level: DetailLevel): number {
  return level === 'simple' ? Math.round(remaining / 10) * 10 : remaining;
}

/** Simple's one-line macro summary: facts, over-cap in words, no scold. */
export function simpleMacroLine(input: {
  carbsOverG: number; fatOverG: number; proteinShortG: number;
}): string {
  const parts: string[] = [];
  if (input.fatOverG > 0) parts.push(`fat ${Math.round(input.fatOverG)} g over`);
  if (input.carbsOverG > 0) parts.push(`carbs ${Math.round(input.carbsOverG)} g over`);
  if (parts.length === 0) return 'carbs and fat on track';
  return parts.join(' · ');
}

// ── Conformance model ───────────────────────────────────────────────────
// For a fixed seed day, the UNDERLYING numbers each level renders. The
// test pins: simple ⊆ standard ⊆ full, and every shared key is equal.
// (Display rounding is presentation; the underlying value is the number.)

export type SeedDay = {
  remainingKcal: number;
  proteinG: number; proteinTargetG: number;
  carbsG: number; carbsTargetG: number;
  fatG: number; fatCapG: number;
  fiberG: number; fiberTargetG: number;
  sugarG: number; sugarCapG: number;
  waterMl: number; waterTargetMl: number;
  intakeLow: number; intakeHigh: number;
  bmr: number; tdeeLow: number; tdeeHigh: number;
};

export function todayNumbersFor(level: DetailLevel, d: SeedDay): Map<string, number> {
  const m = new Map<string, number>();
  // Simple: energy left, protein, entries — the floor everyone sees.
  m.set('remainingKcal', d.remainingKcal);
  m.set('proteinG', d.proteinG);
  m.set('proteinTargetG', d.proteinTargetG);
  m.set('waterMl', d.waterMl);
  if (atLeast(level, 'standard')) {
    m.set('carbsG', d.carbsG);
    m.set('carbsTargetG', d.carbsTargetG);
    m.set('fatG', d.fatG);
    m.set('fatCapG', d.fatCapG);
    m.set('fiberG', d.fiberG);
    m.set('fiberTargetG', d.fiberTargetG);
    m.set('sugarG', d.sugarG);
    m.set('sugarCapG', d.sugarCapG);
    m.set('waterTargetMl', d.waterTargetMl);
    m.set('intakeLow', d.intakeLow);
    m.set('intakeHigh', d.intakeHigh);
  }
  if (atLeast(level, 'full')) {
    // Full shows the plan's internals inline — BMR and the TDEE range.
    m.set('bmr', d.bmr);
    m.set('tdeeLow', d.tdeeLow);
    m.set('tdeeHigh', d.tdeeHigh);
  }
  return m;
}

/** Readiness as a word in Simple — the number stays one tap away. */
export function readinessWord(score: number): 'Rested' | 'OK' | 'Tired' {
  return score >= 75 ? 'Rested' : score >= 55 ? 'OK' : 'Tired';
}
