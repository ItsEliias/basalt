# Basalt

**A non-gamified, honesty-first health ledger for Android** — food, training, sleep,
and vitals in one place, so the numbers can talk to each other. No rings, no streak
shaming, no fabricated data: real numbers or a quiet empty state, always with a source.

Four claims, each verifiable:

- **Every formula is published.** Readiness weights, progression rules, sleep need and
  debt, correlation gates, deviation thresholds — all of it, generated from the same
  constants the app compiles against, at
  [basalt.itseliias.com/formulas](https://basalt.itseliias.com/formulas).
- **No streak shaming.** Streaks are rest-aware by a published rule: planned rest days
  and rest-advised days *maintain* a run and never start one. Missing a day is stated,
  never scolded.
- **AI proposes, never narrates.** Every AI estimate arrives as a range (`~480–720`),
  editable, unconfirmed until you say so — and no AI summary ever replaces your data.
  The evaluation harnesses that hold the AI to this are committed in this repo.
- **Readiness that doesn't require a wearable.** The readiness inputs come from
  whatever sources you actually have, each shown with its math — and a camera-based
  fingertip HRV measurement is in calibration, gated on agreeing with a reference
  wearable before it's allowed to feed anything. Optical wrist sensors fail on
  tattooed wrists; a camera and a published quality gate don't.

Internal codename **LEDGER** appears in older docs — same product.

## One app, six faces

The same Today screen in all six themes. Every theme is defined entirely through a
token contract — colour, type, shape, meter geometry, elevation — with zero component
branches (`packages/ui/src/theme/contract.ts`).

| | | |
|---|---|---|
| ![Today screen in the Minimal theme: near-black background, mono numerals, hairline rules](docs/readme-assets/theme-minimal.png) | ![Today screen in the Humanist theme: warm paper background, rounded cards, sentence-case labels in a humanist sans](docs/readme-assets/theme-humanist.png) | ![Today screen in the Athletic theme: high-contrast dark with bold condensed numerals and all-caps labels](docs/readme-assets/theme-athletic.png) |
| ![Today screen in the Brutalist theme: off-white paper, heavy black card borders, bold grotesque numerals](docs/readme-assets/theme-brutalist.png) | ![Today screen in the Depth theme: blue-green aurora gradient over layered dark surfaces](docs/readme-assets/theme-depth.png) | ![Today screen in the Atelier theme: dark ink background with serif display numerals and brass accents](docs/readme-assets/theme-atelier.png) |

## Walkthrough

Everything below is the Minimal theme (the default), captured from the seeded 90-day
demo dataset via the repeatable pipeline in `scripts/readme-shots/`.

### Today

| | |
|---|---|
| ![Today in the Ledger layout: energy remaining hero, macro rows with targets, logged meals as receipt rows](docs/readme-assets/today-ledger.png) | ![Today in the Tiles layout: the same data as large glanceable tiles](docs/readme-assets/today-tiles.png) |

The day opens on energy remaining against your published target, macros with their
targets, and the day's entries as receipt rows. Two layouts — Ledger and Tiles — carry
identical data. Sections can be hidden (hiding is omission, never a locked placeholder);
the energy hero is the one anchor that always shows.

| | |
|---|---|
| ![Macros card where the sugar cap row reads over the cap, stated plainly with the excess amount](docs/readme-assets/today-overcap.png) | ![Today with hide-the-numbers on: entries listed, all numbers replaced by qualitative words](docs/readme-assets/today-hidden.png) |

Over a cap, the row says so — "64 / 55 g · 9 over" — and nothing scolds. And for
anyone who tracks better without numbers staring back, hide-the-numbers keeps
recording everything while the interface speaks qualitatively; the data stays in your
ledger and exports.

### Log

| | |
|---|---|
| ![The Log capture screen: barcode viewfinder with mode row for barcode, search, manual, AI and photo entry](docs/readme-assets/log-capture-modes.png) | ![The Tray mid-log: three items staged with a running total line before one commit](docs/readme-assets/log-tray.png) |

Five capture lanes — barcode, search, manual, AI text (typed or spoken via the OS),
photo — all ending in the same editable-before-save form. The Tray stages a multi-item
meal with a live running total and commits once. A favorite logs in two taps from app
open.

![An AI estimate showing calorie ranges before confirmation, with the often-forgotten companions card underneath](docs/readme-assets/log-ai-range.png)

AI estimates wear `~` and a calibrated range until you confirm — a true value inside
an honest range beats a tight wrong number, and the committed eval harness enforces
exactly that. The omissions card suggests commonly forgotten companions (oil,
dressing, the sugar in your coffee); nothing is ever auto-added.

### Train

| | |
|---|---|
| ![A training session: set table with previous performance, and a suggestion line stating its basis](docs/readme-assets/train-session.png) | ![The guided set timer running with phase and remaining time in large type](docs/readme-assets/train-guided.png) |

Sets land as their own rows with your previous performance beside them. Suggestions
state their basis — including the mesocycle phase and, when history supports it, the
percentage-of-training-max math ("72.5 kg = 85% of TM 85 kg") — and every suggestion
says what it is: a suggestion, never a mandate.

| | |
|---|---|
| ![Plate calculator showing per-side plates and the warm-up ramp sets](docs/readme-assets/train-plates.png) | ![The rep-PR matrix: best weight at each rep count as a grid](docs/readme-assets/train-pr-matrix.png) |

| | |
|---|---|
| ![Walk start screen with GPS accuracy and a weather line: temperature, wind, sunset](docs/readme-assets/walk-ready-weather.png) | ![A saved walk expanded in the recent list: route map with distance, duration, pace and elevation — the dev basemap tiles carry an API-key watermark pending a production tile key](docs/readme-assets/walk-summary.png) |

Walks record with honest GPS filters (bad fixes rejected, jitter never inflates
distance). The start screen shows the weather from your rounded coordinates only;
saved walks carry the route, per-km splits, and an attribution line that also states
what the map can't do yet — the current dev tiles are watermarked and don't permit
offline caching, and the card says so rather than hiding the map. Guided interval
walks cue by vibration first, talk-test effort language second, and never a pace
target.

![A shareable walk card with the route drawing and stats on a dark background](docs/readme-assets/share-card.png)

### Recover

| | |
|---|---|
| ![Readiness card tapped open, each component showing its literal arithmetic against your own baselines](docs/readme-assets/recover-readiness.png) | ![Sleep card with personal need, debt, suggested bedtime window and the bedtime variance line](docs/readme-assets/recover-sleep.png) |

Readiness opens into its own math — each component's ratio against your own baseline,
weights published. Sleep need is the median of your own nights (a stated default until
14 exist); naps credit the day without shrinking what a night is expected to be; debt,
a suggested bedtime window, and bedtime variance each carry their formula one tap away.
Sleep stages are display-only by law: they never enter any score or suggestion.

| | |
|---|---|
| ![The breathing pacer mid-session: a scaling square with phase label and elapsed time](docs/readme-assets/recover-pacer.png) | ![A mobility routine mid-hold: body figure with target regions highlighted, countdown, and cue text](docs/readme-assets/recover-mobility.png) |

The breath pacer is a scaling square (no rings here, even decoratively) with haptic
phase changes — fully usable silent. Mobility is three fixed routines, not a library;
the optional self-assessment only reorders emphasis, because a "mobility score" is a
trap this app refuses to build.

![The camera HRV tuning bench after a failed read: the captured waveform, a DISCARDED verdict naming its reasons — frame rate, clean-beat count, artifact fraction — and the quality row reading FAIL with the raw metrics](docs/readme-assets/recover-ppg.png)

Fingertip-over-camera HRV, in calibration. The quality gates are published (signal-to-
noise, clean beat count, artifact fraction) and a read that fails any of them is
discarded with the reasons named — never a shaky number. It feeds nothing until
side-by-side readings against a reference wearable earn it.

### Trends

| | |
|---|---|
| ![Correlations card reading zero past the gates, with every checked pair and its actual r value listed under checked-not-shown](docs/readme-assets/trends-correlations.png) | ![Monthly behavior report stating it lacks enough evening check-ins to report honestly](docs/readme-assets/trends-monthly.png) |

Correlations show only at published gates (|r| ≥ 0.45, n ≥ 30 days). In this capture
nothing clears the bar, and the card says so — then lists every pair it checked with
the real r values, because a dashboard that only shows hits is lying by omission.
The monthly report follows the same rule: short of its evidence threshold, it states
that instead of padding. Everything is labelled correlation, never cause.

![Week in Review: the week's facts in plain sentences with numbers](docs/readme-assets/trends-week-review.png)

### Settings

| | |
|---|---|
| ![Settings Display card: text size, density, six theme chips, Today layout, and section visibility toggles](docs/readme-assets/settings-display.png) | ![Sharing card: a coach grant with its domain list, and the claim-a-code field](docs/readme-assets/settings-sharing.png) |

Sharing is read-only grants by single-use code: pick the domains, hand over the code,
revoke with one hold — access dies at the other side's next query, enforced by the
database. Walk routes and sleep stages are never shared; cycle data only ever by its
own explicit grant.

![Export options: JSON, sectioned CSV, and a per-table archive](docs/readme-assets/settings-export.png)

Your data exports completely — every row of every table — in one tap. Deletion is a
verified server-side cascade of everything, and a schema-enumerating test fails the
suite if any table is ever missing from the wipe.

### Onboarding

| | |
|---|---|
| ![The onboarding goals step: six goal cards with sub-descriptions, two selected, and the copy stating plainly that conflicting pairs lean toward recomposition](docs/readme-assets/onboarding-goals.png) | ![The same goal choices reopened later from Settings as a sheet, with save-and-recompute-targets](docs/readme-assets/settings-goals.png) |

Onboarding asks only what it needs to compute your targets, every question is
skippable, and conflicting goals are resolved in the open ("lose weight + build
muscle leans the plan toward recomposition; we'll say so, not hide it"). Every answer
is editable later from Settings — the same picker, one recompute away. No upsells —
there is nothing to upsell; this app has no monetisation and never will.

## The honesty rules

These are product law, not style preferences, and most are pinned by tests:

- **Real or hidden.** No placeholder zeros, no fabricated charts, no invented values.
  A screen without data shows a quiet typographic empty state that says why.

![A brand-new account's Today screen: every card states what is missing and how to connect it — no targets yet, nothing logged, no step source — and the water goal shows its formula](docs/readme-assets/today-empty.png)

That rule on a fresh account: no demo chart, no zeroed rings — each card names its
absence and the path to fill it, and the one computed number on screen (the water
goal) states its formula.
- **Published formulas.** Every derived number's math is one tap away in-app and on
  the [formulas page](https://basalt.itseliias.com/formulas), which is generated from
  the app's own constants so it cannot drift.
- **`~` and ranges.** Unconfirmed AI values are marked and ranged; inferred chart
  values draw dashed, measured ones solid.
- **Over-caps stated plainly.** "5 over" is information. There is no red alarm, no
  guilt copy — pinned by no-cheerleading and no-scolding tests across the app.
- **Sources on everything synced.** Every Health Connect datum names its origin app.
- **Correlation, never cause.** And the checked-but-not-shown list keeps the
  correlations card honest about its misses.
- **Capture is never paywalled, no capture modality is ever mandatory, sleep stages
  never enter a score** — the full amended law is in
  [`docs/basalt-design-spec.md`](docs/basalt-design-spec.md).

## Status

**Not yet on Google Play.** This is a working app in pre-release: the full suite is
green (869 tests across seven packages), the backend is live, and the privacy and
deletion pages are in force — but several native features await verification on
physical hardware, and the camera-HRV measurement is explicitly in calibration. The
complete, honest list of what still needs a device is
[`docs/DEVICE-TEST-PLAN.md`](docs/DEVICE-TEST-PLAN.md). Nothing in this README should
be read as "shipped to users" until a Play listing exists.

## Architecture

pnpm workspace:

```
app/                  Expo ~56 / RN 0.85 / React Navigation 7 / Zustand 5 / Supabase
packages/
  core-data/           Result<T>, dates, Supabase client factory, sharing, deletion guard
  health-connect/      Android Health Connect provider (read-only, source-labelled)
  nutrition/           food CRUD, water, Open Food Facts, recipes, cooking mode, fill-gap
  training/            sessions → exercises → sets, periodization, race plans, mobility
  analytics/           readiness, streaks, correlations, sleep need/debt, cycle, PPG
  ui/                  six-theme design system (token contract, zero theme branches)
docs/                  binding docs + dated batch reports
supabase/              migrations, edge functions (all AI runs server-side)
scripts/               seeder, eval harnesses, formulas-page generator, screenshot pipeline
```

- Every write goes through the service layer (`Result<T>`); an offline outbox replays
  failed writes as service-call intents, so a dead spot never loses a log.
- Supabase with RLS (`auth.uid() = user_id`) on every table; **no secrets in the
  client bundle** — all AI goes through Edge Functions, and the committed eval
  harnesses (`pnpm eval:quick-add`, `eval:recipe-ideas`, `eval:sharing-rls`) run
  against the deployed functions.
- The six themes exist only as token-contract implementations: if a theme would need
  a component override, the contract grows a token instead.
- `pnpm test` from the repo root: **869 tests, seven packages, green at every commit.**

## Privacy

The in-force policy lives at
[basalt.itseliias.com/privacy](https://basalt.itseliias.com/privacy/). The short
version: your data sits in your own row-level-secured account; there are no
analytics, ads, or trackers; and the complete list of what ever leaves the device is
short — sync to your own account, the AI inputs you explicitly submit (typed/spoken
text as text, photos you choose, ingredient lists), barcode digits to Open Food
Facts, rounded coordinates to Open-Meteo for the walk-screen weather, and map tiles
for the area a route map displays. Deleting your account removes every row and file,
server-side, verified.

## Getting started

```bash
pnpm install
cp app/.env.example app/.env   # fill in Supabase URL + publishable key
pnpm test                       # everything, from repo root
```

Run the app:

```bash
cd app
pnpm start           # Metro only — pair with a running native build
pnpm android          # full native build + install + launch (first run, or after native changes)
```

`pnpm android` is only needed after native-affecting changes (new native module,
manifest/permissions change); plain `pnpm start` + Metro reload covers JS-only work
once a native build is installed. Screenshots in this README regenerate via
`scripts/readme-shots/screenshots.md`.

## Backend rules (Supabase)

- Every Basalt table is prefixed `basalt_`; RLS on all of them; no gamification
  columns anywhere.
- **Migration-safety rule: no destructive SQL that isn't scoped to `basalt_`-prefixed
  objects, ever** (the project is currently shared with another app — see
  `docs/DECOMMISSION.md` for the move-out runbook).
- Account deletion cascades across every `basalt_` table + storage, on both the
  in-app and server paths — enforced by a test that enumerates the schema.

## Workflow

- Branch discipline: topic branches, merged to `main` with tests passing; never
  force-push `main`.
- Commit after each coherent unit with its tests green.

## Docs index

`docs/basalt-design-spec.md` (the binding UI contract + honesty laws) ·
`docs/basalt-theme-contract.md` · `docs/basalt-layouts.md` ·
`docs/THEME-SYSTEM-REPORT.md` (six-theme rollout) ·
`docs/SHARING-RLS-DESIGN.md` (the sharing security model) ·
`docs/DEVICE-TEST-PLAN.md` (what still needs hardware) ·
`docs/DECOMMISSION.md` (Supabase move-out runbook) ·
dated `docs/V*-REPORT.md` files are snapshots of each work batch — history, not
necessarily current state.
