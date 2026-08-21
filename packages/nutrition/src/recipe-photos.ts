import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, currentUserId, type Result } from '@basalt/core-data';

// Recipe cover photos — private bucket, same shape as food-entry photos.
// Source thumbnails (JSON-LD, og:image, social covers) are never hotlinked:
// they get downloaded once at save time and stored here, so a recipe's
// cover never rots or disappears when the source page changes.

export const RECIPE_PHOTO_BUCKET = 'basalt-recipe-photos';

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** `${userId}/${stamp}-${rand}.${ext}` — folder-first so RLS can scope on it. */
export function recipePhotoPath(userId: string, stampMs: number, rand: string, ext: string): string {
  return `${userId}/${stampMs}-${rand}.${ext}`;
}

/**
 * Fetch a remote cover image and upload it into the caller's own folder in
 * the private recipe-photos bucket. Best-effort by design: a failed fetch or
 * a non-image response returns an error Result rather than throwing, so a
 * flaky source image never blocks saving the recipe itself.
 */
export async function downloadAndUploadRecipeCover(
  client: SupabaseClient,
  sourceImageUrl: string,
  stampMs: number,
  rand: string,
): Promise<Result<string>> {
  const u = await currentUserId(client);
  if (!u.ok) return u;

  let bytes: Uint8Array;
  let contentType: string;
  try {
    const res = await fetch(sourceImageUrl);
    if (!res.ok) return err(`Could not fetch cover image (HTTP ${res.status}).`);
    contentType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!contentType.startsWith('image/')) return err('Cover URL did not return an image.');
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return err('Network error downloading the cover image.');
  }

  const ext = EXT_BY_CONTENT_TYPE[contentType] ?? 'jpg';
  const path = recipePhotoPath(u.data, stampMs, rand, ext);
  const { error } = await client.storage
    .from(RECIPE_PHOTO_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) return err(error.message);
  return ok(path);
}

/** Short-lived signed URL for display — the bucket itself stays private. */
export async function signedRecipePhotoUrl(
  client: SupabaseClient,
  path: string,
  expiresInS = 3600,
): Promise<Result<string>> {
  const { data, error } = await client.storage
    .from(RECIPE_PHOTO_BUCKET)
    .createSignedUrl(path, expiresInS);
  if (error || !data) return err(error?.message ?? 'Could not sign the cover photo URL.');
  return ok(data.signedUrl);
}

/** Batch variant for the saved-recipes list — one round trip per screen load. */
export async function signedRecipePhotoUrls(
  client: SupabaseClient,
  paths: string[],
  expiresInS = 3600,
): Promise<Result<Map<string, string>>> {
  if (paths.length === 0) return ok(new Map());
  const { data, error } = await client.storage
    .from(RECIPE_PHOTO_BUCKET)
    .createSignedUrls(paths, expiresInS);
  if (error || !data) return err(error?.message ?? 'Could not sign cover photo URLs.');
  const map = new Map<string, string>();
  data.forEach((d, i) => {
    if (d.signedUrl) map.set(paths[i]!, d.signedUrl);
  });
  return ok(map);
}

export async function removeRecipePhoto(client: SupabaseClient, path: string): Promise<Result<void>> {
  const { error } = await client.storage.from(RECIPE_PHOTO_BUCKET).remove([path]);
  if (error) return err(error.message);
  return ok(undefined);
}
