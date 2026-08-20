// Date helpers copy-pasted across the source app's services.
//
// `isoDay` was duplicated byte-identically in exactly two files
// (weightService.ts, habitService.ts) as a general "format an arbitrary
// Date" helper — weightService buckets historical weigh-ins by day,
// habitService walks backward day-by-day for streak calculation.
// `todayISO` was inlined in 7 more files (foodService, waterService,
// meditationService, questService, sleepService, workoutService,
// stepService) that only ever needed "now"; the other 2 (weightService,
// habitService) instead composed it from `isoDay(new Date())`. Both forms
// produce identical output for the same instant, so `todayISO` here is
// implemented in terms of `isoDay`, matching every existing call site.

/** Format a Date as YYYY-MM-DD in its local calendar day. */
export function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD for today, in the device's local calendar day. */
export function todayISO(): string {
  return isoDay(new Date());
}
