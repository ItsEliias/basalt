# Basalt — Claude Code Kickoff Prompt

Paste this (or point Claude Code at this file) when starting the build. The five reference files ship alongside it.

---

## Repo & environment setup (first, before any code)

**Basalt gets its OWN repository, seeded from the existing monorepo.** The source code to harvest lives in `ItsEliias/oathbound` (a pnpm monorepo, workspace name `fitness-monorepo`, containing `apps/arise`, `apps/oathbound`, and `packages/*`) and `ItsEliias/arise` (standalone; the monorepo's `apps/arise` is a current copy — prefer the monorepo). Steps:

1. Clone `ItsEliias/oathbound` into a temporary directory as the **source quarry** — read-only, never pushed to.
2. Create the new repository with `gh repo create ItsEliias/basalt --private` and scaffold it as its own pnpm workspace:
   ```
   basalt/
     app/            Expo/React Native app (Expo ~56 stack, same as arise)
     packages/
       core-data/    vendored from the quarry (Result<T>, dates, client factory, sync contracts + their tests)
       health-connect/  vendored from the quarry (all 5 files + types; add tests, full 28-permission manifest)
       nutrition/    vendored from the quarry (food, water, OFF client, JSON-LD recipe import + tests)
       training/     NEW — set_entry relational model (port the SHAPE from the quarry's apps/oathbound/src/db/schema.ts to Postgres; drop unlock/trial/stat tables)
       analytics/    NEW
       ui/           NEW — design tokens per the design contract (token-provider pattern may be referenced from the quarry's ui-primitives; write components fresh)
     reference/      (optional, gitignored) selected quarry files kept locally for porting reference — e.g. apps/arise/src/services/targetsService.ts, streakService.ts, the GPS logic in AriseWalkTrackerScreen.tsx, exerciseService.ts + scripts/seedExercises.ts
     docs/           this kickoff prompt + the five reference docs, committed
   ```
3. **Vendor, don't link:** copy package source + tests in; Basalt's copies evolve independently. Preserve original license headers if present. Never import from the quarry path.
4. Create a fresh root `CLAUDE.md` for the Basalt repo: Basalt is the only app here; `docs/basalt-design-spec.md` is the binding UI contract; honesty rules are product law; prototype is visual truth; the forbidden-list is absolute; tests required for every ported/new engine.
5. Basalt also needs its **own new Supabase project** (fresh schema per the migration report §3 — no gamification columns; RLS everywhere). Do not point Basalt at Arise's Supabase project.
6. Branch discipline: `m1-<topic>` branches, PR into `main`, never force-push main.

**Consequence to accept knowingly:** vendoring forks the engines — fixes no longer flow automatically between Basalt and Arise. The week-one chores below therefore apply to **Basalt's vendored copies**; the same fixes should be applied to the Arise/monorepo repos separately (a small standalone task, not part of this build).

## The task

Build **Milestone 1** of Basalt, a non-gamified all-in-one health app, in its own new repository (`ItsEliias/basalt`), seeded from the existing monorepo per the setup section above.

Read these, in this order, before writing code:
1. `basalt-master-roadmap.md` — the plan of record: scope, phasing, architecture, week-one chores.
2. `basalt-design-spec.md` — the **binding UI contract**: tokens, components, interaction + honesty rules, forbidden list.
3. `basalt-app-prototype.html` — the visual source of truth (v11.1). Open it in a browser at ~390px width. When spec and prototype disagree, the prototype wins.
4. `health-app-migration-report.md` — what ports from Arise/Oathbound, with file paths, and what is fake and must be rebuilt.
5. `basalt-feature-adoption-matrix.md` — per-feature detail when implementing anything specific.

## Milestone 1 scope (from the roadmap)

1. **Week-one chores first, applied to Basalt's vendored code:** AI calls via Supabase Edge Function only (no client-side Anthropic key, ever); full Health Connect manifest (all 28 permissions); `walks` table in the schema from day one; exactly one food write-path and one target engine (do not vendor `diaryService.ts` or `utils/tdee.ts` — they're the legacy duplicates); one TypeScript version; green `pnpm test` from the first commit.
2. Scaffold `app/` (Expo/React Native: Expo ~56, React Navigation, Zustand, Supabase) and `packages/ui` (design tokens per the design contract).
3. New unified Postgres schema per the migration report §3 (profiles, versioned targets, food_entries+ext ids, food_favorites, workout_sessions/session_exercises/set_entries from Oathbound's model, walks, sleep_sessions+sleep_stages, hydration_logs, mindfulness_sessions — **no gamification columns anywhere**).
4. Wire the Tier-A engines: `targetsService` (as day-1 seed for the adaptive TDEE loop), `packages/nutrition` (food CRUD, Open Food Facts, hydration with the real bodyweight formula), `packages/health-connect`, exercise DB + seeder, streak computation.
5. Build the V1 surfaces from the prototype: 8-step onboarding (multi-goal, conditional equipment, all of it) → Today (hero energy, macros + caps with over-state, receipt, tiles) → Log/Capture (camera barcode + GS1 check digit, manual add, favorites) → Train/Session (relational set logger, Prev column, RIR, rest timers, guided set timer) → Settings (profile editing, export, full-cascade delete). Quick-log (+) sheet. Recover/Trends shells can be static-but-honest (real data or real empty states) in M1.

Definition of done: a person can onboard, get computed targets, log food by barcode and manually, log a strength session with timed exercises, see Today reflect all of it truthfully, edit everything in Settings, export their data, and delete their account completely.

## Hard constraints

- UI: follow `basalt-design-spec.md` exactly — tokens, mono numerals, hairlines, receipt rows, real-or-hidden empty states. The forbidden list (rings, glow, mascots, confetti, XP…) is absolute.
- Honesty rules are product law: no fake data, no placeholder zeros, `~` on unconfirmed AI values, over-caps stated plainly, sources shown on synced data.
- Every write goes through the service layer (`Result<T>` pattern from `packages/core-data`) so offline-outbox can slot in later.
- No secrets in the client bundle. RLS `auth.uid() = user_id` on every table.
- Arise and Oathbound apps must keep building — shared-package changes need their tests green.
- Write tests for the engines you port or build (the monorepo has 189 passing package tests — extend that, don't regress it).
- CTA-reachability: intake/onboarding screens must keep their primary button on-screen at all common viewport heights (this bug already happened once — test for it).

## Naming

App: **Basalt** (store name "Basalt: Health & Fitness", subtitle "Food, training, sleep, vitals"). Internal codename LEDGER may appear in older docs — same product.
