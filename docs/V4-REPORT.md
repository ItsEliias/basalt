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

- **Migration written, NOT applied**: `20260907170000_basalt_social_v4.sql`
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
