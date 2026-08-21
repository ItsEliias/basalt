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
