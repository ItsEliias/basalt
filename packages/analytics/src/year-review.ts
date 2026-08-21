// Year in Review — the Week in Review's honesty at year scale: factual
// clauses, stats only where real data exists, exactly one gap named, and
// a thin year refuses to compose (90+ logged days or 45+ sessions).

export type YearReviewInput = {
  yearLabel: string;
  totalDaysSoFar: number;
  foodLoggedDays: number;
  sessions: number;
  volumeKg: number;
  walks: number;
  walkKm: number;
  sleepNights: number;
  sleepAvgMin: number | null;
  weightFirstKg: number | null;
  weightLastKg: number | null;
};

export type YearReview = {
  lede: string | null;
  gap: string | null;
  stats: { k: string; v: string }[];
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export function composeYearReview(y: YearReviewInput): YearReview {
  if (y.foodLoggedDays < 90 && y.sessions < 45) {
    return { lede: null, gap: null, stats: [] };
  }

  const stats: { k: string; v: string }[] = [];
  if (y.volumeKg > 0) stats.push({ k: 'Volume', v: y.volumeKg >= 1000 ? `${(y.volumeKg / 1000).toFixed(1)} t` : `${fmt(y.volumeKg)} kg` });
  if (y.sessions > 0) stats.push({ k: 'Sessions', v: String(y.sessions) });
  if (y.walkKm > 0) stats.push({ k: 'Walked', v: `${y.walkKm.toFixed(0)} km` });
  if (y.sleepAvgMin !== null) {
    stats.push({ k: 'Sleep', v: `${Math.floor(y.sleepAvgMin / 60)}:${String(Math.round(y.sleepAvgMin % 60)).padStart(2, '0')} avg` });
  }
  if (y.weightFirstKg !== null && y.weightLastKg !== null) {
    const d = Math.round((y.weightLastKg - y.weightFirstKg) * 10) / 10;
    stats.push({ k: 'Weight', v: `${d >= 0 ? '+' : '−'}${Math.abs(d)} kg` });
  }

  // One gap — the weakest coverage dimension, deterministically.
  const candidates: { severity: number; text: string }[] = [];
  const unlogged = y.totalDaysSoFar - y.foodLoggedDays;
  if (unlogged > 0) {
    candidates.push({ severity: unlogged / y.totalDaysSoFar, text: `${unlogged} days went unlogged` });
  }
  if (y.sleepNights < y.totalDaysSoFar * 0.5) {
    candidates.push({
      severity: 1 - y.sleepNights / Math.max(1, y.totalDaysSoFar),
      text: y.sleepNights === 0 ? 'sleep was never persisted' : `sleep was persisted on only ${y.sleepNights} nights`,
    });
  }
  if (y.sessions === 0) candidates.push({ severity: 0.9, text: 'no training sessions were logged' });
  const gap = candidates.sort((a, b) => b.severity - a.severity)[0]?.text ?? null;

  const clauses = [
    y.sessions > 0 ? `${y.sessions} training sessions` : null,
    `food logged on ${y.foodLoggedDays} of ${y.totalDaysSoFar} days`,
    y.walks > 0 ? `${y.walks} recorded walks` : null,
  ].filter(Boolean);

  return {
    lede: `${y.yearLabel}: ${clauses.join(' · ')}.` + (gap ? ` The one gap: ${gap}.` : ''),
    gap,
    stats,
  };
}
