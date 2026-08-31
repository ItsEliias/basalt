import { Platform, PermissionsAndroid } from 'react-native';
import { parseWeightMeasurement, b64ToBytes, WEIGHT_SCALE_SERVICE, WEIGHT_MEASUREMENT_CHAR } from '@basalt/core-data';

// BLE scale lane — standard Weight Scale profile only, optional forever.
// Lazy-required like the voice module: builds without react-native-ble-plx
// (Expo Go, pre-rebuild dev clients) never show the control. Scanning only
// runs while the weight sheet asks for it; nothing pairs, nothing runs in
// the background.

let manager: any | null | undefined;

function getManager(): any | null {
  if (manager !== undefined) return manager;
  try {
    const { BleManager } = require('react-native-ble-plx');
    manager = new BleManager();
  } catch {
    manager = null;
  }
  return manager;
}

export function bleAvailable(): boolean {
  return getManager() !== null;
}

async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Number(Platform.Version) < 31) return true;
  const res = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  return Object.values(res).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

export type ScaleSession = { stop: () => void };

/**
 * Scan for a standard weight scale, subscribe to its measurements, and
 * stream readings until stopped. Errors surface as messages, never as
 * invented values.
 */
export async function startScaleRead(handlers: {
  onReading: (kg: number) => void;
  onError: (message: string) => void;
}): Promise<ScaleSession> {
  const dead: ScaleSession = { stop: () => {} };
  const m = getManager();
  if (!m) return dead;
  if (!(await ensurePermissions())) {
    handlers.onError('Bluetooth permission is off for Basalt in system settings.');
    return dead;
  }

  let device: any = null;
  let sub: any = null;
  let stopped = false;
  const stop = () => {
    stopped = true;
    try { m.stopDeviceScan(); } catch { /* already stopped */ }
    try { sub?.remove(); } catch { /* gone */ }
    try { device?.cancelConnection(); } catch { /* gone */ }
  };

  m.startDeviceScan([WEIGHT_SCALE_SERVICE], null, (error: any, found: any) => {
    if (stopped) return;
    if (error) {
      handlers.onError(error.message ?? 'Bluetooth scan failed.');
      stop();
      return;
    }
    if (!found) return;
    m.stopDeviceScan();
    void found
      .connect()
      .then((d: any) => d.discoverAllServicesAndCharacteristics())
      .then((d: any) => {
        device = d;
        sub = d.monitorCharacteristicForService(
          WEIGHT_SCALE_SERVICE,
          WEIGHT_MEASUREMENT_CHAR,
          (err: any, char: any) => {
            if (stopped) return;
            if (err) {
              handlers.onError(err.message ?? 'Lost the scale connection.');
              return;
            }
            if (!char?.value) return;
            const reading = parseWeightMeasurement(b64ToBytes(char.value, globalThis.atob));
            if (reading) handlers.onReading(reading.weightKg);
          },
        );
      })
      .catch((e: any) => {
        if (!stopped) handlers.onError(e?.message ?? 'Could not connect to the scale.');
      });
  });

  return { stop };
}
