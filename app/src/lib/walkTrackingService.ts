import { Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidForegroundServiceType } from '@notifee/react-native';
import { acquireForegroundService, releaseForegroundService } from './foregroundServiceCoordinator';

// Android foreground service for outdoor walk tracking. Same job as
// timerService.ts (keep the JS process alive and un-throttled with the
// screen off, so Location.watchPositionAsync's callback keeps firing when
// the phone locks) but for a different reason and a different Android
// foreground-service type: `location`, not `health`. This is also why it
// doesn't need the separate "Allow all the time" background-location
// permission most tracking apps are known for — a foreground service with
// a visible, ongoing notification is not "background" as Android defines
// it for that permission, only ACCESS_FINE_LOCATION/COARSE_LOCATION are
// required, and OutdoorTab already requests those before a walk can start.
//
// Failure is honest: if the service can't start (permission, OEM policy),
// startWalkTracking() returns false and OutdoorTab says plainly that
// recording will stop if the screen locks — not a silent lie.

const CHANNEL_ID = 'walk-tracking';
const NOTIF_ID = 'walk-tracking';

/** Notification action id — OutdoorTab listens and runs its normal stop
 *  path. On a paired watch the mirrored notification carries the same
 *  button, which is the whole of "Wear step 0": action-complete
 *  notifications, no watch app. */
export const WALK_STOP_ACTION_ID = 'walk-stop';

// notifee requires a background handler to exist; the stop action uses
// launchActivity so the app foregrounds and OutdoorTab's own listener
// does the actual stop — nothing is saved from a headless context.
notifee.onBackgroundEvent(async () => { /* handled in foreground */ });

const WALK_ACTIONS = [
  { title: 'Stop & save', pressAction: { id: WALK_STOP_ACTION_ID, launchActivity: 'default' } },
];

let running = false;
let failed = false;

/** True if a foreground-service start failed since app launch. */
export function walkTrackingServiceFailed(): boolean {
  return failed;
}

/** Start (or restart) the walk-tracking notification. Resolves true iff the
 *  service actually came up — callers should degrade honestly on false. */
export async function startWalkTracking(label: string): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // no foreground-service concept to fail here
  try {
    if (!running) {
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Walk tracking',
        importance: AndroidImportance.LOW, // silent — this is a status notification, not an alert
      });
      await notifee.requestPermission();
      acquireForegroundService();
    }
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: 'Basalt — recording your walk',
      body: label,
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_LOCATION],
        ongoing: true,
        onlyAlertOnce: true,
        pressAction: { id: 'default' },
        actions: WALK_ACTIONS,
        smallIcon: 'ic_launcher',
      },
    });
    running = true;
    failed = false;
    return true;
  } catch {
    failed = true;
    return false;
  }
}

/** Update the notification body — call sparingly (e.g. every km or every
 *  minute), never per GPS fix; matches timerService's own "no spam" rule. */
export async function updateWalkTracking(label: string): Promise<void> {
  if (!running) return;
  try {
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: 'Basalt — recording your walk',
      body: label,
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_LOCATION],
        ongoing: true,
        onlyAlertOnce: true,
        pressAction: { id: 'default' },
        actions: WALK_ACTIONS,
        smallIcon: 'ic_launcher',
      },
    });
  } catch {
    // A missed update just means a stale notification body — tracking
    // itself (the actual GPS subscription) is unaffected.
  }
}

export async function stopWalkTracking(): Promise<void> {
  if (!running) return;
  running = false;
  try {
    await notifee.cancelNotification(NOTIF_ID);
  } catch {
    // Nothing to do — the OS already tore the notification down.
  }
  await releaseForegroundService();
}
