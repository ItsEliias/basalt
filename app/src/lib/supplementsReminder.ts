import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// One optional daily reminder for the supplements checklist. Same honesty
// as hydration: the notification reminds, it never ticks anything.

export const SUPPLEMENTS_CHANNEL_ID = 'basalt.supplements';
export const SUPPLEMENTS_NOTIF_ID = 'basalt.supplements.daily';
export const SUPPLEMENTS_REMINDER_KEY = 'basalt.supplementsReminder';
export const SUPPLEMENT_REMINDER_HOURS = [8, 12, 20] as const;

export function supplementsReminderContent(hour: number): { title: string; body: string } {
  return {
    title: 'Supplements',
    body: `Your checklist is on Today. You asked for this at ${String(hour).padStart(2, '0')}:00 — nothing ticks itself.`,
  };
}

export function parseSupplementsReminderHour(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return (SUPPLEMENT_REMINDER_HOURS as readonly number[]).includes(n) ? n : null;
}

export async function getSupplementsReminderHour(): Promise<number | null> {
  return parseSupplementsReminderHour(await AsyncStorage.getItem(SUPPLEMENTS_REMINDER_KEY));
}

/** `null` turns the reminder off. */
export async function setSupplementsReminderHour(hour: number | null): Promise<{ ok: boolean; reason?: string }> {
  await Notifications.cancelScheduledNotificationAsync(SUPPLEMENTS_NOTIF_ID).catch(() => {});
  if (hour !== null) {
    await Notifications.setNotificationChannelAsync(SUPPLEMENTS_CHANNEL_ID, {
      name: 'Supplements reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, reason: 'Notifications are off for Basalt in system settings.' };
    }
    await Notifications.scheduleNotificationAsync({
      identifier: SUPPLEMENTS_NOTIF_ID,
      content: supplementsReminderContent(hour),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
        channelId: SUPPLEMENTS_CHANNEL_ID,
      },
    });
  }
  await AsyncStorage.setItem(SUPPLEMENTS_REMINDER_KEY, hour === null ? '' : String(hour));
  return { ok: true };
}
