// Race plans — one knob, one published model, no coach-speak.
//
// The knob: ONE recent result (distance + time). Everything derives from
// it via the Riegel model (Peter Riegel, 1977): T2 = T1 × (D2/D1)^1.06 —
// named in the UI, exponent published here. Training paces are fixed
// multiples of predicted race pace, published below. No fitness scores,
// no adaptive magic; retime the knob with a newer result and the plan
// recomputes.
//
// Missed-session ramp-back is a published rule, not a judgement call:
//   · behind by ≤ 1 week  → repeat the last completed week
//   · behind by > 1 week  → step back two weeks from where you stopped
// A plan never scolds; it states where you are and what the rule says.

export const RIEGEL_EXPONENT = 1.06;

export type RaceKey = '5k' | '10k' | 'half' | 'marathon';

export const RACE_DISTANCES_M: Record<RaceKey, number> = {
  '5k': 5000,
  '10k': 10000,
  half: 21097.5,
  marathon: 42195,
};

/** Riegel 1977: T2 = T1 × (D2/D1)^1.06. */
export function riegelPredict(basisDistM: number, basisS: number, targetDistM: number): number {
  return basisS * Math.pow(targetDistM / basisDistM, RIEGEL_EXPONENT);
}

/** Published pace multipliers over predicted race pace (sec/km). */
export const PACE_MULTIPLIERS = { easy: 1.3, steady: 1.12, race: 1.0 } as const;

export type PaceSet = { easySecPerKm: number; steadySecPerKm: number; raceSecPerKm: number };

export function trainingPaces(basisDistM: number, basisS: number, race: RaceKey): PaceSet {
  const targetM = RACE_DISTANCES_M[race];
  const raceSecPerKm = riegelPredict(basisDistM, basisS, targetM) / (targetM / 1000);
  return {
    easySecPerKm: Math.round(raceSecPerKm * PACE_MULTIPLIERS.easy),
    steadySecPerKm: Math.round(raceSecPerKm * PACE_MULTIPLIERS.steady),
    raceSecPerKm: Math.round(raceSecPerKm),
  };
}

// Long-run build per race — start km, peak km. Linear build to the peak at
// the second-to-last week; the final week is the taper (60% of peak, and
// the week's other sessions shrink too).
export const LONG_RUN_KM: Record<RaceKey, { start: number; peak: number }> = {
  '5k': { start: 4, peak: 8 },
  '10k': { start: 6, peak: 12 },
  half: { start: 8, peak: 18 },
  marathon: { start: 12, peak: 30 },
};

export const PLAN_WEEKS_MIN = 6;
export const PLAN_WEEKS_MAX = 16;

export type PlanSession = {
  key: string;
  label: string;
  detail: string;
};

export type PlanWeek = {
  index: number;
  taper: boolean;
  sessions: PlanSession[];
};

function paceText(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

/**
 * Three sessions a week — easy, steady, long — for `weeks` weeks (clamped
 * to the published 6–16 band). The last week tapers.
 */
export function buildRacePlan(race: RaceKey, weeks: number, paces: PaceSet): PlanWeek[] {
  const n = Math.max(PLAN_WEEKS_MIN, Math.min(PLAN_WEEKS_MAX, Math.round(weeks)));
  const { start, peak } = LONG_RUN_KM[race];
  return Array.from({ length: n }, (_, i) => {
    const taper = i === n - 1;
    const build = n > 2 ? i / (n - 2) : 1;
    const longKm = taper
      ? Math.round(peak * 0.6)
      : Math.round(start + (peak - start) * Math.min(1, build));
    const easyKm = Math.max(3, Math.round(longKm * 0.5));
    const steadyKm = Math.max(3, Math.round(longKm * (taper ? 0.3 : 0.4)));
    return {
      index: i,
      taper,
      sessions: [
        { key: `w${i}s0`, label: `Easy ${easyKm} km`, detail: `~${paceText(paces.easySecPerKm)} · conversational` },
        { key: `w${i}s1`, label: `Steady ${steadyKm} km`, detail: `~${paceText(paces.steadySecPerKm)} · comfortably hard` },
        { key: `w${i}s2`, label: `Long ${longKm} km`, detail: `~${paceText(paces.easySecPerKm)} · ${taper ? 'taper week' : 'the week’s anchor'}` },
      ],
    };
  });
}

export type RampBack =
  | { action: 'continue' }
  | { action: 'repeat'; week: number; note: string }
  | { action: 'step_back'; week: number; note: string };

/**
 * The published catch-up rule. `calendarWeek` is where the calendar says
 * you should be; `lastCompletedWeek` is the last week with all sessions
 * ticked (-1 when none).
 */
export function rampBack(calendarWeek: number, lastCompletedWeek: number): RampBack {
  const behind = calendarWeek - (lastCompletedWeek + 1);
  if (behind <= 0) return { action: 'continue' };
  if (behind === 1) {
    return {
      action: 'repeat',
      week: Math.max(0, lastCompletedWeek),
      note: 'About a week behind — the rule says repeat your last completed week.',
    };
  }
  return {
    action: 'step_back',
    week: Math.max(0, lastCompletedWeek - 1),
    note: 'More than a week behind — the rule says step back two weeks from where you stopped and rebuild.',
  };
}

/** hh:mm:ss (or mm:ss under an hour) for predicted race times. */
export function raceTimeText(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${m}:${String(ss).padStart(2, '0')}`;
}
