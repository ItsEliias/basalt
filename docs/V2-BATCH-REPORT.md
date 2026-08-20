# Basalt — V2 Batch Report (Phase A groundwork + Phase B features)

**Date:** 21 August 2026 · **Repo:** `ItsEliias/basalt` · **Status:** both phases complete.
**Suite: 398 tests green** (core-data 26, ui 19, analytics 28, nutrition 111, training 114,
health-connect 31, app 69); `tsc --noEmit` clean everywhere. Every unit went branch →
tests → `--no-ff` merge.

---

## Phase A — Submission groundwork

1. **Privacy policy + account-deletion page** — drafted in `docs/site/` (plain-English,
   specific to what the app actually does: the complete leaves-the-device list, HC read-only
   commitments, no-photos-today stated, export + full-cascade deletion, no-app contact path
   with reply-confirmation identity check). Both DRAFT-bannered; contact email is a
   placeholder pending your review. Deployed to the `gh-pages` branch — **but GitHub Pages
   cannot be enabled: free-plan private repos don't get Pages** (the API says so verbatim).
   Decision needed — see the needs-you list.
2. **In-app AI disclosure** — the AI capture srcnote now reads: *"Your description is sent to
   Anthropic (Claude) to estimate — only the text above, never your ledger, name or email."*
3. **FGS type → `health`** — plugin rewritten (permissions: `FOREGROUND_SERVICE`,
   `FOREGROUND_SERVICE_HEALTH`, `ACTIVITY_RECOGNITION`, `POST_NOTIFICATIONS`; special-use
   property gone). `ACTIVITY_RECOGNITION` is requested at runtime before the service starts;
   a decline degrades honestly to the runs-only-while-open srcnote. **Device verification
   pending a dev build** — the pure catch-up layer is fully tested either way.
4. **Tile provider scaffold** — `EXPO_PUBLIC_TILE_URL` / `_TILE_ATTRIBUTION` env vars feed the
   map and its srcnote; CARTO dev tiles remain the pinned fallback; Stadia and MapTiler URLs
   are documented in `route-map.ts` and `.env.example`.

   **Recommendation: Stadia Maps.** Its Alidade Smooth Dark raster is the closest match to
   Basalt's palette of any hosted style (MapTiler's Dataviz Dark reads bluer and busier at
   walk-summary zooms), raster `@2x` is a first-class product rather than an afterthought,
   pricing is a flat, predictable tier that a single-app indie fits comfortably inside, and
   the free tier is usable during development with the same URL shape — so the swap is
   literally pasting the key. MapTiler is the fallback if you'd rather have its larger style
   catalog later.
5. **`docs/PLAY-ANSWERS.md`** — data-safety form (typed rows, the Anthropic
   service-provider declaration, deletion answers), the HC developer declaration with a
   paste-ready justification paragraph, and the FGS declaration. Play Console becomes
   transcription.

## Phase B — Feature batch

1. **Progression engine v1** (the flagship) — `suggestNext`, pure, 12 tests: five published
   rules in order — no history invents no numbers; 14/28-day gaps ramp back at 90%/80% with
   the gap stated; RIR 0 or "too hard" lightens 5%; top of the 8–12 range with reps in
   reserve adds 2.5 kg and resets to 8s; RIR ≥ 2 mid-range adds one rep. Bodyweight work
   progresses by reps only; warmups are invisible; back-off sets can't drag the top weight
   down. Every suggestion carries its basis in words and renders as a hint ending *"a
   suggestion, never a mandate"* — nothing is prefilled from it. The day-one `feedback`
   column finally gets its capture UI (THIS FELT too easy / right / too hard, after a
   committed set), closing the loop for next time.
2. **Rep-PR matrix + warm-up calculator** — best real weight per rep count (real-or-hidden:
   untrained counts don't appear, the PRS link itself doesn't render without history);
   published warm-up ramp (bar ×10 · 55% ×5 · 70% ×3 · 85% ×1, 2.5 kg-rounded, colliding
   steps dropped) inside the plate calculator.
3. **Adapt Session** — propose-then-confirm over the current session: less-time trims to 2
   hard sets, no-equipment swaps to same-primary-muscle bodyweight cover (or drops with the
   gap named), quiet swaps impact movements, exclude-muscle drops primary hits "at your
   request". Exercises with logged sets are never touched — pinned across all four modes.
4. **Hide-the-numbers mode** — `basalt_profiles.hide_numbers` (additive migration, applied
   live). Today goes log-only (quiet "Logged — N items", no macros card, ✓ instead of kcal),
   Week in Review withholds deficit/surplus. Everything is still recorded and exported, and
   the Settings row says exactly that. Capture flows deliberately unchanged: entering food
   requires that food's numbers; the running totals are what go quiet.
5. **Correlations** — fixed published pair list (five same-day + volume×next-night-sleep),
   Pearson r, shown only past |r| ≥ 0.45 over ≥ 30 overlapping days, every statement ending
   "correlation, not cause (r, n)". Checked-not-shown pairs are named with their actual r
   and n on the card, so an empty card is evidence of checking. 14 tests, gates pinned.
6. **Share cards** — walk / rep-PRs / Week in Review as captured images in the editorial
   style, one small wordmark, no watermark spam. The walk card draws the route as pure
   geometry (`projectRoute`, 4 tests: aspect-correct, north-up, round scale bar) —
   **deliberately no tiles** on the share image: deterministic to capture, and no tile
   attribution obligations travel with it; the card states "GPS route, no tiles" itself.

## Notes

- **A dev-client rebuild is required** (new since last build: `react-native-view-shot`; plus
  the FGS manifest change from Phase A).
- The Week in Review lede still names protein counts in hide-the-numbers mode (grams-vs-target
  phrasing, not calories); flag it if you want it quieter.
- `docs/SUBMISSION-CHECKLIST.md` tracks Phase A state item-by-item.

---

## Needs you (the stop-point list, unchanged by Phase B)

1. **Privacy pages**: review both drafts (`docs/site/`), fill the contact email, then pick a
   Pages hosting path — the free plan cannot serve Pages from this private repo. Options:
   make the repo public, upgrade the plan, or say the word and I'll create a small public
   `basalt-site` repo and deploy there.
2. **Tile key**: create the Stadia Maps account (or MapTiler if you prefer), put the URL +
   attribution in `app/.env` per `.env.example`.
3. **Dev build + device checks**: rebuild the dev client, then verify on-device: guided
   timer with screen off (now under the `health` FGS type + runtime permission), the map
   tile, notification tap-through, and a share-card capture.
4. **Play Console + HC declaration**: transcribe `docs/PLAY-ANSWERS.md` once the privacy URL
   is final.
5. **DECOMMISSION go/no-go**: I have not run it and won't without your explicit go.
