import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { queueAdd, queueList, queueRemove, type QueuedPhoto } from './photoQueueModel';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Photo capture for AI estimation — downscaled on-device to ~1024 px before
// anything leaves the phone, both for payload size and because the estimate
// doesn't need more. The photo itself is only sent when the user asks for an
// estimate; "photo now, log later" keeps it local until then.

const QUEUE_KEY = 'basalt.photoQueue';
const QUEUE_DIR = `${FileSystem.documentDirectory}food-queue/`;

export async function capturePhoto(from: 'camera' | 'gallery'): Promise<{ b64: string; uri: string } | null> {
  const opts = { quality: 0.9, base64: false, allowsEditing: false } as const;
  const result =
    from === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  const small = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return small.base64 ? { b64: small.base64, uri: small.uri } : null;
}

export async function loadPhotoQueue(): Promise<QueuedPhoto[]> {
  return queueList((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]');
}

/** Copy the downscaled file into app storage and queue it for later. */
export async function enqueuePhoto(uri: string): Promise<QueuedPhoto[]> {
  await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true }).catch(() => {});
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dest = `${QUEUE_DIR}${id}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  const next = queueAdd(await loadPhotoQueue(), { id, uri: dest, takenAt: new Date().toISOString() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  return next;
}

export async function dequeuePhoto(id: string): Promise<QueuedPhoto[]> {
  const queue = await loadPhotoQueue();
  const entry = queue.find((q) => q.id === id);
  if (entry) await FileSystem.deleteAsync(entry.uri, { idempotent: true }).catch(() => {});
  const next = queueRemove(queue, id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  return next;
}

export async function readQueuedPhotoB64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}
