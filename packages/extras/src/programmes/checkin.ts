// The weekly check-in (programmes Extra) — exactly ONE proposal, chosen by
// stated rules, citing the numbers it used. The safety rail outranks
// everything: a loss faster than 1%/week (or gain past 0.5%) gets ONLY
// 'slow down' — never a tighter target, never praise for speed.

export type CheckinInput = {
  /** The programme's assumed rate, signed %/week. */
  targetRatePct: number;
  /** Observed from the 7-day trend vs last week's, signed %/week; null = not enough weigh-ins. */
  observedRatePct: number | null;
  currentCalories: number;
  sessionsPlanned: number;
  sessionsDone: number;
};

export type CheckinProposal =
  | { kind: 'slow-down'; reason: string }
  | { kind: 'hold'; reason: string }
  | { kind: 'adjust'; deltaKcal: number; reason: string }
  | { kind: 'swap-lighter'; reason: string };

const LOSS_CAP = -1.0;
const GAIN_CAP = 0.5;

const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%/wk`;

/** One proposal per week. The order of the rules IS the policy. */
export function weeklyCheckin(input: CheckinInput): CheckinProposal {
  const { observedRatePct: obs, targetRatePct: target } = input;

  // 1 — Safety rail first, and it is the ONLY thing said when it fires.
  if (obs !== null && (obs < LOSS_CAP || obs > GAIN_CAP)) {
    return {
      kind: 'slow-down',
      reason: `Your trend moved ${pct(obs)} this week — past the ${obs < 0 ? '1% loss' : '0.5% gain'} cap. Slow down: eat closer to maintenance this week. No other change proposed.`,
    };
  }

  // 2 — Sessions missed by half or more → make the week lighter, not the
  //     diet tighter.
  if (input.sessionsPlanned > 0 && input.sessionsDone <= input.sessionsPlanned / 2) {
    return {
      kind: 'swap-lighter',
      reason: `${input.sessionsDone} of ${input.sessionsPlanned} planned sessions happened. Proposal: swap next week to lighter sessions rather than adjusting food — consistency first.`,
    };
  }

  // 3 — No trend yet → hold, and say why.
  if (obs === null) {
    return {
      kind: 'hold',
      reason: 'Not enough weigh-ins this week for a trend — target held. Three weigh-ins next week gives the check-in something honest to work with.',
    };
  }

  // 4 — Off the programme's rate by more than 0.15%/wk → one bounded nudge.
  const gap = obs - target;
  if (Math.abs(gap) > 0.15) {
    const delta = gap > 0 ? -Math.min(150, Math.max(100, Math.round(Math.abs(gap) * 400))) : Math.min(150, Math.max(100, Math.round(Math.abs(gap) * 400)));
    return {
      kind: 'adjust',
      deltaKcal: delta,
      reason: `Trend ${pct(obs)} vs the programme's ${pct(target)} — proposal: move the target ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} kcal (from ${input.currentCalories.toLocaleString('en-US')}). One bounded step, never a leap.`,
    };
  }

  // 5 — On track.
  return {
    kind: 'hold',
    reason: `Trend ${pct(obs)} vs the programme's ${pct(target)} — inside the line. Target held at ${input.currentCalories.toLocaleString('en-US')} kcal.`,
  };
}

// ── Trend corridor — the band the programme expects, published ─────────

export type Corridor = { low: number; high: number };

/**
 * Expected weight after `week` weeks at the programme's rate, with an
 * honest band: ±0.3 kg of scale noise plus 25% of the expected change.
 */
export function corridorFor(startKg: number, ratePctPerWeek: number, week: number): Corridor {
  const expected = startKg * (1 + (ratePctPerWeek / 100) * week);
  const tolerance = 0.3 + Math.abs(expected - startKg) * 0.25;
  return {
    low: Math.round((expected - tolerance) * 10) / 10,
    high: Math.round((expected + tolerance) * 10) / 10,
  };
}

export const CORRIDOR_EXPLAINER =
  'Corridor = start weight moved at the programme’s rate, ± 0.3 kg scale noise ± 25% of the expected change. A trend outside it is information, not failure.';

// ── The complete weekly check-in (V4 Phase 8f) ─────────────────────────
//
// One report of facts, then exactly ONE proposal chosen from a published
// priority list: safety → adherence → energy → volume. Never more than
// one ask per week.

export const CHECKIN_PRIORITY = ['safety (pain flags)', 'adherence (sessions or meals)', 'energy adjustment', 'volume'] as const;

export type MissReason = 'skipped' | 'moved' | 'ill';

export type FullCheckinInput = CheckinInput & {
  missReasons?: MissReason[];
  /** % of planned meals logged as planned (±10%), null = nothing planned. */
  mealAdherencePct: number | null;
  rirTrend: { thisWeekAvg: number | null; lastWeekAvg: number | null };
  /** Pain-flagged sets in the last 7 days. */
  painFlags: number;
  waistCm?: number | null;
  /** Regions outside the volume band two weeks running, if any. */
  volumeProposalReason?: string | null;
};

export type FullCheckin = {
  report: string[];
  proposal: CheckinProposal | { kind: 'safety' | 'adherence-offer' | 'volume'; reason: string };
};

const rirLine = (t: FullCheckinInput['rirTrend']): string | null => {
  if (t.thisWeekAvg === null) return null;
  if (t.lastWeekAvg === null) return `Average RIR ${t.thisWeekAvg.toFixed(1)} this week — first week with the numbers.`;
  const dir = t.thisWeekAvg < t.lastWeekAvg - 0.2 ? 'harder, as the block intends'
    : t.thisWeekAvg > t.lastWeekAvg + 0.2 ? 'easier — loads may be shy of the plan'
    : 'flat';
  return `Average RIR ${t.lastWeekAvg.toFixed(1)} → ${t.thisWeekAvg.toFixed(1)} — ${dir}.`;
};

export function fullWeeklyCheckin(input: FullCheckinInput): FullCheckin {
  const report: string[] = [];
  const reasons = input.missReasons ?? [];
  const missed = Math.max(0, input.sessionsPlanned - input.sessionsDone);
  report.push(
    `Sessions ${input.sessionsDone} of ${input.sessionsPlanned}${missed > 0 && reasons.length > 0 ? ` (missed: ${reasons.join(', ')})` : ''}.`,
  );
  if (input.mealAdherencePct !== null) {
    report.push(`Meal plan: ${Math.round(input.mealAdherencePct)}% of planned meals logged as planned (±10%).`);
  }
  const rl = rirLine(input.rirTrend);
  if (rl) report.push(rl);
  if (input.waistCm) report.push(`Waist ${input.waistCm} cm — your tape, your trend.`);
  if (input.painFlags > 0) report.push(`${input.painFlags} pain ${input.painFlags === 1 ? 'flag' : 'flags'} this week.`);

  // ONE proposal, by the published priority.
  // 1 — safety
  if (input.painFlags >= 3) {
    return {
      report,
      proposal: {
        kind: 'safety',
        reason: `${input.painFlags} pain flags this week — before anything else: worth getting that looked at, and the flagged movements have substitutions proposed in-session. No other change this week.`,
      },
    };
  }
  // 2 — adherence: sessions first, meals second
  const illOnly = reasons.length > 0 && reasons.every((r) => r === 'ill');
  if (input.sessionsPlanned >= 3 && input.sessionsDone <= input.sessionsPlanned / 2 && !illOnly) {
    return {
      report,
      proposal: {
        kind: 'adherence-offer',
        reason: `You're at ${input.sessionsDone} of ${input.sessionsPlanned} sessions — want a ${Math.max(2, input.sessionsDone + 1)}-day version? A plan that happens beats a plan that doesn't.`,
      },
    };
  }
  if (input.mealAdherencePct !== null && input.mealAdherencePct < 50) {
    return {
      report,
      proposal: {
        kind: 'adherence-offer',
        reason: `${Math.round(input.mealAdherencePct)}% of planned meals happened — want fewer planned meals, or batch-cook so the fridge decides? The plan should fit the week you actually have.`,
      },
    };
  }
  // 3 — energy (the Phase 6 rules, unchanged)
  const energy = weeklyCheckin(input);
  if (energy.kind !== 'hold') return { report, proposal: energy };
  // 4 — volume
  if (input.volumeProposalReason) {
    return { report, proposal: { kind: 'volume', reason: input.volumeProposalReason } };
  }
  return { report, proposal: energy };
}
