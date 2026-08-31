# V3-A report — Phase 4 items 1–5

**Date:** 2026-08-31 · **Branch:** `v3-full-batch` · **Suite:** 696 green.
Commits: outbox `3352b2b` · periodization `18a44bb` · sleep need `8f309da` ·
monthly report `0c63d7d` · deviation `03866e7`.

## 1 · Offline outbox (`3352b2b`)

Phase 0 found contracts-only; this lands the working half that protects users: **writes
survive dead spots**. Intent replay (queue the service call's input, not a raw row) through
the same service functions, so chains replay exactly as live calls. AsyncStorage, corrupt-
safe, retry budget with nothing silently dropped; only network-shaped failures queue —
real errors still surface. Drains on start/foreground/60s interval. Wired: food entries
(single + Tray), water, weigh-ins, check-ins, mindfulness. Settings shows the one quiet
line. **Deviations:** read-path local-first out of scope (needs a local mirror of every
query); no connectivity listener (netinfo = new native module — start/foreground/interval
covers the guarantee); chained training writes need client-generated ids end-to-end first.

## 2 · Periodization engine (`18a44bb`)

Pure engine (20 tests) layering a published 6-week block (3 accumulation / 2
intensification / 1 deload) over `suggestNext` — never replacing it; `first_time` passes
through untouched. Early-deload advised on any TWO of three published signals (feedback
trend ≥40% too-hard · 7-day readiness mean <45 · a main lift stalled 2+ weeks, holiday
weeks skipped). `basalt_programs` (additive migration, applied live, RLS ×4, **advisors
run: no findings on the new table** — the report's advisor notes below). The program's
non-training weekdays are the planned-rest source the Phase-1 streak rule was built for —
that loop is now closed. Train's idle view: Program card (phase label, day chips, deload
advice with reasons, start/stop); suggestions periodize in the session store, setsDelta
adjusts prefilled rows.

## 3 · Sleep need + debt (`8f309da`)

Need/debt words, never a score (13 tests, rules pinned): personal need = median of your
last 28 nights clamped 7:00–10:00, honest 8:00 default until 14 nights *and it says so*;
P75-heavy prior day +30 min (readiness's own load framing reused); debt = Σ(need−slept)
over 14 nights, surplus repays, floor zero; absent nights absent. "You got 6:50 of the
8:10 your body needed." Personal need now feeds readiness's sleep component. Stage law
applied: module provably reads no stages; stage bar gains the accuracy-ceiling srcnote.

## 4 · Monthly behavior-impact report (`0c63d7d`)

Month supplies facts (factor evenings, mood coverage), correlations supply impact over
their own window — **gates unbent** (|r| ≥ 0.45, n ≥ 30 can't be honestly cleared inside
one calendar month, so the month doesn't shrink them). Checked-not-shown included; <8
check-in days → no report; no-cheerleading pinned. Renders in Trends; opt-in notification
mirrors Week in Review (fixed prompt, no numbers; one-shot for the next 1st, rolled
forward at app start — expo has no monthly repeat).

## 5 · Vitals deviation (`03866e7`)

Outlier-only against your own 30-day min–max. ≥7 baseline days or the vital is withheld;
card at ≥2 of observed deviating, naming its denominator; no-diagnosis language pinned.
Observes what's persisted (HRV, RHR, sleep duration) and extends as the sync grows.
**Deviation:** the off-by-default notification is deferred — without a background
evaluation path it could only fire when the app is already open, which is theatre.

## Advisor output (run after the schema change, per invariants)

No findings on `basalt_programs`. Pre-existing, out of scope for this branch: three
un-prefixed Arise tables with RLS-no-policy (INFO), Arise's `increment_guild_xp`
SECURITY DEFINER + mutable search_path (WARN — Arise's function, untouchable per the
migration-safety rule), `basalt_delete_my_data` SECURITY DEFINER executable by
authenticated (intentional: it is the user-callable self-wipe), and **leaked-password
protection disabled** (WARN — project-level auth setting, shared with Arise; flagged for
the needs-you list, one dashboard toggle).
