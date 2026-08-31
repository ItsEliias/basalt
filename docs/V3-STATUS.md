# V3 — Phase 0 status audit

**Date:** 2026-08-31 · **Branch:** `v3-full-batch` (off `m1-theme-system` — see deviation
note 1) · **Baseline suite:** 610 tests green.

Verdicts: **SHIPPED** (works as V3 assumes) · **PARTIAL** (exists, needs completion) ·
**ABSENT** (nothing in the tree). Evidence is file paths, checked this audit — not report
claims.

## The three named verifications

**Offline outbox — PARTIAL, contracts only.** `packages/core-data/src/sync.ts` defines
`OutboxEntry`/`OutboxStore`/`RemoteSync`/`ChangeApplier` and a tested `syncOnce()`
orchestrator — and *nothing implements any of it*. No persistent store, no service write
enqueues anything (the only "outbox" mention outside core-data is a comment in
`packages/training/src/sessions.ts`), no drain on start/connectivity. Phase 4 item 1 is
real work, confirmed.

**V2 roadmap features (roadmap §4) — what actually exists:**
- `challenge.ts` is the *personal* monthly challenge (own-baseline, private). It is NOT the
  1-v-1 co-op — Phase 4.17 is ABSENT and `challenge.ts` shares no meaningful machinery with
  it (different data shape, different tables). Build fresh, reuse only the consistency-dot
  rendering.
- Progression v1 (`training/progression.ts`, 5 published rules) is SHIPPED; the
  periodization engine (mesocycles, block structure, deload triggers) is ABSENT — 4.2
  extends `suggestNext` as planned.
- Week/Year review + personal challenge SHIPPED (`analytics/week-review.ts`,
  `year-review.ts`); the monthly behavior-impact report (4.4) is ABSENT (correlations
  engine exists to extend: `correlations.ts`, fixed pair list, gates pinned).
- ABSENT, no partial anywhere (grep sweep over packages+app): sleep need/debt, illness
  early-warning, cycle tracking, suggest-food-to-fill-macros, voice logging lane,
  ingredients-on-hand, recipe OCR, routine import, guided audio interval walks, race
  plans, multi-recipe cooking mode, shoe mileage, BLE scale, coach/caregiver sharing.

**THEME-SYSTEM-REPORT open items:**
- Depth device check — **CLOSED since the report's caveat**: real glow + real glass blur
  confirmed on physical SM-S908E (2026-08-27/28 sessions, report's "Second/Third device
  session" sections). Remaining Depth caveat is only pre-SDK-31 fallback (flat tint) —
  cosmetic, low priority, noted not fixed.
- SubNav active-state colour — still an extrapolation with no reference precedent; stands
  as a design judgment call, not V3 work.
- Tiles fifth slot (Water per layouts doc vs Fat per reference mockup) — went with the
  doc; unresolved judgment call, not V3 work.
- CTA Minimal-visible colour change — same category.

## Phase 1 items — verified current state

1. **Rest-day streak break — CONFIRMED.** `analytics/streaks.ts` `currentAndLongest()` is
   rest-day-blind; `workout`/`full` streaks break on any no-session day. Template rest
   days exist (`training/templates.ts`); readiness exists (`analytics/readiness.ts`) —
   both inputs for the new rule are available.
2. **Hide-numbers lede leak — CONFIRMED.** `analytics/week-review.ts` lede/clauses name
   protein day-counts ("protein landed under target on N of M logged days") regardless of
   mode; the composer has no hideNumbers input at all — TrendsScreen only filters the
   Deficit/Surplus *stat chips*, not the lede.
3. **Text-scale gap — CONFIRMED, measured.** In-app +1/+2 (`TEXT_SCALE_MULTIPLIER`) is
   consumed only inside `packages/ui` (`base.tsx`, `receipt.tsx`). **155 raw `<Text`
   usages** across app screens/components ignore it (largest: TrainScreen 31,
   ShareCards 17, RecipesTab 15, OutdoorTab 14, LogScreen 13). ShareCards is exempt by
   design (fixed editorial capture size). Real target ≈ 138.
4. **Timer running-state audit — mindfulness pacer is the weak one.** Guided set timer has
   hero countdown + progress + phase label (strong). Rest timer counts visibly. Walk
   recording shows LIVE map + climbing stats. The breathing pacer's running state is the
   ring animation + label swap — adequate when animating but `READY`→running is the only
   cue and haptics fire only on phase change; audit properly in Phase 1.
5. **Transition floor — CONFIRMED gap.** `guided-timer.ts` `leadInS: 5` hardcoded in
   EMOM/Tabata/circuit configs; no user-settable minimum. (Floor applies to lead-in/
   transitions, NOT the published Tabata 20/10 work/rest — those stay verbatim, pinned.)

## Phase 3 items — verified current state

- **Tray** — ABSENT. Add-food commits one entry per pass through the form.
- **One-tap favorites** — PARTIAL: favorites store `servingSize`/`servingUnit`
  (`nutrition/favorites.ts` lines 22–23) but tapping a favorite opens the full editable
  form. The data model needs nothing; the interaction does.
- **Repeat yesterday — ALREADY SHIPPED.** `log/model.ts` `yesterdayMeals()` + per-meal
  "Copy yesterday's <meal>" rows in LogScreen (V1.x "swipe-copy-yesterday"). V3 work here
  is only verifying it commits in one tap and integrating with the Tray.
- **Live-total keypad** — ABSENT (no running meal total anywhere in the add flow).
- **Graded uncertainty** — ABSENT: `ai-quick-add` returns point values (`calories:
  number`), no low–high; charts have no dashed/inferred style.
- **Omissions prompt** — ABSENT.
- **Competitor import** — ABSENT. (CSV *export* exists — `exportFormat.ts` — and is the
  round-trip target.)
- **Eval harness caveat:** the V1.x 20-case A/B ran as a throwaway; **no eval harness is
  committed anywhere** (git history checked). "Extend the eval set" for Phase 3/4 means
  first committing a real harness (`scripts/eval/`) — treated as part of Phase 3 item 2.

## Phase 4 building blocks confirmed present

Readiness + `basalt_vitals` daily HRV/RHR rollups (illness baselines ready) · sleep
sessions/stages tables + HC sync · correlations with lag-1 checkin pairs · templates with
rest-day structure · walk tracking with FGS (this week) + TTS voice splits (audio-walk
plumbing) · `route-loop`/`beacon` Edge Function patterns · `timerService`/
`foregroundServiceCoordinator` (multi-timer cooking mode base) · 28 `basalt_` tables, all
RLS `auth.uid() = user_id`.

## Deviations from the prompt's assumptions

1. **Branch base:** `v3-full-batch` branches from `m1-theme-system` (31 commits ahead of
   `main`, device-verified, unmerged). V3's theme invariants require that work; merging to
   `main` first was blocked by tooling permissions, so the end-of-batch `--no-ff` merge
   into `main` will carry both. Nothing in main is missing from this base.
2. **Repeat yesterday** moves from "build" to "verify + Tray integration" (already
   shipped).
3. **Per-theme snapshot set** (invariants list: "extend the per-theme snapshot set") —
   **no snapshot set exists** (repo-wide check). The theme-contract doc specced 24
   snapshots; never built. V3 will establish the set for surfaces it touches rather than
   retrofitting all existing screens (recorded as a scope choice).
4. **Instrumentation** (`instrumentation.ts`) is console.log-structured with two display
   events only; V3 features extend this pattern — no vendor exists, per the file's own
   comment.
5. **Mindfulness guardrails** (Phase 5.5) are already mostly *practiced* (one pacer, no
   library) — the work is writing them into the spec so they can't drift.
