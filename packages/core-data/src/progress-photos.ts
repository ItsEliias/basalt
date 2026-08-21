import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, type Result } from './result';
import { currentUserId } from './user';

// Progress photo vault — private bucket, private by default, excluded from
// exports unless explicitly included. Paths are folder-first so storage RLS
// scopes on the owner's folder.

export const PROGRESS_PHOTO_BUCKET = 'basalt-progress-photos';

export type ProgressPose = 'front' | 'side' | 'back';

export type ProgressPhoto = {
  id: string;
  pose: ProgressPose;
  takenAt: string;
  storagePath: string;
};

const mapRow = (r: any): ProgressPhoto => ({
  id: r.id,
  pose: r.pose,
  takenAt: r.taken_at,
  storagePath: r.storage_path,
});

/** base64 → bytes; duplicated from nutrition's photos.ts (no cross-dep). */
function base64ToU8(b64: string): Uint8Array {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/=+$/, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v === -1) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export async function addProgressPhoto(
  client: SupabaseClient,
  pose: ProgressPose,
  base64Jpeg: string,
): Promise<Result<ProgressPhoto>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const path = `${u.data}/${pose}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const up = await client.storage
    .from(PROGRESS_PHOTO_BUCKET)
    .upload(path, base64ToU8(base64Jpeg), { contentType: 'image/jpeg', upsert: false });
  if (up.error) return err(up.error.message);
  const { data, error } = await client
    .from('basalt_progress_photos')
    .insert({ user_id: u.data, pose, storage_path: path })
    .select('*')
    .single();
  if (error || !data) return err(error?.message ?? 'Could not save the photo record.');
  return ok(mapRow(data));
}

export async function listProgressPhotos(
  client: SupabaseClient,
  pose?: ProgressPose,
): Promise<Result<ProgressPhoto[]>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  let q = client
    .from('basalt_progress_photos')
    .select('*')
    .eq('user_id', u.data)
    .order('taken_at', { ascending: true });
  if (pose) q = q.eq('pose', pose);
  const { data, error } = await q;
  if (error) return err(error.message);
  return ok((data ?? []).map(mapRow));
}

export async function signedProgressUrls(
  client: SupabaseClient,
  paths: string[],
  expiresInS = 3600,
): Promise<Result<Map<string, string>>> {
  if (paths.length === 0) return ok(new Map());
  const { data, error } = await client.storage
    .from(PROGRESS_PHOTO_BUCKET)
    .createSignedUrls(paths, expiresInS);
  if (error || !data) return err(error?.message ?? 'Could not sign URLs.');
  const map = new Map<string, string>();
  data.forEach((d, i) => {
    if (d.signedUrl) map.set(paths[i]!, d.signedUrl);
  });
  return ok(map);
}

export async function deleteProgressPhoto(client: SupabaseClient, photo: ProgressPhoto): Promise<Result<void>> {
  const rm = await client.storage.from(PROGRESS_PHOTO_BUCKET).remove([photo.storagePath]);
  if (rm.error) return err(rm.error.message);
  const { error } = await client.from('basalt_progress_photos').delete().eq('id', photo.id);
  if (error) return err(error.message);
  return ok(undefined);
}
