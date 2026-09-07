import * as Notifications from 'expo-notifications';

// Wind-down (winddown Extra) — the offer logic. When sleep debt runs past
// 90 minutes, one notification is scheduled for tonight at the usual
// bedtime minus 30 minutes. One-shot, never repeating, cancelled and
// re-decided each time Recover computes the debt.

export const WINDDOWN_CHANNEL_ID = 'basalt.winddown';
export const WINDDOWN_NOTIF_ID = 'basalt.winddown.tonight';
export const WINDDOWN_DEBT_FLOOR_MIN = 90;
export const WINDDOWN_LEAD_MIN = 30;

export const WINDDOWN_OFFER = {
  title: 'Wind-down',
  body: 'Sleep debt is past 90 minutes. Tonight’s tools are on Recover — breathing, a body scan, or ten quiet minutes. Or ignore this; it won’t repeat.',
};

/** Median bedtime (minutes past midnight, evening-shifted) from recent nights. */
export function usualBedtimeMin(bedtimesIso: readonly string[]): number | null {
  const mins = bedtimesIso
    .map((iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      let m = d.getHours() * 60 + d.getMinutes();
      if (m < 12 * 60) m += 24 * 60; // past-midnight bedtimes sort after evening ones
      return m;
    })
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);
  if (mins.length < 3) return null;
  return mins[Math.floor(mins.length / 2)]!;
}

/**
 * Decide tonight's offer. Cancels any previous one first; schedules only
 * when the debt clears the floor AND the moment is still ahead of now.
 */
export async function scheduleWindDownOffer(input: {
  sleepDebtMin: number | null;
  bedtimesIso: readonly string[];
  now?: Date;
}): Promise<'scheduled' | 'skipped'> {
  await Notifications.cancelScheduledNotificationAsync(WINDDOWN_NOTIF_ID).catch(() => {});
  if (input.sleepDebtMin === null || input.sleepDebtMin <= WINDDOWN_DEBT_FLOOR_MIN) return 'skipped';
  const usual = usualBedtimeMin(input.bedtimesIso);
  if (usual === null) return 'skipped';

  const now = input.now ?? new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  target.setMinutes(usual - WINDDOWN_LEAD_MIN);
  if (target.getTime() <= now.getTime()) return 'skipped';

  await Notifications.setNotificationChannelAsync(WINDDOWN_CHANNEL_ID, {
    name: 'Wind-down',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return 'skipped';
  await Notifications.scheduleNotificationAsync({
    identifier: WINDDOWN_NOTIF_ID,
    content: WINDDOWN_OFFER,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target, channelId: WINDDOWN_CHANNEL_ID },
  });
  return 'scheduled';
}

// ── Body scan — five minutes, one stage per minute, plain words ────────

export const BODY_SCAN_STAGES = [
  'Feet and legs — notice the weight of them',
  'Hips and back — let the chair or bed carry you',
  'Hands and arms — loosen the grip you forgot you had',
  'Shoulders and jaw — both are probably higher than they need to be',
  'Breath — nothing to fix, just count a few',
] as const;

export function bodyScanStage(elapsedSec: number): string {
  const idx = Math.min(BODY_SCAN_STAGES.length - 1, Math.floor(elapsedSec / 60));
  return BODY_SCAN_STAGES[idx]!;
}
