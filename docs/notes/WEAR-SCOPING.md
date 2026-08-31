# Watch / Wear OS — scoping doc (NOT built, by V3 instruction)

What a Basalt watch presence would be, what it costs, and the order to do it in if ever.

## What the watch is for (and not for)

Basalt's watch story is **capture and glance, never dashboards**: start/stop a walk,
see the guided-walk phase, tick a set done with the rest timer on the wrist, +250 ml
water, and the energy-remaining number. Nothing on the wrist invents data; everything
syncs through the same service layer. No rings — the forbidden list applies at 40 mm
exactly as at 390 px.

## The cheap 80% that needs no watch app at all

1. **Health Connect is already the bridge.** Any Wear OS or Galaxy watch writing
   steps/HR/sleep to Health Connect already feeds Basalt — that pipe exists today.
2. **Notification surfaces.** The walk FGS notification and rest-timer notification
   already mirror to a paired watch for free, including their action buttons. Making
   those notifications action-complete (pause/stop on the walk, done-set on the timer)
   is plain Android work in the existing app, no watch SDK, and delivers most of the
   glance value.

## The real watch app (ordered, if ever)

| step | what | cost driver |
|---|---|---|
| 1 | Wear OS tile: energy remaining + water +250 (data-layer sync from phone) | Kotlin + Wear SDK; the app is Expo/RN — the watch module is a separate native project |
| 2 | Walk companion: start/stop, glance stats, guided-phase haptics on the wrist | Wear health-services APIs, standalone GPS decisions |
| 3 | Set-ticker for sessions with wrist rest-timer | Data-layer session state protocol |
| — | Apple Watch | Requires the iOS build to exist first (there is none); WatchKit/SwiftUI; not before an iOS decision |

## Costs to be honest about

- RN has no first-class Wear OS story: the watch app is a native Kotlin module in the
  Android project, with a data-layer protocol we then own forever.
- Watch testing needs physical devices; emulator coverage for health services is poor.
- Every watch surface doubles the theme/copy audit area (six themes × wrist).

## Recommendation

Do step 0 now-ish (action-complete notifications — it's phone-side and small), and
defer the tile/app until there's a user base asking for it. Apple Watch is gated on an
iOS build decision that hasn't been made.
