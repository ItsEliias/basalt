// Sleep need + debt — need/debt framing, deliberately NOT a 0–100 score.
// Every rule is published here; the math is one tap away in the UI; no
// number renders without the data behind it.
//
// The rules:
//   · Personal need = the median of your own last 28 nights, clamped to
//     [7:00, 10:00]. Until 14 real nights exist, the need is the published
//     default (8:00) and says so — a floor, not a guess dressed up.
//   · Strain: a prior day whose training volume reached your own P75 adds
//     30 minutes to that night's need (the same load component readiness
//     uses, reused not reinvented).
//   · Debt = Σ(need − slept) over the last 14 nights, floored at zero —
//     surplus nights repay debt; you cannot bank sleep below zero debt.
//   · Nights with no persisted sleep are ABSENT from the sums (absence is
//     not zero sleep); the debt line names how many nights it could see.
//   · Nap credit (V3.1): a day's LONGEST session is the night; additional
//     sessions up to 3 h are naps and CREDIT the day's slept total; extra
//     sessions longer than 3 h merge into the night (split sleep). The
//     nightly-need median is computed from NIGHTS ONLY — naps repay debt,
//     they never shrink what a night is expected to be.
//
// Sleep stages are display-only by product law (spec §5 amendment №5):
// nothing in this module reads stages, and nothing ever may.

export const SLEEP_NEED_RULES = {
  defaultNeedMin: 480,
  napMaxMin: 180,
  minNightsForPersonal: 14,
  personalWindowNights: 28,
  clampMin: 420,
  clampMax: 600,
  debtWindowDays: 14,
  strainExtraMin: 30,
} as const;

export type SleepNeed = {
  needMin: number;
  personal: boolean;
  basis: string;
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const hm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;

/** Personal nightly need from history — or the published default, stated. */
export function personalSleepNeed(recentNightsMin: number[]): SleepNeed {
  const R = SLEEP_NEED_RULES;
  const nights = recentNightsMin.filter((m) => m > 0).slice(-R.personalWindowNights);
  if (nights.length < R.minNightsForPersonal) {
    return {
      needMin: R.defaultNeedMin,
      personal: false,
      basis: `published default (${hm(R.defaultNeedMin)}) until ${R.minNightsForPersonal} nights of history — ${nights.length} so far`,
    };
  }
  const med = median(nights);
  const clamped = Math.min(R.clampMax, Math.max(R.clampMin, Math.round(med)));
  return {
    needMin: clamped,
    personal: true,
    basis: `median of your last ${nights.length} nights${clamped !== Math.round(med) ? `, clamped to ${hm(clamped)}` : ''}`,
  };
}

/**
 * Split one day's sessions into night vs nap minutes. Longest session =
 * the night; additional sessions ≤ napMaxMin are naps; longer extras
 * merge into the night (split sleep).
 */
export function classifyDaySleep(sessionMins: number[]): { nightMin: number; napMin: number } {
  const real = sessionMins.filter((m) => m > 0).sort((a, b) => b - a);
  if (real.length === 0) return { nightMin: 0, napMin: 0 };
  let nightMin = real[0]!;
  let napMin = 0;
  for (const m of real.slice(1)) {
    if (m <= SLEEP_NEED_RULES.napMaxMin) napMin += m;
    else nightMin += m;
  }
  return { nightMin: Math.round(nightMin), napMin: Math.round(napMin) };
}

/** Strain adjustment for one night: heavy prior day → +30 min need. */
export function strainAdjustedNeed(
  baseNeedMin: number,
  priorDayVolumeKg: number,
  volumeP75: number | null,
): { needMin: number; strained: boolean } {
  if (volumeP75 !== null && volumeP75 > 0 && priorDayVolumeKg >= volumeP75) {
    return { needMin: baseNeedMin + SLEEP_NEED_RULES.strainExtraMin, strained: true };
  }
  return { needMin: baseNeedMin, strained: false };
}

export type SleepDebt = {
  debtMin: number;
  nightsSeen: number;
  windowDays: number;
};

/**
 * Rolling debt over the window. `nights` holds per-night slept minutes and
 * that night's (possibly strain-adjusted) need; absent nights are simply
 * not in the list. Surplus repays; total floors at zero.
 */
export function sleepDebt(nights: { sleptMin: number; needMin: number }[]): SleepDebt {
  const window = nights.slice(-SLEEP_NEED_RULES.debtWindowDays);
  let debt = 0;
  for (const n of window) {
    debt += n.needMin - n.sleptMin;
  }
  return {
    debtMin: Math.max(0, Math.round(debt)),
    nightsSeen: window.length,
    windowDays: SLEEP_NEED_RULES.debtWindowDays,
  };
}

/** "You got 6:50 of the 8:10 your body needed." (+ the nap credit, stated) */
export function lastNightLine(sleptMin: number, needMin: number, napMin = 0): string {
  const base = `You got ${hm(sleptMin)} of the ${hm(needMin)} your body needed`;
  return napMin > 0 ? `${base} — nap ${hm(napMin)} credited` : base;
}

/** "need 7:50 − nap 0:40 = 7:10 remaining" — the math-sheet nap row. */
export function napCreditLine(needMin: number, napMin: number): string {
  return `need ${hm(needMin)} − nap ${hm(napMin)} = ${hm(Math.max(0, needMin - napMin))} remaining`;
}

export function debtLine(debt: SleepDebt): string {
  if (debt.nightsSeen === 0) return 'No sleep recorded in the window — no debt number without nights';
  const nights = `${debt.nightsSeen} of ${debt.windowDays} nights recorded`;
  if (debt.debtMin === 0) return `No sleep debt across the last ${nights}`;
  return `${hm(debt.debtMin)} behind across the last ${nights}`;
}
