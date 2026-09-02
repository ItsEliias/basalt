# README screenshot pipeline — repeatable capture procedure

Screenshots rot. This procedure regenerates every README image from scratch
after any UI change, on an emulator, against the seeded 90-day test account,
with a clean status bar. Nothing in `docs/readme-assets/` is hand-made.

## Prerequisites (one-time)

- Android emulator AVD (any recent Pixel image; captures in this repo used
  `Pixel_10_Pro`, 1280×2856).
- A debug build installed: `cd app/android && ./gradlew assembleDebug`,
  then `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
- Metro running (`cd app && npx expo start`) + `adb reverse tcp:8081 tcp:8081`.
- `pngquant` optional; without it the snap script compresses via Pillow.

## Per-run setup

```bash
emulator -avd Pixel_10_Pro -no-snapshot-save -no-boot-anim &
adb wait-for-device

# Fresh, deterministic 90-day dataset ending today (wipe-and-regenerate):
pnpm seed:test-account

# Deterministic rendering:
adb shell "settings put global window_animation_scale 0; \
           settings put global transition_animation_scale 0; \
           settings put global animator_duration_scale 0"

# Sign in as the committed QA account (cody.liddell.01@gmail.com / TEST123).
# Dev-build note: dismiss the yellow LogBox banner (tap its ×) if it appears;
# it must never be in a committed shot.
```

Every capture goes through `scripts/readme-shots/snap.sh <name>`, which
(re)applies **adb demo mode** — fixed 09:00 clock, 100% battery, wifi, no
notification icons — captures, pulls to `docs/readme-assets/<name>.png`, and
compresses. `scripts/readme-shots/tap.sh "<visible text>" [nth]` taps
elements by accessible text via uiautomator, so runs don't depend on
hardcoded coordinates.

## PII rule (checked on every run)

No committed shot may show a real name or any email address, including the
QA account's. The auth screen is never shot signed-in; Settings shots must
be of sections that don't render the account email. If a future screen adds
one, crop or use the display-name field — never commit it.

## The shot list

All walkthrough shots in the **Minimal** theme (the default). Names are the
committed filenames. Navigation is from a cold app open unless stated.

| file | screen | how to reach / state to arrange |
|---|---|---|
| onboarding-goals | Onboarding, goals step | Create a throwaway account (readme.shot+N@example.com) → shoot the goals step → delete the account afterwards (Settings → Delete, or admin) |
| today-ledger | Today, Ledger layout | default after sign-in; seeded day visible |
| today-tiles | Today, Tiles layout | Settings → Display → Today layout → Tiles; back to Today |
| today-overcap | Macros card with an over-cap row | log sugary items until the sugar cap row reads "N over"; shot the macros card region |
| today-hidden | Hide-the-numbers Today | Settings → toggle hide numbers → Today |
| log-capture-modes | Log tab, capture entry points | Log tab; the mode row (barcode viewfinder default) shows BARCODE·SEARCH·MANUAL·AI·PHOTO |
| log-tray | The Tray mid-log | add 2–3 items via search "Add to tray"; shoot with the tray banner totals visible |
| log-ai-range | AI estimate: range + omissions | Log → AI → "chicken burrito and a large coke" → Estimate; shoot the ~low–high items + "Often forgotten" card |
| train-session | Session: set table + suggestion basis | Train → Start session → add a big-three lift (history exists) → suggestion line visible |
| train-guided | Guided set timer running | add a timed movement (e.g. plank) → Begin |
| train-plates | Plate calculator + warm-up ramp | in a session exercise with a working weight set |
| train-pr-matrix | Rep-PR matrix | exercise card → PR matrix section |
| walk-ready-weather | Walk start with weather line | Train → Outdoor → Check GPS (`adb emu geo fix <lng> <lat>` first) |
| walk-summary | Walk summary: map + splits | feed a ~1.2 km route via repeated `geo fix`, record, stop & save |
| share-card | Share card example | walk row → SHARE AS IMAGE |
| recover-readiness | Readiness + tapped-open math | Recover; tap the readiness card |
| recover-pacer | Breathing pacer mid-session | Recover → Mind → Begin (square mid-scale) |
| recover-mobility | Mobility routine mid-hold | Mind → Mobility → Morning 5 → Begin |
| recover-sleep | Sleep card: need/debt/window/consistency | Recover; tap sleep card for the math sheet |
| recover-ppg | Camera HRV bench + quality gates | Recover → CAMERA HRV (dev builds); emulator's virtual camera makes reads fail honestly — the DISCARDED state with named reasons IS the shot |
| trends-correlations | Correlations + checked-not-shown | Trends |
| trends-monthly | Monthly behavior report | Trends (needs a completed month in the window — seeded) |
| trends-week-review | Week in Review | Trends |
| settings-display | Themes / layout / text / density | Settings → Display card |
| settings-sharing | Sharing grants | Settings → Sharing (create a grant so a row shows; revoke after if desired) |
| settings-export | Export options | Settings → Your data |
| theme-minimal / theme-humanist / theme-athletic / theme-brutalist / theme-depth / theme-atelier | The SAME Today screen, six themes | Settings → Display → theme chip → Today → snap → repeat. Reset to Minimal afterwards |

Deliberate empty states are part of the product: at least one shot above
must show a real-or-hidden absence (e.g. a vitals tile with no source, or
the correlations card's "checked, not shown" list). Do not stage fake data
to fill gaps.

## After a run

```bash
ls -la docs/readme-assets/   # every shot present, every size sane
```
Update README image references + alt text if filenames changed. Alt text is
mandatory for every image — describe what the screen shows, not "screenshot".
