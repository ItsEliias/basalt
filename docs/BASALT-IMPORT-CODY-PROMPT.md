# Basalt — create Cody's account and import his spreadsheet history

Input: `docs/import/basalt-import-cody.json` (built from `My Fittness Plan.xlsx`; raw cell text preserved beside every parsed value, with a confidence flag). Read the `notes` array first — it lists the judgement calls already made.

## 1 — Account

Create the user with the Supabase admin API (service key, server-side, never in the app bundle): email `itseliiasstudy@gmail.com`, password from the environment variable `BASALT_SEED_PASSWORD` (I'll export it in the shell before you run — do not ask me to paste it and do not write it to any file). Mark the email confirmed so there's no verification round-trip. If the address already exists, stop and tell me.

Onboarding state: mark onboarding complete with theme Minimal, capture Extras at defaults, motivation Extras off, Pebble off. I'll pick the rest in the app.

## 2 — Import, in this order, all attributed `source: 'import'`

**Body weight** — 8 readings (2022-03-11 → 2022-06-15, then 2024-01-18 → 2024-02-01). Insert as ordinary weight entries. The Profile & Targets trend line must not draw a straight line across the 19-month gap; if the trend code doesn't already break on gaps > 30 days, add that.

**Targets** — two historical blocks (2022: P229/C310/F97 = 3,029 kcal; 2024-02-12: P180/C310/F97 = 2,833 kcal). Store as target history so Trends can show them, but do **not** set either as the current target — the Phase 6 profile will compute the current one from his numbers, and 2,833 for a 90 kg lift-and-walk day is probably still high for a cut. Current targets stay unset until he fills in the profile.

**Programme templates** — four splits (Gym 1 & 2, five sessions each; Home 1 & 2, three each) into the user's own programme templates, with prescriptions where the sheet had them (Gym split 1 only). Exercises that don't match the exercise library go in as custom exercises with the sheet name, and the import log lists them so I can map them later.

**2022 session logs** — 87 exercise-weeks across W1–W6. Date them by week (week 1 = w/c 2022-03-14) with `date_confidence: 'week'` and show them in Train history under a "historical import" band. Rules for the set parser output:
- `confidence: high` (e.g. `50x8`) → a real set.
- `medium` (weight only, e.g. `12.5`) → sets × reps from the prescription, weight as given, flagged estimated.
- `low` (`35 IJ x10`) → machine-setting, not kg: store the setting in the set note, leave kg null. Never convert.
- `none` (`purple 9th x8`, `BW`, `23.5 DPP`, `31.25ish`) → store the raw text as the set note, no numbers.
None of these may generate a PR or feed the progression engine. Add a test that the PR detector ignores `source: 'import'` rows with `date_confidence != 'day'`.

**Recipes** — 12 recipes with ingredient-level macros and prep steps. Import ingredients as the source of truth and let Basalt compute the totals; the sheet's "Approximate Total" lines go in as a note only (two of them disagree with their own ingredients by >8%). Level 1 / Level 2 becomes a tag.

**Food lists** — the four category lists (protein / carbs / fats / micros) as favourites, so the plate builder and search have something to start from.

**Exercise descriptions** — 15 short form cues; attach to the matching library or custom exercise as the description.

## 3 — Report

`docs/import/IMPORT-REPORT.md`: counts inserted per table, every custom exercise created, every set that landed as note-only, the two recipe mismatches with both totals, and screenshots of Trends (weight, with the gap), Train history (the import band), and Recipes. Then a line I can paste to Cody: what he'll see, and the three things the sheet didn't have that the profile will ask him for — height, date of birth, activity level.
