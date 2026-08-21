// Social recipe import — the pure client half. Host detection decides when
// a pasted link routes to the social Edge Function instead of the JSON-LD
// importer; the og-tag parser here is the same logic the function runs
// (duplicated there — Deno can't import from this workspace; keep in sync).

export function isSocialRecipeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return (
      host === 'tiktok.com' || host.endsWith('.tiktok.com') ||
      host === 'instagram.com' || host.endsWith('.instagram.com') ||
      host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be'
    );
  } catch {
    return false;
  }
}

/** Minimal og/meta extraction — content attr before or after property. */
export function parseOgTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const metaRe = /<meta\s+[^>]*>/gi;
  for (const tag of html.match(metaRe) ?? []) {
    const prop = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (prop && content !== undefined && !(prop in out)) {
      out[prop] = decodeEntities(content);
    }
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

/** The Edge Function's response shape → an editable SaveRecipeInput-like draft. */
export type SocialRecipeResponse = {
  title: string;
  serves: number;
  total_time_min: number | null;
  ingredients: { quantity: string; unit: string; name: string }[];
  steps: string[];
  calories_per_serve: number;
  protein_per_serve: number;
  carbs_per_serve: number;
  fat_per_serve: number;
  cover_image_url: string | null;
  note: string;
};
