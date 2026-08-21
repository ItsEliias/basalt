import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

// ai-photo-food — a food photo or a nutrition label → structured estimates.
// Same rules as ai-quick-add: the Anthropic key lives only here as a secret,
// only the image the user chose is sent (never the ledger), every value is
// an estimate the client marks ~, and nothing auto-commits.
//
// mode 'meal'  → per-item suggestions (MacroFactor pattern)
// mode 'label' → the printed panel transcribed into a custom-food shape

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

const ITEM_PROPS = {
  food_name: { type: 'string' },
  meal_guess: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snacks'] },
  calories: { type: 'number' },
  protein_g: { type: 'number' },
  carbs_g: { type: 'number' },
  fat_g: { type: 'number' },
  fiber_g: { type: 'number' },
  sugar_g: { type: 'number' },
  sodium_mg: { type: 'number' },
  portion_note: { type: 'string' },
} as const;

const MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'note'],
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
    note: { type: 'string' },
  },
} as const;

const LABEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'food_name', 'brand', 'serving_size', 'serving_unit', 'calories',
    'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'note',
  ],
  properties: {
    food_name: { type: 'string' },
    brand: { type: ['string', 'null'] },
    serving_size: { type: 'number' },
    serving_unit: { type: 'string' },
    calories: { type: 'number' },
    protein_g: { type: 'number' },
    carbs_g: { type: 'number' },
    fat_g: { type: 'number' },
    fiber_g: { type: 'number' },
    sugar_g: { type: 'number' },
    sodium_mg: { type: 'number' },
    note: { type: 'string' },
  },
} as const;

const MEAL_SYSTEM = `You estimate nutrition from a photo of food in a health-tracking app.
Rules:
- One item per distinct food you can see. Estimate the visible portion; state your portion assumption in portion_note (e.g. "looks like ~250 g cooked rice").
- Values are honest estimates — realistic, not optimistic. Photos hide oil, butter and sauces: when likely present, include a conservative amount and say so in the note.
- meal_guess from the food type; note: one short sentence naming the biggest uncertainty in the whole estimate. Never marketing language, never advice.
- If the photo does not show food, return an empty items array and say so in note.`;

const LABEL_SYSTEM = `You transcribe a printed nutrition information panel from a photo.
Rules:
- Copy the printed per-serving values exactly; convert kJ to kcal (divide by 4.184) when only kJ is printed and say so in note.
- serving_size/serving_unit from the label's stated serving. Brand from the packaging when visible, else null.
- note: one short sentence on anything unreadable or converted. If the photo shows no nutrition panel, set food_name to "" and say so in note. Never guess unreadable numbers — use 0 and name them in note.`;

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
  if (!apiKey) {
    return json({ error: 'AI capture is not configured on the server yet (ANTHROPIC_API_KEY secret missing).' }, 503);
  }

  let imageB64 = '';
  let mode: 'meal' | 'label' = 'meal';
  try {
    const body = await req.json();
    imageB64 = String(body?.imageB64 ?? '');
    if (body?.mode === 'label') mode = 'label';
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!imageB64 || imageB64.length < 100) return json({ error: 'No image received.' }, 400);
  if (imageB64.length > 2_000_000) {
    return json({ error: 'Image too large — the app should downscale before sending.' }, 413);
  }

  const anthropic = new Anthropic({ apiKey });
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: mode === 'meal' ? MEAL_SCHEMA : LABEL_SCHEMA },
      },
      system: mode === 'meal' ? MEAL_SYSTEM : LABEL_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageB64 },
            },
            {
              type: 'text',
              text: mode === 'meal' ? 'Estimate this meal.' : 'Transcribe this nutrition label.',
            },
          ],
        },
      ],
    } as never);

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      return json({ error: 'Could not read that photo.' }, 422);
    }
    const textBlock = response.content.find((b: { type: string }) => b.type === 'text') as
      | { type: 'text'; text: string }
      | undefined;
    if (!textBlock) return json({ error: 'Empty model response.' }, 502);
    return json({ ...JSON.parse(textBlock.text), estimated: true, mode, model: response.model });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI request failed.';
    return json({ error: message }, 502);
  }
});
