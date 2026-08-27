import notifee from '@notifee/react-native';

// notifee registers exactly ONE Android foreground-service class
// (app.notifee.core.ForegroundService, see plugins/withForegroundServiceTypes.js)
// shared by every notifee foreground notification an app shows — the
// session timer and outdoor-walk tracking both use it, for different
// reasons, and can genuinely overlap (nothing stops a user opening Train
// mid-walk). notifee.stopForegroundService() tears the ONE Android service
// down entirely; calling it from whichever feature happens to finish first
// would silently kill the other's notification too. This is a tiny
// reference count so "stop" only really stops it once nothing needs it.

let registered = false;
let refCount = 0;

/** Call before displaying a foreground-flagged notification. Idempotent —
 *  registers the underlying service on first use across the whole app. */
export function acquireForegroundService(): void {
  if (!registered) {
    registered = true;
    // The runner promise never resolves; the service lives until the last
    // acquirer releases it.
    notifee.registerForegroundService(() => new Promise(() => {}));
  }
  refCount += 1;
}

/** Call after cancelling a foreground-flagged notification. Only actually
 *  stops the Android service once every acquirer has released. */
export async function releaseForegroundService(): Promise<void> {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;
  try {
    await notifee.stopForegroundService();
  } catch {
    // Nothing to do — the service either wasn't running or the OS already
    // tore it down.
  }
}
