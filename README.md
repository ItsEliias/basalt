# Basalt

**A non-gamified, honesty-first health ledger for Android** — food, training, sleep and vitals in one place, so the numbers can talk to each other.

## Overview

Most health and fitness apps compete on engagement: streak pressure, XP, mascots, confetti, AI-narrated "insights," and gamified everything. Basalt is a deliberate rejection of that model. It's a **ledger, not a game** — a single place to log food, training, sleep and vitals where every number is either real or plainly marked as missing, every formula behind a target or suggestion is published and visible, and AI is allowed to *propose* things (a meal, a set, an adjustment) but never to *narrate* or score your day.

The project grew out of the **Arise** app (an earlier, more gamified AI health concept — the shared Supabase project is still literally named `Arise \ Basalt`) but has since diverged into its own product with an opposite design philosophy. Where Arise leaned into game mechanics, Basalt's product law is "honesty over engagement": no fake data, no placeholder zeros, unconfirmed AI values are marked with `~` and rendered as ranges, over-target numbers are stated plainly ("41 / 36 g · 5 over") and never scolded, every synced datum shows its source, capture is never paywalled, and manual entry is always enough — no feature requires AI or a sensor to work.

The in-app "About" screen states the promise verbatim:

**What it does**
- Builds a training programme and meal plan from your own numbers — your equipment, your week, your history.
- Shows the maths behind every target, suggestion and adjustment. Nothing is a black box.
- Corrects itself weekly against your trend weight — one bounded change at a time, with the reason attached.

**What it doesn't**
- See your form — a phone can count sets, not watch your spine.
- Tell muscle from fat on the scale — the trend is honest, its composition isn't knowable from a phone.
- Diagnose anything — pain flags count, they never conclude.
- Replace a professional for injuries, eating disorders or medical conditions.

Every published formula (readiness, progression, correlations, sleep need/debt, target maths) is also rendered as a standalone page, generated from the same constants the app compiles against, at basalt.itseliias.com/formulas.

## Key Features

Verified against the current source tree (`app/src`, `packages/*/src`):

- **Core ledger** — food/water diary, training sessions (`set_entry` → `session_exercises` → `sessions`), sleep & vitals capture, all going through a single service layer per domain (one food write path, one target engine).
- **Multi-modal capture** — barcode/label scan (Open Food Facts + GS1), photo-to-meal (AI proposes items with portion ranges), voice logging (on-device transcription), and a manual plate builder — all commit as ordinary log entries, none gated behind a paywall.
- **Published-formula targets** — BMR (Mifflin–St Jeor), activity factor derived from real step/session history when it's earned (±20% banded), goal-rate rails with floors/"slow down" caps; every number a range with the midpoint shown and the working one tap away (`packages/nutrition/src/targets.ts`, `activity-factor.ts`).
- **Deterministic programme generator** — takes a PT-style intake (experience, days/week, minutes, equipment, limitations) and outputs a split with sets/reps/rest/starting loads; knee pain caps squat-pattern difficulty, bodyweight-only progresses by reps, unfixable volume gaps are stated rather than hidden (`packages/training/src/programs.ts`, `progression.ts`, `condition-bias.ts`).
- **Weekly check-in / adaptation engine** — reads the week (safety → adherence → energy → volume, in that published priority), states the facts, and proposes exactly one bounded change; illness never counts against adherence (`packages/training/src/adapt-session.ts`, `packages/analytics/src/week-review.ts`).
- **Analytics engines** — readiness score, training progression, cross-metric correlations, sleep need/debt, streaks (two automatic weekly freezes), year-in-review, all in `packages/analytics/src`.
- **Health Connect integration** — a 28-record-type provider architecture for syncing steps, workouts, sleep, heart rate, etc. from Android Health Connect (`packages/health-connect`), plus a stub provider for tests/dev without a device.
- **Wearable/service imports** — Strava, Garmin and Oura connections with explicit source attribution on every synced value; sessions and sleep are imported, never edited (`app/src/lib/connectedServices*.ts`).
- **Pebble** — an optional (off-by-default) companion that only *proposes*, never comments on completed activity; **Pebble Coach** answers questions about your own numbers, citing exactly which numbers it used and proposing at most one action, with a hard-coded crisis-detection path that runs before anything else on every free-text field and never leaves the device.
- **Eleven UI themes** (Minimal, Humanist, Athletic, Brutalist, Depth, Atelier, Clay, Gummy, Soft, Sticker, Candy Rings) sharing one token contract, contrast-verified in CI (4.5:1 text / 3:1 marks) via a rendered-tree contrast walker; motion is themed too (Minimal snaps, Gummy springs) and respects Android's "Remove animations" (`packages/ui/src/tokens.ts`, `tokens.test.ts`).
- **Three detail levels** (Simple / Standard / Full) — same engines, same numbers, different amount shown; a conformance test pins that Simple's numbers are a subset of Standard's are a subset of Full's.
- **Extras registry** — every optional feature (streaks, XP/levels/badges, friends & challenges, meal planning + grocery list, fasting timer, hydration reminders, supplements checklist, cycle tracking, progress photos, journal, wind-down, meditation timer, and more) is off by default and driven from a single registry the app compiles against, so the in-app feature list can't drift from what's actually implemented (`packages/extras`).
- **Home-screen widgets** — Today (macros) and Readiness widgets via `react-native-android-widget` (`app/src/widgets`).
- **Outbox-based offline sync** — every write goes through a `Result<T>` service layer that queues into an offline outbox for replay (`app/src/lib/outbox.ts`, `packages/core-data/src/sync.ts`).
- **Full data portability** — JSON/CSV/per-table zip export and a doctor-report PDF; account deletion is a true cascade across every `basalt_`-prefixed table plus storage (`app/src/lib/exportData.ts`, `doctorReport.ts`).
- **AI features run server-side only** — recipe ideas, quick-add parsing, daily summary text, photo-food recognition, Pebble Coach and social recipe import are all Supabase Edge Functions; no AI provider keys ever ship in the client (`supabase/functions/*`).

## Tech Stack

**Mobile app** (`app/`)
- **React Native** 0.85.3 on **Expo** ~56.0.5 (dev client), **React** 19.2.3, TypeScript ~5.7
- **React Navigation** 7 (bottom-tabs, native, stack)
- **Zustand** 5 for client state (`app/src/state`)
- **Supabase JS** ^2.106.2 client
- Native/Expo modules: `expo-camera`, `expo-image-manipulator`, `expo-speech-recognition`, `expo-notifications`, `expo-background-task`/`expo-task-manager`, `expo-file-system`, `expo-print`/`expo-sharing`, `expo-audio`
- `react-native-vision-camera` 4.7.3 (patched via pnpm `patchedDependencies`), `react-native-ble-plx` (Bluetooth scale support), `react-native-health-connect` (Android Health Connect), `react-native-android-widget` (home-screen widgets), `@maplibre/maplibre-react-native` (route maps), `react-native-svg`
- Eleven Google Fonts families (Nunito, Barlow, Archivo, Manrope, Jost, IBM Plex Mono, Cormorant Garamond, Baloo 2, Lilita One, Poppins, Fredoka) loaded via `@expo-google-fonts/*` — the core set loads at startup, five expressive-theme typefaces (Baloo 2, Lilita One, Poppins, Fredoka, plus Nunito's black weight) lazy-load on theme switch to keep Minimal's first paint light
- **Vitest** 4 for unit tests, TypeScript `tsc --noEmit` for type checking

**Shared packages** (`packages/*`, pnpm workspace, all TypeScript + Vitest)
- `core-data` — `Result<T>` pattern, date helpers, Supabase client factory, sync/outbox contracts, crisis-detection logic
- `nutrition` — food CRUD, Open Food Facts + GS1 barcode lookups, JSON-LD recipe import, meal planning, fasting, hydration
- `training` — session/set model, programme generation, progression, GPS/route matching, tile caching for offline maps
- `analytics` — readiness, correlations, sleep need/debt, streaks, weekly/yearly reviews
- `health-connect` — 28-record-type Android Health Connect provider + manifest
- `ui` — design-token contract and themed components
- `extras` — the feature registry described above

**Backend** — **Supabase** (project `ezsrwwfieihelfekgclz`, shared with the Arise app; every Basalt table is `basalt_`-prefixed and isolated by `auth.uid() = user_id` row-level security). 37 SQL migrations under `supabase/migrations`. Ten Edge Functions (Deno) under `supabase/functions`: `ai-quick-add`, `ai-recipe-ideas`, `ai-daily-summary`, `ai-photo-food`, `pebble-coach`, `social-recipe-import`, `route-loop`, `oauth-exchange`, `delete-account`, `beacon`.

**Package management** — pnpm 10.34.5 workspace (`app` + `packages/*`).

## Architecture

```
basalt/
├── app/                     Expo/React Native app (the only shipping target)
│   ├── App.tsx              Root component, navigation + provider wiring
│   ├── src/
│   │   ├── screens/         Today · Log · Train · Recover · Trends · Settings · Onboarding · Auth
│   │   ├── components/      Cross-screen UI (TabBar, sheets, cards, crisis screen)
│   │   ├── state/           Zustand stores (appStore, sessionStore)
│   │   ├── lib/             Domain logic that isn't a "package": exports, notifications,
│   │   │                    Pebble, outbox, health sync glue, connected services, etc.
│   │   ├── widgets/         Android home-screen widgets (Today, Readiness)
│   │   └── motion/          Theme-driven motion/animation tokens
│   └── android/             Native Android project (Gradle)
│
├── packages/                Vendored, independently-versioned workspace packages
│   ├── core-data/           Result<T>, dates, Supabase client, sync, crisis logic
│   ├── nutrition/           Food, water, recipes, fasting, meal planning
│   ├── training/            Sessions, sets, programmes, progression, GPS
│   ├── analytics/           Readiness, correlations, streaks, reviews
│   ├── health-connect/      Android Health Connect provider (28 record types)
│   ├── ui/                  Design tokens + themed components (11 themes)
│   └── extras/              The single source of truth for optional features
│
├── supabase/
│   ├── migrations/          37 SQL migrations (basalt_-prefixed schema, RLS)
│   └── functions/           10 Deno Edge Functions (all AI + privileged operations)
│
├── docs/                    Binding product/design docs (see below) + phase reports
├── scripts/                 Seed data, formula-page generation, offline evals
└── reference/               Gitignored — old-monorepo files kept for porting reference only
```

**Data/control flow**: UI screens call into the `packages/*` service layer, which returns `Result<T>` rather than throwing. Every write additionally enqueues into the offline outbox (`app/src/lib/outbox.ts`) so it can replay once connectivity returns. Reads/writes go straight to Supabase Postgres under RLS (`auth.uid() = user_id` on every `basalt_` table). Anything requiring a secret — AI calls (quick-add parsing, recipe ideas, photo-food, daily summary, Pebble Coach), OAuth token exchange, or account deletion — is routed to a Supabase Edge Function; the client only ever holds the project URL and a publishable key.

Two documents are the binding contracts for anyone changing the app (see `CLAUDE.md` at repo root for the full list of product laws):
- `docs/basalt-design-spec.md` — the UI/token contract.
- `docs/basalt-app-prototype.html` — the pixel-level visual source of truth; wins over the spec if they disagree.

## Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/ItsEliias/basalt.git
   cd basalt
   ```
2. **Install dependencies** (pnpm workspace — installs `app/` and every `packages/*`)
   ```bash
   pnpm install
   ```
3. **Configure environment variables.** Copy `app/.env.example` to `app/.env` and fill in your own Supabase project's client-safe values (never the service-role key):
   - `EXPO_PUBLIC_SUPABASE_URL` — your Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — the publishable ("anon") key only
   - `EXPO_PUBLIC_TILE_URL` / `EXPO_PUBLIC_TILE_ATTRIBUTION` — optional; a licensed map tile provider for route maps (falls back to dev CARTO tiles when unset)

   The Supabase project itself needs the schema applied from `supabase/migrations/` and the Edge Functions in `supabase/functions/` deployed; AI-backed functions additionally need their own provider keys set as Supabase function secrets (never in the app).
4. **Run the dev client**
   ```bash
   cd app
   npx expo start
   ```
   (Several native modules — camera, BLE, Health Connect, vision camera — mean this app needs a custom dev client / EAS build rather than plain Expo Go.)

## Running It

From the repo root (pnpm workspace scripts):

| Command | What it does |
|---|---|
| `pnpm install` | Installs all workspace dependencies (app + every package) |
| `pnpm test` | Runs `test` in every workspace package — must stay green before any commit |
| `pnpm seed:test-account` | Seeds a test account's data via `scripts/seedTestAccount.ts` |
| `pnpm eval:quick-add` | Offline eval harness for the AI quick-add parser (`scripts/eval/quickAddEval.ts`) |
| `pnpm eval:recipe-ideas` | Offline eval harness for the AI recipe-ideas function |
| `pnpm eval:sharing-rls` | Probes the row-level-security rules on the sharing feature |

From `app/`:

| Command | What it does |
|---|---|
| `npx expo start` | Starts the Expo dev server / dev client |
| `pnpm android` / `pnpm ios` | Builds and runs the native dev client on a device/emulator |
| `pnpm test` | `tsc --noEmit` (type check) followed by `vitest run` (unit tests) |

Release build: `cd app/android && ./gradlew bundleRelease` produces the Play Store AAB.

Each package under `packages/*` also exposes its own `pnpm test` (`vitest run`), invoked collectively by the root `pnpm test`.

## Project Structure

| Path | Purpose |
|---|---|
| `app/App.tsx` | App entry: navigation shell, providers (theme/extras/detail level) |
| `app/src/screens/` | One folder per tab (today, log, train, recover, trends, settings) plus onboarding/auth |
| `app/src/lib/` | Non-UI domain glue: outbox, exports, notifications, Pebble, connected services, doctor-report generation |
| `app/src/state/` | Zustand stores |
| `app/src/widgets/` | Android home-screen widget components + native handler |
| `packages/core-data/` | Result type, Supabase client factory, sync/crisis logic — the foundation every other package depends on |
| `packages/nutrition/`, `training/`, `analytics/`, `health-connect/` | Domain engines, each independently tested |
| `packages/ui/` | Design-token contract (`tokens.ts`) and the 11-theme system |
| `packages/extras/` | Registry that drives the in-app "Extras" list and settings |
| `supabase/migrations/` | Postgres schema history (37 migrations) |
| `supabase/functions/` | Edge Functions — every AI call and privileged operation |
| `docs/basalt-design-spec.md` | Binding UI/token contract |
| `docs/basalt-app-prototype.html` | Pixel-accurate visual source of truth (v11.1) |
| `docs/DECOMMISSION.md` | Plan for splitting off Basalt's own Supabase project from the shared Arise one |
| `docs/*-REPORT.md` | Dated development-phase reports (M1, V1–V4.1) — a running build log |
| `CLAUDE.md` | Repo-specific AI-assistant configuration: the full list of binding product/UI laws |
| `LICENSE` | Proprietary, all-rights-reserved notice |

## Status

**Closed testing, version 0.2.1** — actively and rapidly developed: 300 commits between 2026-08-20 and 2026-09-15, roughly 50,000 lines of TypeScript, and over 1,000 Vitest test blocks across the workspace. It is past prototype stage — there is a built Android App Bundle/APK in `app/android/` and Play Store listing assets in `docs/store-assets/` (see `PLAY-SUBMISSION-REPORT.md`, `SUBMISSION-CHECKLIST.md`) — and currently sits in pre-launch/closed-testing on Android. The backend still shares a Supabase project with the (paused) Arise app pending a documented decommission/split (`docs/DECOMMISSION.md`). In-app feedback (Settings → About → Send feedback) opens the user's mail app to itseliias@proton.me — nothing is sent silently.

## License

Proprietary — all rights reserved. See [`LICENSE`](LICENSE). The repository is publicly viewable for transparency (the honesty laws, published formulas, and privacy posture are meant to be auditable) but this does **not** grant any licence to use, copy, modify or redistribute the code, design, or assets. Contact: itseliias@proton.me.
