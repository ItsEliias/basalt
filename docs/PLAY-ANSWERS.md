# Play Console — Draft Answers (transcribe, don't decide)

**Status: DRAFT** — answers assume the privacy policy is published at its final URL
(URLs below are final: `https://basalt.itseliias.com/`) and AI quick-add stays enabled.
**Both pages still carry a DRAFT banner pending your review — remove it before store submission.**
If either changes, revisit the marked answers.

## 1 · Data safety form

### Data collection & security (top-level questions)

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** (collects; does not share for advertising) |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (TLS to Supabase and every named endpoint) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app full deletion + web request page (`https://basalt.itseliias.com/delete-account/`) |

### Data types — declare COLLECTED (not shared) unless noted

| Category | Type | Collected | Purpose | Notes |
|---|---|---|---|---|
| Personal info | Email address | Yes, required | Account management | Sign-in identity (Supabase Auth) |
| Health & fitness | Health info | Yes, optional | App functionality | Food/nutrition logs, weight, sleep (+stages), water, mindfulness, conditions/medications the user opts to note; Health Connect reads the user approves |
| Health & fitness | Fitness info | Yes, optional | App functionality | Workouts, sets, walks |
| Location | Precise location | Yes, optional | App functionality | GPS walk routes while recording; stored in the user's account. **Shared only in the user-initiated live-beacon flow**: the user explicitly starts sharing a link showing their latest position to people they choose, with a visible in-app indicator, explicit stop, and a 2-hour hard expiry — never shared with any company |
| Photos & videos | Photos | **Yes, optional** | App functionality | Food-entry photos and progress photos the user chooses to take — both in private per-user buckets (RLS), shown via short-lived signed URLs, deleted with the record or the account; never shared. Progress photos are additionally excluded from data exports unless the user opts in. Barcode scanning remains on-device with nothing stored |
| App activity / App info | — | **No** | — | No analytics, no crash reporting, no advertising SDKs |

**"Data shared" section:** declare **user-provided food descriptions are processed by a
service provider (Anthropic)** when the user invokes AI quick-add. Play's definition of
"sharing" exempts service providers processing on the developer's behalf — Anthropic is a
service provider under their commercial API terms (no training on API data). Answer the
ephemeral-processing question **Yes** for this flow (the text is processed to return an
estimate; Anthropic API data is not used for training). State it in the privacy policy
regardless — it is stated there.

**Account deletion URL:** `https://basalt.itseliias.com/delete-account/`
**Privacy policy URL:** `https://basalt.itseliias.com/privacy/`

### Data deletion

- Deletion path: in-app (Settings → Delete account & all data, type-to-confirm) — immediate,
  full cascade including the auth record.
- Web path: the deletion page's email flow (reply-confirmation identity check, ≤7 days).
- No retention window; no partial retention. Answer "all data is deleted" without carve-outs.

## 2 · Health Connect developer declaration

Google's separate approval form for apps requesting HC permissions in production.

| Question | Answer |
|---|---|
| What data does your app read from Health Connect? | The 26 record types declared in the manifest (steps, sleep, exercise, vitals, body measurements, nutrition, hydration and related — the full list is pinned by test in `packages/health-connect/src/manifest.ts`) |
| Does your app write to Health Connect? | **No** — read-only |
| Primary use case | **Fitness and wellness**: displaying the user's own health and fitness data back to them in a unified ledger, with every synced value labeled with its source |
| Is HC data used for advertising? | **No** |
| Is HC data shared with third parties? | **No** — stored only in the user's own account (Supabase, RLS-scoped) |
| Is HC data used for machine learning? | **No** |
| Can users delete HC-derived data? | **Yes** — individually in-app, or entirely via account deletion (full cascade) |
| Privacy policy explains HC data use? | **Yes** — dedicated Health Connect section at `https://basalt.itseliias.com/privacy/` |

**Justification paragraph (paste-ready):** Basalt is a personal health ledger. It reads the
Health Connect record types the user explicitly approves and displays that data back to the
user in their own private ledger, each value labeled with its source. Data is stored only in
the user's own row-level-secured account, is never written back to Health Connect, never used
for advertising, model training, or any purpose other than displaying the user's own data to
them, and is fully deletable in-app.

## 3 · Foreground service declaration (Play may ask)

- Type: `health` (Android 14 typed service) — the guided workout set timer continues while
  the screen is off during an active, user-started training session.
- The service runs only during an active session, shows a silent ongoing notification naming
  the current phase, and stops when no timer is running.
- Permission backing the `health` type: `ACTIVITY_RECOGNITION`, requested at runtime; the
  feature degrades honestly if declined (timer runs only while the app is open).
- Second type: `location` — GPS walk recording continues with the screen off during a
  user-started walk, behind a visible ongoing notification with an explicit Stop action.
  Only while-in-use location permission is used (a foreground service is not "background"
  for Android's background-location permission); the service stops with the walk.

## 3b · V3 additions (2026-09-01) — new answers the batch introduces

| Surface | Data-safety impact |
|---|---|
| **Voice logging** (`RECORD_AUDIO`, OS speech recognition) | **Audio is NOT collected**: the operating system's own speech service transcribes on the device's account; only the resulting TEXT goes to the existing AI quick-add flow (same Anthropic service-provider declaration as typed text). Declare the microphone permission's purpose as app functionality; no "Audio" data type is collected or shared. If Play asks about the Google speech service, transcription is performed by the OS speech provider under the user's own device settings |
| **Bluetooth scale** (`BLUETOOTH_SCAN/CONNECT`) | No new data type — a weigh-in the user explicitly requests, stored like a manual one with a source tag. Declare "scan/connect for a user-initiated device pairing-free reading"; neverForLocation flag applies to BLUETOOTH_SCAN |
| **Sharing (coach/caregiver grants)** | This is USER-TO-USER sharing inside the app, not third-party sharing under Play's definition (data stays in the developer's backend; the user explicitly grants another account read access and can revoke). State it in the privacy policy; the data-safety "shared" answer stays No-except-Anthropic-service-provider |
| **Cycle tracking** | Falls under the existing Health info row (optional, app functionality). Explicitly excluded from every sharing preset; own opt-in domain |
| **1-v-1 co-op** | The only cross-account datum is a per-day boolean ("logged anything that day") published by the user's own device after explicit pairing. Covered by the user-to-user sharing note; no new data type |
| **Background work** (`expo-background-task`) | Periodic OS-scheduled sync of the user's own pending writes + the opt-in vitals notification. No new collection; mention under "data collected in the background" only if the form asks — answer: same data types, same purposes, user-initiated writes being retried |
| **Speech/BLE permissions strings** | Microphone: "so you can speak a meal instead of typing it" · Bluetooth: "to read weigh-ins from your smart scale — only when you ask it to" (verbatim from the manifest config) |

## 4 · Revisit-if

- AI quick-add disabled → remove the Anthropic service-provider declaration.
- ~~Photo attachments ship → Photos becomes a collected type~~ — landed (food-entry photos, optional); the data-safety table above reflects it.
- Live beacon landed → the location row above already reflects it (user-initiated sharing, not third-party sharing).
- Tile provider swap → no data-safety change (tile fetches reveal only viewed map area, no
  user identifier is sent), but keep the privacy policy's provider name current.
