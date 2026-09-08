# Basalt — pre-testers pass (0.2.0, versionCode 2)

> Provenance: the V4 batch prompt referenced this file but it did not
> exist in the repo. Authored 2026-09-08 during the run-to-completion
> pass from the established protocols (DEVICE-TEST-PLAN.md, the V4 gate
> amendment, PLAY-SUBMIT-TODAY.md). Edit freely — the checklist below is
> the contract for what testers receive.

This is the build the closed testers get — nobody has 0.1.0. Everything
in §1 runs on the machine and is DONE when ticked; §2 is the one hard
stop: a real-device session with the phone plugged in.

## 1 · Machine checks (run before any build ships)

- [x] Full workspace suite green (`pnpm test`) — 1,195 tests at HEAD.
- [x] TypeScript clean (`tsc --noEmit` in app).
- [x] Deletion guard green — every `basalt_` table in BOTH wipe paths
      (SQL fn + delete-account v16).
- [x] Extras lint green — `packages/extras` unreachable outside the gate.
- [x] Crisis lint green — every self-expression text field runs the
      detector; the crisis screen is never inside an ExtraSlot; no
      setting can disable it (the module imports nothing).
- [x] No-BMI source scan green across app + packages.
- [x] Supabase advisors run post-schema-changes: Basalt-scoped anon RPC
      execution revoked (migration `basalt_revoke_anon_rpc`). Remaining
      findings are Arise's tables (out of bounds by law), the
      long-standing `basalt_walks_shared` definer view (V3 sharing
      design, documented), intentional authenticated-definer RPCs, and
      the auth-level leaked-password toggle (shared project — needs the
      owner's call, see PLAY-SUBMIT-TODAY).
- [x] versionCode 2 / versionName 0.2.0 in build.gradle + app.json.
- [x] Release AAB built from this commit; universal APK built from the
      AAB for the device session.

## 2 · Device session — THE hard stop (plug the phone in)

Order matters; the gate runs first while the install is fresh.

1. **The V4 gate (pass/fail)** — fresh install, sign in with the seed
   account, leave every Extra at its registry default. Screenshot every
   screen in Minimal and diff against the pre-branch-main baseline
   (`app/android/baseline-main-8323e32.apk` + `scripts/readme-shots/`).
   The ONLY expected diffs, each ordered by a phase prompt and
   decision-logged in V4-REPORT: (a) the intake-range line under the
   Today hero (`uncertainty`, default ON); (b) Log loses the Planner
   sub-tab; (c) Recover loses the empty Cycle and Progress-photos cards;
   (d) Settings loses the old fasting toggle; plus the Mind card
   replacing the old evening check-in on Recover (Phase 7 core). Any
   other pixel = a bug in this batch.
2. **All-off run (informational)** — flip everything off in Settings ›
   Extras, re-shoot, record the diff. Expected: capture modes hidden vs
   main; not a failure.
3. **Extra-by-Extra smoke** — turn each on and touch it once: capture
   modes, streaks/XP/social/narrative cards, sounds, widgets (place BOTH
   home-screen widgets), rings layout, each More-tool (planner tab back,
   fasting card, hydration hours → one notification fires, supplements
   tick + reminder, cycle card, photos capture → local file + cloud
   switch, connected-services rows say "soon"), plan card (apply +
   override), programme (start recomp8, week strip, corridor), coach
   (ask one grounded question; ask "how much creatine" → deflection),
   journal (entry, cloud switch, PDF), wind-down (body scan start),
   meditation (start 5-min, lock the phone, bell + notification).
4. **Crisis path on device** — type a fixed test phrase into the coach,
   the check-in note, and a journal entry, with Extras all ON and again
   all OFF where the field still exists: the screen must appear every
   time, numbers must match the region, the entry must still save.
5. **Onboarding** — wipe app data, run onboarding end-to-end: scope →
   theme → capture (ticked) → Pebble → streaks/XP → friends → daily
   summary → More tools (multi-select) → Wellbeing tools (multi-select).
   Every yes lands in Settings › Extras.
6. **Walk notification** — start an outdoor walk, lock the phone:
   distance/elapsed/pace live on the lock screen; Pause/Resume works;
   paused time is excluded from the save.
7. **Deferred screenshots** — every new V4 surface in Minimal and one
   expressive theme, into `docs/store-assets/screenshots/` +
   DEVICE-TEST-PLAN appendix; re-shoot the store listing set showing the
   Extras onboarding and one expressive theme.
8. **Cody import (user-run)** — `export BASALT_SEED_PASSWORD='…'` then
   `npx tsx --env-file=.env scripts/importCody.ts --dry-run`, paste the
   output, then the real run; IMPORT-REPORT.md follows.

## 3 · After the session

- Fix anything red, re-run §1, rebuild AAB + universal APK if code
  changed, update PLAY-SUBMIT-TODAY.md, upload to the closed track with
  the 0.2.0 release notes (every Extra listed + defaults stated).
