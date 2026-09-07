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
