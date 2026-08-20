// Pure formatting helpers backing the honesty rules — every numeral the UI
// prints goes through one of these so the rules live in exactly one place.

/** Thousands-grouped integer, e.g. 2340 → "2,340". */
export function groupInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/**
 * Cap state for a "under is the goal" nutrient (design spec §3 cap row).
 * Over-cap is stated plainly — "41 / 36 g · 5 over" — never hidden, never
 * scolded. Values are rounded for display the same way before comparing so
 * the text never reads "36 / 36 · 0 over".
 */
export function capState(
  value: number,
  cap: number,
): { over: boolean; overBy: number; fillPct: number } {
  const v = Math.round(value * 10) / 10;
  const c = Math.round(cap * 10) / 10;
  const over = v > c;
  return {
    over,
    overBy: over ? Math.round((v - c) * 10) / 10 : 0,
    fillPct: c > 0 ? Math.min(100, (v / c) * 100) : v > 0 ? 100 : 0,
  };
}

/** Bar fill percentage, clamped 0–100. */
export function fillPct(value: number, target: number): number {
  if (target <= 0) return value > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, (value / target) * 100));
}

/** Seconds → "MM:SS" (rest timers, guided set timer, session clocks). */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Seconds-per-km → "M:SS" pace text (splits rows). */
export function paceText(secondsPerKm: number): string {
  if (!isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  const s = Math.round(secondsPerKm);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Minutes → "7 h 21 m" split used by sleep heroes. */
export function hoursMinutes(totalMinutes: number): { h: number; m: number } {
  const mins = Math.max(0, Math.round(totalMinutes));
  return { h: Math.floor(mins / 60), m: mins % 60 };
}

/**
 * "~" marker for AI-derived, not-yet-confirmed values (honesty rule §5).
 * The tilde is dropped only when `confirmed` is true.
 */
export function approxValue(value: number, confirmed: boolean): string {
  return confirmed ? groupInt(value) : `~${groupInt(value)}`;
}

/** Weight display honoring quarter-kg precision without fake decimals. */
export function kgText(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
