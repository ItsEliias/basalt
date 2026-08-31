import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

// ai-photo-food — a food photo or a nutrition label → structured estimates.
// Same rules as ai-quick-add: the Anthropic key lives only here as a secret,
// only the image the user chose is sent (never the ledger), every value is
// an estimate the client marks ~, and nothing auto-commits.
//
// mode 'meal'    → per-item suggestions (MacroFactor pattern)
// mode 'label'   → the printed panel transcribed into a custom-food shape
// mode 'recipe'  → a recipe page/screenshot OCR'd into an editable draft
// mode 'routine' → a training plan screenshot OCR'd into template days

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
  // Graded uncertainty (V3 law): calibrated range from the model itself;
  // `calories` stays the central estimate, and must lie within it.
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

const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title', 'serves', 'time_min', 'ingredients', 'steps',
    'calories', 'calories_low', 'calories_high', 'protein_g', 'carbs_g', 'fat_g', 'note',
  ],
  properties: {
    title: { type: 'string' },
    serves: { type: 'number' },
    time_min: { type: 'number' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['quantity', 'name'],
        properties: {
          // Verbatim as printed ("2 cups", "500 g", "" when unstated).
          quantity: { type: 'string' },
          name: { type: 'string' },
        },
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    calories: { type: 'number' },
    calories_low: { type: 'number' },
    calories_high: { type: 'number' },
    protein_g: { type: 'number' },
    carbs_g: { type: 'number' },
    fat_g: { type: 'number' },
    note: { type: 'string' },
  },
} as const;

const ROUTINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'days', 'note'],
  properties: {
    name: { type: 'string' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'exercises'],
        properties: {
          label: { type: 'string' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'sets', 'reps', 'weight_kg'],
              properties: {
                name: { type: 'string' },
                sets: { type: 'number' },
                reps: { type: ['number', 'null'] },
                weight_kg: { type: ['number', 'null'] },
              },
            },
          },
        },
      },
    },
    note: { type: 'string' },
  },
} as const;

const MEAL_SYSTEM = `You estimate nutrition from a photo of food in a health-tracking app.
Rules:
- One item per distinct food you can see. Estimate the visible portion; state your portion assumption in portion_note (e.g. "looks like ~250 g cooked rice").
- Values are honest estimates — realistic, not optimistic. Photos hide oil, butter and sauces: when likely present, include a conservative amount and say so in the note.
- calories_low/calories_high: a CALIBRATED range the true energy plausibly falls in — photo portion estimation is uncertain, so ranges should be honestly wide; the true value inside the range beats a tight wrong range. calories must lie within the range.
- meal_guess from the food type; note: one short sentence naming the biggest uncertainty in the whole estimate. Never marketing language, never advice.
- If the photo does not show food, return an empty items array and say so in note.`;

const LABEL_SYSTEM = `You transcribe a printed nutrition information panel from a photo.
Rules:
- Copy the printed per-serving values exactly; convert kJ to kcal (divide by 4.184) when only kJ is printed and say so in note.
- serving_size/serving_unit from the label's stated serving. Brand from the packaging when visible, else null.
- note: one short sentence on anything unreadable or converted. If the photo shows no nutrition panel, set food_name to "" and say so in note. Never guess unreadable numbers — use 0 and name them in note.`;

const RECIPE_SYSTEM = `You transcribe a recipe from a photo (cookbook page, screenshot, handwritten card) for a health-tracking app.
Rules:
- TRANSCRIBE what is printed — title, serves, time, ingredient quantities verbatim, steps in order. Never invent ingredients or steps that are not visible; anything unreadable goes in note by name.
- Macros are PER SERVE. When the page prints nutrition, transcribe it and say so in note. When it does not, estimate honestly from the ingredient list and say "estimated from ingredients" in note.
- calories_low/calories_high: a calibrated range; recipes made at home vary, so widen accordingly; calories must lie within the range.
- If the photo shows no recipe, return title "" and say so in note.`;

const ROUTINE_SYSTEM = `You transcribe a training routine from a photo (app screenshot, coach's spreadsheet, gym card) for a training-log app.
Rules:
- TRANSCRIBE what is printed: routine name, day labels, exercise names as written, set counts, reps, weights. Convert printed lb to kg (divide by 2.2046) and say so in note.
- Never invent numbers. Unstated reps or weight → null. Unreadable rows → leave them out and name them in note.
- Rep ranges ("8-12") → the LOWER bound, noted in note once.
- Group by day when the layout shows days; a flat list is one day labelled "Day 1".
- If the photo shows no routine, return an empty days array and say so in note.`;

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
  let mode: 'meal' | 'label' | 'recipe' | 'routine' = 'meal';
  try {
    const body = await req.json();
    imageB64 = String(body?.imageB64 ?? '');
    if (body?.mode === 'label' || body?.mode === 'recipe' || body?.mode === 'routine') mode = body.mode;
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
      max_tokens: 6000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema:
          mode === 'meal' ? MEAL_SCHEMA
          : mode === 'label' ? LABEL_SCHEMA
          : mode === 'recipe' ? RECIPE_SCHEMA
          : ROUTINE_SCHEMA },
      },
      system:
        mode === 'meal' ? MEAL_SYSTEM
        : mode === 'label' ? LABEL_SYSTEM
        : mode === 'recipe' ? RECIPE_SYSTEM
        : ROUTINE_SYSTEM,
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
              text:
                mode === 'meal' ? 'Estimate this meal.'
                : mode === 'label' ? 'Transcribe this nutrition label.'
                : mode === 'recipe' ? 'Transcribe this recipe.'
                : 'Transcribe this training routine.',
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
