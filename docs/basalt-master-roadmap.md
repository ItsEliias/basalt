# BASALT — Master Roadmap (Plan of Record)

**Consolidates:** the Arise/Oathbound codebase audit → migration map, the UI benchmark review, the per-app feature adoption matrix, and the v7 prototype. This document supersedes the phasing sections of the earlier docs; they remain as reference detail.

**Product:** Basalt — the all-in-one honest health ledger. Store listing: **"Basalt: Health & Fitness"** / subtitle **"Food, training, sleep, vitals"**.
**Positioning:** food, training, sleep and vitals in one ledger, so the numbers can actually talk to each other. No gamification, no fake data, no guilt. The serious counterpart to Arise.
**Portfolio:** Arise = live, maintenance mode. Oathbound = frozen (organs harvested: `set_entry` schema). Basalt = the build.

> **Status (2026-08-31):** V3 batch delivered on `v3-full-batch` — see `docs/V3-REPORT.md`
> for the roll-up, deviation ledger and needs-you list. 1,031 tests green; sharing,
> programs, race plans, cycle, co-op, voice/BLE lanes and the offline outbox all landed.

---

## 0. Architecture & repo

```
fitness-monorepo/
  packages/
    core-data/        keep — Result, dates, client factory, sync contracts (outbox impl later)
    health-connect/   keep — 28 record types; ADD tests + full manifest; HealthKit sibling V1.x
    nutrition/        keep — food, water, OFF client, JSON-LD import; ADD favorites, units, allergen flags
    training/         NEW  — set_entry relational model (from Oathbound), progression engine later
    analytics/        NEW  — rolling trends V1, gated correlations + journal engine later
    ui/               NEW  — Basalt design system (tokens from prototype; token-provider pattern from ui-primitives)
  apps/
    arise/            frozen feature-wise; consumes shared fixes
    oathbound/        frozen
    basalt/           the new app
```

Backend: Supabase-direct (as today), every write through the service layer so the local-first outbox can slot in at V1.x without touching screens. AI calls (food capture, recipe parsing) go through **Supabase Edge Functions — never a client-side API key**.

### Week-one chores (shared-code fixes that also repair Arise)
1. Move the Anthropic key behind an Edge Function (it currently ships in the client bundle).
2. Declare all 28 Health Connect permissions in the manifest (currently 1 — 27 readers fail at runtime).
3. Create the `walks` table (DDL currently lives in a code comment; saves fail silently).
4. Kill the duplicate write paths: `diaryService.ts` (XP-infected) and `utils/tdee.ts` (divergent calorie engine) — one food path, one target engine.
5. Unify TypeScript (5.7/6.0 split) and make root `pnpm test` green.

---

## 1. Design system (locked)

Swiss functionalist / editorial dark. Canvas `#0F1115`, surface `#16181D`, hairline `#22262E`, ink `#F4F5F6`/`#8A909B`. Accents (CVD-validated on dark): protein/strength `#C08432`, carbs/movement `#3E9B78`, fat/load `#BE5540`, recovery/sleep `#5E72E4`. System neo-grotesque + tabular mono numerals. Receipt lists, hairline bars, thin-line body map, mechanical viewfinder, honest empty states. Color only when it means something. Market validation: MFP's card redesign backlash, Hevy's retreat to platform-native chrome, WHOOP as the only (hardware-locked) neighbor. Prototype v7 is the reference implementation.

**IA:** Today · Log (Capture/Recipes/Planner) · **[＋ quick-log]** · Train (Session/Plans/Library/Outdoor) · Recover (Vitals/Mind) · Trends.

---

## 2. V1 — "The Ledger" (launch scope)

### Onboarding (prototype v11 — 8 steps, every step skippable, everything editable in Settings)
1. Basics: name, age, height, weight, goal weight, sex (energy-formula only), units (metric/imperial).
2. Goals — **multi-select** (lose / build / health / fitness / sleep / recomp); conflicting pairs balanced toward recomp and *said so*.
3. Health considerations: BP, T1/T2 diabetes, heart, asthma, pregnancy/postpartum, shoulder/knee/back injuries, mobility, surgery — biases exercise selection, enables relevant logging. Plus optional **weight-affecting medications** (GLP-1, insulin, thyroid) — adjusts target expectations, stored privately.
4. Eating & drinking honestly: takeaway/week, alcohol, sugary drinks, who cooks, breakfast, **smoking/vaping**, caffeine.
5. Dietary requirements: allergies/intolerances (coeliac strict-GF distinct from gluten sensitivity — "may contain traces" respected; dairy vs lactose; nut/peanut/shellfish/fish/egg/soy/sesame/sulphites) + diet & belief (veg/vegan/pescatarian/halal/kosher/low-FODMAP/keto/diabetic-friendly/low-sodium).
6. Train location (gym / home / both) — **gym skips the equipment step**.
7. Home equipment (16 items) — only shown for home/both.
8. Lifestyle: job activity, current exercise, sleep, stress, motivation ("what's driving this"), check-in preference (quiet / weekly digest / daily).
Output: daily targets — energy, protein, carbs, fat, fibre, sugar cap, sodium cap, water, steps, sleep — seeded from all of it, recalibrated weekly by the adaptive TDEE loop. No paywall inside onboarding.

### Settings (V1, prototype v11)
Profile (every onboarding answer editable) · goals & targets · dietary requirements · training setup · preferences (check-ins, connected sources, hide-the-numbers) · Your Data (one-tap JSON/CSV export; doctor PDF at V1.x) · Account (email, plan/billing placeholder, sign out, **delete account = full cascade across every table + photos + auth record** — Google Play / App Store compliance requirement).

### Nutrition
- PORT: `targetsService` (Mifflin-St Jeor as day-1 seed, 1200 floor), `packages/nutrition` food CRUD, OFF client, hydration engine (wire the real bodyweight formula — the live screen currently ignores it).
- BUILD: camera barcode scanner + GS1 check digit (expo-camera; nothing exists today); **adaptive TDEE loop** (MacroFactor pattern: expenditure from weight trend vs intake, weekly auto-adjustment with a one-line "why"); favorites/recents ("frequent at this hour", 1-tap re-log); swipe-copy-yesterday; optional photo on any entry (private by default); caps with honest over-state; **allergen/diet conflict flagging on scans** (open differentiator — no competitor does it); AI quick-add via Edge Function (text; marked "~" until confirmed); micronutrient wall (only nutrients with source data).

### Recipes & planning (V1 slice)
- PORT: JSON-LD URL importer (exists, tested).
- BUILD: recipe persistence in Postgres (currently AsyncStorage-only), serving scaling, ingredient check-off → grocery list (aisle-grouped, unit-normalised, checkable), cover thumbnail from source, dietary chips + per-ingredient conflict flags.

### Training
- PORT: exercise DB + seeder (873 movements), `workoutService` shell; **Oathbound `set_entry` relational model** for per-set rows.
- BUILD: set logger with Prev column (ghosted last-session values as defaults), RIR per set, supersets, per-exercise remembered rest timers, plate calculator, per-set comments + machine-settings notes, warm-up/drop/failure set types, **guided set timer for timed exercises** (configurable lead-in → work → rest with last-5 warning, per-set beeps, haptics primary, screen-off via Live Activity/foreground service, auto-logs to set_entries as duration; generalises to EMOM/Tabata/circuits at V1.x), plans/templates ("Push · Week 1", duplicate-week, GYM/HOME badges, equipment-aware), library with muscle/equipment/my-equipment filters, **per-exercise muscle-highlight figure** (primary solid / secondary faded on the thin-line body figure — rendered from free-exercise-db muscle data, all 873 movements, zero licensing), muscle volume body map (from real set history), post-exercise one-tap feedback (too easy / right / too hard) — logged from day one so the V1.x engine has data.
- LICENSE: **ExerciseDB one-time dataset (~$299 mobile)** — 1,394 exercise GIFs self-hosted + substitutions/progressions/regressions data (feeds Adapt-Session & swaps); render GIFs duotone-treated inside the framed viewfinder so they read as instructional diagrams. Alternative: Gymvisual royalty-free packs. V2 option: bespoke monochrome mannequin renders for top ~100 movements by logging frequency.

### Outdoor
- PORT: GPS state machine + accuracy filters + haversine (extract from Arise screen into `training` or own module).
- BUILD: the `walks` table (finally), live map with stats overlay + modest pause, Douglas-Peucker simplification before save, per-km splits with pace bars, step tracking with baseline-adaptive goal.

### Recover
- PORT: **health-connect package whole** (fix manifest, add tests), sleep service, weight service, meditation service.
- BUILD: `sleep_sessions` + `sleep_stages` schema (stages currently thrown away), vitals dashboard with real-or-hidden rule + personal-baseline framing, manual measurements (weight, girths), Mind tab: breathing pacer (box/4-7-8/coherent), named timer presets, mindful-minutes sync.

### Trends & trust
- BUILD: 7/30-day rolling trends (no correlations yet), Week in Review digest (one gap named, no cheerleading), no-guilt consistency calendar, Records ledger (incl. longest full-log run), dual milestones (streak + lifetime), **JSON/CSV export + complete wipe**, data-sovereignty settings page.

### Explicitly rebuilt-not-ported (audit verdict: fakes)
Mesocycle/readiness engine, trends screen, meal planner, grocery list, macro calculator screen, export flow.

---

## 3. V1.x — fast follows (ordered)

1. **iOS HealthKit provider** (one-file drop-in per the provider architecture — unlocks iOS parity; schedule early).
2. **AI food capture done right:** photo → verified-DB ingredients (MacroFactor pattern, not LLM blobs); label OCR; freeform sentence + voice logging; "photo now, log later" queue. All: capture → editable suggestion → confirm.
3. **Social recipe import:** TikTok/IG/YouTube/FB via Edge Function (caption + transcript parse), cover thumbnail, "~" macros until confirmed.
4. **Progression engine v1:** deterministic next-session loads (+2.5 kg / +1 rep rules off RIR + feedback), rep-PR matrix with contextual hints, warm-up calculator, smart superset scroll, live PR toast, break detection, missed-workout realignment (Runna pattern), **Adapt Session menu** (less time / no equipment / quiet mode / exclude muscle), Workout Spaces (per-location equipment).
5. **Per-muscle recovery model** (Fitbod pattern: volume + sleep/HRV where available, manual override) feeding the body map and session suggestions.
6. **Readiness number** (sleep-time HRV + RHR + sleep quality + prior load) — published formula, real-or-hidden, one actionable sentence.
7. **Correlations engine** (|r| ≥ 0.45, n ≥ 30, "correlation not cause", checked-not-shown list) + mood/factor check-ins.
8. Routes: generate-a-loop from OSM, matched-route PRs ("your usual Tuesday loop"), Beacon live-location link, voice announcements, sleep sub-factors, vitals baseline-range table, fasting timer module (zones, no pseudo-science), meal planner + shared grocery lists, training/rest-day targets, workout-aware portion scaling.
9. **Progress photo vault:** 3-pose capture with alignment guides + **ghost overlay** (nobody has it), angle tags, side-by-side compare, scheduled photo days, encrypted private-by-default.
10. Retention & reach: Year in Review, shareable editorial cards, personalized monthly challenge (vs your own baseline), widgets + watch complications + Live Activity, **doctor-shareable PDF report**, hide-the-numbers mode, per-meal budgets, Big-Three tile, traffic-light scan verdict (derived, not moralized).

## 4. V2 — later

Real periodization engine (built on V1.x data), WHOOP-style journal→behavior-impact reports, sleep need (debt + strain), illness early-warning (vitals deviation), cycle tracking done properly, GLP-1/diabetes condition modes (with real research, or never), suggest-food-to-fill-remaining-macros, ingredients-on-hand generation, OCR of handwritten recipes, screenshot/PDF routine import, guided audio interval walks (RPE-based, scripted not filmed), restaurant menu coverage (AU investigation), running/race plans (one-knob pace model), BLE smart-scale support (auto user recognition), caregiver sharing, coach read-only portal, 1-v-1 friend competition / co-op quests, multi-recipe cooking mode, shoe-mileage tracker, offline-first sync (contracts exist in core-data).

## 5. Excluded — permanently

XP/levels/quests/mascots/streak-flames/confetti (Arise's lane), video workout content (a studio business), trainer-client platform features, kids mode, steps-for-cash, sweepstakes/medal economies, public social feed, camera rep counting (for now), quiz→paywall funnels, countdown timers, upsells to paying users, night-safety heatmaps (no data), loyalty-point currencies.

## 6. Monetization posture

Free forever: all manual logging, barcode, exercise library, timers, export. One visible price. Premium gates the expensive and the advanced: AI capture pipelines, adaptive engines' full depth, correlations + journal, route generation, doctor PDF, photo vault extras. Modeled on Hevy/MacroFactor/Flavorish honesty; explicitly rejecting MFP/WalkFit/BetterMe/Fitbod patterns.

## 7. The AI rule (applies to every feature above)

Capture → editable suggestion → confirm. Uncertain values marked "~". Formulas published ("algorithm, not black box"). Nothing auto-commits, nothing is hidden, nothing scolds.

---

## Milestone 1 (next concrete step)
Scaffold `apps/basalt` + `packages/ui` with the design tokens; wire targets + food logging + barcode + exercise DB + set logger against the new unified schema; Today/Log/Train shells from the prototype. That's a usable daily logger — everything after it compounds.
