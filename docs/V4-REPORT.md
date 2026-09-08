# V4 report — Extras

Branch `v4-extras` off main (`8323e32`). Baseline before any code:
**1063 tests green**. The governing rule: every Extra off by default (the
registry's sanctioned exceptions aside), switchable in Settings › Extras,
offered once in onboarding — and with everything off the app is
pixel-identical to main, enforced by the all-off snapshot diff below.

## All-off baseline

The baseline debug APK was built from the exact branch point with all V4
work stashed (the bundle carries zero V4 code) and archived before any
V4 code ran. **The screen capture + diff could not be completed this
session:** the emulator's system process ANRs on every app cold start
after a full day of builds — sign-in became impossible (input events
land in invisible ANR dialogs). Deferred, not skipped: the protocol is
tooled (`scripts/readme-shots/diffdir.sh`) and improved over the naive
version — baseline shots and phase all-off shots will be captured
back-to-back in one device session (same live data, same status bar) by
stashing/unstashing what Metro serves, which is *more* honest than
day-apart captures. First candidate session: the pre-testers device
pass. Until the diff runs, Phase 0 is code-complete but its gate is
open.

## Phase 0 — the Extras framework (code complete; suite 1063 → 1075)

- **Registry** (`packages/core-data/src/extras/registry.ts`): id, title,
  oneLiner, group, default, onboarding copy, requires, permissions,
  groupOnboarding — plus the state model (defaults, parse, `extraOn`,
  `setExtra` with two-way dependency enforcement) and the derived
  onboarding screen list. 10 tests: shape, default-off rule (exceptions
  only in sanctioned groups), acyclic requires, cascade-off-with-report,
  refuse-child-without-parent, yes/no round-trip, screens-from-registry.
- **`<ExtraSlot id>`** + `useExtra` + `ExtrasProvider` — renders nothing
  while the Extra (or anything it requires) is off. Lint-as-test pins
  `packages/extras/*` imports to the gate and the registry.
- **Settings › Extras**: grouped switches from the registry, oneLiner
  under each, disabled-with-reason when a requirement is off, an alert
  naming dependents that a parent turn-off also turned off.
- **Onboarding**: offer screens after the theme step, one per flagged
  entry/group — live preview, registry question, Yes / Not now; the
  footer CTA is the one-tap skip-all ("Skip the extras — build my
  targets"). Existing users: the same sequence once, as the dismissable
  "New in Basalt" modal; every finish path marks it seen.
- **Pebble is the first Extra.** Its master toggle IS the extra (both
  Settings surfaces stay in sync; a pre-V4 device with Pebble on
  migrates once); voice + data-screen prefs unchanged; Today's
  PebbleSlot sits inside `<ExtraSlot id="pebble">`.
- **Contract**: design-spec §6 gains the *Extras-only* list ("never on
  by default, never affects a core number") and §8 records the four
  binding rules.

## Phase 1 — Capture (code complete; suite 1075 → 1083)

STOP POINT A answered: existing Anthropic key, server-side label mode, no
ML Kit (no new native dependency; secrets stay server-side). What landed:

- **Four capture Extras in the registry**, all `default: true` (the
  sanctioned exception — input methods, not motivation), all
  `groupOnboarding`: photo-to-meal, voice logging, barcode & label scan,
  plate builder. Onboarding shows ONE capture screen — a checklist
  seeded ticked from the registry, "Keep the ticked ones" / "Just
  typing, thanks"; grouped screens got the checklist variant of
  `ExtrasStep`.
- **Existing capture surfaces gated, typing stays the floor**: the Log
  capture-mode control derives from the extras (search · [barcode] ·
  [photo] · ai · [plate] · manual), the current mode falls back to
  search if its Extra flips off mid-session, the voice mic inside AI
  mode rides `captureVoice`, and the quick-log sheet's SCAN item rides
  `captureBarcode`. No capture path was added or removed from core —
  the toggles only hide surfaces.
- **Plate builder — the first real `packages/extras` feature**
  (`@basalt/extras`): a pure model (add/remove up to six recent foods,
  portion factor ×0.25–×3 clamped, drag mapping, area-true circle
  radii, scaled totals, `plateEntries` producing ordinary food-entry
  shapes — 8 tests) and the `PlateBuilder` component (SVG plate,
  drag-to-size circles with −/+ steppers and a11y labels, favorites as
  the recent-food picker, commits through the host's `addFoodEntry` —
  the package never touches the service layer). Lives in Log as the
  PLATE mode inside `<ExtraSlot id="capturePlate">`.
- **Lint rule refined**: a file may import `@basalt/extras` only if it
  also renders `<ExtraSlot` (or is the provider/registry) — LogScreen
  qualifies; anything else fails the suite.

**Gate semantics (amended by the user, 2026-09-07):** the pass/fail
invariant is **"fresh install with every Extra at its registry default
renders identically to pre-branch main"** — capture extras default on,
and hiding barcode/photo/plate under a deliberate all-off is an
*expected* difference from main, not a bug. The pre-tester session
records BOTH runs (defaults, and all-off) in this report; only the
defaults run gates.

Device verification of the new surfaces (plate drag, mode hiding,
checklist onboarding screen) rides the same deferred session as the
all-off gate.

## Phase 1 — original stop-point context (for the record)

Discovery that reshapes the phase: **photo-to-meal, voice logging and
label capture already exist in core Basalt** (V2/V3): `ai-photo-food`
(Anthropic vision, `claude-sonnet-5`, per-item portion *ranges* under
the graded-uncertainty law, modes meal/label/recipe/routine),
voice → `ai-quick-add`, and the barcode scanner. The provider
abstraction the prompt asks about is these Edge Functions — the key
lives server-side as the `ANTHROPIC_API_KEY` Supabase secret, never in
`app/.env` (the no-secrets-in-client law). Phase 1's remaining work is
therefore: registry entries + ExtraSlot gating for the capture methods
(on by default), the genuinely new plate builder, and a decision on
ML Kit on-device OCR vs the existing server-side label mode — all
pending the stop-point answer.

## Phase 2 — Motivation (streaks, XP, Pebble grows landed; HALTED at STOP POINT B; suite 1083 → 1103)

- **Streaks with freezes** (`packages/extras/src/streaks`): freeze-aware
  runs for logging / training / sleep-logged. Two freezes per Mon–Sun
  ISO week, auto-applied oldest-first, no banking; a freeze only ever
  BRIDGES two real days (runs neither start with nor consist of frozen
  days — the first implementation let freezes leak past run edges; the
  tests caught it). Rest days never break training: the host passes the
  core engine's rest-aware day set. Frozen days are listed on the card,
  and the rules render verbatim from `STREAK_RULES` on Trends. 8 tests.
- **XP, levels, badges, confetti** (`packages/extras/src/xp` +
  `motivation/Cards.tsx`): XP = entries×5 + sessions×25 + walks×15 +
  sleep×10, printed on the card from the same constants the code uses
  (test-pinned); level curve written down (250·n·(n−1)) with exact
  boundary tests; three badges, real milestones only (10 sessions,
  100 km walked, 30-day complete-log run) with their "how" printed.
  Confetti: 22 token-coloured pieces, 1.2 s, PRs only — it fires off
  the SAME quiet e1RM PR detection the sets table already renders, in
  SessionTab, gated by the xp Extra. 7 tests.
- **Pebble grows** (`packages/extras/src/growth`): one published score —
  (logging + training + sleep days) ÷ 90 over the rolling 30 days —
  five stages at 0/20/40/60/80%, regression is the same pure function
  (test asserts the fall). Five staged SVGs, same character with more
  detail (stage 3 IS the classic Pebble; 1–2 quieter, 4 facets, 5 a
  sprout). Surfaces: the Settings Pebble card (stage + score + rules)
  and the Today bubble's mascot swaps to the staged pebble via a new
  optional `mascot` prop on the core PebbleSlot (inert when unused —
  all-defaults rendering unchanged). Requires the pebble Extra
  (registry-enforced). 4 tests + the app-side window-constant pin.
- Registry: `streaks` + `xp` share one onboarding screen via the new
  `onboardingGroup` field ("Streaks, XP and badges?" — one yes);
  `pebbleGrows` is Settings-only (matches the prompt's onboarding
  order). Trends hosts the cards inside ExtraSlots and loads their
  data only while the toggles are on.

### STOP POINT B — social schema + RLS, for review before anything is applied

Pattern follows V3's co-op law: **cross-account data is only ever
published aggregates written by the owner's own device** — no policy
grants any read into another user's raw tables. Proposed objects (all
`basalt_`-prefixed, nothing applied yet):

```sql
-- 1 · Invites: private to their owner; redemption ONLY via definer RPC.
create table basalt_friend_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,               -- 8-char, single-use
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz
);
-- RLS: select/insert/delete where owner_id = auth.uid(). No update policy.

-- 2 · Friendships: ordered pair (user_a < user_b), created by the RPC.
create table basalt_friends (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
-- RLS: select where auth.uid() in (user_a, user_b);
--      delete where auth.uid() in (user_a, user_b) (unfriend, either side);
--      NO insert policy — only basalt_redeem_friend_invite(code) writes it:
--      security definer fn validating code, expiry, not-self, not-already-
--      friends; marks the invite redeemed in the same transaction.

-- 3 · Challenges: friends-only, three published kinds.
create table basalt_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('steps','sessions','logged_days')),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on <= starts_on + 31)
);
-- RLS: select where basalt_is_challenge_member(id);
--      insert where creator_id = auth.uid();
--      delete where creator_id = auth.uid().

create table basalt_challenge_members (
  challenge_id uuid not null references basalt_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,              -- self-chosen at join, the ONLY name shared
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
-- RLS: select where basalt_is_challenge_member(challenge_id);
--      insert where user_id = auth.uid() AND friends-with-creator
--      (exists on basalt_friends for (uid, creator) pair);
--      delete where user_id = auth.uid().
-- basalt_is_challenge_member(cid): security definer, stable —
--   exists(select 1 from basalt_challenge_members where challenge_id = cid
--          and user_id = auth.uid()) — definer breaks the self-referential
--   policy recursion.

-- 4 · Progress: the owner's device UPSERTS its own aggregate; members read.
create table basalt_challenge_progress (
  challenge_id uuid not null references basalt_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  value numeric not null,                  -- steps count / session count / logged-day 0-1
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id, day)
);
-- RLS: select where basalt_is_challenge_member(challenge_id);
--      insert/update where user_id = auth.uid(). No delete policy needed
--      (cascade covers it); add delete where user_id = auth.uid() for tidiness.

-- 5 · "3 friends logged today": one boolean per day, self-published.
create table basalt_friend_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  logged boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
-- RLS: insert/update where user_id = auth.uid();
--      select where user_id = auth.uid() OR an accepted basalt_friends row
--      pairs auth.uid() with user_id.
```

**The exact columns another user can ever see of yours:** your half of a
friendship row (`user_a/user_b`, `created_at`) · a challenge's `kind`,
`starts_on`, `ends_on` · your self-chosen `display_name` + `joined_at` ·
your per-day aggregate `value` for a challenge you both joined · your
per-day `logged` boolean. **Never:** food entries, weights, sleep,
vitals, photos, or any row of any other `basalt_` table. Deletion: every
table cascades from `auth.users` and will be appended to BOTH wipe
lists (Edge + SQL) in the same migration — the deletion-coverage test
fails the suite otherwise.

Awaiting review; the daily-narrative Extra (last in the phase order)
also waits behind this stop.

### Phase 2 completion — social + narrative client side (suite 1103 → 1115)

STOP B was answered "continue"; what landed and what's gated:

- **Migration written, NOT applied** *(since applied — see the Interlude
  below)*: `20260907170000_basalt_social_v4.sql`
  exactly as posted (plus one fix the deletion guard caught — see below).
  The `apply_migration` call was permission-blocked by the tool
  classifier; it needs the user to approve a retry or run
  `supabase db push`. The social Extra's client code is complete and
  inert until then (reads/writes will error politely against missing
  tables; the Extra defaults off).
- **The deletion guard caught a real regression**: the new
  `basalt_delete_my_data` body had been copied from the ppg-calibration
  migration and silently dropped `basalt_mobility_sessions` (added by a
  later migration). Fixed in the unapplied file; the Edge function's
  wipe lists gained the five social tables (friends as two-sided,
  invites/challenges via a new KEYED list) — 8/8 deletion tests green.
  Edge redeploy pending alongside the migration.
- **Social** (`packages/extras/src/social` + `SocialCard` +
  `app/src/lib/socialData.ts`): invite codes (8-char no-lookalike
  alphabet, model-tested), leaderboard math (sum/sort/self-mark,
  zero-row members stay visible), the published shared-columns note
  rendered on the card, challenge create/join plumbing, Today's
  "N friends logged today" line (plain fact, null when zero), and the
  device publishing only its own aggregates (`publishToday`). 7 tests.
- **Daily narrative** (`packages/extras/src/narrative` + edge function
  `ai-daily-summary`, deploy pending): one paragraph about YESTERDAY
  from numbers the client chooses to send; the model system prompt
  forbids advice/cheer/invention; the label "Generated summary" is part
  of the component (no prop can hide it); an empty day earns silence.
  Law tests pin: label unconditional, yesterday-only, never-on-Trends
  (source scan), never-in-a-notification (source scan of every
  notification module). 5 tests.
- Registry: `social` + `narrative` entries (motivation, off, own
  onboarding screens per the prompt's order).

## Interlude — Cody's import (approved mid-run)

Server side done: social migration applied (RLS summary in the STOP B
section stands, verified 0 `using (true)`), `date_confidence` added to
basalt_workout_sessions ('day' default, 'week' for imports),
delete-account v14 live (social wipe lists), ai-daily-summary v1 live.

Core rules added for the import, all test-pinned:
- `prEligibleSession` (training): source='import' + date_confidence≠'day'
  never mints a PR or feeds progression — wired into sessionStore's
  historyFor (PR mark + suggestions) and Trends' records query.
- `IMPORTED_TARGETS_REASON` (core-data): rows whose reason starts with
  "Imported history" are excluded from current-target resolution
  (null-safe `.or()` filter) but readable via the new
  `listTargetHistory()` for Trends.
- `splitSeriesOnGaps` (analytics): a trend line never crosses a
  >30-day hole; consumed by the Phase 6 profile trend.

`scripts/importCody.ts` (user-run, password from their shell env only):
account create with stop-if-exists, weight ×8 (source import), two
target-history rows (fibre derived at 14 g/1000 kcal — logged), 4 splits
→ 16 session templates (rep ranges + form cues in template notes —
logged), 87 exercise-weeks → week-dated sessions per the confidence
rules (high=real set · medium=weight+prescription reps flagged
estimated · low with reps=machine-setting note, kg null · else raw text
on the exercise note), 12 recipes (ingredients are truth; >8% stated
mismatches flagged), favourites only where macros exist (name-only
skipped and listed — a 0-kcal favourite would be a lie). Dry-run prints
counts, custom exercises and note-only sets, writes nothing.

## Phase 3 — Glanceability (suite 1115 → see commit; registry: `sounds`, `widgets`, both off)

- **Rings Today layout** (core, not an Extra — it's a layout choice like
  tiles): `todayLayout` gains `'rings'`
  (`20260907191000_basalt_today_layout_rings.sql`, applied), selectable in
  Settings next to ledger/tiles. The hero renders the same three numbers
  as the ledger — remaining energy, protein, water — as quiet stroke
  arcs. This does not violate the forbidden list: the V3.4 theme
  amendment split rings-as-reward (still forbidden globally) from
  rings-as-meter-shape (theme-scoped expression, `theme.shape.meter`);
  the rings layout uses the meter primitives, carries no glow, no
  celebration at close, over-cap stated in words.
- **Lock-screen walk, rich** (`walkNotifModel.ts`, 4 tests): the walk
  foreground notification now shows distance, elapsed and pace
  (zero-padded `06:00 /km`; no pace at all under 100 m — a made-up pace
  is a lie), plus a Pause/Resume action. Pause is honest time-keeping:
  `pausedSince`/`pausedTotalMs` on the tracking state, GPS fixes during
  pause update position only (no distance accrues), elapsed subtracts
  paused time everywhere (live readout, voice announcements, saved walk).
- **Sounds** (Extra, off): three short generated sine samples —
  tick (set commit), commit (log commit), pr — via expo-audio 56.0.13
  at volume 0.4, `playSound()` checks the Extra and is a static import
  everywhere (repo rule: no dynamic `import()` in app code). Haptics on
  the same commit points are core and fire regardless — they were
  already part of the app's language.
- **Widgets** (Extra, off): (1) macros join the Today widget — protein /
  carbs / fat against targets on one line, fat over-cap in words
  (`· 5 over`), hide-the-numbers carries through. The macros ride the
  snapshot ONLY while the Extra is on, so at defaults the widget renders
  byte-identically to pre-branch main (the gate invariant). (2) A second
  home-screen widget, **Readiness**: last computed score or "No number",
  with its age in plain words ("as of 45 min ago"); Recover publishes
  the snapshot only while the Extra is on. Hand-added like the first
  widget (no prebuild): manifest receiver `.widget.BasaltReadiness`,
  `widgetprovider_basaltreadiness.xml`, string resource, app.json plugin
  entry. Widget model tests 5 → 11.
- **Wear OS: not this branch.** `docs/WEAROS-SCOPE.md` records what a
  tile would need (native Wear module, Data Layer publisher, Expo-less
  Gradle wiring, watch test surface) and why it's a branch of its own.

Decisions made without you:
- Rings layout requires targets + a loaded day; with either missing it
  falls back to the ledger's empty state rather than drawing empty arcs.
- The Readiness widget shows "open Basalt — fills after Recover
  computes" until the first snapshot exists — a real empty state, not a
  fake 0.
- Widget macro line uses the fat target as a cap (matches Today's
  ledger phrasing); protein/carbs render as plain progress.

## Phase 4 — Depth (suite 1128 → 1142; registry: `mealPlanning`, `fasting`, `hydration`, `supplements`, `cycle`, `photos`, `imports` — all off, one shared "More tools" multi-select offer)

- **Already-built features moved into Extras**: meal planning + grocery
  (V3's PlannerTab — the Log sub-tab now appears only with the Extra on),
  fasting timer (was a profile toggle in Settings, now the `fasting`
  Extra; the old toggle row is gone), cycle tracking (`cycle` ExtraSlot
  around the Recover card), progress photos (`photos` ExtraSlot).
- **Hydration reminders** (new): pick hours (08:00–22:00, every 2 h
  offered) on a Settings card inside the ExtraSlot; one daily
  notification per hour via expo-notifications. Copy is pinned by test:
  "You asked for a reminder at HH:00. Nothing is logged unless you log
  it." Turning the Extra off cancels every scheduled notification.
  5 tests.
- **Supplements checklist** (new): `basalt_supplements` +
  `basalt_supplement_checks` (RLS self-only, applied; both wipe paths
  extended — deletion guard 8/8; delete-account v15 deployed). Card on
  Today: your list, per-day ticks, add in your own words, long-press to
  remove; optional single daily reminder (off/08/12/20). The law is
  printed on the card and source-scan-tested: Basalt never suggests a
  product or proposes a dose. 3 tests.
- **Progress photos, local-first**: photos now save to the app's private
  documents directory by default — this phone only. Cloud sync is a
  separate switch on the card with the trade in plain words (upload of
  NEW photos to the private bucket; photos taken before the flip stay
  where they were taken). Compare gained an overlay mode (first under,
  latest over at half strength) beside side-by-side.
- **Connected services** (`imports` Extra): Strava / Garmin / Oura OAuth
  built end-to-end and dormant — authorize URLs, `basalt://oauth/<service>`
  deep-link redirect (scheme hand-added to the manifest + app.json),
  token exchange in a new `oauth-exchange` Edge Function (v1 deployed;
  returns a plain-words 501 until its secrets exist), imports writing
  through the service layer with `source` + `ext_id` dedup (re-import is
  a no-op). Rows say "Coming soon — needs developer registration" until
  `EXPO_PUBLIC_*_CLIENT_ID` env vars exist. `docs/REGISTRATIONS.md` has
  the exact registrations, scopes and redirect URIs. 5 tests.
- **Doctor export**: 30 → 90 days, plus a Food-intake section — daily
  energy as a RANGE over logged days (min–max, median, median protein),
  with "unlogged days are absent, not zero" printed as the source line.
  HRV/RHR bands were already in. 5 tests (2 new).

Decisions made without you:
- **Doctor export stays core** (not in the `imports`/depth Extras): it
  already shipped in Settings on main, and access to your own data is a
  right, not a tool. Extended in place.
- **Demotions change the defaults render vs pre-branch main** — the gate
  run will show exactly four expected diffs, all ordered by this phase's
  "off by default" header: Log loses the Planner sub-tab, Recover loses
  the empty Cycle opt-in card and the Progress-photos card, Settings
  loses the old fasting toggle (it moved under Extras). Every other
  screen must still diff clean; anything else is a bug.
- **`profiles.fasting_enabled` is orphaned, not dropped**: the Extra is
  now the only gate. The column stays (additive-only migrations) and
  nothing reads it.
- **OAuth tokens live in AsyncStorage** (app-private), not a new
  SecureStore native dep — same no-new-native-deps rule as ML Kit.
  Client secrets never touch the device at all.
- **Garmin's pull is registered-work**: their Health API is push-based
  behind an approved program; the authorize flow is built, and the row +
  REGISTRATIONS.md say the webhook Edge Function is scoped for when the
  approval lands.
- **Fasting gained no notification**: it's a live timer card on Recover;
  a scheduled "you are fasting" push would be a nudge, not a reminder
  the user configured. Hydration and supplements carry the scheduled
  notifications for this group.
- **Cloud-photo backfill not built**: flipping cloud sync on uploads new
  captures only; a bulk upload of the existing local vault is a bigger
  consent moment than a switch and is stated plainly in the switch copy.

## Phase 5 — The Basalt-only ones (suite 1142 → 1148; registry: `uncertainty`, basalt group, ON by default)

- **Visible uncertainty** (`packages/nutrition/src/uncertainty.ts`): the
  nutrition engine already stores entry-level capture provenance — every
  entry's `source` — so that IS the confidence signal; no schema change.
  The published model (pinned by test, printed verbatim in-app): barcode
  ±5%, recipe ±10%, typed ±10%, database match ±15%, synced ±20%, photo
  and quick-add ±25%, unknown ±25%. The day's range sums every entry at
  its worst and best, so one loose entry can't hide behind ten tight
  ones, and the range visibly narrows as capture quality improves. On
  Today it's one quiet line under the energy hero in all three meter
  shapes (numeral, dial, rings) — "likely 1,700–2,300 kcal eaten ·
  narrows as entries are weighed" — and tapping it opens the per-source
  math applied to today's actual entries plus the explainer, which ends
  "A stated model, not a measurement." 6 tests.
- **"Why" everywhere** — the audit: every number on Today / Recover /
  Trends checked for tap-to-components or a published-source note.
  Already compliant: Recover readiness (math modal), sleep need (math
  modal), weight trend ("least-squares fit, not wishful smoothing"),
  vitals bands (source + day counts); Trends correlations (|r| ≥ 0.45 /
  n ≥ 30 gates printed, checked-not-shown named), records (Epley e1RM
  named), big three (published matcher), muscle volume (published band);
  Today macros/caps/micros/water (own-log srcnotes, "absent means absent
  data, never zero"). **The one gap found and fixed: the energy hero
  itself** — the biggest number in the app had no components on tap. It
  now opens "Energy remaining — the math": target, minus eaten, equals
  remaining, active energy labelled informational-unless-eat-back, and
  the target's own stated reason (or a pointer to Profile & Targets).

Decisions made without you:
- **"Why everywhere" is core, not an Extra** — gating honesty behind a
  switch would break the published-formulas law. Only the intake range
  is a (default-on) Extra, because it adds a surface.
- `uncertainty` defaults ON as a registry-sanctioned basalt-group
  exception (same mechanism as capture). At the gate run this means one
  expected diff on Today vs pre-branch main: the range line under the
  hero. All-off hides it.
- The hero numeral is now wrapped in a Pressable for the why-tap — the
  gate diff should treat any pixel shift there as a bug (none expected;
  the wrapper adds no styling).

## Phase 6 — Profile & Targets · Programmes · Coach (suite 1148 → 1175)

### 6a — Profile & Targets (core)

- **Placement decision**: the Nutrition plan is a card in **Settings,
  directly under the Profile card** — every input it reads (sex, height,
  DOB, activity) is edited right above it, and the existing "Daily
  targets" row stays as the quick summary.
- **Engine** (`packages/nutrition/src/plan.ts`): every number a range
  from a published formula — Mifflin-St Jeor ±10% × activity, then the
  chosen rate; protein 1.6–2.2 g/kg; fat 20–35% of energy; carbs the
  remainder; fibre 14 g/1,000 kcal; sugar <10%; sodium <2,300 mg; water
  by weight. Weight input is the **7-day trend (3+ weigh-ins), never a
  single reading** — fewer weigh-ins fall back to the latest one,
  labelled as such on the card.
- **Rails in code, reasons in words** (all test-pinned): energy floor
  1,200 F / 1,500 M / 1,500 unspecified with "adequate nutrition
  unlikely" wording; rate cap 1%/wk loss / 0.5%/wk gain — a request past
  the cap is clamped and the only words are "slow down"; an under-18 DOB
  hides the plan entirely ("Logging still works fully"); "Estimates, not
  medical advice." renders with the plan; **no BMI category labels ever**
  — a source-scan test sweeps app + packages for category words.
- **Overrides**: tap any range row → set a custom value; it lands as a
  targets version with a stated reason and the computed range stays on
  the card. "Apply midpoints as targets" writes the whole plan with the
  formula in the reason. 10 tests.

**Worked example (as requested; sex assumed male for the arithmetic,
stated in the test):** 30 y, 82 kg, 178 cm, moderately active, −0.5%/wk →
BMR 1,788 · TDEE 2,494–3,048 · rate −451 kcal/day · **energy
2,043–2,597 kcal** (midpoint 2,320) · protein 131–180 g · fat 52–90 g ·
carbs 222–307 g · fibre 32 g · sugar cap 58 g · sodium cap 2,300 mg ·
water 2,600 ml. Pinned verbatim in `plan.test.ts`.

### 6b — Programmes (Extra, depth group, off)

- **Templates as data** (`packages/extras/src/programmes/templates.ts`):
  8-week recomposition (3 strength + 2 walks, −0.25%/wk), Strength block
  (6 wk, 4 days, maintenance), Walking base (4 wk, 5 walks). Adding a
  template is adding an entry.
- **Weekly check-in — exactly ONE proposal**, rules in a stated order
  (each pinned): (1) trend past the safety cap → ONLY "slow down", no
  target change, no praise; (2) ≥half the sessions missed →
  swap-lighter, "rather than adjusting food"; (3) no trend → hold with
  the why; (4) >0.15%/wk off the programme's rate → one bounded
  ±100–150 kcal step citing both rates; (5) on track → hold. Accepting
  an adjust writes a targets version with the check-in's own words as
  the reason. 9 tests.
- **Programme card** (Train tab, above the core Program card): week
  strip, trend corridor (published band: rate-moved start ± 0.3 kg noise
  ± 25% of expected change — "information, not failure"), check-in with
  Accept/Ignore, stop.
- **Share-as-challenge RLS, 5 lines**: sharing reuses the Phase-2 social
  tables unchanged — a `basalt_challenges` row (creator-scoped insert) +
  self-insert membership; friends join via the friendship-checked member
  policy; progress is each device publishing its OWN session counts to
  `basalt_challenge_progress` (self-scoped writes, member-scoped reads
  via the security-definer helper); zero `using (true)` anywhere; food
  and weight rows remain unreadable by any other user. No new tables, no
  new policies — the applied migration `basalt_program_templates` only
  adds nullable columns to the self-scoped `basalt_programs`.

### 6c — Pebble Coach (Extra, basalt group, off, requires Pebble)

- **Hard limits on-device, before any network call**
  (`packages/extras/src/coach/model.ts`, pinned by 8 tests): medical →
  "one for a doctor" + doctor-report pointer; dosing → never a dose;
  disordered-eating (outranks everything) → coaching declines and points
  to the Butterfly Foundation / a GP, "will not coach restriction".
  Deflection copy is itself scanned: no pseudo-diagnosis, no mg, no
  cheer. A source-scan pins "never initiates" — the module contains no
  notification or scheduling code.
- **Grounded answers**: `pebble-coach` Edge Function (v1 deployed,
  claude-sonnet-5) receives ONLY the numbers the client chose to send,
  answers in plain sentences, lists `citedNumbers` rendered under every
  reply ("NUMBERS USED · …"), and may propose at most one action from
  {open-recover, open-plan, open-train} → rendered Accept/Ignore, never
  an edit. Malformed replies are parsed defensively.
- Contract: design-spec **§9 Targets published + Rails + Coach** added.

Decisions made without you:
- The plan's rate preference lives in device storage (`basalt.planRatePct`)
  — the resulting targets sync as versions; the knob itself is per-device.
- Coach grounding from Today currently sends intake/protein vs targets;
  readiness/sleep-debt slots exist and are sent as null (stated as "not
  recorded" by the coach) until a cheap loader is worth it.
- The coach card self-gates (`<ExtraSlot id="coach">` inside the
  component) — the extras-lint rule caught the first version and the fix
  makes the gate travel with the file.
- The crisis detector (Phase 7) will be wired IN FRONT of the coach's
  text entry point, as the spec orders; the coach ships this phase with
  its own guards only.

## Phase 7 — Wellbeing (suite 1175 → 1195; registry: `journal`, `winddown`, `meditation` — new Wellbeing group, all off, one shared multi-select offer)

### Core — Mind, Recover's third section

- **Daily check-in** (`MindCard`, replacing the old evening check-in
  card): mood / energy / stress on 1–5 rendered as words, never faces —
  Low · Flat · OK · Good · High (pinned, plus an emoji-free source scan).
  The evening facts (alcohol, late meal, …) stay; an optional one-line
  note joins them (through the crisis gate); a 30-day strip shows one
  mono char per day per scale, absent days as `·`. Schema: additive
  `energy` + `stress` columns on `basalt_checkins` (applied).
- **Correlations**: energy/stress series feed the existing engine
  through the same gates (|r| ≥ 0.45, n ≥ 30); new checked pairs —
  intake×mood, training-volume×mood, stress-level×sleep-that-night
  (lag 1), sleep×energy-level. *(Mood-vs-sleep-DEBT decision-logged: the
  daily-series loader carries nightly sleep, not the rolling debt
  number; adding a debt series is real engine work, deferred.)*
- **Stress-aware proposals**: the spec's exact rule (stress 4–5 on 4 of
  7 days, or mood ≤ 2 on 3 of 7) in `wellbeing.ts`, delivered through
  the NORMAL proposal path (a `stress-swap` Pebble proposal on Today —
  Swap lighter / Not now). Phrasing pinned by test: fact + offer, and
  the banned phrasings are asserted absent from output AND source.

### The crisis path — always on, cannot be disabled, not in any Extra

- **Detector** (`packages/core-data/src/crisis.ts`): curated definite +
  unsure phrase lists, entirely on-device. The module has NO imports —
  structurally it cannot read a setting, a flag, or the extras state.
- **Decision made without you (spec deviation, stated):** the spec
  allowed an AI second pass when the list is unsure. Unsure phrases
  instead TRIGGER locally. Rationale: false positives are acceptable
  and false negatives are not (this is stricter), and the same spec
  promises "no data leaves the device except the user's own action" —
  an AI pass would send the user's darkest sentence to a server at the
  worst possible moment. Privacy and the stronger guarantee win.
- **The screen** (`CrisisSheet`): "This sounds heavy." + plain words; AU
  Lifeline 13 11 14 (call + text 0477 13 11 14) and 000; NZ 1737; UK/IE
  Samaritans 116 123; US/CA 988; findahelpline.com everywhere; one-tap
  call and text; no mascot; no "are you sure"; the entry still saves and
  the copy says so. Region from the JS locale — no new native dep.
- **Wiring + lint** (`crisisLint.test.ts`): the fixed phrases trigger
  (pure fn — independent of every Extra by construction, asserted); the
  coach question, the check-in note and the journal each run
  `checkCrisis` FIRST and render `CrisisSheet`; a completeness scan
  flags any new self-expression TextInput not on the audited list; and
  no `<CrisisSheet` may appear inside any `<ExtraSlot>` block (this
  caught CoachCard's self-gate — the sheet now renders outside it).
- **Scope decision**: the gate guards fields where a person writes about
  THEMSELVES (coach, journal, check-in note). Object-name fields (food
  search, supplement names, exercise notes) are out — "chicken killed
  my macros" is not a cry for help, and a crisis screen on a barcode
  search would teach users to ignore it.

### Extras — one "Wellbeing tools" offer screen

- **Journal**: local-first exactly like progress photos (device entries
  + separate cloud switch with the trade in words; cloud table
  `basalt_journal_entries` applied, RLS self-only, both wipe paths
  extended — guard 8/8, delete-account v16 live). 90-day doctor PDF via
  the system sheet. "Ask the coach about this →" appears per entry ONLY
  inside a nested coach ExtraSlot, runs the crisis gate before any
  network call, and the reply is labelled "COACH — ONLY BECAUSE YOU
  ASKED".
- **Wind-down**: 5-minute body scan (one plain instruction per minute, a
  light haptic between), 10-minute quiet timer; box breathing is NOT
  duplicated — the existing breath pacer (visual + haptics, logs real
  sessions) is pointed at, honestly. The offer: when sleep debt passes
  90 min, ONE non-repeating notification at the usual bedtime (median of
  last 14 nights, 3+ needed) minus 30 — decided fresh each time Recover
  computes, cancelled otherwise.
- **Meditation timer**: 5/10/20 minutes, soft bell every five (the tick
  sample, direct — the bell IS the feature, not the sounds Extra),
  notifee foreground service (health type, shared ref-counted service
  with walks) so a locked phone finishes the sit; minutes land as
  `basalt_mindfulness_sessions` kind `unguided` through the outbox, with
  the same 30-second false-start floor as the breath pacer.

### Docs

- Design spec **§10 Wellbeing**: no diagnosis/screening, no PHQ-9/GAD-7,
  no mental-health score, crisis path unconditional and ungateable,
  journal private by construction.
- **PLAY-ANSWERS**: new Health-info row declaring mood/energy/stress +
  note + journal as mental-health data (optional, local-first, on-device
  crisis matching).
- **Store listing**: "MIND, WITHOUT SCORES" section with the
  crisis-resources line.

## Release prep — 0.2.0 (versionCode 2)

- **Suite at HEAD: 1,195 tests green** across 8 workspaces (main was
  1,063 when the branch opened).
- versionCode 2 / 0.2.0 in `build.gradle` + `app.json`.
- **Advisor pass after the batch's schema changes**: Basalt-scoped fix
  applied (`basalt_revoke_anon_rpc` — the two V4 social RPCs are no
  longer executable by `anon`). Left alone, with reasons: Arise's
  un-prefixed tables (out of bounds by repo law), `basalt_walks_shared`
  definer view (V3 sharing design, already documented), the
  authenticated-callable definer RPCs (that IS the design), and the
  auth-level leaked-password toggle (shared project — flagged as an
  owner call in PLAY-SUBMIT-TODAY).
- **Decision made without you**: `docs/BASALT-PRE-TESTERS-PROMPT.md` was
  referenced by the batch prompt but did not exist in the repo — I
  authored it from DEVICE-TEST-PLAN.md + the gate amendment + the
  submit doc. §1 (machine checks) is executed and ticked; §2 is the
  device session and remains THE hard stop.
- **Store assets**: listing.md gains "EXTRAS — OFF UNTIL YOU SAY
  OTHERWISE" (replacing the now-false "no XP ever" paragraph) and
  "MIND, WITHOUT SCORES" with the crisis-resources line; 0.2.0 release
  notes in PLAY-SUBMIT-TODAY list every Extra and state the defaults
  (capture four + uncertainty ON; everything else OFF). Screenshots
  flagged for re-shoot at the device session (Extras onboarding + one
  expressive theme).
- AAB + universal APK: built from this commit (paths + sizes in
  PLAY-SUBMIT-TODAY once the build lands below).

### Still waiting on you

1. **The device session** (BASALT-PRE-TESTERS-PROMPT.md §2) — plug the
   phone in: the defaults-vs-main gate (pass/fail), the all-off run
   (informational), Extra-by-Extra smoke, on-device crisis checks,
   onboarding end-to-end, walk notification, all deferred screenshots.
2. **Cody's import** — the dry-run/real-run outputs of
   `scripts/importCody.ts` (§2.8); IMPORT-REPORT.md follows your paste.
3. **Developer registrations** when you want the imports live
   (docs/REGISTRATIONS.md) and the Anthropic key check for
   `ai-daily-summary` / `pebble-coach` (both deployed; they 503/501
   politely without their secrets).
4. The Supabase leaked-password toggle (shared-project owner call).

## Device session — 2026-09-08 (the hard stop, run)

**THE GATE PASSED.** Fresh defaults vs pre-branch main on a physical
S22 Ultra: two screens pixel-identical, every other diff on the expected
list, both runs archived in `docs/report-assets/`. The all-off run is
recorded (capture modes hidden — pre-approved). The crisis path passed
on the RELEASE build from every text entry point, Extras on and off,
with the entry still saving and real AU numbers. Full detail:
DEVICE-TEST-PLAN §28.

Found and owed to this session:
- **P1 — health-type FGS crashes on targetSDK 36** (meditation timer now,
  the V3 guided set timer latently): needs a granted health/activity
  runtime permission we can't assume. Fix lands in Phase 8 (meditation →
  scheduled bells, no service; guided timer → permission-checked
  fallback). This is precisely the check §27 said an AVD could not make.
- **P2 — Settings header says V0.1 on the 0.2.0 build.**
- Fixed in-session: grouped Extras offers now scroll (CTA-reachability).
- Cosmetic: capture-mode chip wrap at 6 modes; plan-rate chip wrap.

Deferred to the post-Phase-8 session with cause (Phase 8 replaces
onboarding and this build): onboarding e2e + burner-account deletion,
walk lock-screen notification, widget placement, store screenshots.
