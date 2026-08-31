# V3-B report — Phase 4 items 6–11

**Date:** 2026-08-31 · **Branch:** `v3-full-batch` · **Suite:** 737 green (was 696 at V3-A).
Commits: fill-gap `e80d04a` · voice `4766b25` · on-hand recipes `d550bf1` ·
OCR + routine `60579f7` · interval walks `4721b0e` · race plans `83169b3`.

## 6 · Fill the gap (`e80d04a`)

Pure engine (12 tests), rules published in-module: gap = target − eaten floored at zero;
under 150 kcal remaining → nothing renders; a food that exceeds the remaining energy is
excluded outright; among fits, rank by macro-kcal closed. Own foods (favorites) first,
always; OFF fills only leftover slots via published staple queries keyed to the scarcest
macro, source-tagged per row. Header states the gap plainly; row reasons are arithmetic
("28 g of your 40 g protein gap"). Tap → Tray; nothing logs without commit.

## 7 · Voice logging lane (`4766b25`)

expo-speech-recognition added (config plugin in app.json — **rides the dev-client rebuild
already on the needs-you list**). OS transcribes; partials stream into the describe-it box;
a final transcript auto-runs the same deployed ai-quick-add. Voice changes the input
surface, never the gates: ~ ranges, Tray, nothing auto-commits; audio never reaches
Basalt's servers (stated in the srcnote). Lazy-required — builds without the module never
show the mic. Eval grew four voice-transcript cases (disfluencies, a self-correction that
must land on the corrected count, run-on quantities, AU brand speech); bands recalibrated
only with citations (Sanitarium 776 kJ, USDA scrambled-egg/mixed-nuts/stir-fry); one
dual-reading case respecified (it tested dice, not the model); harness gained a single
transport-error retry — honesty failures are never retried. 24/24 live; across repeated
runs a rare single-case wobble remains (an occasional Tim Tam undercount) — recorded, not
papered over.

## 8 · On-hand recipes (`d550bf1`)

New `ai-recipe-ideas` Edge Function (deployed): 2–3 complete proposals from the listed
ingredients plus ONLY a published staples set (salt, pepper, water, oil) — the model may
not invent pantry contents; what a dish also needs arrives as a concrete "missing" list.
Committed eval (`pnpm eval:recipe-ideas`) is almost entirely **mechanical**: uses ⊆ listed,
staples never in uses, missing never contains a listed item, ranges coherent, vegetarian
kitchen yields no meat. 5/5 twice after two catches: max_tokens starvation zero-filling
ideas (thinking shares the budget → raised to 6000) and a conditional-hedge missing entry
(banned by prompt). RecipesTab lane: proposals show kcal range + gap; tap lands in the
same editable draft as any import, macros wearing ~.

## 9 · Recipe OCR + routine-photo import (`60579f7`)

ai-photo-food gains modes 'recipe' and 'routine' (deployed). Both are transcription-first:
never invent what isn't visible, name the unreadable in the note. Recipe → the same
editable draft; quantities kept verbatim (no lossy parsing); macros estimated only when
the page prints none, provenance stated. Routine → `routineToTemplates` (pure, 8 tests):
one template per day, the CSV importer's published matcher reused (fuzzy + manual
override, unmatched imports as written), no-set-count rows skipped by name, printed lb→kg
noted, rep ranges take the lower bound. ImportSheet's new Photo lane keeps the dry-run
discipline end to end.

## 10 · Guided interval walks (`4721b0e`)

Fixed three-session catalogue (7 tests) — a picker, deliberately not a library. Cues are
talk-test RPE ("brisk — breathing harder, short sentences only"); pinned by test: totals
match stated minutes, cues contain no digits, spoken copy obeys the no-cheerleading law
exactly as printed copy. Haptics are the primary signal (double-heavy = pick it up,
single-light = ease off), TTS the detail layer over the same voice as km splits. Script
end ≠ walk end — the recording continues until the user stops it, and says so.

## 11 · Race plans (`83169b3`)

One knob: one recent result. Riegel (1977) by name, exponent 1.06 pinned; paces are
published multiples (easy 1.30 · steady 1.12 of predicted race pace); 6–16 week band,
3 sessions/week, long run builds then tapers; the classic 25:00-5k → ~52:06-10k check is
a test. Ramp-back is a published rule with no-scolding pinned: ≤1 week behind → repeat
last completed; more → step back two. `basalt_race_plans` stores **inputs only** — the
plan recomputes from the formula so a stale copy can't disagree with it. Additive
migration applied live, RLS ×4, **advisors run: nothing new** (same pre-existing
Arise-side findings as V3-A). Train card: predicted time with basis named, three paces,
week dots, tick rows, ramp-back note.

## Deviations this phase

- Voice needs the dev-client rebuild to be live on device (module + plugin are in the
  repo; no crash paths without it). Already on the needs-you list.
- The live quick-add eval has inherent run-to-run variance; treated as a monitoring
  harness — transport errors retry once, honesty checks never loosened for wobble.
- Recipe OCR keeps ingredient quantities verbatim in the name rather than parsing them
  into qty/unit — lossless beats structured-but-lossy for transcription.
