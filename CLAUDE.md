# Basalt — Claude Code Configuration

Basalt is the only app in this repository: a non-gamified, all-in-one honest health
ledger (food, training, sleep, vitals). Store name "Basalt: Health & Fitness".
Internal codename LEDGER appears in older docs — same product.

## The law of this repo

1. **`docs/basalt-design-spec.md` is the binding UI contract.** Tokens, mono
   numerals, hairlines, receipt rows, real-or-hidden empty states. Do not invent
   new visual language — every screen must be composable from the contract's
   components.
2. **`docs/basalt-app-prototype.html` (v11.1) is the visual source of truth.**
   Open at ~390 px width. When the spec and the prototype disagree, the
   prototype wins.
3. **Honesty rules are product law**, not style preferences: no fake data, no
   placeholder zeros, `~` on unconfirmed AI values, over-caps stated plainly
   ("41 / 36 g · 5 over") and never scolded, sources shown on every synced
   datum, published formulas. Real data or a quiet typographic empty state —
   never a fabricated chart.
4. **The forbidden list is absolute**: rings/gauges, glow, glassmorphism,
   mascots, emoji in UI copy, confetti, XP/levels/badges, motivational
   cheerleading, bright color without semantic meaning, new fonts/hues/radii,
   upsells in onboarding, AI summaries that displace data.
5. **Tests are required for every ported or new engine.** The quarry brought
   189 green package tests; the suite has grown since (499 as of the
   2026-08-22 legibility revision) — extend, never regress. `pnpm test` at
   root must stay green.
6. **Legibility floors are binding, not suggestions.** Type floor 11px
   (10.5 for srcnotes and tab labels only), text-color contrast floor
   4.5:1 on both `--bg` and `--surface`, every tappable clears Android's
   48dp minimum via `hitSlop`. Pinned in `packages/ui/src/tokens.test.ts`;
   see `docs/basalt-design-spec.md` §1–2 for the full table. Do not shrink
   or dim below these without updating that pinned test in the same change.
7. **Five audit laws (2026-08-31 amendment, spec §5 has the full text +
   rationale):** capture is never paywalled; no capture modality is ever
   mandatory (manual entry is the floor); AI proposes, never narrates (no
   AI summaries of completed activity, at all); graded uncertainty
   (unconfirmed AI = ranges from the model, charts draw inferred values
   dashed/banded vs solid measured); sleep stages are display-only and
   never enter any score or suggestion. Plus the timer laws in spec §4:
   visible running state on every timed surface, and the engine-enforced
   10 s transition floor (`MIN_TRANSITION_S`).

## Architecture

pnpm workspace:

```
app/                  Expo ~56 / RN 0.85 / React Navigation 7 / Zustand 5 / Supabase
packages/
  core-data/          Result<T>, dates, Supabase client factory, sync contracts (vendored)
  health-connect/     28-record-type provider architecture (vendored; full manifest)
  nutrition/          food CRUD, water, Open Food Facts, JSON-LD recipe import (vendored)
  training/           set_entry relational model (sessions → session_exercises → set_entries)
  analytics/          streaks / rolling trends
  ui/                 Basalt design tokens + components (token-provider pattern)
docs/                 the binding docs — read before building anything
reference/            gitignored quarry files kept for porting reference only
```

- **Every write goes through the service layer** (`Result<T>` from
  `packages/core-data`) so the offline outbox can slot in later without
  touching screens.
- **Exactly one food write path** (`packages/nutrition`) and **one target
  engine** (`targetsService`). Never resurrect `diaryService` or `utils/tdee`.
- **Vendored packages evolve independently** — never import from the old
  monorepo, never "sync back".

## Backend (Supabase)

- Project `ezsrwwfieihelfekgclz` — **shared with the Arise app** (free-tier
  limit; user-approved, reaffirmed 2026-08-21). Every Basalt table is prefixed
  `basalt_`; never touch un-prefixed tables — they belong to Arise.
- **Migration-safety rule: no destructive SQL that isn't scoped to
  `basalt_`-prefixed objects, ever.** No drop/delete/truncate/alter against
  any un-prefixed table, function, policy or extension — including "harmless"
  cleanup. If a statement can't name its `basalt_` target explicitly, it
  doesn't run.
- The move to a dedicated project follows `docs/DECOMMISSION.md`; triggers:
  first external tester, store submission, or resumed Arise schema work —
  whichever comes first.
- RLS `auth.uid() = user_id` on every table. No gamification columns anywhere.
- **No secrets in the client bundle, ever.** AI calls and privileged operations
  (account deletion) go through Supabase Edge Functions. The client gets only
  the URL + publishable key via `.env` (gitignored).
- Account deletion: full cascade across every `basalt_` table + storage; the
  auth record is deleted only when the user has no Arise rows (shared auth
  pool — documented caveat until Basalt gets its own project).

## Workflow

- Branch discipline: `m1-<topic>` branches, PR into `main`, never force-push
  `main`.
- Commit after each coherent unit **with its tests passing**.
- CTA-reachability: intake/onboarding screens keep their primary button
  on-screen at all common viewport heights — regression-tested (this bug
  shipped once already).
- `pnpm test` from repo root runs everything; run it before every commit.
