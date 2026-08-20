# All-In-One Health App — Codebase Audit & Migration Plan

**Audited:** `ItsEliias/oathbound` (fitness-monorepo) + `ItsEliias/arise` (standalone) — August 2026
**Purpose:** Decide what to cherry-pick from both apps into the new non-gamified, all-in-one health app.

---

## 0. The three most important findings

**1. The two repos overlap — the monorepo is your real starting point.**
The `oathbound` repo is not just Oathbound. It's a pnpm monorepo (`fitness-monorepo`) containing **both apps** plus five extracted packages (`core-data`, `nutrition`, `health-connect`, `gamification`, `ui-primitives`). Its `apps/arise` is a current, squashed copy of the standalone `arise` repo, already rewired to import the shared packages. The Phase 0 extraction you (or a past session) did there is exactly the cherry-picking groundwork the new app needs — **~40% of the "clean engine extraction" work is already done.** Start the new app inside this monorepo as a third app, or fork the packages out.

**2. Your spec describes the aspiration, not the code.**
The feature matrix you wrote lists many engines that **do not exist in either repo**. Verified absent by exhaustive search:

| Claimed in spec | Reality |
|---|---|
| Barcode scanning + GS1 check-digit validation | Barcode is a manual `TextInput`. `expo-camera` is installed but imported **nowhere**. Zero GS1/checksum code. |
| Multimodal AI food capture (vision) | Text-only. `quickAddMeal()` sends a *description string* to Claude Haiku. No image input. |
| Adaptive progressive overload / mesocycle engine | **Fake.** "Mesocycle week" = `(workout count % 4) + 1`. Load advice = flat `best × 1.025` string. "Readiness" never reads HRV/sleep — it's a counter that only goes down. Advisory copy dressed as an engine. |
| RIR→RPE conversion, drop sets, rest timers | RIR is a raw number field. No conversion, no drop sets. One rest timer exists but reads from a 16-exercise hardcoded array. |
| Douglas-Peucker, pace smoothing, elevation | None. GPS stores every raw fix; pace is one division at stop time. |
| Sleep stage persistence | Read-only. Health Connect returns real stages; `sleep_logs` has no stage columns — stages are dropped. The sleep screen **fabricates** stages from fixed fractions when HC data is absent. |
| Pearson correlations, 14/30/90-day trends | Zero statistical code in either repo. The Trends screen is 100% hardcoded mock data. |
| Progress photo vault | Does not exist. |
| JSON/CSV export + wipe | Export is an `Alert.alert("check your email in 24h")` — no file is ever generated. Wipe deletes only 4 of ~20 tables. |
| Meal planner + grocery list | Planner = 8 hardcoded meals in a screen. Grocery list = deduped ingredient strings, no quantities, no unit math. |
| Fraction/unit converter | Tokenizes `½ cup` but never converts. No ml/g/oz table anywhere. |
| iOS HealthKit provider | Stub only. iOS silently returns zeros. |
| Favorites/recents (foods) | Not implemented. No table, no action. |

This isn't a criticism — it means the migration plan must be honest about **build vs port**. Roughly: **~50% port, ~50% build.**

**3. The gamification entanglement is much lighter than feared.**
Structurally, health tables and gamification tables share **zero foreign keys** — you can drop every RPG/social table and all health data survives. The XP coupling lives almost entirely at the *screen* layer: one hook (`useHealthLogXP`) called from 6 screens, plus ~15 direct `awardXPAndSync` calls in legacy screens, plus exactly **two service-level infections** (`diaryService.ts:80-81` and `socialService.ts:200`). Every modern health service is already XP-free. Cherry-picking is cheap.

---

## 1. Migration map

### Tier A — Lift wholesale (clean, `Result<T>`-typed, zero gamification imports, mostly tested)

| Asset | Location | Notes |
|---|---|---|
| **Health Connect provider** | `packages/health-connect/` (873 lines + types + stub + origin labels) | **The crown jewel.** 28 record types: HRV (rMSSD), SpO2, RHR, VO2max, glucose, body temp, blood pressure, respiratory rate, 4-part body composition, floors, elevation, speed, power, cadence, sleep sessions w/ stages, nutrition, hydration. Provider-interface architecture means HealthKit is a one-file drop-in. ⚠️ Zero tests; manifest declares only 1 of 28 permissions — fix both. |
| **Nutrition package** | `packages/nutrition/` | `food.ts` (CRUD, HC meal import), `water.ts` (HC dedupe w/ injected storage), `open-food-facts.ts` (barcode + name lookup), `recipe-import.ts` (JSON-LD scraper w/ `@graph` handling, ISO durations, vulgar fractions, confidence score). 40 tests. |
| **core-data package** | `packages/core-data/` | `Result<T>`, dates, Supabase client factory, daily-log parent, **local-first sync contracts** (interfaces + orchestrator, no impl yet). 27 tests. |
| **Target engine** | `apps/arise/src/services/targetsService.ts` | Mifflin-St Jeor (with intersex averaging), 5-level activity multipliers, goal deltas, macro splits, `MIN_SAFE_CALORIES = 1200` floor, profile-migration helpers. Pure functions. |
| **Exercise DB** | `exercises` table DDL + `scripts/seedExercises.ts` + `exerciseService.ts` | free-exercise-db, idempotent upsert, GIN-indexed muscle search, ILIKE injection escaping. |
| **Thin health services** | `stepService`, `sleepService`, `weightService`, `meditationService`, `habitService`, `walkService`, `workoutService` | All clean. Each has documented schema gaps (below) — the services are fine, the tables are the bottleneck. |
| **Streak computation** | `streakService.ts` | Computed-not-stored streaks over real log tables. Keep as a neutral "consistency" metric even without gamification. |
| **GPS capture core** | `AriseWalkTrackerScreen.tsx:65-195` | The state machine (`checking→denied→services_off→ready→tracking→saving→summary→error`), 30m accuracy filter, 3m jitter filter, haversine math. Extract to a service; the screen itself is themed. |
| **"Real-or-hidden" vitals pattern** | `AriseVitalsMatrixScreen.tsx` | Permission-gated tiles: no grant → CONNECT state, never a fake zero. Take the pattern, rebuild the screen. |

### Tier B — Lift with surgery

| Asset | Surgery required |
|---|---|
| Oathbound's **`set_entry` relational schema** (`apps/oathbound/src/db/schema.ts`) | This is a genuinely better strength model than Arise's `workout_logs.exercises` jsonb blob: real per-set rows, RPE 0–10 check constraint, zones, 12 constraint tests. Port the *shape* to Postgres; drop `unlock_rule`, `trial`, stat tables. |
| Hydration formula (`phase9WellnessService.ts:124`) | `weightKg × 32 + step-based activity bonus + goal modifier, clamp 1600–3600` — exactly your spec's formula. Extract the function, delete the RPG copy around it. ⚠️ The live water screen currently ignores it (hardcoded 2000ml) — wire it up properly. |
| Meal quality scorer (`phase9WellnessService.ts:244`) | The protein-density/fiber/calorie-fit skeleton is reasonable; the regex fiber-guessing and "Elite fuel" labels are not. Replace constants with a defensible standard or drop it from v1. |
| AI quick-add (`claudeService.ts`) | The flow is right; the implementation ships an **Anthropic API key in the client bundle** (`EXPO_PUBLIC_CLAUDE_API_KEY`). Move behind a Supabase Edge Function. Add vision input there too. |
| Recipe heuristic text parser (`phase11LiveCapabilityService.ts:115`) | Deterministic ingredient/step splitter — useful as the no-network fallback tier. Strip the themed output. |
| `ui-primitives` package | Keep the token-based ThemeProvider *pattern* (it's genuinely theme-agnostic); write the component library fresh — it's only ~250 LOC and has no Button/Input/Card. |

### Tier C — Build from scratch (nothing usable exists)

Camera barcode scanning + GS1 validation · vision food capture · favorites/recents · unit/fraction conversion engine · grocery list with quantity aggregation · persisted meal planner (`meal_plans` table) · recipe Supabase persistence (currently AsyncStorage-only) · real progressive overload engine · RIR→RPE, supersets (dead field), drop sets, proper rest timers · route simplification/pace smoothing/elevation · step goals · sleep stage persistence · correlations + rolling trends analytics · progress photo vault · JSON/CSV export + complete wipe · breathing pacer (only a countdown timer exists) · **iOS HealthKit provider** · offline-first sync implementation (contracts exist, no impl).

### Tier D — Leave behind

All of `packages/gamification`, `rpgService`, quest/achievement/companion/guild/social/shop/battle services and screens (~95 of 130 Arise screens), `useHealthLogXP`, the phase9/10/11 "advisory text" services, `healthProviderAdapter.ts` (fiction — hardcoded provider capabilities), `diaryService.ts` (legacy XP-infected write path), `utils/tdee.ts` (older divergent duplicate of targetsService), the entire Gen-1 screen tree, all Bevel/Ornate/Glow/Rarity components, `AriseHealthTrendsScreen` + `AriseMacroCalculatorScreen` (pure mocks — one has a hardcoded 175cm height).

---

## 2. Known landmines (fix these regardless)

1. **Anthropic API key in the client bundle** — `EXPO_PUBLIC_CLAUDE_API_KEY`. Anyone can extract it from the APK. Server-side proxy, day one.
2. **Health Connect manifest declares 1 of 28 permissions** (`app.json` has only `READ_STEPS`) — 27 of 28 readers fail at runtime today.
3. **`walks` table was never created** — the DDL lives in a code comment; GPS saves fail silently.
4. **Two parallel write paths to the same food tables** (`packages/nutrition/food.ts` vs legacy `diaryService.ts`) and two calorie engines with different constants. The new app must have exactly one of each.
5. Dead deps to not carry over: `victory-native`, `expo-sqlite`, `netinfo`, `nativewind`/`tailwind` (declared, never wired), `i18next` (vestigial).
6. `arise` has **zero runnable tests** and a `test` script that fails by design (43 pinned TS errors). The monorepo packages have 189 green tests — build on those.

---

## 3. Unified schema proposal (Postgres / Supabase)

Principles: no gamification columns anywhere; per-set and per-stage data in real rows, not jsonb; every synced row carries `source`; `unique(user_id, date)` on daily rollups; RLS `auth.uid() = user_id` everywhere (already the pattern).

**Identity & targets**
- `profiles` — id(=auth.users), name, biological_sex, birthdate, height_cm, activity_level, goal_type, goal_weight_kg, weekly_target_kg, equipment, dietary_flags[], use_metric, language. *(Drop: mascot_type, streak, is_premium, trial_used.)*
- `targets` — user_id, effective_date, calories, protein_g, carbs_g, fat_g, fiber_g, water_ml, steps, sleep_min. *(Versioned rows instead of columns-on-profile → historical charts stay honest when targets change.)*

**Nutrition**
- `food_entries` — as today (it's good: 12+ nutrients, vitamins/minerals jsonb, barcode, source) **plus** `ext_id`/`ext_source` (fixes the HC-meal dedupe heuristic flagged in `foodService.ts`).
- `food_favorites` — user_id, snapshot of a food entry, use_count, last_used_at. *(New — powers 1-tap re-logs and recents.)*
- `recipes`, `recipe_ingredients` (qty numeric, unit, name, aisle), `recipe_steps` — *(new; today recipes live only in AsyncStorage).*
- `meal_plans` — user_id, date, meal_slot, recipe_id | food_snapshot. *(New.)*
- `grocery_lists` / `grocery_items` — consolidated qty + unit, aisle, checked. *(New.)*

**Training** *(port Oathbound's shape)*
- `workout_sessions` — user_id, started_at, ended_at, notes, source.
- `session_exercises` — session_id, exercise_id→exercises, order, superset_group.
- `set_entries` — session_exercise_id, set_number, reps, weight_kg, rir, rpe (check 0–10), is_dropset, rest_s.
- `exercises` — as today, unchanged. *(Drop `workout_logs.xp_earned` with the old table.)*

**Movement & recovery**
- `walks`/`activities` — actually created this time; route jsonb (simplified before insert), distance_m, duration_s, elevation_gain_m, avg_pace.
- `step_logs`, `weight_entries`, `wellbeing_logs` — as today.
- `sleep_sessions` — user_id, date, bedtime, waketime, quality, source. **`sleep_stages`** — session_id, stage(deep|light|rem|awake), start, end. *(Fixes the flagged gap; HC already returns this data.)*
- `hydration_logs` — user_id, ts, ml, source, ext_id. *(Own table replaces `daily_logs.water_ml` counter → fixes the AsyncStorage-dedupe fragility and enables time-of-day charts.)*
- `mindfulness_sessions` — own table at last (currently hijacks `workout_logs`).
- `progress_photos` — user_id, taken_at, storage_path (private bucket), pose_tag.

**System**
- `export_jobs` — actually wired to a generator this time. Complete cascade-delete wipe function covering every table.

**Drop entirely:** `rpg_profiles`, `user_inventory`, `user_achievements`, `companion_unlocks`, `player_loadout`, `guilds*`, `friendships`, `challenges`, `leaderboard_snapshots`, `dailies`, `daily_completions`, and the `xp_value`/`hp_loss` columns on habits. Nothing references them.

**Architecture note:** both apps are online-only Supabase today (the `expo-sqlite` dep is unused). `core-data/sync.ts` already defines clean local-first contracts (`OutboxStore`, `RemoteSync`, `syncOnce`) with tests against fakes. Recommendation: v1 ships Supabase-direct like today (known quantity), with all writes going through the service layer so the outbox can be slotted in at v1.x without touching screens.

---

## 4. The v1 cut

**Thesis:** the differentiator is *coherence* — training, food, and recovery in one ledger, with honest analytics. Ship the pillars that share data; defer the ones that don't.

### v1 — "The Ledger" (mostly porting + schema work)
1. **Nutrition:** manual add, OFF barcode lookup **with a real camera scanner** (expo-camera + GS1 check digit — small, well-specified build), favorites/recents, AI quick-add via Edge Function, dynamic targets (port `targetsService`).
2. **Training:** exercise library (port), new relational set logger (Oathbound schema) with RIR, supersets, rest timers.
3. **Recovery:** hydration (port + wire the real formula), sleep with stage persistence, weight/measurements, wearable sync (port health-connect pkg, fix manifest), vitals dashboard with the real-or-hidden rule.
4. **Analytics v0:** 7/30-day rolling trends only — honest, no correlations yet.
5. **Trust layer:** working JSON/CSV export, complete wipe, no fake data anywhere.

### v1.x
Correlations engine (Pearson w/ |r|≥0.45 + overlap gating), 90-day windows, progress photos, step goals, GPS activities with route simplification, breathing pacer, HealthKit provider (this is what unlocks iOS — schedule it early if iOS matters).

### v2
Real progressive overload engine (the current one must be rebuilt from zero — design it around actual per-set history + readiness inputs, which the new schema finally makes queryable), recipe scraper UI + persisted recipes, meal planner + unit-aware grocery lists, offline-first sync.

### Explicitly rebuild-not-port
The mesocycle/readiness engine, trends screen, meal planner, grocery list, macro calculator screen, export flow — every one of these is currently a mock or a fake, and porting them would smuggle dishonest surfaces into an app whose whole identity is honesty.

---

## 5. Suggested repo strategy

Work inside the existing monorepo — it's already shaped for this:

```
fitness-monorepo/
  packages/
    core-data/        ← keep (add outbox impl later)
    health-connect/   ← keep (add tests, HealthKit sibling)
    nutrition/        ← keep (add favorites, units, grocery)
    training/         ← NEW (set_entry model, overload engine later)
    analytics/        ← NEW (trends now, correlations v1.x)
    gamification/     ← untouched; the old apps still use it
    ui/               ← NEW editorial design system (token pattern from ui-primitives)
  apps/
    arise/            ← frozen
    oathbound/        ← frozen
    <newapp>/         ← the all-in-one app
```

This keeps Arise and Oathbound alive, lets the new app consume the proven packages directly, and means every engine you harden benefits from the 189 existing tests. One prerequisite chore: unify TypeScript (arise is on 6.0, everything else 5.7) and make root `pnpm test` green by excluding arise's stopgap script.
