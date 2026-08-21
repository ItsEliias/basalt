# Basalt — V2A Report (Nutrition & Capture + Training)

**Date:** 21 August 2026 · **Status:** units 1–8 complete. **Suite: 437 tests green**
(core-data 26, ui 19, analytics 28, training 133, nutrition 125, health-connect 31, app 75);
`tsc --noEmit` clean everywhere. Every unit branch → tests → `--no-ff` merge.

## Nutrition & capture

1. **Food-entry photos** — private `basalt-food-photos` bucket (applied live) with
   `basalt_`-named storage policies scoped to the caller's own folder; folder-first paths so
   RLS can scope on them. Optional photo row on the entry form (camera/gallery, preview,
   remove); upload on save — a failed upload logs the entry photo-less rather than blocking
   the meal. 30 px thumbnails on Today's receipt via batched signed URLs; the bucket is never
   public. **delete-account v3** (deployed) wipes the user's bucket folder pagination-safely.
   PLAY-ANSWERS: Photos is now collected/optional.
2. **AI photo capture + label OCR** — `ai-photo-food` Edge Function (deployed; live-smoked
   both modes with a foodless image → honest empties). Meal mode returns per-item ~
   suggestions on the quick-add shape, with the photos-hide-oil caveat built into the system
   prompt; label mode transcribes the printed panel (kJ→kcal stated, unreadable numbers
   zeroed and named, never guessed) into a custom-food draft — saving it also files a
   reusable favourite. Images are downscaled to 1024 px on-device before anything leaves the
   phone. In-app disclosure matches quick-add's, naming Anthropic and exactly what is sent.
3. **Photo-now-log-later + dictation** — a local queue (pure core, corrupt-store-safe,
   idempotent, honest relative labels) holds photos on-device until the user asks for the
   estimate; the quick-add box notes that the keyboard's mic dictates straight in (OS
   dictation — nothing custom to trust).
4. **Social recipe import** — `social-recipe-import` Edge Function (deployed; live-smoked):
   TikTok/Instagram/YouTube allowlist, server-side fetch, og-tags + YouTube full-description
   extraction, then Claude structures the caption under strict no-invention rules
   (amountless ingredients stay amountless; steps only from a stated method; a recipe-free
   caption 422s — the live smoke returned "a music video description with no recipe content
   at all"). Drafts keep the source link and cover URL, macros ~ until confirmed.
5. **Meal budgets + training-day eat-back** — published 25/30/30/15 split redistributing the
   day's *remaining* energy over meals still to come; skipped windows flow forward with the
   note saying so; over-target days floor at zero with no scolding (pinned). The eat-back
   line (+active kcal) is display arithmetic stated as a suggestion — stored targets are
   never touched. Hidden entirely in hide-the-numbers mode.

## Training

6. **Muscle-highlight figure** — `BodyFigure` in @basalt/ui (the prototype's front/back svg,
   parameterized by region intensity; untouched regions render as quiet outlines). The
   published muscle→region map covers all 17 free-exercise-db values, pinned so no exercise
   highlights nothing. DETAILS → on every picker row: primary solid, secondary faded,
   instructions, and a dashed **media slot left for the licensed GIF pack** (excluded per
   your list).
7. **Timer modes + superset scroll + Big Three** — EMOM (work+rest always one minute, pinned),
   Tabata (published 20/10 × 8 verbatim), circuits (stations × rounds with a clamping
   station/round label) — all riding the *same* guided engine, so auto-logging, wall-clock
   catch-up and sensory collapse carry over untouched. Committing a superset set glides the
   scroll to the partner card. Trends' Big-Three card uses a published matcher (variations
   never pose as competition lifts; sumo counts; **no partial totals** — the card says why).
8. **Per-muscle recovery** — published heuristic (48 h base, volume-extended capped +24 h,
   short-persisted-night +20%, all stated in the srcnote and in each region's why), one-day
   manual overrides labeled as the user's call, the body figure lit by loadedness on the
   pre-session view, and picker candidates annotated "trained recently" — never hidden.

## Notes

- New native deps this batch: `expo-image-picker`, `expo-image-manipulator` (dev-client
  rebuild folded into the existing device-test requirement).
- The `ai-photo-food` and `social-recipe-import` functions reuse the existing
  `ANTHROPIC_API_KEY` secret — nothing new to configure.
- V2B (units 9–17) continues in `docs/V2B-REPORT.md`; the device-test plan lands with it.
