# Basalt — V2B Report (Recover & Analytics + Outdoor + Body & Retention)

**Date:** 21 August 2026 · **Status:** units 9–17 complete; the full 17-unit batch is done.
**Suite: 473 tests green** (core-data 26, ui 19, analytics 42, training 142, nutrition 129,
health-connect 31, app 84); `tsc --noEmit` clean everywhere. Every unit branch → tests →
`--no-ff` merge. V2A (units 1–8) is in `docs/V2A-REPORT.md`; hardware verification is
`docs/DEVICE-TEST-PLAN.md`.

## Recover & analytics

9. **Readiness + vitals persistence** — `basalt_vitals` (applied live) holds daily HRV-median
   and resting-HR rollups from the HC sync (median per night, so one rMSSD outlier can't set
   the day). The readiness number is four published 0–25 components — HRV and RHR as ratios
   against *your* 30-day medians, sleep vs target, prior-day load against *your* P75 — with
   the literal math in every component's detail string, one tap away. Real-or-hidden is
   structural: 7+ baseline days per vital, 3+ components or **no number** (a 3-of-4 day is
   scored out of 75 and the note names the gap). Recover also gains the 30-day baseline-band
   table (min–median–max, 7+ real days or no band).
10. **Journal check-ins → correlations** — `basalt_checkins` (applied live): five boolean
    factors + optional mood 1–5, one row per day, upserted as chips are tapped, never scored.
    The correlations pair list stays fixed and published; factors pair with the *next*
    morning's sleep row (evening facts, lag 1 — the date arithmetic is commented in the pair
    list), mood pairs same-day with sleep and steps. Same gates, same disclaimers,
    checked-not-shown picks the new pairs up automatically.
11. **Fasting module** — off by default (`profiles.fasting_enabled`). Stage descriptions stick
    to commonly described physiology ranges with the disclaimer as a constant; a
    banned-vocabulary test pins that detox/autophagy/boost language cannot creep in, and the
    24 h+ stage points at medical guidance rather than deeper fasting. One active fast at a
    time, enforced server-side in the service.

## Outdoor

12. **Routes** — `route-loop` Edge Function (deployed; live smoke returned a real 2.04 km loop
    of 164 footpath points over central Sydney in 6 s): Overpass walkable ways, heap-Dijkstra
    to a half-distance turnaround, return leg with used edges penalized ×3. The achieved
    length is stated *next to* the request, never rounded into agreement; surfaces/closures
    are declared unverified. First smoke melted the worker CPU cap on O(n²) selection — both
    the function and the mirrored pure engine (9 tests) now run the binary-heap version.
    **Matched routes** (5 tests): arc-length resampling, direction-agnostic similarity, greedy
    clustering; "your usual loop · median time" annotates matching recent walks at 3+ visits.
    **Voice splits**: opt-in OS text-to-speech every whole km.
13. **Beacon** — user-initiated live-location sharing: explicit start (share sheet with the
    link), explicit stop, 2-hour hard expiry, one active beacon per user server-enforced,
    bordered in-app indicator stating exactly who can see what. The Edge Function was
    deployed *without* gateway JWT so the public GET works, with every mutation validating
    the JWT itself — the full lifecycle was live-smoked including the honest
    ended/expired/unknown answers. The public page (basalt-site `/beacon/`, noindex) shows
    only the latest position — no name, no history, no route. Privacy draft + PLAY-ANSWERS
    updated: location is "shared" only in this user-initiated flow.

## Body & retention

14. **Progress photo vault** — second private bucket + metadata table (applied live). Capture
    with alignment guides and a 28%-opacity ghost of your previous same-pose photo;
    front/side/back tags; first-vs-latest compare. Excluded from exports unless the Settings
    toggle opts in; delete-account (redeployed) wipes both buckets and the table.
15. **Widget + notification rest timer** — the BasaltToday home-screen widget renders the
    snapshot Today last computed, *always stamped with its age* ("as of 7 h ago", never posing
    as live); hide-the-numbers carries through to the home screen (pinned); no snapshot says
    "Open Basalt", never zeroes; the headless task touches storage only. The session
    notification now counts rest down in 10-second buckets, exact inside the final five.
16. **Doctor PDF** — the one deliberately light surface (it renders for paper): weight trend
    with every weigh-in tabulated, sleep, activity, 30-day vitals bands; sources named per
    section, absent data *stated* rather than dropped, and a header that says plainly it is
    self-recorded consumer-device data, not a clinical record. Pure composer, 4 tests,
    markup-escape pinned.
17. **Year in Review + monthly challenge** — the year composer applies Week-in-Review
    discipline at year scale (one gap, no cheerleading pinned, refuses to compose under 90
    logged days / 45 sessions). The challenge is a *private* target from your own baseline
    (step median ×1.1 on 20 days, or +1 session/week capped at 5), opt-in and off by default,
    no leaderboards, no badges — and no baseline means no challenge, with the empty state
    explaining why.

## Cross-cutting

- **delete-account** grew with every unit and now wipes 26 user tables + profiles + two
  storage buckets; `basalt_exercises` remains the only excluded table (global catalog).
- **Export** covers every new table; progress photos stay out unless opted in.
- New native pieces this half: `expo-speech`, `expo-print`, `react-native-android-widget`
  (+ its config plugin and widget registration in `index.ts`).
- PLAY-ANSWERS and the basalt-site privacy draft were updated in-stride (photos, beacon).

## Needs you (carried forward + new)

1. Privacy pages: review (now including the **beacon** section and the updated photos note),
   contact email, DRAFT banners off. DNS for `basalt.itseliias.com` → `itseliias.github.io`,
   then HTTPS enforcement.
2. Tile key (Stadia recommended) into `app/.env`.
3. **Dev-client rebuild + the device-test plan** (`docs/DEVICE-TEST-PLAN.md`) — six new
   native modules since the last build.
4. Play Console + HC declaration transcription when the privacy URL is final.
5. ExerciseDB GIF license (media slots are waiting), HealthKit (deferred), DECOMMISSION
   (still gated on your explicit go).
