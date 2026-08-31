import { PermissionsAndroid, Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { setTimerServiceHooks } from '../state/sessionStore';
import { acquireForegroundService, releaseForegroundService } from './foregroundServiceCoordinator';

// Android foreground service for the session timers. Its ONE job is process
// priority: while it runs, the OS keeps the app's JS alive with the screen
// off, so the store's 1 Hz interval keeps ticking (and the wall-clock
// catch-up in the store covers anything the OS still throttles). The
// ongoing notification shows the current phase and is updated only on
// phase changes — never a per-second spam.
//
// Failure is honest: if the service can't start (permission, OEM policy),
// we record it and the Train screen says the timer only runs with the app
// open — the pre-service behavior, not a silent lie.

const CHANNEL_ID = 'session-timer';
const NOTIF_ID = 'session-timer';

let hooked = false;
let running = false;
let failed = false;

/** True if a foreground-service start failed since app launch. */
export function timerServiceFailed(): boolean {
  return failed;
}

/** Call once at app start, before any notification is displayed. */
export function registerTimerService(): void {
  if (hooked || Platform.OS !== 'android') return;
  hooked = true;
  setTimerServiceHooks({
    onActive: (label) => void showOrUpdate(label),
    onInactive: () => void stop(),
  });
}

async function showOrUpdate(label: string): Promise<void> {
  try {
    if (!running) {
      // The service is declared with the Android 14 `health` FGS type,
      // which requires ACTIVITY_RECOGNITION to be granted at start time.
      // A decline is a decline: no service, honest srcnote fallback.
      if (Number(Platform.Version) >= 29) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          failed = true;
          return;
        }
      }
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Session timer',
        importance: AndroidImportance.LOW, // silent — haptics are the signal
      });
      await notifee.requestPermission();
      acquireForegroundService();
    }
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: 'Basalt — session timer',
      body: label,
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        onlyAlertOnce: true,
        pressAction: { id: 'default' },
        smallIcon: 'ic_launcher',
      },
    });
    running = true;
    failed = false;
  } catch {
    failed = true;
  }
}

async function stop(): Promise<void> {
  if (!running) return;
  running = false;
  try {
    await notifee.cancelNotification(NOTIF_ID);
  } catch {
    // Nothing to do — the OS already tore the notification down.
  }
  await releaseForegroundService();
}
