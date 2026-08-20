# Basalt — Play Store Submission Checklist

Things that are fine for a personal dev-client build but must change before the
store listing goes live. Grows as items arise; check items off with the commit
that resolves them.

- [x] **Foreground service type → `health`.** Done (Phase A): the plugin
  declares `health`, `ACTIVITY_RECOGNITION` is requested at runtime before the
  service starts (honest srcnote fallback on decline), and the special-use
  property/permission are gone. **Remaining: verify screen-off continuation on
  a real dev build** — the pure catch-up layer is tested; the service layer
  needs a device.

- [~] **Commercial tile provider swap — scaffolded (Phase A).** `WALK_TILE_URL`
  + attribution now come from `EXPO_PUBLIC_TILE_URL` / `_TILE_ATTRIBUTION` env
  vars with the CARTO dev tiles as fallback; Stadia and MapTiler are both
  documented in `route-map.ts`. **Remaining: create the provider account and
  put the key in `app/.env`.** Original item: The Outdoor map uses CARTO's free
  raster tiles (`WALK_TILE_URL` in `packages/training/src/route-map.ts`) —
  fine for development, not licensed for a published commercial app. Swap to a
  paid plan (CARTO, MapTiler, Stadia) or self-hosted tiles; it's a one-line
  URL + attribution change, both pinned by tests that will fail loudly on the
  swap until updated.

- [~] **Play account-deletion web page — live, pending review (Phase A+C).**
  Published at `https://basalt.itseliias.com/delete-account/` (public repo
  `ItsEliias/basalt-site`, GitHub Pages + custom domain). **Remaining: your
  review, then remove the DRAFT banner** in `basalt-site/delete-account/index.html`
  and re-push. Original item: Play requires a *web* URL where
  users can request account deletion without reinstalling the app. The
  in-app path (Settings → type-DELETE → `delete-account` Edge Function) is
  done; the public page is not. A minimal static page + a small Edge Function
  flow (email-verified deletion request) satisfies it.

- [ ] **Run `docs/DECOMMISSION.md`.** Store submission is one of the three
  named triggers for leaving the shared Arise Supabase project. Replay
  migrations + seed into a dedicated project, repoint `app/.env`, re-run the
  DoD walkthrough, make delete-account unconditional (no shared-auth-pool
  caveat), then clean the `basalt_` tables out of the shared project.

- [~] **Play data-safety form — draft answers ready (Phase A).** See
  `docs/PLAY-ANSWERS.md`; transcribe once the privacy URL is final. Original item: Declare: health & fitness data (Health
  Connect reads — the 26 declared permissions), food/nutrition logs, precise
  location (GPS walks — collected, not shared), photos (barcode camera — not
  stored off-device unless the user attaches one), account identifiers
  (email). All encrypted in transit; user-deletable (full cascade). "No data
  shared with third parties" holds ONLY while AI quick-add is disclosed:
  free-text food descriptions are sent to Anthropic's API — declare it.

- [~] **Privacy policy — live, pending review (Phase A+C).** Published at
  `https://basalt.itseliias.com/privacy/` (repo `ItsEliias/basalt-site`).
  **Remaining: your review + contact-email fill-in, then remove the DRAFT
  banner** in `basalt-site/privacy/index.html` and re-push. Original item: Required by Play for any app, doubly so with health
  data + Health Connect (Google requires HC data use to be listed
  explicitly). Must name: what's collected per table, Supabase hosting,
  Anthropic processing for AI quick-add (with the ~-estimate framing), OSM/
  tile-provider fetches during map display, no ads/analytics/tracking, full
  deletion path. Link it in the listing and in-app (Settings).

- [~] **Health Connect app-approval form — draft answers ready (Phase A).**
  See `docs/PLAY-ANSWERS.md` §2. Original item: Separate from the data-safety
  form: Google requires apps reading Health Connect data in production to be
  approved via the HC developer declaration. Without it, HC access is capped
  to sideloaded/dev installs.
