# Play submission report — 0.1.0 closed test (2026-09-07)

Branchwork: `v3-4-themes` and `play-submission` merged to main (--no-ff) and
pushed; every phase below ran on main. Suite: **1063 green** after the merges,
**1067** after this batch (feedback model +4).

## Phase 0 · Two questions answered

### Did yesterday's week-review fire as "Pebble · Basalt"? — No, and it could not have

Three independent reasons, all verified:

1. **The emulator was off on Sunday evening.** It crashed after the Sept-4
   session and was cold-booted again on Sept 7 (Monday) morning.
2. **The week-review toggle was off.** The Sept-7 08:21 Settings capture
   shows "Sunday 18:00 notification — off"; the crash had also rolled the
   app data back to its Aug-28 snapshot state.
3. **Pebble voice wasn't on yet.** The toggle was first enabled Monday
   ~08:26, after any Sunday-18:00 window.

Forward fix, done in the release pass below: week-review enabled on the QA
device with Pebble voice on — the voiced title is applied at schedule time
(`voicedContent`, model-pinned), so the next Sunday-18:00 delivery is the
real-world check.

### Why was the AAB 105 MB?

Audit of the 09:11 bundle (105.6 MB compressed / 315.8 MB uncompressed):

| Slice | Size (uncompressed) | Ships to a device? |
|---|---|---|
| BUNDLE-METADATA (native debug symbols) | 105.0 MB | Never — Play keeps them for crash symbolication |
| Native libs, 4 ABIs (maplibre 10.5 MB/ABI, RN, vision-camera…) | 137.5 MB | One ABI only (arm64 = 36.0 MB) |
| dex | 41.7 MB | Yes |
| res (incl. fonts, see below) | 24.2 MB | Yes |
| assets + misc | ~5 MB | Yes |

**A real phone downloads ≈ 50–60 MB**, not 105 — the AAB number is
inflated by symbols that never ship and by the three ABIs the device
doesn't take (x86/x86_64 exist for emulators).

**Fonts: the five theme fonts are NOT in the startup bundle, but they were
worse than that in the binary.** Registration is lazy per theme
(`expressiveFonts.ts`) — a Minimal startup registers none of them. The
audit found the real bug elsewhere: both App.tsx and the expressive
loaders imported @expo-google-fonts package *indexes*, so Metro shipped
every weight + italic of 13 families — **149 .ttf / 22.8 MB** for the 36
faces the themes actually declare. Fixed with per-file requires
(two commits): **36 .ttf / 6.4 MB, AAB 105.6 → 98.8 MB**. (The gradle
`createBundleReleaseJsAndAssets` task also stale-caches on font changes —
its generated `react` outputs had to be purged to make the trim land;
noted for future size work.)

## Phase 3 · Release build on device

- AAB rebuilt from main HEAD (post font-trim, post icons):
  `app/android/app/build/outputs/bundle/release/app-release.aab`
  (**98.8 MB**, versionCode 1 / 0.1.0, upload-key signed).
- Universal APK built from that AAB with bundletool 1.18.2
  (official google/bundletool release) and the upload key; installed on
  the emulator over a clean uninstall.
- Results: DEVICE-TEST-PLAN.md §27 (every check + screenshot paths).

All checks green on the emulator: cold boot on Hermes without Metro,
sign-in + live Today, theme picker with lazy Fredoka in release, Pebble
toggles + sleep-debt bubble, feedback mailto → Gmail, privacy link →
browser, instant water write, week-review enabled through the Android 13
permission prompt (scheduled in Pebble voice for next Sunday). Two items
are explicitly NOT device-verifiable here and stay open with reasons in
§27: the two foreground services with the screen off (the AVD's
system-server ANRs make timing claims dishonest — physical device), and
the burner-account deletion run (path deployed + 8 tests pin it).

## Phase 4 · Placeholder icons — the pillars mark

A programmatically drawn basalt colonnade (four hex-capped columns,
`#E8E6E1` on `--bg #0F1115`): adaptive icon (anydpi-v26 + per-density
foregrounds + background colour), legacy + round launchers, white
notification small icon with the `#3E9B78` accent via the
expo-notifications manifest meta. Written directly into `android/res`
because this repo hand-maintains its signing config in `build.gradle`
(prebuild would clobber it); `app.json` carries the same assets for any
future prebuild. The template's `.webp` launchers were removed (duplicate
resource collision). **Placeholder** — swap when the real logo lands:
regenerate `app/assets/*` + `docs/store-assets/{icon-512,feature-graphic}`.

## Phase 5 · Submission docs

- `docs/PLAY-SUBMIT-TODAY.md` — console walkthrough: account → content
  declarations (keyed to PLAY-ANSWERS.md) → listing → **closed-testing
  track** (`closed-alpha-1`, 14-day note, production gated on the
  decommission) → rollout.
- `docs/store-assets/` — `listing.md` (name/short/full copy, closed-test
  note, tester instructions **including the Send-feedback line**),
  `icon-512.png`, `feature-graphic.png`, six 2:1-cropped phone
  screenshots.

## Deviations from the phase order, declared

- Phase 4 (icons) ran before the Phase-3 build so the artifact under test
  IS the artifact for upload — otherwise the "final" AAB would never have
  been on a device.
- The font-trim (Phase 0's finding) also landed pre-build for the same
  reason.

## The one thing still on you

The DRAFT check: read basalt.itseliias.com/privacy/ + /delete-account/,
remove the DRAFT banners in `ItsEliias/basalt-site`, push. Then follow
`PLAY-SUBMIT-TODAY.md` top to bottom.
