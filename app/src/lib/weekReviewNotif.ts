import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  WEEK_REVIEW_CHANNEL_ID, WEEK_REVIEW_CONTENT, WEEK_REVIEW_NOTIF_ID,
  WEEK_REVIEW_STORAGE_KEY, WEEK_REVIEW_TRIGGER,
} from './weekReviewNotifModel';

// Native wiring for the Sunday 18:00 Week in Review prompt. Enabling is
// explicit (Settings toggle) and honest about failure: if the OS denies
// notification permission we report it and store nothing.

export async function isWeekReviewNotifEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(WEEK_REVIEW_STORAGE_KEY)) === 'on';
}

export async function enableWeekReviewNotif(): Promise<{ ok: boolean; reason?: string }> {
  // Channel must exist before the Android 13 permission prompt can appear.
  await Notifications.setNotificationChannelAsync(WEEK_REVIEW_CHANNEL_ID, {
    name: 'Week in review',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) {
    return { ok: false, reason: 'Notifications are off for Basalt in system settings.' };
  }
  await Notifications.scheduleNotificationAsync({
    identifier: WEEK_REVIEW_NOTIF_ID,
    content: {
      title: WEEK_REVIEW_CONTENT.title,
      body: WEEK_REVIEW_CONTENT.body,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: WEEK_REVIEW_TRIGGER.weekday,
      hour: WEEK_REVIEW_TRIGGER.hour,
      minute: WEEK_REVIEW_TRIGGER.minute,
      channelId: WEEK_REVIEW_CHANNEL_ID,
    },
  });
  await AsyncStorage.setItem(WEEK_REVIEW_STORAGE_KEY, 'on');
  return { ok: true };
}

export async function disableWeekReviewNotif(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEK_REVIEW_NOTIF_ID);
  await AsyncStorage.setItem(WEEK_REVIEW_STORAGE_KEY, 'off');
}

/**
 * Route a tap on the notification to Trends. Handles both the running-app
 * listener and the cold-start case; returns an unsubscribe.
 */
export function wireWeekReviewNotifTap(openTrends: () => void): () => void {
  const last = Notifications.getLastNotificationResponse();
  if (last?.notification.request.identifier === WEEK_REVIEW_NOTIF_ID) openTrends();
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.notification.request.identifier === WEEK_REVIEW_NOTIF_ID) openTrends();
  });
  return () => sub.remove();
}
