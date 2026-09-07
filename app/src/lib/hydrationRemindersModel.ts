// Hydration reminders (hydration Extra) — the user picks the hours; each
// hour is one daily notification. The copy is a reminder, not a nudge:
// nothing is logged unless the user logs it, and the notification says so.

export const HYDRATION_CHANNEL_ID = 'basalt.hydration';
export const HYDRATION_STORAGE_KEY = 'basalt.hydrationReminders';
export const HYDRATION_NOTIF_PREFIX = 'basalt.hydration.';

/** Offerable hours — waking day, on the hour. */
export const HYDRATION_HOUR_CHOICES = [8, 10, 12, 14, 16, 18, 20, 22] as const;

export function hydrationNotifId(hour: number): string {
  return `${HYDRATION_NOTIF_PREFIX}${hour}`;
}

export function hydrationContent(hour: number): { title: string; body: string } {
  return {
    title: 'Water',
    body: `You asked for a reminder at ${String(hour).padStart(2, '0')}:00. Nothing is logged unless you log it.`,
  };
}

/** Stored: sorted unique hours within the offered set. */
export function parseHydrationHours(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (h): h is number => typeof h === 'number' && (HYDRATION_HOUR_CHOICES as readonly number[]).includes(h),
    );
    return [...new Set(valid)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function hydrationSummary(hours: number[]): string {
  if (hours.length === 0) return 'no hours picked — no notifications';
  return `${hours.map((h) => `${String(h).padStart(2, '0')}:00`).join(' · ')}`;
}
