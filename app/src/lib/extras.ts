import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EXTRAS_STORAGE_KEY, EXTRAS_INTRO_SEEN_KEY, PEBBLE_LEGACY_MIGRATED_KEY,
  parseExtras, setExtra, type ExtraId, type ExtrasState,
} from '@basalt/core-data';
import { PEBBLE_STORAGE_KEY } from './pebbleModel';

// Extras flags live on the device like every voice/notification preference.
// One storage key, defaults from the registry, a change feed so Settings,
// onboarding and every ExtraSlot stay in sync without prop-drilling.

type Listener = (state: ExtrasState) => void;
const listeners = new Set<Listener>();
let cached: ExtrasState | null = null;

export function onExtrasChange(fn: Listener): () => void {
  listeners.add(fn);
  if (cached) fn(cached);
  return () => listeners.delete(fn);
}

function emit(state: ExtrasState) {
  cached = state;
  for (const fn of listeners) fn(state);
}

export async function getExtras(): Promise<ExtrasState> {
  if (cached) return cached;
  const state = parseExtras(await AsyncStorage.getItem(EXTRAS_STORAGE_KEY));
  // One-time migration: a pre-V4 device with Pebble on keeps Pebble on.
  if (await AsyncStorage.getItem(PEBBLE_LEGACY_MIGRATED_KEY) === null) {
    try {
      const legacy = JSON.parse((await AsyncStorage.getItem(PEBBLE_STORAGE_KEY)) ?? '{}') as { showInApp?: boolean };
      if (legacy.showInApp === true) state.pebble = true;
    } catch { /* defaults stand */ }
    await AsyncStorage.setItem(PEBBLE_LEGACY_MIGRATED_KEY, 'done');
    await AsyncStorage.setItem(EXTRAS_STORAGE_KEY, JSON.stringify(state));
  }
  cached = state;
  return state;
}

/** Flip a flag; enforces the registry's requires rules; persists; emits. */
export async function setExtraFlag(
  id: ExtraId,
  on: boolean,
): Promise<{ state: ExtrasState; turnedOffDependents: ExtraId[]; refused: boolean }> {
  const r = setExtra(await getExtras(), id, on);
  if (!r.refused) {
    await AsyncStorage.setItem(EXTRAS_STORAGE_KEY, JSON.stringify(r.state));
    emit(r.state);
  }
  return r;
}

// ── "New in Basalt" — existing users see the onboarding sequence once ──

export async function extrasIntroSeen(): Promise<boolean> {
  return (await AsyncStorage.getItem(EXTRAS_INTRO_SEEN_KEY)) === 'seen';
}

export async function markExtrasIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(EXTRAS_INTRO_SEEN_KEY, 'seen');
}
