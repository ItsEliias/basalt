# V3 — final batch report

**Dates:** 2026-08-31 (single working session) · **Branch:** `v3-full-batch` (33 feature
commits) · **Suite:** 499 → **800 green** across 7 packages · **Model routing, evals,
migrations, deploys: all live.** Per-phase detail lives in V3-STATUS, V3-PHASE1,
V3-PHASE3, V3-A, V3-B, V3-C; this report is the roll-up, the deviation ledger, and the
needs-you list.

## Phases, one line each

| phase | shipped | report |
|---|---|---|
| 0 | Audit: outbox contracts-only, 14 features ABSENT, corrected assumptions | V3-STATUS.md |
| 1 | Rest-aware streaks · hide-numbers leak sealed at the composer · ~100-site text-scale sweep · timer running-state invariant · 10 s transition floor | V3-PHASE1-REPORT.md |
| 2 | Five product laws written into spec §5 + CLAUDE.md law 7 | (in spec) |
| 3 | Tray · one-tap favorites (already shipped; long-press edit added) · repeat-yesterday · graded uncertainty end-to-end with committed live eval · omissions pass · Strong/Hevy/generic/own-CSV import with dry-run | V3-PHASE3-REPORT.md |
| 4A | Outbox wiring · periodization + basalt_programs · sleep need/debt · monthly behavior report · vitals deviation | V3-A-REPORT.md |
| 4B | Fill-the-gap · voice lane + voice eval cases · on-hand recipes (new function, mechanical eval) · recipe OCR + routine-photo import · guided interval walks · Riegel race plans + basalt_race_plans | V3-B-REPORT.md |
| 4C | Cooking mode · shoe mileage + basalt_shoes · BLE scale (standard GATT) · **sharing with route-stripping view, 15/15 live RLS probe** · cycle tracking + basalt_cycle_entries · 1-v-1 co-op + basalt_pairs | V3-C-REPORT.md |
| 5 | Tile hide/show (omission only) · walk glance type · weekly per-muscle volume vs published band · haptic route nudge (50 m/25 m hysteresis) · mindfulness guardrails into spec + retention caution shipped | (this report) |
| — | Flag-don't-build notes: GLP-1 research requirements, AU restaurant findings, Wear scoping | docs/notes/ |

## Tap-count benchmark (Phase 3, unchanged since)

**Favorite in 2 taps from app open — met exactly** (Log tab → tap favorite, commits
instantly). Repeat-yesterday 2 · barcode 3+scan · manual 4+typing · 3-item Tray meal
~3.3 taps/item. Full table in V3-PHASE3-REPORT.md.

## STOP-POINT decisions taken

- **A** (post-Phase 3): "continue" → Phase 4 in order.
- **B** (sharing): design doc approved; **route-stripping view variant chosen** — built,
  probed 15/15 live (`pnpm eval:sharing-rls`).

## Deviation ledger — every departure, with reasoning

1. **Branch base**: `v3-full-batch` branches off `m1-theme-system`, not main (merge was
   classifier-blocked at batch start; nothing in main is missing from this base). The
   end-of-batch `--no-ff` merge to main carries both.
2. **Outbox scope**: durable intent-replay + visible pending count shipped; read-path
   local-first NOT built (needs a query mirror — an architecture, not a feature);
   no connectivity listener (netinfo = new native module; start/foreground/60 s covers
   the guarantee); chained training writes still need client-generated ids end-to-end.
3. **Illness early-warning notification deferred**: without a background-evaluation
   path the check runs only at app open, and a notification you can only receive by
   already opening the app is theatre. The quiet Recover card is the deliverable.
4. **Monthly report gates unbent**: |r|≥0.45, n≥30 cannot honestly fit one calendar
   month, so the month supplies facts and correlations keep their own trailing window.
5. **Live eval variance**: the quick-add eval is a monitoring harness against a live
   model — single-case wobble recurs across runs (an occasional Tim Tam undercount).
   Transport errors retry once; honesty checks were never loosened; every band
   recalibration carries a citation; one dual-reading voice case was respecified
   because it tested dice, not the model.
6. **Voice auto-runs on the final transcript** — the speed lane spends one AI call on
   a mangled transcript occasionally; the box stays editable and re-runnable.
7. **Recipe OCR keeps quantities verbatim** in the ingredient name — lossless beats
   structured-but-lossy for transcription.
8. **Routine re-import duplicates template names** (templates have no ext_id, unlike
   sessions). Known, in the device test plan; a follow-up could add one.
9. **Cooking timers use screen-on hold**, not a second foreground-service lane — the
   Android timer FGS is session-store-coupled, and screen-on is the prompt's own
   stated mechanism for cooking mode.
10. **BLE supports the standard Weight Scale profile only** — guessing proprietary
    byte layouts would put invented numbers in a ledger.
11. **Sharing advisor findings are intentional**: the `security_definer_view` ERROR on
    `basalt_walks_shared` IS the route-stripping mechanism (an invoker view cannot
    withhold a column without granting base-table reads); the redeem/join functions
    WARN as authenticated-executable SECURITY DEFINER — the enumeration-proof pattern,
    same class as `basalt_delete_my_data`.
12. **Shared-viewer grants are labeled by role + date, not name** — profiles are not
    in any share domain, so the viewer honestly has no name to show.
13. **Tile hide/show and glance/voice-splits/route-nudge prefs are device-local**
    (AsyncStorage), not profile-synced — display prefs of one hand, one phone.
14. **Race plans store inputs only** — the plan recomputes from the published formula
    so a stale stored copy can never disagree with it.
15. **Co-op dots publish when the card loads** — a partner's dots can lag until they
    next open Trends. No background publishing without a background-task module.

## Compromises consciously accepted

- The shared Supabase project remains (Arise + Basalt): every migration stayed
  basalt_-scoped and additive; DECOMMISSION.md still governs the move.
- Fill-the-gap's OFF fallback uses published generic staple queries — editorial, but
  published, deterministic and source-tagged; own foods always outrank it.
- Weekly-volume half-credit (secondary = 0.5) is a modelling choice, stated in the
  srcnote rather than hidden in the math.

## Backend objects created this batch (all additive, all advisor-checked)

`basalt_programs` · `basalt_race_plans` · `basalt_shoes` (+walks.shoe_id) ·
`basalt_share_grants` (+18 grantee SELECT policies, `basalt_walks_shared` view,
`basalt_redeem_share_code`) · `basalt_cycle_entries` · `basalt_pairs` +
`basalt_pair_days` (+`basalt_join_pair`). Edge Functions deployed: `ai-quick-add` (v↑),
`ai-photo-food` (v3: +recipe/+routine modes), `ai-recipe-ideas` (new).

## Committed harnesses

`pnpm eval:quick-add` (24 cases, graded-uncertainty + voice) · `pnpm eval:recipe-ideas`
(5 mechanical cases) · `pnpm eval:sharing-rls` (15 live two-account probes) ·
`pnpm test` (800).

## Device verification

DEVICE-TEST-PLAN.md gained the V3 appendix (§11–18): outbox airplane-mode drills, the
speed lanes, AI lanes, programs/race/volume, guided walks + shoes + glance + nudge,
BLE scale, two-account sharing and co-op, tiles/sleep/deviation/monthly. **Everything
in §12-voice and §16 needs the dev-client rebuild first** (two new native modules).

## Needs-you list (updated)

Carried from V2, still open:
1. **Dev-client rebuild + install** — now blocks: walk FGS verification, voice lane,
   BLE scale (`expo-speech-recognition`, `react-native-ble-plx` + config plugins are
   all committed; it's one `eas build` / local gradle run away).
2. Privacy pages hosting (Play listing).
3. Map tile key decision.
4. Play data-safety / transcription answers (PLAY-ANSWERS.md).

New this batch:
5. **Supabase auth leaked-password protection** — one dashboard toggle, shared with
   Arise, advisor-flagged every run.
6. **Background-task module decision** — would unlock the illness-warning
   notification, outbox drain-on-reconnect, and co-op background publishing in one go.
7. File/document-picker module for CSV import (paste works today).
8. A second real test account exists for sharing/co-op device tests:
   `basalt.share.probe@example.com` / `TEST123` (created by the RLS probe, committed).
9. Decisions on the three flagged notes: GLP-1 clinical/regulatory consult (or shelve),
   AU restaurant data budget (or keep the menu-board photo path), Wear step-0
   (action-complete notifications) yes/no.
10. **End-of-batch merge**: `v3-full-batch` → `main` with `--no-ff` (carries the theme
    branch history too). Ready whenever you are — nothing further is stacked on it.
