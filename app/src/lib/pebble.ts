import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PEBBLE_STORAGE_KEY, PEBBLE_DISMISSED_KEY_PREFIX,
  normalizePebbleSettings, parsePebbleSettings, type PebbleSettings,
} from './pebbleModel';
import { revoiceScheduledNotifs } from './pebbleRevoice';

// Pebble settings live on the device, like every notification toggle —
// they are a voice preference, not ledger data.

export async function getPebbleSettings(): Promise<PebbleSettings> {
  return parsePebbleSettings(await AsyncStorage.getItem(PEBBLE_STORAGE_KEY));
}

export async function setPebbleSettings(patch: Partial<PebbleSettings>): Promise<PebbleSettings> {
  const next = normalizePebbleSettings({ ...(await getPebbleSettings()), ...patch });
  await AsyncStorage.setItem(PEBBLE_STORAGE_KEY, JSON.stringify(next));
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
