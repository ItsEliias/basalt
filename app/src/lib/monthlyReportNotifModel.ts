// Monthly behavior-report delivery — the pure half, expo-free so the
// Pebble revoice path and the voice-parity test can import it without
// dragging native modules along.

export const MONTHLY_REPORT_NOTIF_ID = 'monthly-behavior-report';
export const MONTHLY_REPORT_CHANNEL_ID = 'monthly-report';

export function nextFirstOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 18, 0, 0);
}
