# Google Play — remaining tasks to finish the 0.2.1 closed test

Snapshot: 2026-09-10. Everything already answered is captured at the bottom
under "Prepared answers" so you never have to re-derive it. Work top-down.

Build to upload: `app/android/basalt-0.2.1-vc3-release.aab`
(versionCode **3** / **0.2.1**, package `com.itseliias.basalt`, feedback
email baked in as itseliias@proton.me). Upload the **.aab**, not the
universal APK.

---

## 1. THE BLOCKER — two foreground-service demo videos

Play won't let the release through until each foreground service has a
YouTube link showing it in use. Two short screen recordings, uploaded to
**YouTube as Unlisted** (ads off, not age-restricted), then paste the links
into the two "Video link" fields.

**Record them ON THE PHONE** with Samsung's built-in Screen Recorder — the
USB-to-Mac connection kept dropping, so don't rely on a cable. First turn on
**Do Not Disturb** and clear the notification shade so no personal
notifications appear in the clip.

### Video A — Health service (workout timer)
1. Quick Settings → **Screen recorder** → No sound / Media sounds → Start.
2. Basalt → **Train → Start session → Add exercise** (any) → Add to session.
3. Tap the **REPS** cell on set 1, type a number, tap the **✓** to log it →
   a rest timer starts.
4. **Swipe down the shade** → the **"Basalt — session timer"** notification
   shows (~2 s on it).
5. Press **Home**, swipe the shade down again → it's still there.
6. Press **power** to lock → it shows on the lock screen (~3 s).
7. Unlock, **stop** the recording.

### Video B — Location service (walk)
1. DND on. Start **Screen recorder**.
2. Basalt → **Train → Outdoor → Start a walk** (near a window / outside for
   GPS).
3. Show it tracking + swipe down to show the **ongoing walk notification**.
4. Press **Home / lock** → the walk notification persists on the lock
   screen; take a few steps so distance/route updates if you can.
5. **Stop** the walk, then **stop** the recording.

> ⚠️ Video B is also the **first real locked-phone test** of walk tracking.
> If the walk notification/distance does NOT survive the lock screen, that's
> a bug to fix before the clip is usable — flag it and it gets fixed.

Task selections on that screen (already decided):
- **FOREGROUND_SERVICE_HEALTH** → "exercise tracker".
- **FOREGROUND_SERVICE_LOCATION** → "User-initiated location sharing"
  (the beacon) **+ "Other"** → *"Recording a GPS route during an outdoor
  walk the user starts, shown with an ongoing notification the whole time."*

---

## 2. Sections that may still be open (App content / Store settings)

- [ ] **Content rating** questionnaire (IARC) — not yet done. Answer
      honestly: it's a health/fitness app, no violence/sexual/gambling
      content; references to mental-health/crisis support are informational.
      No user-generated content shared publicly.
- [ ] **Target audience & content** — audience 16+ (the app states "16 and
      over"); not designed for children; no appeal to kids.
- [ ] **Ads** — "No, my app does not contain ads."
- [ ] **Data safety** — finish + submit (answers below).
- [ ] **Government apps / Financial features / Health apps** — the **Health
      apps declaration** applies (it's a health app): confirm you're not
      claiming to diagnose/treat, and that health data use matches the
      privacy policy. No financial/government features.
- [ ] **News / COVID** — N/A.
- [ ] **App access** — add the one test login (below).
- [ ] **Store listing** — text + graphics + the 6 screenshots (below).
- [ ] **Health data permissions** (Health Connect, 27 descriptions) —
      already written; paste from `docs/store-assets/` notes / the chat.
- [ ] **AI asset declaration** — "Don't label assets" (icon/feature graphic
      are vector-drawn, screenshots are real captures).

## 3. Roll out

- [ ] Upload the .aab → all three "no bundle" errors clear.
- [ ] Accept **Play App Signing** on the first upload.
- [ ] Release name: **`0.2.1 (3)`**. Notes already pasted.
- [ ] Track: **`closed-alpha-1`**. Add testers (email list or a Google
      Group). **≥ 12 testers for ≥ 14 continuous days** is required before
      you can promote to production (personal developer accounts).

## 4. External / not-in-Console

- [ ] **Trademark registration** (optional, separate legal step): to
      formally register "Basalt: Health & Fitness" as an Australian owner,
      file through **IP Australia** (ipaustralia.gov.au) — class 9
      (software) and/or 44 (health). Until then the marks are common-law
      (asserted in LICENSE + the site footer). Not required to ship.
- [ ] Consider making the GitHub repo **private** if you'd rather it not be
      publicly readable (the LICENSE already forbids reuse either way).

---

## Prepared answers (copy-paste)

**App access — one test login:**
- Name: `Reviewer test account`
- Username/email: `cody.liddell.01@gmail.com`
- Password: `TEST123`
- Other info: *"Sign in on the first screen with email + password (no OTP,
  no 2FA). All AI, Health Connect and sharing features are optional and off
  by default; no extra setup needed to review."*

**Data safety:**
- Collects or shares user data? **Yes**. Encrypted in transit? **Yes**.
  Account creation? **Username and password** only.
- **Location → Precise**: Collected Yes, Shared Yes, purpose App
  functionality, optional, not ephemeral. (Approximate: no.)
- **Health & fitness (Health info + Fitness info)**: Collected Yes, Shared
  Yes, purpose App functionality, optional, not ephemeral.
- **Personal info → Name**: Collected Yes, Shared No, purpose App
  functionality, optional, not ephemeral.
- Nothing for ads/analytics; nothing sold.

**Store listing** — full copy in `docs/store-assets/listing.md`:
- App name: `Basalt: Health & Fitness`
- Short (79/80): `The honest health ledger — food, training, sleep and vitals, no games, no noise.`
- Full description: in listing.md (current V4.1 version).
- Icon: `docs/store-assets/icon-512.png` (512×512).
- Feature graphic: `docs/store-assets/feature-graphic.png` (1024×500).
- Phone screenshots (current 0.2.1, 1080×2160, upload these 6):
  `docs/store-assets/screenshots/01-today-depth.png`, `02-today-gummy.png`,
  `03-train.png`, `04-recover.png`, `05-trends.png`, `06-log.png`.
  (Ignore the older 1280×2560 set — pre-0.2.1 UI.)
- Tablet screenshots: either turn OFF tablet support in the listing, or
  reuse the phone shots (they meet the 10-inch 1080px minimum).

**Release notes (en-US):**
```
Basalt 0.2.1 — the honest all-in-one health ledger: food, training, sleep and vitals in one place, every formula published.

Feedback: Settings → About → Send feedback. Bugs, confusing screens and wrong numbers all welcome.
```

**URLs / contact:**
- Privacy policy: `https://basalt.itseliias.com/privacy/`
- Account deletion: `https://basalt.itseliias.com/delete-account/`
- Contact / feedback email: `itseliias@proton.me`
