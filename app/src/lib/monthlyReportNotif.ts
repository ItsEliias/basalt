import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Monthly behavior-impact prompt — mirrors the Week in Review pattern
// exactly: opt-in, a fixed factual prompt with NO numbers (a local trigger
// cannot run the composer at delivery), tap opens Trends where the report
// composes live from the ledger.
//
// expo has no monthly repeating trigger, so enabling schedules a one-shot
// for the next 1st at 18:00 and rescheduleMonthlyReportNotif() (called at
// app start) keeps rolling it forward while the toggle is on.

export const MONTHLY_REPORT_NOTIF_ID = 'monthly-behavior-report';
const STORAGE_KEY = 'basalt.monthlyReportNotif';
const CHANNEL_ID = 'monthly-report';

const CONTENT = {
  title: 'Last month, from your ledger',
  body: 'Behavior facts and what moved with what — open Trends to read it.',
} as const;

export function nextFirstOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 18, 0, 0);
}

export async function isMonthlyReportNotifEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_KEY)) === 'on';
}

async function schedule(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: MONTHLY_REPORT_NOTIF_ID,
    content: { title: CONTENT.title, body: CONTENT.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextFirstOfMonth(new Date()),
      channelId: CHANNEL_ID,
    },
  });
}

export async function enableMonthlyReportNotif(): Promise<{ ok: boolean; reason?: string }> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Monthly report',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) {
    return { ok: false, reason: 'Notifications are off for Basalt in system settings.' };
  }
  await schedule();
  await AsyncStorage.setItem(STORAGE_KEY, 'on');
  return { ok: true };
}

export async function disableMonthlyReportNotif(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(MONTHLY_REPORT_NOTIF_ID);
  await AsyncStorage.setItem(STORAGE_KEY, 'off');
}

/** Roll the one-shot forward — call at app start; no-op when off. */
export async function rescheduleMonthlyReportNotif(): Promise<void> {
  if (!(await isMonthlyReportNotifEnabled())) return;
  await Notifications.cancelScheduledNotificationAsync(MONTHLY_REPORT_NOTIF_ID);
  await schedule();
}

/** Route a tap to Trends — running-app + cold-start, like the weekly one. */
export function wireMonthlyReportNotifTap(openTrends: () => void): () => void {
  const last = Notifications.getLastNotificationResponse();
  if (last?.notification.request.identifier === MONTHLY_REPORT_NOTIF_ID) openTrends();
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.notification.request.identifier === MONTHLY_REPORT_NOTIF_ID) openTrends();
  });
  return () => sub.remove();
}
