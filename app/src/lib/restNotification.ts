import * as Notifications from 'expo-notifications';

// Rest-done notification (V4 Phase 8d). The ongoing session notification
// counts rest down silently; this one-shot ALERTS when rest ends so a
// backgrounded phone still says "next set". Scheduled when rest starts,
// cancelled when rest ends early — skip, next set, or session end.

const CHANNEL_ID = 'basalt.rest';
const NOTIF_ID = 'basalt.rest.done';

export async function scheduleRestDone(seconds: number): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID).catch(() => {});
    if (seconds < 15) return; // a sub-15s rest doesn't need a push
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
    });
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return; // never prompt mid-set — the session flow asked already
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID,
      content: { title: 'Rest done', body: 'Next set when you are.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + seconds * 1000),
        channelId: CHANNEL_ID,
      },
    });
  } catch { /* a missing nudge is not an error */ }
}

export async function cancelRestDone(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIF_ID).catch(() => {});
}
