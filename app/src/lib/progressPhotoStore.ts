import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { ProgressPose } from '@basalt/core-data';
import { addProgressPhoto, listProgressPhotos, signedProgressUrls } from '@basalt/core-data';
import { supabase } from './supabase';

// Progress photos, local-first (photos Extra). The default is this phone
// only: files under the app's private documents directory, indexed in
// AsyncStorage. Cloud sync is a SEPARATE switch — flipping it on uploads
// new captures to the private bucket as well; existing local photos stay
// local and the switch says so in plain words.

export const PHOTOS_CLOUD_KEY = 'basalt.progressPhotos.cloud';
export const PHOTOS_LOCAL_INDEX_KEY = 'basalt.progressPhotos.local';
const LOCAL_DIR = `${FileSystem.documentDirectory}progress-photos/`;

export const PHOTOS_CLOUD_WARNING =
  'On: new photos also upload to Basalt’s private storage, tied to your account and wiped with it. '
  + 'Off: every photo stays on this phone only — deleted with the app, in no backup Basalt controls. '
  + 'Photos taken before you flip this stay where they were taken.';

export type PhotoRecord = {
  id: string;
  pose: ProgressPose;
  takenAt: string;
  /** Renderable now: a file:// URI or a short-lived signed URL. */
  uri: string;
  where: 'device' | 'cloud';
};

type LocalIndexRow = { id: string; pose: ProgressPose; takenAt: string; fileName: string };

function parseIndex(raw: string | null): LocalIndexRow[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((r) => r && r.id && r.fileName) : [];
  } catch {
    return [];
  }
}

export async function isCloudSyncOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(PHOTOS_CLOUD_KEY)) === 'on';
}

export async function setCloudSync(on: boolean): Promise<void> {
  await AsyncStorage.setItem(PHOTOS_CLOUD_KEY, on ? 'on' : 'off');
}

/** Save a capture. Local always; cloud too when the separate switch is on. */
export async function savePhoto(pose: ProgressPose, base64Jpeg: string): Promise<{ ok: boolean }> {
  const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const fileName = `${id}.jpg`;
  await FileSystem.makeDirectoryAsync(LOCAL_DIR, { intermediates: true }).catch(() => {});
  await FileSystem.writeAsStringAsync(LOCAL_DIR + fileName, base64Jpeg, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const index = parseIndex(await AsyncStorage.getItem(PHOTOS_LOCAL_INDEX_KEY));
  index.push({ id, pose, takenAt: new Date().toISOString(), fileName });
  await AsyncStorage.setItem(PHOTOS_LOCAL_INDEX_KEY, JSON.stringify(index));
  if (await isCloudSyncOn()) {
    // Best-effort: a failed upload never loses the local copy.
    await addProgressPhoto(supabase, pose, base64Jpeg).catch(() => {});
  }
  return { ok: true };
}

/**
 * Everything renderable, oldest first: device photos always; cloud rows
 * (from before local-first, or other devices) only when the switch is on.
 */
export async function listPhotoRecords(): Promise<PhotoRecord[]> {
  const index = parseIndex(await AsyncStorage.getItem(PHOTOS_LOCAL_INDEX_KEY));
  const local: PhotoRecord[] = index.map((r) => ({
    id: r.id,
    pose: r.pose,
    takenAt: r.takenAt,
    uri: LOCAL_DIR + r.fileName,
    where: 'device',
  }));
  let cloud: PhotoRecord[] = [];
  if (await isCloudSyncOn()) {
    const rows = await listProgressPhotos(supabase);
    if (rows.ok && rows.data.length > 0) {
      const signed = await signedProgressUrls(supabase, rows.data.map((p) => p.storagePath));
      if (signed.ok) {
        cloud = rows.data
          .filter((p) => signed.data.get(p.storagePath))
          .map((p) => ({
            id: p.id,
            pose: p.pose,
            takenAt: p.takenAt,
            uri: signed.data.get(p.storagePath)!,
            where: 'cloud' as const,
          }));
      }
    }
  }
  // A capture with cloud on exists both sides; keep the device copy.
  const seenMinute = new Set(local.map((p) => `${p.pose}:${p.takenAt.slice(0, 16)}`));
  const merged = [...local, ...cloud.filter((p) => !seenMinute.has(`${p.pose}:${p.takenAt.slice(0, 16)}`))];
  return merged.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}
