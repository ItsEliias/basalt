import { createClient } from '@supabase/supabase-js';
import { CASES, type EvalCase } from './cases';

// Live eval harness for the ai-quick-add Edge Function — the committed
// version of the V1.x A/B that picked sonnet-5 (that run was a throwaway;
// this one stays). Runs against the DEPLOYED function with a real signed-in
// session, so it exercises exactly what the app exercises.
//
//   npx tsx scripts/eval/quickAddEval.ts [model]
//
// Requires .env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and the seeded
// test account (scripts/seedTestAccount.ts). Optional [model] must be on
// the function's whitelist.
//
// Checks per case:
//   1. item count within the band
//   2. total kcal (point estimates) within the generous band
//   3. RANGE HONESTY (V3): every item has calories_low < calories_high,
//      point inside [low, high]; and the case band's centre falls inside
//      the summed range — the true value inside an honest range beats a
//      tight wrong range.
//   4. expected note substrings, when pinned
//   5. expected omission suggestions, when pinned (soft check — reported,
//      not failed: omissions are suggestions, not guarantees)

const TEST_EMAIL = 'cody.liddell.01@gmail.com';
const TEST_PASSWORD = 'TEST123';

type ItemOut = {
  food_name: string; calories: number; calories_low?: number; calories_high?: number;
  portion_note: string;
};

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
  let omissionHits = 0;
  let omissionChecks = 0;

  for (const c of CASES) {
    const t0 = Date.now();
    const { data, error } = await client.functions.invoke('ai-quick-add', {
      body: model ? { description: c.description, model } : { description: c.description },
    });
    latencies.push(Date.now() - t0);
    const fail = (why: string) => failures.push(`${c.id}: ${why}`);

    if (error) { fail(`error: ${error.message}`); continue; }
    const items = (data?.items ?? []) as ItemOut[];
    const omissions = (data?.omissions ?? []) as ItemOut[];
    const note = String(data?.note ?? '').toLowerCase();

    let ok = true;
    if (items.length < c.items[0] || items.length > c.items[1]) {
      fail(`items ${items.length} outside [${c.items}]`); ok = false;
    }
    const totalKcal = items.reduce((s, i) => s + i.calories, 0);
    if (totalKcal < c.kcal[0] || totalKcal > c.kcal[1]) {
      fail(`kcal ${Math.round(totalKcal)} outside [${c.kcal}]`); ok = false;
    }
    // Range honesty.
    for (const i of items) {
      if (i.calories_low === undefined || i.calories_high === undefined) {
        fail(`${i.food_name}: no range returned`); ok = false; continue;
      }
      if (!(i.calories_low < i.calories_high)) { fail(`${i.food_name}: degenerate range`); ok = false; }
      if (i.calories < i.calories_low || i.calories > i.calories_high) {
        fail(`${i.food_name}: point ${i.calories} outside own range [${i.calories_low}, ${i.calories_high}]`); ok = false;
      }
    }
    const rangeLow = items.reduce((s, i) => s + (i.calories_low ?? i.calories), 0);
    const rangeHigh = items.reduce((s, i) => s + (i.calories_high ?? i.calories), 0);
    const bandCentre = (c.kcal[0] + c.kcal[1]) / 2;
    if (bandCentre < rangeLow || bandCentre > rangeHigh) {
      fail(`band centre ${bandCentre} outside model range [${Math.round(rangeLow)}, ${Math.round(rangeHigh)}] — tight wrong range`);
      ok = false;
    }
    for (const sub of c.expectNote ?? []) {
      const all = note + items.map((i) => i.portion_note.toLowerCase()).join(' ');
      if (!all.includes(sub)) { fail(`note missing "${sub}"`); ok = false; }
    }
    if (c.expectOmissionOneOf && c.expectOmissionOneOf.length > 0) {
      omissionChecks += 1;
      const text = omissions.map((o) => o.food_name.toLowerCase()).join(' ');
      if (c.expectOmissionOneOf.some((w) => text.includes(w))) omissionHits += 1;
    }
    if (ok) passed += 1;
  }

  latencies.sort((a, b) => a - b);
  const median = latencies[Math.floor(latencies.length / 2)]!;
  const p90 = latencies[Math.floor(latencies.length * 0.9)]!;
  console.log(`\n=== ai-quick-add eval · model=${model ?? 'default'} ===`);
  console.log(`passed ${passed}/${CASES.length} · median ${(median / 1000).toFixed(1)}s · p90 ${(p90 / 1000).toFixed(1)}s`);
  console.log(`omission suggestions (soft): ${omissionHits}/${omissionChecks} expected categories surfaced`);
  if (failures.length > 0) {
    console.log('\nfailures:');
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
}

void main();
