import * as Notifications from 'expo-notifications';
import {
  WEEK_REVIEW_CHANNEL_ID, WEEK_REVIEW_CONTENT, WEEK_REVIEW_NOTIF_ID, WEEK_REVIEW_TRIGGER,
} from './weekReviewNotifModel';
import { MONTHLY_REPORT_CONTENT, voicedContent } from './pebbleModel';
import { MONTHLY_REPORT_CHANNEL_ID, MONTHLY_REPORT_NOTIF_ID, nextFirstOfMonth } from './monthlyReportNotifModel';

// When the Pebble-voice toggle flips, notifications already scheduled for
// the future keep whatever title they were scheduled with — so re-issue
// them under the new voice. Bodies and triggers come from the same models
// the schedulers use: the voice can never change what is said or when.

export async function revoiceScheduledNotifs(pebbleVoice: boolean): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ids = new Set(scheduled.map((r) => r.identifier));

    if (ids.has(WEEK_REVIEW_NOTIF_ID)) {
      const v = voicedContent({ id: WEEK_REVIEW_NOTIF_ID, ...WEEK_REVIEW_CONTENT }, pebbleVoice);
      await Notifications.scheduleNotificationAsync({
        identifier: WEEK_REVIEW_NOTIF_ID,
        content: { title: v.title, body: v.body, data: { icon: v.icon } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: WEEK_REVIEW_TRIGGER.weekday,
          hour: WEEK_REVIEW_TRIGGER.hour,
          minute: WEEK_REVIEW_TRIGGER.minute,
          channelId: WEEK_REVIEW_CHANNEL_ID,
        },
      });
    }

    if (ids.has(MONTHLY_REPORT_NOTIF_ID)) {
      const v = voicedContent({ id: MONTHLY_REPORT_NOTIF_ID, ...MONTHLY_REPORT_CONTENT }, pebbleVoice);
      await Notifications.scheduleNotificationAsync({
        identifier: MONTHLY_REPORT_NOTIF_ID,
        content: { title: v.title, body: v.body, data: { icon: v.icon } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextFirstOfMonth(new Date()),
          channelId: MONTHLY_REPORT_CHANNEL_ID,
        },
      });
    }
  } catch { /* the next enable/reschedule applies the voice anyway */ }
}
