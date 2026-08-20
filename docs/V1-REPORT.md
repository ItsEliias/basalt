# Basalt — V1 Report

**Date:** 21 August 2026 · **Repo:** `ItsEliias/basalt` · **Status:** V1 scope met, verified end-to-end.

## Scope, as ordered — all delivered

The accepted V1 remainder, in the order you set, each unit merged from its own branch with tests:

| Unit | Branch | What shipped |
|---|---|---|
| HC permission reconciliation | `v1-hc-permissions` | Full 28-record-type accounting: 26 own-permission entries + `CyclingPedalingCadence` (shared under `READ_EXERCISE` — the vendored comment claiming `READ_SPEED` was wrong, verified against HC docs and the library's mapping table) + `SleepStage` (nested inside `SleepSessionRecord` under `READ_SLEEP`). `RECORD_TYPE_ACCOUNTING` in `manifest.ts` documents every row; 5 tests pin the counts and the two shared/nested mappings so a future record type can't slip through unaccounted. |
| Decommission runbook | `v1-decommission-doc` | `docs/DECOMMISSION.md` (6-step runbook: replay migrations + seed, repoint env, re-run DoD walkthrough, make delete-account unconditional, clean `basalt_` tables out of the shared project) with the migration triggers you named — first external tester, store submission, or resumed Arise schema work, whichever first. `CLAUDE.md` gained the migration-safety law: *no destructive SQL that isn't scoped to `basalt_`-prefixed objects, ever.* |
| HC background sync | `v1-hc-sync` | `syncHealthData` — a provider-injected engine (testable with fakes) that persists **sleep sessions + stages at last** (the flagship source-app gap), steps (upsert on user+date), weight, hydration, and HC-originated meals into the `basalt_` tables, all ext-id-deduped so re-syncs never double-count. `runHealthSync` wires it app-side with a 15-minute throttle; Today and Recover now read persisted rows first and fall back to live HC. |
| M1 letter-gaps | `v1-letter-gaps` | Supersets settable in-session (A1/A2 tags, link/unlink), per-set comments, end-session RPE prompt (chips 6–10 + skip — skipping stores nothing, not a default), plate calculator (greedy per-side breakdown, residual stated when the bar can't be loaded exactly), swipe-copy-yesterday on Log, guided-timer keep-awake while training. |
| Outdoor | `v1-outdoor` | GPS walk recorder onto `basalt_walks`: a mode state machine (idle → checking → services-off/denied → ready → tracking → saving → summary/error) over `expo-location`, accuracy/jitter fix filters, haversine distance, elevation gain with a climb threshold, Douglas-Peucker route simplification before storage, boundary-interpolated km splits with pace bars, recent-walks list. |
| Recipes + planner + grocery | `v1-recipes` | Recipes in Postgres at last (the source app kept them in AsyncStorage): URL import → editable draft → save, with imported macros wearing `~` until `macros_confirmed` flips; serving-scaled detail view; dietary-conflict flagging over ingredients; log-a-serving through the one food write path. 7-day planner with tap-to-log. Grocery list with unit-normalised consolidation (same name + same base unit sums; different units stay separate; prose amounts never merge — no unit fiction), aisle grouping, check-off, clear-checked. |
| AI quick-add | `v1-ai-quick-add` | `ai-quick-add` Edge Function (JWT-verified): freeform text → structured suggestions via `claude-opus-4-8` with a strict JSON-schema output, so the client never defensively parses. Every returned value wears `~` and lands in the editable draft — capture → suggestion → confirm, nothing auto-commits. The Anthropic key exists only as a Supabase secret; no client-side AI key exists anywhere. |
| Week in Review | `v1-week-review` | `composeWeekReview` — a pure composer over the last completed Mon–Sun: factual lede, **exactly one gap named** (worst adherence dimension by deterministic severity), stats only for dimensions with real data (volume, deficit/surplus stated as which it is, sleep avg from persisted sessions, steps avg), and a week with too little data says so instead of composing fiction. Rendered as the top Trends card with a wstat row. |

## Verification

**Test suite: 317 tests green** across all seven workspaces — core-data 26, ui 19, analytics 18,
nutrition 101, training 60, health-connect 31, app 62. `tsc --noEmit` clean on every package and
the app.

**Live backend walkthrough** (fresh throwaway accounts against the production project, exercising
the exact REST contract the app uses): **23/23 functional checks passed** — daily log + food entry;
recipe with ingredients and steps inserted, read back nested, and macros confirmed; meal plan
referencing the recipe; grocery item inserted and checked off; walk with a route JSONB; sleep
session **with stages**; step log; versioned targets; RLS verified from a second account (zero
rows visible across all six V1 tables, cross-user insert rejected); then `delete-account`
returning ok.

**Server-side residue check** (service-role SQL): zero rows for both walkthrough users across all
19 user-owned `basalt_` tables + `basalt_profiles`, and **zero rows in `auth.users`** — the
cascade genuinely covers every V1 table and the sign-in record.

One observation worth recording, not a defect: a deleted user's JWT remains cryptographically
valid until it expires (stateless tokens), but every query under it returns zero rows and the
auth record is verifiably gone. Nothing is readable; the token is a husk.

**Table accounting:** the schema holds 21 `basalt_` tables. `delete-account` wipes 19 by
`user_id` plus `basalt_profiles` by `id`; the 21st, `basalt_exercises`, is the global seeded
movement catalog (873 rows, no user data) and is correctly excluded.

## Deviations and notes

1. **`ANTHROPIC_API_KEY` is not set yet.** AI quick-add returns an honest 503 ("not configured on
   the server yet") which the app surfaces as-is. To enable it: Supabase dashboard → Edge
   Functions → Secrets, or `supabase secrets set ANTHROPIC_API_KEY=…`. Nothing else needs to
   change or redeploy.
2. **Outdoor ships without a map tile.** Splits, distance, elevation, pace, and the recent-walks
   list are real; the simplified route is stored in `basalt_walks.route`, so a tile can render it
   later without a schema change. A map dependency was out of scope for this slice.
3. **Grocery is a single table** (`basalt_grocery_items` with a `position` column), deviating from
   the migration report §3's two-table list+items shape. V1 has exactly one active list per user;
   the two-table shape can be added additively if named/multiple lists arrive.
4. **`expo-location ^57.0.1`** — matches the version arise pins, keeping the shared-project
   toolchain consistent.
5. **Shared Supabase project retained** per your decision. The `basalt_` prefix rule and the new
   migration-safety law in `CLAUDE.md` fence it; `docs/DECOMMISSION.md` is the exit, triggered by
   first external tester, store submission, or resumed Arise schema work — whichever comes first.
6. **Week in Review is computed on view**, reviewing the last completed Mon–Sun. The prototype's
   "every Sunday 18:00" was a push-delivery promise; scheduled delivery needs notification
   infrastructure (V1.x), so the card's source note says what it actually is — written from your
   data, no cheerleading, one gap named — and nothing it isn't.
7. **Process:** every V1 unit went branch → `--no-ff` merge → push, except the Outdoor unit which
   was first committed directly to `main` — caught before pushing and rewritten onto
   `v1-outdoor` with a proper merge, so the published history keeps the discipline throughout.

## What's next (V1.x candidates, in rough value order)

1. Map tile on Outdoor summaries (route JSONB is already there).
2. Planned-vs-actually-eaten reconciliation on the planner.
3. Week in Review as a scheduled Sunday notification (the composer is done; this is delivery).
4. Guided-timer true screen-off continuation (Android foreground service / notification timer).
5. Condition-based exercise biasing in the library ordering (stored at onboarding since M1).
6. Per-table CSV export archive (zip dependency).
7. Dedicated Supabase project per `DECOMMISSION.md` when a trigger fires.
