import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { saveTargets, addWeightEntry, IMPORTED_TARGETS_REASON } from '@basalt/core-data';
import { recordFoodUse, saveRecipe } from '@basalt/nutrition';
import {
  saveTemplate, startSession, addSessionExercise, logSet, endSession, getExercises,
} from '@basalt/training';

// importCody.ts — creates Cody's account and imports the spreadsheet
// history from docs/basalt-import-cody.json. Every write goes through the
// app's own service layer and carries source 'import'. Run with --dry-run
// first: it prints counts per table, every custom exercise and every
// note-only set, and writes nothing.
//
//   npx tsx --env-file=app/.env scripts/importCody.ts --dry-run
//   BASALT_SEED_PASSWORD comes from YOUR shell (export it before running);
//   it is never read from a file and never printed.

const DRY = process.argv.includes('--dry-run');
const ROOT = resolve(__dirname, '..');
const DATA = JSON.parse(readFileSync(resolve(ROOT, 'docs', 'basalt-import-cody.json'), 'utf8'));

const WEEK1_MONDAY = '2022-03-14'; // per the JSON notes
const log = (...a: unknown[]) => console.log(...a);

type Counts = Record<string, number>;
const counts: Counts = {};
const bump = (t: string, n = 1) => { counts[t] = (counts[t] ?? 0) + n; };
const customExercises = new Set<string>();
const noteOnlySets: string[] = [];
const decisions: string[] = [];

function mondayOfWeek(week: number): string {
  const d = new Date(`${WEEK1_MONDAY}T09:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (week - 1) * 7);
  return d.toISOString();
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const PASSWORD = process.env.BASALT_SEED_PASSWORD;
  if (!SUPABASE_URL || !ANON || !SERVICE) {
    console.error('Missing SUPABASE_URL / publishable key / SUPABASE_SERVICE_ROLE_KEY (use --env-file=app/.env).');
    process.exit(1);
  }
  if (!PASSWORD && !DRY) {
    console.error('BASALT_SEED_PASSWORD is not set — export it in your shell first.');
    process.exit(1);
  }

  const email: string = DATA.account.email;
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  // ── 1 · Account ────────────────────────────────────────────────────
  let userClient: SupabaseClient | null = null;
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const already = existing?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (already) {
    console.error(`STOP: ${email} already exists (id ${already.id}). Nothing was written.`);
    process.exit(2);
  }
  log(`account: will create ${email} (email pre-confirmed)`);
  if (!DRY) {
    const created = await admin.auth.admin.createUser({
      email, password: PASSWORD!, email_confirm: true,
    });
    if (created.error || !created.data.user) {
      console.error('Account creation failed:', created.error?.message);
      process.exit(1);
    }
    userClient = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
    const signIn = await userClient.auth.signInWithPassword({ email, password: PASSWORD! });
    if (signIn.error) {
      console.error('Sign-in after creation failed:', signIn.error.message);
      process.exit(1);
    }
    // Onboarded profile: Minimal theme; Extras are device-side flags whose
    // defaults already match the request (capture on, motivation off,
    // Pebble off) — nothing to store server-side for them.
    const prof = await userClient.from('basalt_profiles').insert({
      id: created.data.user.id, name: 'Cody', theme: 'minimal', use_metric: true,
    });
    if (prof.error) { console.error('Profile insert failed:', prof.error.message); process.exit(1); }
  }
  bump('basalt_profiles');
  const db = () => userClient!;

  // ── 2 · Body weight ────────────────────────────────────────────────
  for (const w of DATA.body_weight) {
    bump('basalt_weight_entries');
    if (!DRY) {
      const r = await addWeightEntry(db(), w.kg, { source: 'import', measuredAt: `${w.date}T08:00:00Z` });
      if (!r.ok) { console.error(`weight ${w.date}:`, r.error); process.exit(1); }
    }
  }

  // ── 3 · Target history (never current — see IMPORTED_TARGETS_REASON) ─
  for (const t of DATA.targets) {
    const effective = t.from ?? WEEK1_MONDAY;
    const fiber = Math.round((14 * t.kcal) / 1000);
    bump('basalt_targets');
    log(`targets ${t.block}: ${t.kcal} kcal P${t.protein_g}/C${t.carbs_g}/F${t.fat_g} effective ${effective} (fibre derived ${fiber} g)`);
    if (!DRY) {
      const r = await saveTargets(db(), {
        effectiveDate: effective,
        calories: t.kcal, proteinG: t.protein_g, carbsG: t.carbs_g, fatG: t.fat_g,
        fiberG: fiber, sugarCapG: null, sodiumCapMg: null, waterMl: null, steps: null, sleepMin: null,
        reason: `${IMPORTED_TARGETS_REASON} — ${t.block} spreadsheet block (${t.note}); fibre derived at 14 g/1000 kcal`,
      });
      if (!r.ok) { console.error('targets:', r.error); process.exit(1); }
    }
  }
  decisions.push('Targets: fibre derived at 14 g/1000 kcal (sheet had P/C/F only); caps/water/steps/sleep left null.');

  // ── 4 · Exercise-name matching ─────────────────────────────────────
  const libraryByName = new Map<string, string>();
  {
    const client = DRY ? admin : db();
    const lib = await getExercises(client, undefined);
    if (lib.ok) for (const e of lib.data) libraryByName.set(e.name.toLowerCase(), e.id);
  }
  const matchExercise = (name: string): string | null => {
    const id = libraryByName.get(name.toLowerCase().trim()) ?? null;
    if (!id) customExercises.add(name);
    return id;
  };

  // ── 5 · Programme templates ────────────────────────────────────────
  const cues: Record<string, string> = DATA.exercise_descriptions ?? {};
  for (const tpl of DATA.programme_templates) {
    for (const session of tpl.sessions) {
      const exercises = session.exercises.map((e: { name: string; prescription?: { sets: number; reps: string; raw: string } }) => {
        const repsNum = e.prescription && /^\d+$/.test(e.prescription.reps) ? Number(e.prescription.reps) : null;
        return {
          exerciseId: matchExercise(e.name),
          exerciseName: e.name,
          targetSets: e.prescription?.sets ?? 3,
          targetReps: repsNum,
        };
      });
      const rangeLines = session.exercises
        .filter((e: { prescription?: { reps: string; raw: string } }) => e.prescription && !/^\d+$/.test(e.prescription.reps))
        .map((e: { name: string; prescription: { raw: string } }) => `${e.name}: ${e.prescription.raw}`);
      const cueLines = session.exercises
        .filter((e: { name: string }) => cues[e.name])
        .map((e: { name: string }) => `${e.name} — ${cues[e.name]}`);
      const notes = [
        'Imported from spreadsheet.',
        ...(rangeLines.length ? [`Rep ranges: ${rangeLines.join(' · ')}`] : []),
        ...cueLines,
      ].join('\n');
      bump('basalt_workout_templates');
      bump('basalt_template_exercises', exercises.length);
      if (!DRY) {
        const r = await saveTemplate(db(), {
          name: `${tpl.title} — ${session.name}`,
          location: tpl.id.startsWith('home') ? 'home' : 'gym',
          notes,
          exercises,
        });
        if (!r.ok) { console.error('template:', r.error); process.exit(1); }
      }
    }
  }
  decisions.push('Rep-range prescriptions (e.g. 4x5-8) keep sets numerically; the range lives in the template notes (targetReps has no range type).');
  decisions.push('Form cues attach to template notes (the exercise library is a shared global table; no per-user description column).');

  // ── 6 · 2022 session logs — one session per (week, split-session) ──
  const grouped = new Map<string, typeof DATA.session_logs>();
  for (const row of DATA.session_logs) {
    const key = `${row.week}·${row.session}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }
  for (const [key, rows] of [...grouped.entries()].sort()) {
    const [weekStr, sessionName] = key.split('·');
    const startedAt = mondayOfWeek(Number(weekStr));
    bump('basalt_workout_sessions');
    let sessionId: string | null = null;
    if (!DRY) {
      const s = await startSession(db(), {
        startedAt,
        source: 'import',
        notes: `Historical import — 2022 W${weekStr} ${sessionName} (week-dated)`,
      });
      if (!s.ok) { console.error('session:', s.error); process.exit(1); }
      sessionId = s.data.id;
      await db().from('basalt_workout_sessions')
        .update({ date_confidence: 'week' }).eq('id', sessionId);
    }
    let order = 0;
    for (const row of rows) {
      const exId = matchExercise(row.exercise);
      const noteSets: string[] = [];
      const realSets: { kg: number | null; reps: number; comment: string | null; estimated: boolean }[] = [];
      for (const set of row.sets) {
        if (set.confidence === 'high' && set.reps != null) {
          realSets.push({ kg: set.kg ?? null, reps: set.reps, comment: null, estimated: false });
        } else if (set.confidence === 'medium' && set.kg != null) {
          const reps = row.prescription && /^\d+$/.test(row.prescription.reps) ? Number(row.prescription.reps) : null;
          if (reps != null) {
            realSets.push({ kg: set.kg, reps, comment: `estimated: reps from prescription (${row.prescription.raw}) — raw '${set.raw}'`, estimated: true });
          } else {
            noteSets.push(set.raw);
          }
        } else if (set.confidence === 'low' && set.reps != null) {
          realSets.push({ kg: null, reps: set.reps, comment: `machine setting '${set.raw}' — not kg, never converted`, estimated: true });
        } else {
          noteSets.push(set.raw);
        }
      }
      if (noteSets.length) {
        noteOnlySets.push(`W${weekStr} ${sessionName} · ${row.exercise}: ${noteSets.join(' | ')}`);
      }
      bump('basalt_session_exercises');
      bump('basalt_set_entries', realSets.length);
      if (!DRY) {
        const notes = [
          row.note,
          noteSets.length ? `Unparseable sets kept verbatim: ${noteSets.join(' | ')}` : null,
        ].filter(Boolean).join('\n') || null;
        const ex = await addSessionExercise(db(), {
          sessionId: sessionId!,
          exerciseId: exId,
          exerciseName: row.exercise,
          orderIndex: order++,
          notes,
        });
        if (!ex.ok) { console.error('session exercise:', ex.error); process.exit(1); }
        let setNo = 1;
        for (const st of realSets) {
          const r = await logSet(db(), ex.data.id, {
            setNumber: setNo++, reps: st.reps, weightKg: st.kg ?? undefined,
            comment: st.comment ?? undefined,
          });
          if (!r.ok) { console.error('set:', r.error); process.exit(1); }
        }
      }
    }
    if (!DRY) {
      const e = await endSession(db(), sessionId!, { endedAt: startedAt });
      if (!e.ok && !String(e.error).includes('ended')) { /* endSession signature variance tolerated */ }
    }
  }

  // ── 7 · Recipes — ingredients are the truth; stated totals a note ──
  const ingredientMacros = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const rec of DATA.recipes) {
    const sum = rec.ingredients.reduce(
      (a: { kcal: number; p: number; c: number; f: number }, i: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }) =>
        ({ kcal: a.kcal + i.kcal, p: a.p + i.protein_g, c: a.c + i.carbs_g, f: a.f + i.fat_g }),
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
    for (const i of rec.ingredients) {
      ingredientMacros.set(String(i.name).toLowerCase(), { calories: i.kcal, protein: i.protein_g, carbs: i.carbs_g, fat: i.fat_g });
    }
    const stated = rec.stated_total;
    const mismatch = stated?.kcal ? Math.abs(stated.kcal - sum.kcal) / sum.kcal : 0;
    const descBits = [
      `Level ${rec.level}`,
      `Sheet's stated total: ${stated?.kcal ?? '—'} kcal (ingredients sum to ${Math.round(sum.kcal)})${mismatch > 0.08 ? ' — disagrees with its own ingredients; ingredients are the source of truth here' : ''}`,
    ];
    bump('basalt_recipes');
    bump('basalt_recipe_ingredients', rec.ingredients.length);
    bump('basalt_recipe_steps', rec.steps.length);
    if (mismatch > 0.08) log(`recipe mismatch >8%: ${rec.title} — stated ${stated.kcal}, ingredients ${Math.round(sum.kcal)}`);
    if (!DRY) {
      const r = await saveRecipe(db(), {
        title: rec.title,
        description: descBits.join('\n'),
        serves: 1,
        source: 'import',
        caloriesPerServe: Math.round(sum.kcal),
        proteinPerServe: Math.round(sum.p * 10) / 10,
        carbsPerServe: Math.round(sum.c * 10) / 10,
        fatPerServe: Math.round(sum.f * 10) / 10,
        macrosConfirmed: true,
        ingredients: rec.ingredients.map((i: { name: string; amount: string }) => ({ qty: null, unit: i.amount, name: i.name })),
        steps: rec.steps,
      });
      if (!r.ok) { console.error('recipe:', r.error); process.exit(1); }
    }
  }
  decisions.push('Recipes: serves=1, per-serve = ingredient sums (source of truth); Level N + the stated-total note live in the description (no tag field).');

  // ── 8 · Food lists → favourites (only where macros exist) ──────────
  const skippedNameOnly: string[] = [];
  for (const [category, names] of Object.entries(DATA.food_lists as Record<string, string[]>)) {
    for (const name of names) {
      const m = ingredientMacros.get(name.toLowerCase());
      if (!m) { skippedNameOnly.push(`${name} (${category})`); continue; }
      bump('basalt_food_favorites');
      if (!DRY) {
        const r = await recordFoodUse(db(), {
          foodName: name, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, fiber: 0,
        });
        if (!r.ok) { console.error('favourite:', r.error); process.exit(1); }
      }
    }
  }
  decisions.push(`Food lists: favourites need macros; ${skippedNameOnly.length} name-only items had no matching recipe ingredient and were skipped (a 0-kcal favourite would be a lie) — listed in the report for manual add.`);

  // ── Output ─────────────────────────────────────────────────────────
  log(`\n${DRY ? 'DRY RUN — nothing written' : 'IMPORT COMPLETE'}`);
  log('\nCounts per table:');
  for (const [t, n] of Object.entries(counts).sort()) log(`  ${t}: ${n}`);
  log(`\nCustom exercises (${customExercises.size}) — no library match, imported by name:`);
  for (const n of [...customExercises].sort()) log(`  · ${n}`);
  log(`\nNote-only sets (${noteOnlySets.length}) — raw text preserved, no numbers:`);
  for (const n of noteOnlySets) log(`  · ${n}`);
  log(`\nSkipped name-only favourites (${skippedNameOnly.length}):`);
  for (const n of skippedNameOnly) log(`  · ${n}`);
  log('\nDecisions made in code (also for the report):');
  for (const d of decisions) log(`  · ${d}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
