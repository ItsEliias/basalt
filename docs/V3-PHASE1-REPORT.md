# V3 — Phase 1 report (corrections) + Phase 2 (contract amendments)

**Date:** 2026-08-31 · **Branch:** `v3-full-batch` · **Suite after phase:** 627 green
(was 610 at Phase 0) · every item its own commit, all green at commit time.

## Phase 1 — the five corrections

1. **Rest-day streak fix** (`fd72ac9`). New published rule in `streaks.ts`: training
   streaks stay alive through planned or readiness-advised rest (`REST_ADVISED_BELOW = 40`,
   pinned). The load-bearing honesty decision: `restAwareDays()` drops any contiguous run
   containing no real session — rest *maintains* a run, it can never *start* one, so a
   no-training user with chronically low readiness still shows zero. Historical per-day
   readiness is recomputed from persisted vitals with rolling 30-day baselines (same
   published components as today's number); days with no computable number are absent.
   **Deviation:** "planned rest (template rest day)" is not derivable — templates carry no
   week structure (Phase 0 finding). The pure rule accepts a planned-rest set; the
   periodization engine (Phase 4.2) will feed it. Srcnote on the streak card states the
   rule. 7 tests.
2. **Hide-numbers lede leak** (`32a7396`). Quieting moved *into* `composeWeekReview`
   (a `hideNumbers` input) instead of downstream filtering, so no consumer — screen, share
   card, future surfaces — can leak. Protein goes qualitative ("mostly on target" /
   "often under target" at a 50% split), gap texts drop counts, Deficit/Surplus never
   compose. Session/logging-day counts stay: the mode hides nutrition numbers, not the
   ledger. 5 pins including a no-digits-near-protein regex.
3. **Text-scale gap sweep** (`7d84cfb`). Measured 155 raw `<Text>` usages; 138 in scope
   (ShareCards exempt — fixed-size capture canvas). New `ScaledText` primitive multiplies
   `fontSize` by the in-app +1/+2 preference; each file migrates via `ScaledText as Text`
   — one-line import diff, zero call-site churn. An `anchored` opt-out exists for the
   spec's two exemptions, but the audit found **no** hero numerals or mono-tabular columns
   rendered screen-locally (all live in ui primitives with correct policy) — zero opt-outs
   used. **Count migrated: 138 across 20 files.**
4. **Timer running-state audit** (`de448a8`). Guided timer, rest timer, walk recording
   all pass (countdowns/phase/progress visibly moving + haptic phase changes). The
   breathing pacer was the gap: phase label + per-phase count existed but nothing showed
   session progress — it now renders `m:ss OF m:00` while running.
5. **Transition floor** (`de448a8`, same commit — same engine). `MIN_TRANSITION_S = 10`,
   enforced inside `createGuidedTimer` (every store path routes through it), lead-in
   stepper added (settable upward, refuses below floor). **Scope decision, recorded:**
   the floor governs *positioning transitions* (lead-in; future scripted side-switches),
   not protocol-defined work:rest cycles — Tabata's published 20/10 × 8 stays verbatim.
   Explicit `leadInS: 0` stays legal ("work on tap" is user-initiated, not auto-advance).
   5 pins; prototype-demo test timings updated to the new law.

## Phase 2 — contract amendments (this commit)

`docs/basalt-design-spec.md` §5 gains the five audit laws, each with its one-line
rationale: capture never paywalled · no mandatory capture modality (manual is the floor) ·
AI proposes, never narrates · graded uncertainty (ranges + solid-vs-dashed charts) ·
sleep stages display-only. §4 gains the two timer laws shipped in Phase 1 (visible
running state, transition floor). CLAUDE.md's law list gains a summarising item 7
pointing at the spec for full text.

Law 3 deliberately *subsumes and extends* the old "no AI summaries that displace data" —
from "that displace data" to "none at all". Law 4's implementation (ranges in
ai-quick-add/photo-food, dashed chart style) is Phase 3 work; the law lands first so the
implementation has something binding to conform to.
