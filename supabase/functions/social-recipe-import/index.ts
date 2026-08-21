import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

// social-recipe-import — a TikTok/Instagram/YouTube link → an editable
// recipe draft. The function fetches the page server-side, extracts the
// caption/description + cover image, and asks Claude to structure it.
// Every macro is an estimate the client keeps ~ until confirmed; the
// source link is preserved. When a platform blocks the fetch, the error
// says so plainly instead of inventing a recipe.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function allowedHost(url: string): boolean {
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

// Keep in sync with packages/nutrition/src/social-import.ts (workspace
// packages can't be imported into Deno functions).
function parseOgTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tag of html.match(/<meta\s+[^>]*>/gi) ?? []) {
    const prop = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (prop && content !== undefined && !(prop in out)) out[prop] = content;
  }
  return out;
}

const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title', 'serves', 'total_time_min', 'ingredients', 'steps',
    'calories_per_serve', 'protein_per_serve', 'carbs_per_serve', 'fat_per_serve', 'note',
  ],
  properties: {
    title: { type: 'string' },
    serves: { type: 'number' },
    total_time_min: { type: ['number', 'null'] },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['quantity', 'unit', 'name'],
        properties: {
          quantity: { type: 'string' },
          unit: { type: 'string' },
          name: { type: 'string' },
        },
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    calories_per_serve: { type: 'number' },
    protein_per_serve: { type: 'number' },
    carbs_per_serve: { type: 'number' },
    fat_per_serve: { type: 'number' },
    note: { type: 'string' },
  },
} as const;

const SYSTEM = `You structure a social-media recipe caption into a recipe draft for a health app.
Rules:
- Use ONLY what the caption states. Ingredients without amounts get quantity "" and unit "" — never invent amounts.
- serves: the caption's stated servings, else your best estimate from quantities (say so in note).
- Macros per serve are honest estimates from the ingredient list — realistic, not optimistic.
- steps: from the caption's method if present; otherwise an empty array — do not fabricate a method.
- note: one short sentence naming the biggest uncertainty (missing amounts, no method, estimated serves).
- If the text contains no recipe at all, return title "" and say so in note.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const asCaller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Not signed in.' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'AI import is not configured on the server yet.' }, 503);

  let url = '';
  try {
    const body = await req.json();
    url = String(body?.url ?? '').trim();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!allowedHost(url)) {
    return json({ error: 'Only TikTok, Instagram and YouTube links import here.' }, 400);
  }

  let html = '';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!res.ok) return json({ error: `The platform answered HTTP ${res.status} — it may be blocking readers.` }, 502);
    html = await res.text();
  } catch {
    return json({ error: 'Could not reach that link.' }, 502);
  }

  const og = parseOgTags(html);
  // YouTube watch pages embed the full description; og:description truncates.
  let caption = og['og:description'] ?? '';
  const ytFull = /"shortDescription":"((?:[^"\\]|\\.)*)"/.exec(html)?.[1];
  if (ytFull) {
    try {
      caption = JSON.parse(`"${ytFull}"`);
    } catch { /* keep og description */ }
  }
  const title = og['og:title'] ?? '';
  const cover = og['og:image'] ?? null;
  if (!caption || caption.length < 20) {
    return json({ error: 'The platform did not return a readable caption for that link — it may require signing in.' }, 422);
  }

  const anthropic = new Anthropic({ apiKey });
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
      system: SYSTEM,
      messages: [
        { role: 'user', content: `Post title: ${title}\n\nCaption/description:\n${caption.slice(0, 6000)}` },
      ],
    } as never);
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      return json({ error: 'Could not structure that caption.' }, 422);
    }
    const textBlock = response.content.find((b: { type: string }) => b.type === 'text') as
      | { type: 'text'; text: string }
      | undefined;
    if (!textBlock) return json({ error: 'Empty model response.' }, 502);
    const parsed = JSON.parse(textBlock.text);
    if (!parsed.title) return json({ error: parsed.note || 'No recipe found in that caption.' }, 422);
    return json({ ...parsed, cover_image_url: cover, source_url: url, estimated: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'AI request failed.' }, 502);
  }
});
