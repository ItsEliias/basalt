# Basalt — Device Test Plan

Everything needing hardware verification, grouped by native module, ordered so one session
covers it all. Prereq: rebuild the dev client first (`npx expo prebuild && npx expo run:android`
or an EAS dev build) — six native modules and one manifest change landed since the last build.

Legend: each line is a checkbox; note failures inline with device + Android version.

## 0 · Build & boot
- [ ] Dev client builds clean (no manifest-merge errors — the FGS `health` type + widget
      receiver are the new manifest touches)
- [ ] App boots, signs in, Today loads

## 1 · Health Connect (`react-native-health-connect`)
- [ ] Connect flow requests the full 26-permission set
- [ ] Sleep + stages appear on Recover after a sync; steps on Today
- [ ] **Vitals rollups**: after a night with HRV/RHR data, `basalt_vitals` rows exist and
      Recover's Baselines card fills (needs 7 days for bands — verify rows at minimum)
- [ ] Readiness number appears once 3+ components exist; tap-through math sheet lists inputs

## 2 · Foreground service + notifications (notifee, `health` FGS type)
- [ ] Start a guided timer → ACTIVITY_RECOGNITION runtime prompt appears (first time)
- [ ] Screen off 2+ minutes mid-timer → timer correct on wake, sets auto-logged during gap,
      haptics did NOT machine-gun on resume
- [ ] Silent ongoing notification shows phase; updates on phase change only
- [ ] Rest timer: notification counts down in 10 s buckets
- [ ] Decline ACTIVITY_RECOGNITION → honest srcnote fallback, no crash, timer runs app-open
- [ ] Notification tap opens the app

## 3 · Scheduled notification (`expo-notifications`)
- [ ] Settings → Week in Review toggle on → permission prompt (Android 13+)
- [ ] Test-fire: set device clock near Sunday 18:00 (or temporarily reschedule) → notification
      arrives; tap lands on Trends (test cold start too)
- [ ] Toggle off cancels (no notification after)

## 4 · Camera + images (`expo-camera`, `expo-image-picker`, `expo-image-manipulator`)
- [ ] Barcode scan still works (regression)
- [ ] Food photo attach: camera + gallery, preview, upload; thumbnail on Today receipt
- [ ] AI meal photo: capture → suggestions with ~; foodless photo → honest empty
- [ ] Label scan: real nutrition panel → transcribed draft; kJ-only label converts and says so
- [ ] Photo-later queue: stash, kill app, reopen — queue intact; estimate → dequeues
- [ ] Progress photos: guides visible, ghost overlays previous same-pose shot, front/side/back
      tags, compare view renders both

## 5 · Maps (`@maplibre/maplibre-react-native`)
- [ ] Walk summary map renders (dark tiles, accent route, start/end markers, scale bar)
- [ ] Recent-walk expanded map renders; gestures are OFF (static tile)
- [ ] Generated loop renders on the map with honest achieved-vs-requested text

## 6 · Location + speech (`expo-location`, `expo-speech`)
- [ ] Record a real walk: fix filters behave, splits sensible, save lands in recent
- [ ] Voice splits ON → spoken announcement at 1 km with pace
- [ ] Loop generation from real location returns a plausible loop (or an honest error)
- [ ] Beacon: start → link shares; second phone/browser opens `basalt.itseliias.com/beacon/#…`
      and sees position updating (~20 s cadence); indicator visible in-app; stop → page says
      "Sharing has ended"; walk-stop also ends it

## 7 · Widget (`react-native-android-widget`)
- [ ] BasaltToday appears in the widget picker with its description
- [ ] Added widget shows energy + water from the last Today view, with "as of" age
- [ ] Hide-the-numbers ON → widget goes log-only
- [ ] Tap opens the app; widget updates after reopening Today

## 8 · Print + share (`expo-print`, `react-native-view-shot`, `expo-sharing`)
- [ ] Doctor report generates a PDF; sections with no data say so; share sheet works
- [ ] Share cards capture correctly (walk with route drawing, PRs, Week in Review) — no black
      captures, correct dark background
- [ ] Exports still share: JSON, sectioned CSV, and the zip archive opens with README +
      per-table files; progress-photo toggle includes/excludes the table

## 9 · Timers under real conditions (no module — behavior)
- [ ] EMOM/Tabata/circuit presets run correctly; circuit label walks stations/rounds
- [ ] Superset commit scrolls to the partner card
- [ ] Wall-clock catch-up: airplane-mode + screen-off gap replays correctly

## 10 · Fasting + check-ins (plain RN — smoke only)
- [ ] Fasting toggle in Settings gates the Recover card; start/end round-trips
- [ ] Check-in chips + mood persist across app restarts (one row per day)

## Appendix — V3 batch (2026-08-31). Everything below needs the dev-client REBUILD first
(two new native modules: `expo-speech-recognition`, `react-native-ble-plx`).

### 11 · Offline outbox (no module — behavior)
- [ ] Airplane mode → log food (single + Tray), water, weigh-in, check-in → Settings shows
      the pending line; radio back on → drains within ~60 s or on tap; rows appear once, never twice
- [ ] Kill the app with writes pending → relaunch → they still drain (AsyncStorage survival)

### 12 · Logging speed lanes
- [ ] Tray: add three items across barcode + search + manual, live line updates, one commit
- [ ] Favorite tap = instant log; long-press opens portion edit
- [ ] Fill-the-gap card: rows match the stated gap; tap lands in the Tray, not the ledger
- [ ] Voice (needs rebuild): mic control appears; disfluent speech lands in the box; final
      transcript auto-estimates; ranges wear ~; airplane mode shows the honest error

### 13 · AI lanes (live functions)
- [ ] On-hand recipes: proposals use only listed ingredients + the four staples; missing
      list is concrete; tap opens the editable draft with ~ macros
- [ ] Recipe OCR: photograph a cookbook page → title/ingredients/steps transcribed,
      unreadable parts named in the note
- [ ] Routine photo: screenshot of a plan → day-by-day preview, unmatched names mappable,
      saves as templates; re-import does not duplicate templates (it will duplicate names —
      known: templates have no ext_id; delete manually)

### 14 · Programs, race plans, volume
- [ ] Start a 6-week block → suggestions shift by phase; planned-rest days hold the streak
- [ ] Race plan: create from a recent result → predicted time plausible; tick a week's
      sessions; skip a week → ramp-back note appears with the published rule
- [ ] Trends weekly-volume card matches the sets actually logged this week (spot-check one region)

### 15 · Walks: guided, shoes, glance, nudge
- [ ] Guided walk: phase change = vibration first (double-heavy up / single-light down),
      then voice; script end announces and recording continues
- [ ] Shoe picked → saved walk adds km to that shoe; threshold line states, never nags
- [ ] Glance mode readable at arm's length in sunlight; toggle persists
- [ ] Route nudge (loop on screen, toggle ON): walk >50 m off → exactly one buzz;
      return and leave again → one more

### 16 · BLE scale (needs rebuild + a standard-profile scale)
- [ ] LISTEN → step on → reading fills the field; save untouched → source ble_scale;
      edit first → source manual; no scale found → quiet listening state, no crash
- [ ] A non-standard scale simply never produces a reading (no invented values)

### 17 · Sharing (two devices / two accounts)
- [ ] Create coach grant → code claims once on the second account; viewer shows granted
      domains only; walks show WITHOUT route lines anywhere
- [ ] Revoke on the owner → viewer refresh on the grantee is empty immediately
- [ ] Cycle domain: invisible unless granted by itself

### 18 · Cycle, co-op, tiles, sleep need, deviation, monthly report
- [ ] Cycle card: opt-in line → chips write days; estimate appears only after two cycles
- [ ] Co-op: pair two accounts → dots render both sides; end pair → dots stop immediately
- [ ] Hide a Today section in Settings → it is GONE from both layouts (no ghost); energy
      hero cannot be hidden
- [ ] Sleep need card math opens; strained nights show "+30 min need"
- [ ] Vitals-deviation card only when ≥2 vitals sit outside their 30-day range (hard to
      stage honestly — verify absence on a normal day)
- [ ] Monthly notification (1st, 18:00 — or reschedule device clock) opens Trends

## Appendix — V3.1 morning batch (2026-09-01). Needs the vision-camera rebuild
(one new native pair: `react-native-vision-camera` + `react-native-worklets-core`).

### 19 · Breathing pacer + tempo metronome
- [ ] Pacer is a SQUARE (no circle anywhere), scales with breath, haptic on each phase change
- [ ] Session lengths 1–5 min; running state shows elapsed-of-total; logs with the pattern named
- [ ] 4-7-8 and box show the breath-hold caution srcnote
- [ ] Tempo 3-1-1 toggle on a timed exercise: heavy/light/medium beats during WORK only;
      survives app restart per-exercise; a screen-off catch-up never machine-guns haptics

### 20 · Sleep card additions
- [ ] Nap day: "need X − nap Y = Z remaining" math row; nap credited in the debt but the
      need median unchanged
- [ ] Bedtime window line appears once 14 nights + 7 wakes exist; formula in the math sheet
- [ ] "Bedtime varies ±X min" line with the MAD math; a midnight-crossing week isn't ±700

### 21 · Weather + formulas page
- [ ] Check GPS → weather line + Open-Meteo srcnote; airplane mode → no line, no crash
- [ ] basalt.itseliias.com/formulas renders on the phone; spot-check three numbers against the app

### 22 · Camera HRV bench (H1)
- [ ] Waveform shows a pulse within ~5 s of a good finger placement
- [ ] Clean seated read: PASS with plausible RMSSD; log against watch → Δ in the table
- [ ] Deliberate bad reads (pressure/movement/standing) → DISCARDED with named reasons
- [ ] Mean |Δ| over ≥3 clean pairs decides ship-on vs ship-off-behind-flag

### 23 · Offline tiles (H2)
- [ ] CARTO (no key): walk map shows the caching-off srcnote; airplane mode → route line only
- [ ] With a Stadia key in .env: cache a route (MB shown ≤40), airplane mode → tiles render
      along the corridor; blank outside it; tap-to-remove works

### 24 · Mobility (H3)
- [ ] Three routines run end-to-end; totals match their names exactly
- [ ] Haptic at every transition/hold change; usable fully silent, screen stays awake
- [ ] Bilateral stretches do both sides; transitions never under 10 s
- [ ] Assessment reorders stretch order only; completed routine logs; partial never logs

### 25 · Actions pass (V3.3)
- [ ] Six-theme sweep: no screen renders Minimal's palette in another theme
      (macro names ink, dots colored, paper themes fully legible) — the
      themeBypass test guards imports, this verifies rendering
- [ ] Set rows: tapping ✓ commits (row un-ghosts, rest timer starts);
      tapping again reopens; keyboard-dismiss still commits; ✓ target
      comfortably hittable with a sweaty thumb
- [ ] End session lives in the header; RPE sheet cancels cleanly
      ('cancel — keep training') without ending anything
- [ ] Tray: bottom commit bar shows running total; 'Log N items' commits
      all-or-nothing; Clear empties without logging
- [ ] Capture modes: 44dp segments at the bottom of the capture area
      switch correctly; active segment obvious in all six themes
- [ ] Start walk: pinned bar shows over scrolled weather/shoes; GPS
      accuracy in the bar matches the card
- [ ] Quick-log +: 56dp, filled mark/markOn in every theme, opens the sheet
- [ ] SrcNote folding: long notes collapse to one line + why→; expanding
      in place doesn't shift surrounding cards; short notes never fold
- [ ] Trends: checked-not-shown folds to the one-line summary and expands
      in place with r values
- [ ] Settings: section switches flip Today sections live; Recover's
      Track cycle button enables the card
- [ ] Water tile shows 'Nothing logged yet · target ml' before first entry
- [ ] Guided timer: countdown at hero size while counting; readable at 2 m

### 26 · Play closed-test additions (2026-09-07)
- [ ] Settings › Account › Send feedback: opens the mail client with
      to=itseliiasstudy@gmail.com, subject "Basalt feedback v0.1.0", and the
      body pre-filled with app version+build, active theme, device model and
      Android version — all correct for THIS device, nothing sent silently
      (the row itself is theme-token styled; check a non-Minimal theme too)
- [ ] Settings › Account › Privacy policy: opens basalt.itseliias.com/privacy
      in the browser
- [ ] Delete account (QA/burner account only!): completes with "sign-in
      record" gone — signing in again with the same credentials fails
      (deletion is unconditional as of 2026-09-07)

### 27 · Release-build pass (0.1.0 AAB → universal APK, emulator, 2026-09-07)

Artifact: `app-release.aab` (98.8 MB, main HEAD, upload-key signed) →
bundletool 1.18.2 `--mode=universal` → installed over a clean uninstall.
Shots: `docs/report-assets/release-0.1.0/`.

- [x] Adaptive pillars icon renders (App-info page) — `app-icon.png`
- [x] Cold boot on Hermes/minified JS, no Metro: sign-in → Today with live
      targets — `today-signin-ok.png`
- [x] Theme picker opens with live previews; Candy Rings staged + confirmed;
      Fredoka lazy-loads from the per-file requires — `theme-picker.png`,
      `candy-applied.png`
- [x] Pebble card: fresh install = all off; master → voice dependency;
      both enable and persist (static-import revoice path, no error) —
      `pebble-toggles.png`
- [x] Pebble sleep-debt bubble above the ring hero in release —
      `pebble-bubble.png`
- [x] Send feedback fires the mailto intent → Gmail picks it up (no mail
      account on the AVD, so the pre-filled compose could not render; the
      subject/body content is pinned by the 4 feedbackModel tests) —
      `feedback-mail-intent.png`
- [x] Privacy-policy row opens the browser with the URL (Chrome first-run
      gate on this AVD blocks the page render; intent verified)
- [x] Quick-log + → WATER +250 commits instantly; water card shows
      250 / 2,700 ml — `water-250.png`
- [x] Week-review toggle: Android 13 POST_NOTIFICATIONS prompt → Allow →
      on; scheduled through voicedContent with Pebble voice on, so next
      Sunday 18:00 delivers as "Pebble · Basalt" — `weekreview-on.png`
- [ ] NEEDS A PHYSICAL DEVICE (environment limit, not a carried-forward
      red): guided-timer + walk foreground services with the screen off
      (§2/§6) — the AVD's system server ANRs under load make FGS timing
      claims dishonest here
- [ ] Delete-account full run (§26) — needs a burner account; deletion is
      Edge-deployed (v13) + pinned by 8 deletion-coverage tests

## §28 — 0.2.0 pre-tester device session (RUN 2026-09-08, Samsung S22 Ultra, Android 16)

Protocol: v4 debug dev-client + Metro switching between main@8323e32 and
v4 HEAD (same native binary both sides — the purest JS-diff); seeded QA
account regenerated first; capture via `scratchpad/gateshots.sh`
(tab-bar-region tap matching, doubled taps, LogBox-banner dismissal —
this phone eats first-taps and the dev banner overlaps the tab bar).

1. **Defaults-vs-main gate: PASS.** 12 screen pairs in
   `docs/report-assets/v4-gate-{baseline,defaults}/`. train.png and
   trends.png pixel-identical (0.34% = status-bar only). Every other diff
   maps to the expected list: intake-range line under the Today hero;
   Log loses Planner, gains PLATE mode; Recover swaps the photos/cycle
   cards for the Mind card; Settings swaps the fasting toggle for the
   Nutrition-plan card + Extras card + rings layout chip. Residual noise
   explained: frequent-at-this-hour and recovery windows follow real
   clock time between runs.
2. **All-off run (informational): recorded** in
   `docs/report-assets/v4-alloff/`. today-scroll/train/trends identical
   to main (0.04%); log.png 12.2% = capture modes hidden, exactly the
   pre-approved expected diff.
3. **Crisis path: FULL PASS on the release build.** All three
   self-expression entry points fire the crisis screen — Mind note
   (wellbeing Extras OFF), coach question and journal entry (Extras ON)
   — with correct AU numbers from the SIM region (Lifeline 13 11 14
   call + 0477 text, 000, findahelpline.com), and the note/entry still
   saves (verified on-screen after dismissal). Shot:
   `docs/report-assets/v4-device-session/crisis-sheet-mind-note.png`.
4. **Release build (universal APK from the AAB)**: cold-boots on Hermes
   with no Metro; sign-in, seeded Today with the range line, New-in-
   Basalt flow, Settings switches, journal save, streaks card with its
   verbatim published rules on Trends — all green. Both widget providers
   (BasaltToday, BasaltReadiness) registered with the system.
5. **BUG (P1, fix before next build): health-type foreground services
   crash on targetSDK 36.** Starting the meditation timer killed the app:
   `SecurityException: Starting FGS with type health … requires
   FOREGROUND_SERVICE_HEALTH (declared ✓) AND one granted runtime
   permission of [ACTIVITY_RECOGNITION, health READ_*]` — none granted on
   a fresh install without Health Connect. `timerService.ts` (guided set
   timer, V3) starts the same FGS type and has the same latent crash —
   this is what §27 couldn't verify on the AVD. Fix queued in Phase 8:
   meditation → scheduled one-shot bell notifications (no service);
   guided timer → FGS only when a qualifying permission is granted,
   plain ongoing notification otherwise.
6. **BUG (P2): Settings header reads "V0.1" on the 0.2.0 build** —
   version string not wired to the build. Fix in Phase 8 wrap.
7. **Fixed during the session** (commit 96b7c03): the 7-row More-tools
   offer pushed its buttons off-screen with no scroll (CTA-reachability
   law) — grouped offer checklists now scroll with the buttons pinned.
8. **Cosmetic findings**: 6 capture modes wrap the BARCODE chip onto two
   lines; the plan-rate chips wrap raggedly on the Nutrition-plan card.
9. **Deferred to the post-Phase-8 session, with cause** (this build is
   replaced by Phase 8, which rewrites onboarding and carries the FGS
   fix): onboarding end-to-end with a throwaway account (+ §26
   delete-account run), rich walk notification + pause on the lock
   screen, physical widget placement, hydration notification firing,
   store screenshots.

### §28.10 — Post-Phase-8 session (same day, second run, release universal APK)

Fresh install of `basalt-0.2.0-universal.apk` (Phase 8 build a68c40a),
burner account `readme.shot+p8@example.com` created in-app. Shots in
`docs/report-assets/v4-device-session/p8-*.png`.

1. **Onboarding end-to-end: PASS.** All 12 core steps on the real
   keyboard, gym path — experience, schedule, equipment with weights,
   limitations chips + medical line, diet extras, waist, theme, detail
   level (three live Today previews render from the theme-picker
   component). Targets computed on finish; Today landed seeded with real
   intake maths, no placeholder zeros anywhere.
2. **Generator live: PASS, matches worked example 1.** Intake (new to
   training, 3 days, ~40 min, bodyweight-only, knee limitation) →
   Full body ×3, 3×10–15 accessories, knee-capped squat pattern,
   "bodyweight — progress by reps" load lines, rules sheet published
   in-app (`p8-generator-{week,rules}.png`). KEEP wrote three ordinary
   templates + an active 8-week programme (`p8-programme-active.png`,
   `p8-templates.png`).
3. **BUG (P1) found + fixed in-session (commit 8a6b208):** starting a
   session from a generated (name-only) template added zero exercises —
   `''` sent as a uuid to `set_entries.exercise_id`; on-screen error
   captured in `p8-bug-uuid-error.png`. Both call layers now coerce
   `'' → null`. Verified by code path + tests; device re-verify rides
   the next install.
4. **Generator entry placement fixed (commit 9d930a6):** the 8c "build
   my programme" row is core (Program card), no longer gated behind the
   off-default programmes Extra.
5. **Detail level on device: PASS.** Simple Today rounds the hero and
   words the macros (`p8-today-simple.png`, QA account: hero 280 for
   283, "carbs and fat on track", MORE affordances); standard shows the
   numbers (`p8-today-standard.png`). Today renders identically at
   standard and full **by design** — full's additions surface in the
   plan maths and why-sheets; pinned by
   `p8-plan-full.png` ("BMR 1,805 kcal · TDEE 2,290–2,799 kcal · rate
   0 kcal/day — the maths, inline because you asked for Full").
6. **Promise screen: PASS** (`p8-promise.png`) — full does/doesn't list
   readable on device, srcnote footer intact.
7. **§26 delete-account: FULL PASS** (closes the §26 carryover). Type-
   DELETE flow ran on the burner; client returned to sign-in; SQL
   verified 0 auth rows for the address and 0 orphan `basalt_profiles`.
8. **Meditation (rewritten to scheduled bells): no crash.** Extra
   flipped on, timer started from Recover — app stayed alive (the §28.5
   FGS crash is gone). Bell-at-interval firing not held for — verify by
   ear in normal use.
9. **Fixed in-session (commit 39886ce):** Settings doctor-report row
   said "last 30 days"; the collector has been 90 days since Phase 4.
10. **Automation gotchas (append to the list):** the Settings screen
    renders its own ⚙ at the same header coords — a doubled tap opens
    then closes it (use verified single taps); the floating + FAB owns
    roughly y>1950, so rows/chips near the scroll bottom must be nudged
    above it before tapping (three separate captures hit the quick-log
    sheet instead); RN chip rows expose only `content-desc` on a
    non-self-closing ViewGroup node — text-node matching misses them.
11. **Still deferred to manual/next pass:** set-commit + pain chips in a
    live session (uiautomator can't idle while the session clock ticks),
    rest-notification firing, walk notification + lock-screen pause,
    physical widget placement, hydration reminder firing, store
    screenshots refresh.
