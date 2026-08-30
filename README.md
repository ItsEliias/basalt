# Basalt

A non-gamified, all-in-one honest health ledger — food, training, sleep, vitals. No rings,
no streak-shaming, no fabricated data. Real numbers or a quiet empty state, always with a
source.

Internal codename **LEDGER** appears in older docs and file names — same product.

## The law of this repo

1. **`docs/basalt-design-spec.md` is the binding UI contract.** Tokens, mono numerals,
   hairlines, receipt rows, real-or-hidden empty states. Every screen must be composable
   from the contract's components — no invented visual language.
2. **`docs/basalt-app-prototype.html`** is the visual source of truth when the spec and the
   prototype disagree.
3. **Honesty rules are product law, not style preferences**: no fake data, no placeholder
   zeros, `~` on unconfirmed AI values, over-caps stated plainly and never scolded, sources
   shown on every synced datum, published formulas.
4. **Forbidden, absolutely**: rings/gauges, glow-as-decoration, glassmorphism-as-decoration,
   mascots, emoji in UI copy, confetti, XP/levels/badges, motivational cheerleading, bright
   color without semantic meaning, upsells in onboarding, AI summaries that displace data.
5. **Tests are required for every engine.** `pnpm test` from the repo root must stay green —
   610 tests as of the six-theme rollout.
6. **Legibility floors are binding**: 11px type minimum (10.5 for srcnotes/tab labels), 4.5:1
   text contrast on every surface, 48dp tap targets. Pinned in
   `packages/ui/src/tokens.test.ts`.

## Architecture

pnpm workspace:

```
app/                  Expo ~56 / RN 0.85 / React Navigation 7 / Zustand 5 / Supabase
packages/
  core-data/           Result<T>, dates, Supabase client factory, sync contracts
  health-connect/      28-record-type Android Health Connect provider
  nutrition/           food CRUD, water, Open Food Facts, JSON-LD recipe import
  training/            set_entry relational model (sessions → exercises → sets)
  analytics/           streaks, rolling trends, correlations
  ui/                  six-theme design system (token-provider pattern)
docs/                  binding docs — read before building anything
supabase/              migrations, seed data, edge functions
reference/             gitignored quarry files kept for porting reference only
```

Every write goes through the service layer (`Result<T>` from `packages/core-data`). There is
exactly one food write path (`packages/nutrition`) and one target engine (`targetsService`).

### Six-theme system

Settings → Display lets a user pick from six fully independent visual themes (Minimal,
Humanist, Athletic, Brutalist, Depth, Atelier), each defined entirely through the contract in
`packages/ui/src/theme/contract.ts` — colour, typography, shape, meter geometry, container
elevation. The rule: **if a theme needs a component override, the contract is missing a
token — add the token, never branch the component.** Full rollout narrative, including every
bug found and fixed while wiring it up, is in `docs/THEME-SYSTEM-REPORT.md`.

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
pnpm ios
```

`pnpm android`/`pnpm ios` are only needed after native-affecting changes (new native module,
Android manifest/permissions change); plain `pnpm start` + Metro reload is enough for JS-only
work once a native build is already installed.

## Backend (Supabase)

- Every Basalt table is prefixed `basalt_`. RLS (`auth.uid() = user_id`) on every table. No
  gamification columns anywhere.
- **No secrets in the client bundle.** AI calls and privileged operations (account deletion)
  go through Supabase Edge Functions (`supabase/functions/`); the client only gets the URL +
  publishable key.
- **Migration-safety rule: no destructive SQL that isn't scoped to `basalt_`-prefixed
  objects, ever.** See `docs/DECOMMISSION.md` if this project's Supabase project is ever
  shared with another app, as it currently is — no drop/delete/truncate/alter against
  anything un-prefixed.
- Account deletion cascades across every `basalt_` table + storage.

## Workflow

- Branch discipline: `m1-<topic>` branches, PR into `main`, never force-push `main`.
- Commit after each coherent unit **with its tests passing**.
- `pnpm test` from repo root before every commit.

## Docs index

Start with `docs/basalt-design-spec.md` and `docs/M1-REPORT.md` for the product/UI contract
and current milestone status. `docs/THEME-SYSTEM-REPORT.md` documents the full six-theme
rollout. `docs/DECOMMISSION.md` is the runbook for moving off the currently-shared Supabase
project. The remaining `docs/*-REPORT.md` files are dated snapshots of prior work batches —
useful for history, not necessarily current state.
