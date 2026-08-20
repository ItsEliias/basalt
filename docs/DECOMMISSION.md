# Decommission runbook — leaving the shared Supabase project

Basalt currently runs inside the **Arise** Supabase project (`ezsrwwfieihelfekgclz`, decided
2026-08-20 at the free-tier project limit, reaffirmed 2026-08-21). Every Basalt object is
`basalt_`-prefixed; auth is a shared pool. This document is the exact runbook for moving to a
dedicated project when a trigger fires.

## Triggers — migrate when the FIRST of these happens

1. **First external tester** (anyone who isn't the developer signs up).
2. **Store submission** (Play or App Store — the delete-account conditionality must go before
   review).
3. **Resumed Arise schema work** (any Arise migration activity in the shared project).

## Runbook

### 1. Stand up the dedicated project

- Create the project (org upgrade or a freed slot; region `ap-southeast-2` to match).
- Replay, in order, every file in `supabase/migrations/` via `apply_migration` (or `supabase db
  push`). The migrations are written to be replayable as-is; per the safety rule below, none of
  them touch un-prefixed objects.
- Enable the `http` extension (its migration is in the sequence), then run
  `supabase/seed/seed_exercises.sql` as a privileged role. Verify: `select count(*) from
  basalt_exercises` → **873**.
- Deploy `supabase/functions/delete-account` to the new project (JWT verification on).
- Auth settings: enable email+password; mirror the confirmation setting the shared project used
  (confirmations currently off — decide deliberately whether to keep that for real users).

### 2. Make delete-account unconditional

In the new project there is no Arise data, so the Arise check is dead weight and a risk:

- Edit `supabase/functions/delete-account/index.ts`: remove `ARISE_TABLES` and the
  `hasAriseData` block; always call `admin.auth.admin.deleteUser(uid)` after the wipe; simplify
  the response note to the unconditional sentence.
- Redeploy, and drop the shared-auth caveat copy from `SettingsScreen` and `CLAUDE.md`.

### 3. Repoint the app

- `app/.env`: new `EXPO_PUBLIC_SUPABASE_URL` + publishable key. Nothing else in the client
  changes — the URL and key are the only project-specific values in the bundle.
- If any user data must carry over (developer accounts only — external users trigger this runbook
  *before* they exist): export via Settings → Your Data on the old project, re-import manually.
  Do not attempt to move auth users between projects; recreate accounts.

### 4. Re-run the DoD walkthrough

Run the 20-step walkthrough from `docs/M1-REPORT.md` (script pattern: signup → profile → targets
→ weigh-in → daily log → barcode + manual entries → water → favorites → library read → session →
weighted + timed sets → RPE end → Today totals → Settings edit → export reads on every table →
delete-account) against the NEW project. All checks must pass, and the delete step must now report
`authDeleted: true` unconditionally. Verify server-side: zero rows for the test user in every
table including `auth.users`.

### 5. Clean the shared project

Only after step 4 passes and the app points at the new project:

- Drop every `basalt_` table, the two Basalt functions and the seed data from the shared project:
  `drop table if exists basalt_… cascade;` for each of the 15 tables (children first or rely on
  cascade), `drop function if exists public.basalt_delete_my_data();`,
  `drop function if exists public.basalt_touch_updated_at();`, and delete the `delete-account`
  Edge Function.
- **Scope check before running anything:** every statement names a `basalt_`-prefixed object or a
  Basalt-owned function. Nothing else. Arise tables, Arise functions, the `http` extension
  (leave it — cheap and harmless) and auth config stay untouched.
- Auth users who only ever used Basalt may be deleted from the shared pool; anyone with Arise
  rows stays.

### 6. Record it

Note the migration date + new project ref in `CLAUDE.md` (Backend section) and remove this
document's "currently shared" framing. The runbook itself stays as history.

## Standing safety rule (also in CLAUDE.md)

**No destructive SQL that isn't scoped to `basalt_`-prefixed objects, ever.** No `drop`/`delete`/
`truncate`/`alter` against any un-prefixed table, function, policy, or extension in the shared
project — including "harmless" cleanup. If a statement can't name its `basalt_` target
explicitly, it doesn't run.
