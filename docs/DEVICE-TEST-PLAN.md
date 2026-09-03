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
