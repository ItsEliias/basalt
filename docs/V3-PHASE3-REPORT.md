# V3 — Phase 3 report (audit P1 features) · STOP-POINT A

**Date:** 2026-08-31 · **Branch:** `v3-full-batch` · **Suite:** 644 green (610 at Phase 0).
Commits: Tray `fea26f0` · graded uncertainty + omissions + eval harness `141bb63` ·
competitor import `4c08dc5`.

## Tap-count table — cold start (app open, Today visible) → logged

| Flow | Taps | Path |
|---|---|---|
| **Favorite, default portion** | **2** | Log tab → tap favorite (commits instantly) |
| **Repeat yesterday's meal** | **2** | Log tab → "Copy yesterday's <meal>" (all entries commit) |
| **Barcode item** | 3 + scan | Log tab → (scanner is the default mode, fires itself) → ADD on result → Log it |
| **Manual item** | 4 + typing | Log tab → MANUAL → New manual entry → fields → Log it |
| **3-item meal via Tray** | 10 (~3.3/item) | Log → SEARCH → query+Search → result → Add to tray ×3 pairs → LOG ALL |

The benchmark — favorite in 2 taps from app open — is met exactly, tied with the fastest
published number in the category. Water stays 2 taps via the + sheet (+ → +250, instant).
Long-press on a favorite opens portion editing without costing the fast path anything.

## What shipped

1. **The Tray** — second action on the universal edit form ("ADD TO TRAY · KEEP LOGGING")
   stashes the entry, clears the search/scan surface, keeps capturing; sticky banner with
   running receipt (`trayTotals`/`trayLine`, pure, tested); LOG ALL commits every item
   through the same service path as single saves. Single-item flows keep their existing
   tap counts — the Tray adds a lane, it doesn't tax the old one.
2. **Graded uncertainty** — both AI food functions return model-calibrated
   `calories_low/high` (prompt states the standard: honest width beats tight-wrong);
   client shows `~520–780 kcal` until confirm collapses to the accepted point. Sparkline
   gains the `inferred` dashed style (`INFERRED_DASH`, no end dot — a dot asserts a
   measurement); **applied nowhere yet** because no current chart mixes measured and
   modelled series — Phase 4's sleep-debt and race-plan charts are its consumers.
3. **Omissions pass** — same model call returns 0–3 commonly-forgotten companions
   (oil/dressing/coffee sugar/butter); "Often forgotten" card renders one-tap
   add-to-Tray rows. Never auto-added, stated in copy.
4. **Competitor import** — Strong/Hevy/generic/Basalt-export parsers (pure, 15 tests),
   published 3-step name matching, dry-run preview (sessions, sets, local-time date
   range, unmatched list with manual mapping), commit through the live service layer
   with `source: import:<format>` + stable `ext_id` (idempotent re-imports — schema
   already had both columns, no migration). Round-trip pinned: our sectioned CSV export
   re-imports losslessly.
5. **Eval harness, committed** (`scripts/eval/`, `pnpm eval:quick-add`) — the V1.x A/B
   was a throwaway; this one stays. 20 cases run live against the deployed function:
   item bands, generous kcal bands, range coherence and range honesty (band centre must
   fall inside the model's summed range — a tight wrong range fails). First run: 17/20,
   catching two genuinely-too-tight ranges and a Tim Tam undershot. One band was
   recalibrated against USDA (cited inline: apple ~95 + 16 g PB ~96 ≈ 191 kcal) and one
   prompt iteration on range width landed **20/20 @ 5.5 s median, omissions 3/4 soft**.
   Both functions deployed.

## Deviations & audit corrections

- **One-tap favorites had already shipped** (V3-STATUS marked PARTIAL — wrong: the tap
  path committed directly). Phase 3's real work there was long-press portion editing.
- **Repeat yesterday had already shipped** (correctly caught in Phase 0) — verified at
  2 taps; left committing directly rather than routing through the Tray (fastest path
  wins; routing through the Tray would add a tap to a flow users love for its speed).
- **Omissions as one round trip**, not a literal second "follow-up pass" — same result,
  half the latency and cost.
- **Import is paste-based** — a file picker requires a new native module
  (expo-document-picker) and a dev-client rebuild; deferred, noted for the needs-you
  list.
- **Range scope**: energy (the headline number) carries the low–high range; macro lines
  keep the `~` shorthand the law explicitly preserves. Per-macro ranges would triple the
  schema surface for numbers nobody scans a row for — revisit only if usage data says
  otherwise.
- **Supabase quota recovered** during this phase (new billing month) — live function
  deploys and the eval both ran for real.

## What the audit changed about the plan ahead (the STOP-POINT A paragraph)

Phase 0's three load-bearing findings survive into Phase 4 unchanged: the outbox is
contracts-only (so Phase 4 item 1 is real wiring work, and it lands first); templates
carry no week structure (so the periodization engine's program object is also what
finally feeds `restAwareDays`' planned-rest input from the Phase 1 streak fix); and
`challenge.ts` shares nothing with the 1-v-1 co-op (17 builds fresh). Two items came
OUT of Phase 4's implicit scope because they already existed (one-tap favorites, repeat
yesterday), and one new obligation went IN: per-theme snapshot coverage doesn't exist
anywhere, so V3 features will establish it for the surfaces they touch rather than
retrofitting the world. Everything else proceeds as written.
