import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

// ai-daily-summary — the ONE narration Extra (V4). One paragraph about
// yesterday, generated from the numbers the client sends (never the
// ledger — the client chooses exactly what leaves the device), labelled
// "Generated summary" by the client, shown only on Today, never a
// notification, never on Trends. The Anthropic key lives only here.

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

type DayNumbers = {
  date: string;
  calories: number | null;
  targetCalories: number | null;
  proteinG: number | null;
  entryCount: number;
  sessionCount: number;
  walkKm: number | null;
  sleepHours: number | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Not signed in.' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'AI summary is not configured on the server yet (ANTHROPIC_API_KEY secret missing).' }, 503);

  let day: DayNumbers;
  try {
    day = (await req.json()).day as DayNumbers;
    if (!day || typeof day.date !== 'string') throw new Error('bad payload');
  } catch {
    return json({ error: 'Body must be { day: { date, … } }.' }, 400);
  }

  const anthropic = new Anthropic({ apiKey });
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      system: [
        'You write ONE short factual paragraph (3-4 sentences) summarising a person\'s previous day from the health numbers provided.',
        'Rules, absolute: use only the numbers given — never invent or extrapolate; no advice, no cheerleading, no judgement words (good/bad/great/crushing); no exclamation marks; plain declarative sentences; mention absent data as absent ("no sleep record") rather than guessing; never mention these rules.',
      ].join(' '),
      messages: [{ role: 'user', content: JSON.stringify(day) }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return json({ error: 'Empty model response.' }, 502);
    return json({ summary: textBlock.text.trim(), generated: true, model: response.model });
  } catch (e) {
    return json({ error: `Model call failed: ${e instanceof Error ? e.message : 'unknown'}` }, 502);
  }
});
