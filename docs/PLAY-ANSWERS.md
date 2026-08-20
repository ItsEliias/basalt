# Play Console — Draft Answers (transcribe, don't decide)

**Status: DRAFT** — answers assume the privacy policy is published at its final URL
(placeholder below: `https://<pages-url>/privacy.html`) and AI quick-add stays enabled.
If either changes, revisit the marked answers.

## 1 · Data safety form

### Data collection & security (top-level questions)

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** (collects; does not share for advertising) |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (TLS to Supabase and every named endpoint) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app full deletion + web request page (`https://<pages-url>/delete-account.html`) |

### Data types — declare COLLECTED (not shared) unless noted

| Category | Type | Collected | Purpose | Notes |
|---|---|---|---|---|
| Personal info | Email address | Yes, required | Account management | Sign-in identity (Supabase Auth) |
| Health & fitness | Health info | Yes, optional | App functionality | Food/nutrition logs, weight, sleep (+stages), water, mindfulness, conditions/medications the user opts to note; Health Connect reads the user approves |
| Health & fitness | Fitness info | Yes, optional | App functionality | Workouts, sets, walks |
| Location | Precise location | Yes, optional | App functionality | GPS walk routes, only while recording a walk; stored in the user's account; never shared |
| Photos & videos | — | **No** | — | Camera is used on-device for barcode scanning; no image is stored or uploaded (declare camera use, not photo collection) |
| App activity / App info | — | **No** | — | No analytics, no crash reporting, no advertising SDKs |

**"Data shared" section:** declare **user-provided food descriptions are processed by a
service provider (Anthropic)** when the user invokes AI quick-add. Play's definition of
"sharing" exempts service providers processing on the developer's behalf — Anthropic is a
service provider under their commercial API terms (no training on API data). Answer the
ephemeral-processing question **Yes** for this flow (the text is processed to return an
estimate; Anthropic API data is not used for training). State it in the privacy policy
regardless — it is stated there.

**Account deletion URL:** `https://<pages-url>/delete-account.html`
**Privacy policy URL:** `https://<pages-url>/privacy.html`

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
| Privacy policy explains HC data use? | **Yes** — dedicated Health Connect section at `https://<pages-url>/privacy.html` |

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

## 4 · Revisit-if

- AI quick-add disabled → remove the Anthropic service-provider declaration.
- Photo attachments ship → Photos becomes a collected type (opt-in, app functionality).
- Tile provider swap → no data-safety change (tile fetches reveal only viewed map area, no
  user identifier is sent), but keep the privacy policy's provider name current.
