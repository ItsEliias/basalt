# Play submission — the do-it-today walkthrough

Everything below is transcription, not decision — the decisions live in
`PLAY-ANSWERS.md` (forms), `store-assets/listing.md` (copy + assets) and
`SUBMISSION-CHECKLIST.md` (what's deliberately deferred). Order matters only
where numbered.

**Before you start:** the one open input is the DRAFT check — read
`https://basalt.itseliias.com/privacy/` and `/delete-account/`, then remove
the DRAFT banner in `ItsEliias/basalt-site` and push. Don't submit with the
banners up.

## 1 · Play Console setup (once)

1. play.google.com/console → create developer account (one-time $25) if not
   done. Identity verification can take a day — start it first.
2. Create app: **Basalt: Health & Fitness** · App (not game) · Free.
3. App content → Privacy policy: `https://basalt.itseliias.com/privacy/`.

## 2 · App content declarations (Console → App content)

- **Data safety:** transcribe section 1 of `PLAY-ANSWERS.md` row by row.
- **Account deletion:** URL `https://basalt.itseliias.com/delete-account/`;
  in-app deletion = yes, all data deleted, no partial retention.
- **Health apps / Health Connect:** complete the Health Connect declaration
  from section 2 of `PLAY-ANSWERS.md` (the paste-ready justification
  paragraph is there). HC access stays capped to the test track until Google
  approves it — expected, fine for the closed test.
- **Ads:** none. **Target audience:** 18+. **News app:** no.
- Content rating questionnaire: health & fitness reference app, no
  user-generated public content, no violence etc. — answer literally.
- **Foreground service + permission declarations** (if prompted for
  `ACTIVITY_RECOGNITION`, location, `RECORD_AUDIO`, `BLUETOOTH_*`): answers
  in sections 3 and 3b of `PLAY-ANSWERS.md`.

## 3 · Store listing (Console → Grow → Store presence)

- Copy from `store-assets/listing.md` verbatim (name, short, full).
- Icon: `store-assets/icon-512.png` · Feature graphic:
  `store-assets/feature-graphic.png` · Phone screenshots:
  `store-assets/screenshots/01…06` in order.
- Category: Health & Fitness. Contact email: itseliiasstudy@gmail.com.

## 4 · Closed testing track

1. Testing → Closed testing → create track `closed-alpha-1`.
2. Upload the AAB:
   `app/android/app/build/outputs/bundle/release/app-release.aab`
   (versionCode 1 / 0.1.0, upload-key signed; opt in to Play App Signing
   when prompted — the upload key is exactly for this).
3. Release notes: "First closed test — the honest health ledger. Full
   feature set; placeholder icon."
4. Testers: create an email list, add testers, save; copy the opt-in URL
   into the tester email together with the **Instructions for testers**
   block from `store-assets/listing.md` — including the Send-feedback line
   (Settings → Account → Send feedback pre-fills version, theme, device).
5. Roll out the release to closed testing.

## 5 · The 14 days, and after

- Google review for a first closed-test release is usually hours-to-days.
- The 14-day closed test with ≥12 testers is a *production* prerequisite
  for personal accounts created after Nov 2023 — keep testers opted in the
  whole time.
- **Before applying for production access:** run `docs/DECOMMISSION.md`
  (dedicated Supabase project — the amended trigger), swap the placeholder
  mark for the real logo, and re-check `SUBMISSION-CHECKLIST.md` for the
  tile-provider key.
