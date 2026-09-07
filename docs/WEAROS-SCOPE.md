# Wear OS scope — not this branch

Decision (V4 Phase 3): no Wear OS work ships in v4-extras. This file records
what a Basalt tile would actually require, so the next branch that picks it up
starts from facts instead of optimism.

## What a tile would show

Same contract as the home-screen widgets — data as of the last time the phone
app computed it, age always stated, never invented:

- **Today tile**: energy remaining (or "N over" in words), water ticks.
- **Readiness tile**: last computed score or "No number", with age.

## What it would need

1. **A separate Wear OS module.** Tiles are native (`androidx.wear.tiles` /
   `ProtoLayout`, Kotlin) — react-native-android-widget does not target Wear.
   That means a `wear/` Gradle module with its own manifest, SDK levels
   (minSdk 30 for Tiles 1.2), and a second APK/AAB bundled via the same
   applicationId + Play multi-artifact upload.
2. **A data channel.** The phone app publishes the same snapshots it already
   writes for widgets (`basalt.widgetSnapshot`, `basalt.readinessSnapshot`)
   over the Wearable Data Layer API (`com.google.android.gms:play-services-wearable`)
   — a new native dependency on the phone side, which V4 has avoided so far.
   No network calls from the watch; the watch never talks to Supabase.
3. **Expo config plugin work.** Expo does not manage Wear modules; the module
   would be hand-maintained under `app/android/` the same way the widget
   receivers are (no prebuild — the hand-edited signing config must survive).
4. **Build + test surface.** A Wear emulator image in CI/dev loop, tile
   preview screenshots in DEVICE-TEST-PLAN, and a physical watch for the
   pre-tester pass. None of this exists today.
5. **Honesty review.** Tiles refresh on a system-controlled cadence; the age
   line ("as of 41 min ago") is what keeps a stale number honest. The
   snapshot contract already carries `at`, so this transfers cleanly.

## What it would NOT need

- No new backend work — the watch reads phone-published snapshots only.
- No new Extras entry decision: it would sit under the existing `widgets`
  Extra (off by default) like the home-screen widgets do.

## Cost estimate

A first Today tile is roughly: Wear module scaffold + Data Layer publisher +
ProtoLayout tile + Play multi-artifact plumbing — a branch of its own, not a
line item. Stop here.
