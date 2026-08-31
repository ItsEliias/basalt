import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

// ai-recipe-ideas — "what can I cook with what's here" → recipe proposals.
// Same laws as every AI surface: the key lives only here; everything the
// model returns is a proposal wearing ~ until the user confirms; the model
// may only cook with what the user LISTED plus a short published staples
// set — inventing pantry contents is lying about the user's kitchen.

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

// Published staples the model may assume without them being listed — and
// nothing else. Returned to the client verbatim so the UI can state them.
const ASSUMED_STAPLES = ['salt', 'pepper', 'water', 'cooking oil'];

const IDEA_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas', 'note'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name', 'uses', 'missing', 'steps', 'serves', 'time_min',
          'calories', 'calories_low', 'calories_high',
          'protein_g', 'carbs_g', 'fat_g',
        ],
        properties: {
          name: { type: 'string' },
          // Only ingredients the user listed (verbatim from their list) +
          // assumed staples. The eval pins this mechanically.
          uses: { type: 'array', items: { type: 'string' } },
          // What the dish would ALSO need that the user did not list —
          // stated plainly, never silently assumed.
          missing: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
          serves: { type: 'number' },
          time_min: { type: 'number' },
          // Per-serve estimates with the same graded-uncertainty law as
          // quick-add: point inside a calibrated range.
          calories: { type: 'number' },
          calories_low: { type: 'number' },
          calories_high: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
        },
      },
    },
    note: { type: 'string' },
  },
} as const;

const DEFAULT_MODEL = 'claude-sonnet-5';
const ALLOWED_MODELS = new Set(['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5']);

const SYSTEM = `You propose simple recipes from ingredients a user says they have on hand, for a health-tracking app.
Rules:
- 2 or 3 ideas, each genuinely cookable from the listed ingredients plus ONLY these assumed staples: ${ASSUMED_STAPLES.join(', ')}. Never assume anything else is in the kitchen.
- "uses": the subset of the USER'S LISTED ingredients the idea uses — copy their wording. Do not list staples here.
- "missing": anything else the dish needs that they did not list. Concrete items only — never conditionals, alternatives, or anything that mentions a listed ingredient ("X if not using Y" is banned; pick one dish and state its real gap). An honest empty kitchen gap beats a pretend-complete recipe. If an idea needs nothing extra, use an empty array — prefer ideas with empty or short missing lists.
- "steps": 3–6 short imperative steps a tired person can follow.
- Nutrition is per serve, honest estimates. calories_low/calories_high: a calibrated range the true per-serve energy plausibly falls in — home-cooked portions vary, so widen accordingly; calories must lie within the range.
- Every idea must be COMPLETE — real steps, real serves, real numbers. Never emit placeholder zeros or filler text; fewer complete ideas beat more broken ones.
- note: one short sentence naming the biggest uncertainty (e.g. "Macros assume ~150 g chicken per serve"). Never marketing language, never advice, never cheerleading.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const asCaller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Not signed in.' }, 401);
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return json(
      { error: 'AI recipes are not configured on the server yet (ANTHROPIC_API_KEY secret missing).' },
      503,
    );
  }

  let ingredients: string[] = [];
  let model = DEFAULT_MODEL;
  try {
    const body = await req.json();
    ingredients = Array.isArray(body?.ingredients)
      ? body.ingredients.map((i: unknown) => String(i).trim()).filter(Boolean)
      : [];
    if (body?.model !== undefined) model = String(body.model);
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (ingredients.length < 2 || ingredients.length > 40) {
    return json({ error: 'List 2–40 ingredients you have on hand.' }, 400);
  }
  if (ingredients.some((i) => i.length > 80)) {
    return json({ error: 'Each ingredient must be under 80 characters.' }, 400);
  }
  if (!ALLOWED_MODELS.has(model)) {
    return json({ error: 'Unsupported model.' }, 400);
  }

  const anthropic = new Anthropic({ apiKey });
  try {
    const format = { type: 'json_schema', schema: IDEA_SCHEMA } as const;
    const tuning =
      model === 'claude-haiku-4-5'
        ? { output_config: { format } }
        : { thinking: { type: 'adaptive' }, output_config: { effort: 'low', format } };
    const response = await anthropic.messages.create({
      model,
      max_tokens: 6000,
      ...tuning,
      system: SYSTEM,
      messages: [{ role: 'user', content: `On hand: ${ingredients.join(', ')}` }],
    } as never);

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      return json({ error: 'Could not propose recipes from that list.' }, 422);
    }
    const textBlock = response.content.find((b: { type: string }) => b.type === 'text') as
      | { type: 'text'; text: string }
      | undefined;
    if (!textBlock) {
      return json({ error: 'Empty model response.' }, 502);
    }
    const parsed = JSON.parse(textBlock.text);
    return json({
      ideas: parsed.ideas,
      note: parsed.note,
      assumedStaples: ASSUMED_STAPLES,
      estimated: true,
      model: response.model,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI request failed.';
    return json({ error: message }, 502);
  }
});
