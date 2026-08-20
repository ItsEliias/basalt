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
const SUGGESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'note'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'food_name', 'meal_guess', 'calories', 'protein_g', 'carbs_g',
          'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'portion_note',
        ],
        properties: {
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
        },
      },
    },
    note: { type: 'string' },
  },
} as const;

const SYSTEM = `You estimate nutrition for food descriptions in a health-tracking app.
Rules:
- One item per distinct food in the description. Use the portion the user stated; when unstated, assume a typical single serving and say so in portion_note (e.g. "assumed 1 medium banana, ~120 g").
- Values are honest estimates for that portion — realistic, not optimistic. Use Australian products/portions when a brand suggests it.
- meal_guess from any time-of-day hints in the text; default to the most typical meal for that food.
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
  try {
    const body = await req.json();
    description = String(body?.description ?? '').trim();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!description || description.length > 1000) {
    return json({ error: 'Describe the food in 1–1000 characters.' }, 400);
  }

  const anthropic = new Anthropic({ apiKey });
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: SUGGESTION_SCHEMA },
      },
      system: SYSTEM,
      messages: [{ role: 'user', content: description }],
    });

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
      note: parsed.note,
      estimated: true,
      model: response.model,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI request failed.';
    return json({ error: message }, 502);
  }
});
