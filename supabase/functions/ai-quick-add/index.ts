import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

// ai-quick-add — freeform text ("2 eggs and a banana") → structured food
// suggestions. The Anthropic key lives ONLY here as a Supabase secret
// (week-one chore #1: no client-side AI key, ever). Every value returned is
// an estimate: the client marks them ~ and nothing auto-commits — capture →
// editable suggestion → confirm.

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

// Strict schema — the API validates the model's output against this, so the
// client never has to defensively parse.
const ITEM_PROPS = {
  food_name: { type: 'string' },
  meal_guess: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snacks'] },
  calories: { type: 'number' },
  // Graded uncertainty (V3 law): a calibrated energy range from the model
  // itself, never invented client-side. `calories` stays the central
  // estimate the edit form prefills; the range is what displays until the
  // user confirms.
  calories_low: { type: 'number' },
  calories_high: { type: 'number' },
  protein_g: { type: 'number' },
  carbs_g: { type: 'number' },
  fat_g: { type: 'number' },
  fiber_g: { type: 'number' },
  sugar_g: { type: 'number' },
  sodium_mg: { type: 'number' },
  portion_note: { type: 'string' },
} as const;

const SUGGESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'omissions', 'note'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(ITEM_PROPS),
        properties: ITEM_PROPS,
      },
    },
    // The omissions pass — commonly forgotten companions NOT stated in the
    // description (cooking oil, dressing, sugar in coffee, butter). The
    // client renders them as optional one-tap additions; nothing here is
    // ever auto-added.
    omissions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(ITEM_PROPS),
        properties: ITEM_PROPS,
      },
    },
    note: { type: 'string' },
  },
} as const;

// Model routing. Default chosen by a 20-case A/B on 2026-08-21 (live, via
// this function): sonnet-5 20/20 passed @ 4.0s median, opus-4-8 18/20 @ 5.2s
// (two borderline range misses), haiku-4-5 15/20 @ 2.7s (real misses: Tim Tam
// 3× over, 3-item smoothie split) — so sonnet-5 is the default: equal-or-
// better quality than opus here, faster, and cheaper. Haiku did not hold.
// Callers may override with any whitelisted model (used by the A/B harness).
const DEFAULT_MODEL = 'claude-sonnet-5';
const ALLOWED_MODELS = new Set(['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5']);

const SYSTEM = `You estimate nutrition for food descriptions in a health-tracking app.
Rules:
- One item per distinct food in the description. Use the portion the user stated; when unstated, assume a typical single serving and say so in portion_note (e.g. "assumed 1 medium banana, ~120 g").
- Values are honest estimates for that portion — realistic, not optimistic. Use Australian products/portions when a brand suggests it.
- calories_low/calories_high: a CALIBRATED range the true energy plausibly falls in, given portion and preparation uncertainty. The true value inside an honest range beats a tight wrong range — width should reflect real uncertainty (a packaged branded item is narrow; "a bowl of curry" is wide). When preparation or portion is ambiguous (home-cooked, restaurant, "a bowl of"), widen substantially — under-width is the common failure mode, especially on the high side where oil and portions hide. calories must lie within the range.
- meal_guess from any time-of-day hints in the text; default to the most typical meal for that food.
- omissions: 0–3 commonly forgotten companions NOT stated in the description — cooking oil for pan-cooked items, dressing on salads, sugar/milk in coffee, butter on toast, sauces. Same item shape, portion_note explaining the assumption. Empty array when nothing plausibly applies. Never duplicate anything the user already stated.
- note: one short sentence naming the biggest uncertainty in the whole estimate (e.g. "Cooking oil not counted unless stated"). Never marketing language, never advice.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Verify the caller's JWT — signed-in users only.
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
      { error: 'AI capture is not configured on the server yet (ANTHROPIC_API_KEY secret missing).' },
      503,
    );
  }

  let description = '';
  let model = DEFAULT_MODEL;
  try {
    const body = await req.json();
    description = String(body?.description ?? '').trim();
    if (body?.model !== undefined) model = String(body.model);
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!description || description.length > 1000) {
    return json({ error: 'Describe the food in 1–1000 characters.' }, 400);
  }
  if (!ALLOWED_MODELS.has(model)) {
    return json({ error: 'Unsupported model.' }, 400);
  }

  const anthropic = new Anthropic({ apiKey });
  try {
    // Haiku 4.5 predates adaptive thinking and the effort knob — for it,
    // send neither; the other models get adaptive thinking at low effort.
    const format = { type: 'json_schema', schema: SUGGESTION_SCHEMA } as const;
    const tuning =
      model === 'claude-haiku-4-5'
        ? { output_config: { format } }
        : { thinking: { type: 'adaptive' }, output_config: { effort: 'low', format } };
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      ...tuning,
      system: SYSTEM,
      messages: [{ role: 'user', content: description }],
    } as never);

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      return json({ error: 'Could not produce an estimate for that description.' }, 422);
    }
    const textBlock = response.content.find((b: { type: string }) => b.type === 'text') as
      | { type: 'text'; text: string }
      | undefined;
    if (!textBlock) {
      return json({ error: 'Empty model response.' }, 502);
    }
    const parsed = JSON.parse(textBlock.text);
    return json({
      items: parsed.items,
      omissions: parsed.omissions ?? [],
      note: parsed.note,
      estimated: true,
      model: response.model,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI request failed.';
    return json({ error: message }, 502);
  }
});
