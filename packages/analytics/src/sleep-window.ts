// Bedtime window + sleep consistency (V3.1 items 5–6). Both are
// arithmetic on the user's own nights — published here, shown in the
// UI's math sheet, and hidden entirely until the data exists.
//
// Bedtime window:
//   · tonight's target sleep = need + min(60, debt ÷ 3) — repay at most
//     an hour a night, a third of the debt at a time
//   · anchor = the MEDIAN of your own recent wake times (no planned item
//     in the ledger carries a clock time, so your own wake habit is the
//     honest anchor — stated in the srcnote)
//   · window = [wake − target − 30 min, wake − target] — a 30-minute
//     runway, a suggestion never an alarm
//   · hidden until the need model is personal (14 nights) AND at least
//     7 wake times exist in the trailing window
//
// Consistency:
//   · bedtime varies ±X min = the MEDIAN ABSOLUTE DEVIATION of the last
//     14 bedtimes around their median — robust, no score, just spread
//   · clock arithmetic runs on an 18:00-origin axis so midnight doesn't
//     split a 11:50pm/12:10am pair into a 23-hour "difference"

export const BEDTIME_RULES = {
  debtRepayCapMin: 60,
  debtRepayFraction: 1 / 3,
  windowWidthMin: 30,
  minWakeSamples: 7,
  consistencyWindowNights: 14,
  clockOriginMin: 18 * 60, // 6:00 pm — the axis origin for wrap-safe math
} as const;

/** Wall-clock minutes-past-midnight → minutes past 18:00 (wrap-safe axis). */
export function toClockAxis(minutesPastMidnight: number): number {
  return (minutesPastMidnight - BEDTIME_RULES.clockOriginMin + 1440) % 1440;
}

export function fromClockAxis(axisMin: number): number {
  return (axisMin + BEDTIME_RULES.clockOriginMin) % 1440;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** "10:40 pm" / "6:55 am" from minutes past midnight. */
export function clockText(minutesPastMidnight: number): string {
  const m = ((Math.round(minutesPastMidnight) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ampm = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${ampm}`;
}

const hm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;

export type BedtimeWindow = {
  /** Window bounds in minutes past midnight. */
  startMin: number;
  endMin: number;
  targetSleepMin: number;
  line: string;
  formulaLine: string;
};

/**
 * The suggested window, or null when the inputs aren't earned yet.
 * `wakeClockMins` = recent wake times (minutes past midnight), night
 * sessions only.
 */
export function bedtimeWindow(
  needMin: number,
  needIsPersonal: boolean,
  debtMin: number,
  wakeClockMins: number[],
): BedtimeWindow | null {
  const R = BEDTIME_RULES;
  if (!needIsPersonal || wakeClockMins.length < R.minWakeSamples) return null;

  const repay = Math.min(R.debtRepayCapMin, Math.round(debtMin * R.debtRepayFraction));
  const targetSleepMin = needMin + repay;
  const wakeAxis = median(wakeClockMins.map(toClockAxis));
  const endAxis = wakeAxis - targetSleepMin;
  const startAxis = endAxis - R.windowWidthMin;
  const startMin = fromClockAxis(((startAxis % 1440) + 1440) % 1440);
  const endMin = fromClockAxis(((endAxis % 1440) + 1440) % 1440);
  return {
    startMin,
    endMin,
    targetSleepMin,
    line: `To meet your need: in bed ${clockText(startMin)}–${clockText(endMin)}`,
    formulaLine:
      `need ${hm(needMin)}` +
      (repay > 0 ? ` + debt repay ${hm(repay)} (⅓ of debt, capped 1:00)` : '') +
      ` = ${hm(targetSleepMin)} before your usual ${clockText(fromClockAxis(wakeAxis))} wake`,
  };
}

export type SleepConsistency = {
  plusMinusMin: number;
  medianBedMin: number;
  nights: number;
  line: string;
  mathLine: string;
};

/** Bedtime spread as ±MAD around the median — a spread, never a score. */
export function sleepConsistency(bedClockMins: number[]): SleepConsistency | null {
  const window = bedClockMins.slice(-BEDTIME_RULES.consistencyWindowNights);
  if (window.length < BEDTIME_RULES.minWakeSamples) return null;
  const axis = window.map(toClockAxis);
  const med = median(axis);
  const mad = Math.round(median(axis.map((a) => Math.abs(a - med))));
  const medianBedMin = fromClockAxis(med);
  return {
    plusMinusMin: mad,
    medianBedMin,
    nights: window.length,
    line: `Bedtime varies ±${mad} min`,
    mathLine: `median bedtime ${clockText(medianBedMin)} over ${window.length} nights · ± is the median absolute deviation`,
  };
}
