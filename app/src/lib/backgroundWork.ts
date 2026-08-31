import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { isoDay } from '@basalt/core-data';
import { loadDeviation, getMyPair, loadCoop } from '@basalt/analytics';
import { supabase } from './supabase';
import { drainOutbox } from './outbox';

// Periodic background work (V3 needs-you item 6, resolved). One OS-
// scheduled task (WorkManager under the hood) doing three quiet jobs:
//   1. drain the offline outbox — a dead-spot write no longer waits for
//      the next app open
//   2. publish co-op dots — a partner's view no longer lags until this
//      phone next opens Trends
//   3. the vitals-deviation notification — OPT-IN, OFF BY DEFAULT, at
//      most one per day, and only when the live composed report crosses
//      its own published card threshold. The body is the same composed
//      headline the Recover card shows — never new language, never
//      diagnosis words (those are pinned by the engine's tests).
//
// Lazy-required like voice/BLE: a dev client without the new native
// modules simply never registers the task — no crash, honest absence.

const TASK_NAME = 'basalt-background-work';
const ILLNESS_TOGGLE_KEY = 'basalt.illnessNotif';
const ILLNESS_LAST_KEY = 'basalt.illnessNotifLast';
const ILLNESS_CHANNEL = 'vitals-deviation';

export async function isIllnessNotifEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ILLNESS_TOGGLE_KEY)) === 'on';
}

export async function setIllnessNotifEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(ILLNESS_TOGGLE_KEY, on ? 'on' : 'off');
  if (on) {
    await Notifications.setNotificationChannelAsync(ILLNESS_CHANNEL, {
      name: 'Vitals deviation',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.requestPermissionsAsync();
  }
}

async function runBackgroundWork(): Promise<void> {
  // 1 · outbox — same drain the app runs on foreground.
  try { await drainOutbox(); } catch { /* next run retries */ }

  // 2 · co-op dots — loadCoop publishes this device's booleans as a side
  // effect; skip quietly when there is no live pair.
  try {
    const pair = await getMyPair(supabase);
    if (pair.ok && pair.data && pair.data.bId) {
      await loadCoop(supabase, pair.data);
    }
  } catch { /* next run retries */ }

  // 3 · vitals deviation — opt-in, once a day, live-composed.
  try {
    if (!(await isIllnessNotifEnabled())) return;
    const today = isoDay(new Date());
    if ((await AsyncStorage.getItem(ILLNESS_LAST_KEY)) === today) return;
    const r = await loadDeviation(supabase);
    if (!r.ok || r.data.headline === null) return;
    await AsyncStorage.setItem(ILLNESS_LAST_KEY, today);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Out of your range',
        body: `${r.data.headline} — open Recover for the numbers.`,
      },
      trigger: null,
    });
  } catch { /* absence of a notification is the honest failure mode */ }
}

/** Define + register the periodic task; call once at app start. */
export async function registerBackgroundWork(): Promise<boolean> {
  let TaskManager: any;
  let BackgroundTask: any;
  try {
    TaskManager = require('expo-task-manager');
    BackgroundTask = require('expo-background-task');
  } catch {
    return false; // pre-rebuild client — the app paths still cover everything
  }
  try {
    if (!TaskManager.isTaskDefined(TASK_NAME)) {
      TaskManager.defineTask(TASK_NAME, async () => {
        await runBackgroundWork();
        return BackgroundTask.BackgroundTaskResult.Success;
      });
    }
    await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: 240 }); // minutes; OS decides the real cadence
    return true;
  } catch {
    return false;
  }
}
