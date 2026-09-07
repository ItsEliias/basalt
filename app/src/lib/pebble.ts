import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PEBBLE_STORAGE_KEY, PEBBLE_DISMISSED_KEY_PREFIX,
  normalizePebbleSettings, parsePebbleSettings, type PebbleSettings,
} from './pebbleModel';
import { revoiceScheduledNotifs } from './pebbleRevoice';
import { getExtras, setExtraFlag } from './extras';

// Pebble settings live on the device, like every notification toggle.
// V4: the master switch IS the Pebble Extra — `showInApp` reads from the
// Extras framework so Settings › Extras and the Pebble card stay one
// source of truth; voice + data-screen prefs keep their own storage.

export async function getPebbleSettings(): Promise<PebbleSettings> {
  const stored = parsePebbleSettings(await AsyncStorage.getItem(PEBBLE_STORAGE_KEY));
  const extras = await getExtras();
  return normalizePebbleSettings({ ...stored, showInApp: extras.pebble });
}

export async function setPebbleSettings(patch: Partial<PebbleSettings>): Promise<PebbleSettings> {
  if (patch.showInApp !== undefined) {
    await setExtraFlag('pebble', patch.showInApp);
  }
  const next = normalizePebbleSettings({ ...(await getPebbleSettings()), ...patch });
  const { showInApp: _extra, ...rest } = next;
  await AsyncStorage.setItem(PEBBLE_STORAGE_KEY, JSON.stringify({ ...rest, showInApp: next.showInApp }));
  // The voice change applies to anything already sitting in the tray's
  // future: re-schedule the fixed prompts under the new voice.
  await revoiceScheduledNotifs(next.notifVoice);
  return next;
}

export async function isPebbleVoiceOn(): Promise<boolean> {
  return (await getPebbleSettings()).notifVoice;
}

/** Dismissals are per-day, per-proposal. */
export async function dismissedToday(iso: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(PEBBLE_DISMISSED_KEY_PREFIX + iso);
  try { return raw ? (JSON.parse(raw) as string[]) : []; } catch { return []; }
}

export async function dismissForToday(iso: string, proposalId: string): Promise<string[]> {
  const list = await dismissedToday(iso);
  if (!list.includes(proposalId)) list.push(proposalId);
  await AsyncStorage.setItem(PEBBLE_DISMISSED_KEY_PREFIX + iso, JSON.stringify(list));
  return list;
}
