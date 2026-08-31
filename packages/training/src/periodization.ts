// Periodization engine — mesocycle-aware progression layered OVER
// suggestNext, never replacing it. Everything here is published and every
// output carries its basis in words; every prescription renders as a
// suggestion. No history still invents no numbers: a first_time suggestion
// passes through untouched.
//
// The block structure (published):
//   weeks 1–3  accumulation    — volume builds: your recent weekly sets
//                                ×1.0 → ×1.1 → ×1.2, loads per suggestNext
//   weeks 4–5  intensification — volume holds at ×1.0, suggested top loads
//                                +2.5%, reps at the bottom of the range
//   week 6     deload          — loads −40%, volume ×0.5 — the point is to
//                                arrive fresh for the next block
//
// Deload triggers (published, any TWO advise an early deload):
//   a) ≥40% of the last 7 days' exercise feedback is "too hard"
//   b) 7-day mean readiness below 45, when readiness was computable
//   c) a main lift's weekly best e1RM flat-or-down across 2+ consecutive
//      weeks that contained sessions

import { roundToStep, type Suggestion } from './progression';

export type BlockPhase = 'accumulation' | 'intensification' | 'deload';

export const MESOCYCLE = {
  accumulationWeeks: 3,
  intensificationWeeks: 2,
  deloadWeeks: 1,
} as const;

export const MESO_LENGTH_WEEKS =
  MESOCYCLE.accumulationWeeks + MESOCYCLE.intensificationWeeks + MESOCYCLE.deloadWeeks;

export const DELOAD_TRIGGERS = {
  tooHardFraction: 0.4,
  readinessMeanBelow: 45,
  stallWeeks: 2,
} as const;

export type Program = {
  id: string;
  startedOn: string; // ISO day
  /** Training weekdays, 0=Sunday … 6=Saturday. The complement is planned rest. */
  trainingDays: number[];
  active: boolean;
};

export function weekIndexFor(startedOn: string, today: Date): number {
  const start = new Date(`${startedOn}T00:00:00`);
  const days = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return Math.max(0, Math.floor(days / 7));
}

export function phaseFor(weekIndex: number): { phase: BlockPhase; weekInPhase: number; weekOfMeso: number } {
  const w = weekIndex % MESO_LENGTH_WEEKS;
  if (w < MESOCYCLE.accumulationWeeks) return { phase: 'accumulation', weekInPhase: w, weekOfMeso: w };
  if (w < MESOCYCLE.accumulationWeeks + MESOCYCLE.intensificationWeeks) {
    return { phase: 'intensification', weekInPhase: w - MESOCYCLE.accumulationWeeks, weekOfMeso: w };
  }
  return { phase: 'deload', weekInPhase: w - MESOCYCLE.accumulationWeeks - MESOCYCLE.intensificationWeeks, weekOfMeso: w };
}

export function phaseLabel(p: { phase: BlockPhase; weekOfMeso: number }): string {
  const name = p.phase === 'accumulation' ? 'Accumulation' : p.phase === 'intensification' ? 'Intensification' : 'Deload';
  return `Week ${p.weekOfMeso + 1} of ${MESO_LENGTH_WEEKS} · ${name}`;
}

/** Weekly volume target per muscle: baseline weekly working sets × the
 *  phase multiplier. No baseline → null; nothing is invented to fill it. */
export function weeklyVolumeTarget(
  baselineWeeklySets: number | null,
  phase: BlockPhase,
  weekInPhase: number,
): number | null {
  if (baselineWeeklySets === null || baselineWeeklySets <= 0) return null;
  const multiplier =
    phase === 'accumulation' ? 1 + 0.1 * weekInPhase : phase === 'intensification' ? 1 : 0.5;
  return Math.max(1, Math.round(baselineWeeklySets * multiplier));
}

export type PeriodizedSuggestion = Suggestion & {
  phase: BlockPhase;
  /** Working-set delta vs the user's own recent norm for the movement. */
  setsDelta: number;
};

/**
 * Layer the mesocycle phase over a base suggestion. first_time passes
 * through untouched — periodization never invents a starting number.
 */
export function periodize(
  base: Suggestion,
  ctx: { phase: BlockPhase; weekInPhase: number },
): PeriodizedSuggestion {
  if (base.kind === 'first_time') return { ...base, phase: ctx.phase, setsDelta: 0 };

  if (ctx.phase === 'deload') {
    const kg = base.weightKg !== null ? Math.max(0, roundToStep(base.weightKg * 0.6)) : null;
    const reps = base.weightKg === null && base.reps !== null ? Math.max(1, Math.round(base.reps * 0.6)) : base.reps;
    return {
      ...base,
      weightKg: kg,
      reps,
      setsDelta: -1,
      phase: 'deload',
      basis: `deload week — ${base.weightKg !== null ? '60% of the suggested load' : 'about 60% of the suggested reps'}, one fewer set; the point is to arrive fresh`,
    };
  }

  if (ctx.phase === 'intensification') {
    const kg = base.weightKg !== null ? roundToStep(base.weightKg * 1.025) : null;
    return {
      ...base,
      weightKg: kg,
      setsDelta: 0,
      phase: 'intensification',
      basis: `${base.basis} · intensification week: +2.5% on the suggested load`,
    };
  }

  // Accumulation: loads per the base rules; volume climbs in weeks 2–3.
  const setsDelta = ctx.weekInPhase >= 1 ? 1 : 0;
  return {
    ...base,
    setsDelta,
    phase: 'accumulation',
    basis: setsDelta > 0 ? `${base.basis} · accumulation week ${ctx.weekInPhase + 1}: one set more than your recent norm` : base.basis,
  };
}

export type DeloadSignals = {
  /** Fraction of the last 7 days' feedback that was "too hard" — null when
   *  no feedback exists (absence is not a signal). */
  tooHardFraction7d: number | null;
  /** Mean of the last 7 days' readiness scores — null when < 3 computable
   *  days (a missing number is not a low number). */
  readinessMean7d: number | null;
  /** Main lifts whose weekly best e1RM was flat-or-down across
   *  DELOAD_TRIGGERS.stallWeeks consecutive session-containing weeks. */
  stalledLifts: number;
};

export function deloadAdvised(signals: DeloadSignals): { advised: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (signals.tooHardFraction7d !== null && signals.tooHardFraction7d >= DELOAD_TRIGGERS.tooHardFraction) {
    reasons.push(`${Math.round(signals.tooHardFraction7d * 100)}% of this week's feedback was "too hard"`);
  }
  if (signals.readinessMean7d !== null && signals.readinessMean7d < DELOAD_TRIGGERS.readinessMeanBelow) {
    reasons.push(`7-day readiness mean ${Math.round(signals.readinessMean7d)} (below ${DELOAD_TRIGGERS.readinessMeanBelow})`);
  }
  if (signals.stalledLifts >= 1) {
    reasons.push(
      `${signals.stalledLifts} main ${signals.stalledLifts === 1 ? 'lift has' : 'lifts have'} stalled ${DELOAD_TRIGGERS.stallWeeks}+ weeks`,
    );
  }
  return { advised: reasons.length >= 2, reasons };
}

/** Count lifts whose weekly-best series is flat-or-down across the last
 *  `stallWeeks` week-over-week steps. Weeks without sessions are skipped —
 *  a holiday is not a stall. */
export function stalledMainLifts(
  weeklyBests: { name: string; weeklyBestE1rm: number[] }[],
  stallWeeks: number = DELOAD_TRIGGERS.stallWeeks,
): number {
  let stalled = 0;
  for (const lift of weeklyBests) {
    const series = lift.weeklyBestE1rm.filter((v) => v > 0);
    if (series.length < stallWeeks + 1) continue;
    const recent = series.slice(-(stallWeeks + 1));
    let flatOrDown = true;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i]! > recent[i - 1]!) { flatOrDown = false; break; }
    }
    if (flatOrDown) stalled += 1;
  }
  return stalled;
}

/** Planned rest days in a window — the program's non-training weekdays.
 *  Feeds the rest-aware streak rule (streaks.ts) as its planned source. */
export function plannedRestDays(program: Program, windowStart: Date, windowEnd: Date): Set<string> {
  const out = new Set<string>();
  const start = new Date(`${program.startedOn}T00:00:00`);
  const cursor = new Date(windowStart);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= windowEnd) {
    if (cursor >= start && !program.trainingDays.includes(cursor.getDay())) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      out.add(`${y}-${m}-${d}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
