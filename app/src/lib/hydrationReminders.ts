import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  HYDRATION_CHANNEL_ID, HYDRATION_HOUR_CHOICES, HYDRATION_STORAGE_KEY,
  hydrationContent, hydrationNotifId, parseHydrationHours,
} from './hydrationRemindersModel';

// Native wiring for hydration reminders — same discipline as the week
// review: permission asked when the first hour is picked, honest failure,
// and turning the Extra off cancels everything.

export async function getHydrationHours(): Promise<number[]> {
  return parseHydrationHours(await AsyncStorage.getItem(HYDRATION_STORAGE_KEY));
}

/** Replace the schedule with exactly `hours`. Empty array cancels all. */
export async function setHydrationHours(hours: number[]): Promise<{ ok: boolean; reason?: string }> {
  for (const h of HYDRATION_HOUR_CHOICES) {
    await Notifications.cancelScheduledNotificationAsync(hydrationNotifId(h)).catch(() => {});
  }
  if (hours.length > 0) {
    await Notifications.setNotificationChannelAsync(HYDRATION_CHANNEL_ID, {
      name: 'Hydration reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, reason: 'Notifications are off for Basalt in system settings.' };
    }
    for (const hour of hours) {
      await Notifications.scheduleNotificationAsync({
        identifier: hydrationNotifId(hour),
        content: hydrationContent(hour),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
          channelId: HYDRATION_CHANNEL_ID,
        },
      });
    }
  }
  await AsyncStorage.setItem(HYDRATION_STORAGE_KEY, JSON.stringify(hours));
  return { ok: true };
}

export async function cancelAllHydrationReminders(): Promise<void> {
  await setHydrationHours([]);
}
