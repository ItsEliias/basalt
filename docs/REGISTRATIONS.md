# Developer registrations — connected services (V4 Phase 4)

The Strava / Garmin / Oura imports are fully built and dormant. Each row in
Settings › Connected services says "Coming soon — needs developer
registration" until its keys exist. This file is the exact to-do list; when
a registration lands, set the keys below and the row comes alive with no
code change.

## Where the keys go

| Key | Where | Why |
|---|---|---|
| `EXPO_PUBLIC_<SERVICE>_CLIENT_ID` | `app/.env` (gitignored) | Client id is public by OAuth design; it only builds the authorize URL. |
| `<SERVICE>_CLIENT_ID` + `<SERVICE>_CLIENT_SECRET` | Supabase Edge Function secrets (`supabase secrets set`) | The `oauth-exchange` function swaps codes for tokens server-side. **The secret never ships in the app bundle.** |

Redirect URI for every service: **`basalt://oauth/<service>`**
(`basalt://oauth/strava`, `basalt://oauth/garmin`, `basalt://oauth/oura`).
The `basalt://` scheme is registered in the app manifest.

## 1 · Strava

- Register at <https://developers.strava.com> → "Create & Manage Your App"
  (a normal Strava account works; no approval queue for < 1 000 athletes).
- App name: Basalt · Category: Data Importer · Website: the privacy page URL.
- **Authorization Callback Domain**: Strava's field takes a domain, not a
  scheme URI — enter `oauth` (mobile scheme redirects are matched by their
  host segment; Strava documents `appname://oauth` mobile flows via their
  mobile authorize endpoint, which the app already uses).
- Scope requested: `activity:read_all` (read-only).
- Keys: client ID + client secret from the app page →
  `EXPO_PUBLIC_STRAVA_CLIENT_ID` in `app/.env`;
  `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` as Edge secrets.

## 2 · Oura

- Register at <https://cloud.ouraring.com/oauth/applications> (any Oura
  account; instant).
- Redirect URI: `basalt://oauth/oura` (Oura accepts custom schemes).
- Scopes: `daily session sleep` (read-only).
- Keys: `EXPO_PUBLIC_OURA_CLIENT_ID` in `app/.env`;
  `OURA_CLIENT_ID` / `OURA_CLIENT_SECRET` as Edge secrets.

## 3 · Garmin

- Apply at <https://developer.garmin.com/gc-developer-program/> for the
  **Garmin Connect Developer Program → Health API**. This one has an
  approval process (business justification form; individual developers are
  accepted but it can take weeks).
- After approval, create a consumer in their developer portal with
  redirect `basalt://oauth/garmin`.
- Note: Garmin's Health API delivers data by **push (webhooks)**, not
  client pull. The authorize flow in the app is done; the data path needs
  a small webhook Edge Function once the program is approved — scoped then,
  not now (stated on the row).
- Keys: `EXPO_PUBLIC_GARMIN_CLIENT_ID` in `app/.env`;
  `GARMIN_CLIENT_ID` / `GARMIN_CLIENT_SECRET` as Edge secrets.

## Setting the Edge secrets

```
supabase secrets set STRAVA_CLIENT_ID=… STRAVA_CLIENT_SECRET=… \
  OURA_CLIENT_ID=… OURA_CLIENT_SECRET=… --project-ref ezsrwwfieihelfekgclz
```

(or Dashboard → Edge Functions → Secrets). No redeploy needed — the
function reads env at request time.
