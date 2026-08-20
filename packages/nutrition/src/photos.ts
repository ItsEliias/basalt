import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';

// Food-entry photos — private bucket, private by default, RLS-scoped to the
// owner's folder. Nothing is public; display goes through short-lived
// signed URLs.

export const FOOD_PHOTO_BUCKET = 'basalt-food-photos';

/** base64 → bytes without Buffer/atob — RN's runtime has neither. */
export function base64ToU8(b64: string): Uint8Array {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/=+$/, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v === -1) continue; // tolerate whitespace/newlines
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** `${userId}/${stamp}-${rand}.jpg` — folder-first so RLS can scope on it. */
export function foodPhotoPath(userId: string, stampMs: number, rand: string): string {
  return `${userId}/${stampMs}-${rand}.jpg`;
}

export async function uploadFoodPhoto(
  client: SupabaseClient,
  base64Jpeg: string,
  stampMs: number,
  rand: string,
): Promise<Result<string>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;
  const path = foodPhotoPath(u.data, stampMs, rand);
  const { error } = await client.storage
    .from(FOOD_PHOTO_BUCKET)
    .upload(path, base64ToU8(base64Jpeg), { contentType: 'image/jpeg', upsert: false });
  if (error) return err(error.message);
  return ok(path);
}

/** Short-lived signed URL for display — the bucket itself stays private. */
export async function signedPhotoUrl(
  client: SupabaseClient,
  path: string,
  expiresInS = 3600,
): Promise<Result<string>> {
  const { data, error } = await client.storage
    .from(FOOD_PHOTO_BUCKET)
    .createSignedUrl(path, expiresInS);
  if (error || !data) return err(error?.message ?? 'Could not sign the photo URL.');
  return ok(data.signedUrl);
}

/** Batch variant for receipt thumbnails — one round trip per day view. */
export async function signedPhotoUrls(
  client: SupabaseClient,
  paths: string[],
  expiresInS = 3600,
): Promise<Result<Map<string, string>>> {
  if (paths.length === 0) return ok(new Map());
  const { data, error } = await client.storage
    .from(FOOD_PHOTO_BUCKET)
    .createSignedUrls(paths, expiresInS);
  if (error || !data) return err(error?.message ?? 'Could not sign photo URLs.');
  const map = new Map<string, string>();
  data.forEach((d, i) => {
    if (d.signedUrl) map.set(paths[i]!, d.signedUrl);
  });
  return ok(map);
}

export async function removeFoodPhoto(client: SupabaseClient, path: string): Promise<Result<void>> {
  const { error } = await client.storage.from(FOOD_PHOTO_BUCKET).remove([path]);
  if (error) return err(error.message);
  return ok(undefined);
}
