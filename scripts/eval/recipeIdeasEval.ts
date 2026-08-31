import { createClient } from '@supabase/supabase-js';

// Live eval for the ai-recipe-ideas Edge Function. Unlike quick-add this
// is almost entirely MECHANICAL — the honesty contract is checkable
// without nutrition bands:
//
//   1. 2–3 ideas per call
//   2. "uses" ⊆ the user's listed ingredients (loose substring match) —
//      the model may not cook with food the user never mentioned
//   3. staples never appear in "uses", and "missing" never contains a
//      listed ingredient — the gap must be real
//   4. range coherence per idea: low < point < high
//   5. steps 3–6, serves ≥ 1
//   6. the vegetarian list produces no meat/fish anywhere
//
//   npx tsx scripts/eval/recipeIdeasEval.ts [model]

const TEST_EMAIL = 'cody.liddell.01@gmail.com';
const TEST_PASSWORD = 'TEST123';

type Idea = {
  name: string; uses: string[]; missing: string[]; steps: string[];
  serves: number; time_min: number;
  calories: number; calories_low: number; calories_high: number;
  protein_g: number; carbs_g: number; fat_g: number;
};

const STAPLES = ['salt', 'pepper', 'water', 'cooking oil'];
const MEAT_WORDS = ['chicken', 'beef', 'pork', 'lamb', 'bacon', 'ham', 'fish', 'salmon', 'tuna', 'prawn', 'shrimp', 'turkey', 'sausage', 'mince'];

const CASES: { id: string; ingredients: string[]; vegetarian?: boolean }[] = [
  { id: 'weeknight', ingredients: ['chicken breast', 'broccoli', 'white rice', 'soy sauce', 'garlic'] },
  { id: 'breakfast', ingredients: ['eggs', 'sourdough bread', 'avocado', 'cherry tomatoes'] },
  { id: 'veg-pantry', ingredients: ['canned chickpeas', 'brown rice', 'spinach', 'lemon', 'greek yoghurt'], vegetarian: true },
  { id: 'sparse', ingredients: ['pasta', 'canned tomatoes'] },
  { id: 'odd-mix', ingredients: ['sweet potato', 'black beans', 'tortillas', 'cheddar cheese', 'lime', 'coriander'] },
];

// Loose containment: "uses" entries must share a word (≥4 chars) with some
// listed ingredient — copies-their-wording with tolerance for plurals.
function fromList(use: string, listed: string[]): boolean {
  const u = use.toLowerCase();
  return listed.some((l) => {
    const ll = l.toLowerCase();
    if (u.includes(ll) || ll.includes(u)) return true;
    const words = ll.split(/\s+/).filter((w) => w.length >= 4);
    return words.some((w) => u.includes(w.replace(/s$/, '')));
  });
}

async function main() {
  try { process.loadEnvFile(); } catch { /* env may be set already */ }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY in .env');
    process.exit(1);
  }
  const model = process.argv[2];
  const client = createClient(url, key);
  const signIn = await client.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (signIn.error) {
    console.error(`Sign-in failed: ${signIn.error.message} — seed the test account first.`);
    process.exit(1);
  }

  let passed = 0;
  const failures: string[] = [];
  const latencies: number[] = [];

  for (const c of CASES) {
    const body = model ? { ingredients: c.ingredients, model } : { ingredients: c.ingredients };
    const t0 = Date.now();
    let { data, error } = await client.functions.invoke('ai-recipe-ideas', { body });
    if (error) {
      await new Promise((r) => setTimeout(r, 2000));
      ({ data, error } = await client.functions.invoke('ai-recipe-ideas', { body }));
    }
    latencies.push(Date.now() - t0);
    const fail = (why: string) => failures.push(`${c.id}: ${why}`);

    if (error) { fail(`error: ${error.message}`); continue; }
    const ideas = (data?.ideas ?? []) as Idea[];

    let ok = true;
    if (ideas.length < 2 || ideas.length > 3) { fail(`${ideas.length} ideas`); ok = false; }
    for (const idea of ideas) {
      for (const use of idea.uses) {
        if (STAPLES.some((s) => use.toLowerCase().includes(s))) {
          fail(`"${idea.name}" lists staple "${use}" in uses`); ok = false;
        } else if (!fromList(use, c.ingredients)) {
          fail(`"${idea.name}" uses unlisted "${use}"`); ok = false;
        }
      }
      for (const m of idea.missing) {
        // Strict both-ways substring here — the loose word match would flag
        // "cornstarch (for thicker sauce)" against listed "soy sauce".
        const ml = m.toLowerCase();
        if (c.ingredients.some((l) => ml.includes(l.toLowerCase()) || l.toLowerCase().includes(ml))) {
          fail(`"${idea.name}" claims listed "${m}" is missing`); ok = false;
        }
      }
      if (!(idea.calories_low < idea.calories && idea.calories < idea.calories_high)) {
        fail(`"${idea.name}" incoherent range [${idea.calories_low}, ${idea.calories}, ${idea.calories_high}]`); ok = false;
      }
      if (idea.steps.length < 3 || idea.steps.length > 6) { fail(`"${idea.name}" ${idea.steps.length} steps`); ok = false; }
      if (idea.serves < 1) { fail(`"${idea.name}" serves ${idea.serves}`); ok = false; }
      if (c.vegetarian) {
        const all = `${idea.name} ${idea.uses.join(' ')} ${idea.missing.join(' ')} ${idea.steps.join(' ')}`.toLowerCase();
        const meat = MEAT_WORDS.find((w) => all.includes(w));
        if (meat) { fail(`"${idea.name}" puts ${meat} in a vegetarian kitchen`); ok = false; }
      }
    }
    if (ok) passed++;
  }

  latencies.sort((a, b) => a - b);
  const med = latencies[Math.floor(latencies.length / 2)]! / 1000;
  console.log(`\n=== ai-recipe-ideas eval · model=${model ?? 'default'} ===`);
  console.log(`passed ${passed}/${CASES.length} · median ${med.toFixed(1)}s`);
  if (failures.length > 0) {
    console.log('\nfailures:');
    failures.forEach((f) => console.log(`  · ${f}`));
    process.exit(1);
  }
}

void main();
