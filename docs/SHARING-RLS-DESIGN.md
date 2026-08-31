# Sharing RLS design — coach read-only portal + caregiver sharing

**Status: DESIGN ONLY — no migration has been applied. STOP-POINT B.**
V3 Phase 4C item 15. Nothing below runs until you say so.

## What this is

Read-only sharing of parts of a user's ledger with another Basalt account:
a **coach** (training-shaped data) or a **caregiver** (health-shaped data).
The two roles are just preset domain bundles — the grant stores the domains
themselves, so a user can hand-pick any subset.

Product laws applied:

- **Nothing is shared by default.** Every domain is opt-in per grant.
- **Read-only, absolutely.** Grantees get SELECT and nothing else. No write
  policy anywhere references a grant.
- **Revocation cuts access at the next query** — enforced by construction,
  because every read re-evaluates the grant row's `revoked_at` inside RLS.
  No sessions to invalidate, no caches to flush server-side.
- **Cycle tracking is its own domain and never bundles** into coach or
  caregiver presets (V3 item 16's law: excluded from sharing unless
  separately and explicitly granted).
- **Both parties can always see the grant** — the owner to revoke it, the
  grantee to know exactly what they can see.

## The one new table

```sql
create table public.basalt_share_grants (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  grantee_id  uuid references auth.users(id) on delete cascade,  -- null until claimed
  role        text not null check (role in ('coach', 'caregiver', 'custom')),
  domains     text[] not null,   -- subset of the domain registry below
  invite_code text not null,     -- 8 chars, random, single-use
  expires_at  timestamptz not null,          -- unclaimed grants die in 48 h
  revoked_at  timestamptz,                   -- null = live
  created_at  timestamptz not null default now(),
  constraint basalt_share_no_self check (grantee_id is null or grantee_id <> owner_id)
);
create index basalt_share_grants_owner_idx   on basalt_share_grants (owner_id);
create index basalt_share_grants_grantee_idx on basalt_share_grants (grantee_id) where revoked_at is null;
```

RLS on the grants table itself:

| op | who | policy |
|---|---|---|
| select | owner or claimed grantee | `auth.uid() = owner_id or auth.uid() = grantee_id` |
| insert | owner only | `auth.uid() = owner_id and grantee_id is null` |
| update (revoke) | owner only | `auth.uid() = owner_id` |
| delete | owner only | `auth.uid() = owner_id` |

**Invite-code redemption** cannot be plain RLS: a SELECT policy permissive
enough for a grantee to find an unclaimed grant by code would let anyone
enumerate codes. So redemption is one SECURITY DEFINER function (same
pattern as the existing `basalt_delete_my_data`), with `search_path`
pinned, executable by `authenticated`:

```sql
create function public.basalt_redeem_share_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  update basalt_share_grants
     set grantee_id = auth.uid()
   where invite_code = p_code
     and grantee_id is null
     and revoked_at is null
     and expires_at > now()
     and owner_id <> auth.uid()
  returning id into g;
  if g is null then raise exception 'Code invalid, expired, or already used.'; end if;
  return g;
end $$;
revoke execute on function public.basalt_redeem_share_code(text) from anon;
```

## Domain registry and policy matrix

One helper predicate, inlined into every shared-table policy (written out
per-table rather than as a function, so each policy is self-contained and
auditable):

```sql
exists (
  select 1 from public.basalt_share_grants g
   where g.owner_id   = <table>.user_id
     and g.grantee_id = (select auth.uid())
     and g.revoked_at is null
     and '<domain>' = any (g.domains)
)
```

`(select auth.uid())` — initplan-cached once per query, the advisor-blessed
form. The new policies are **additional permissive SELECT policies**; every
existing `auth.uid() = user_id` policy stays untouched, so owners lose
nothing and writes are unaffected.

| domain | tables gaining the SELECT policy | in coach preset | in caregiver preset |
|---|---|---|---|
| `training` | basalt_sessions, basalt_session_exercises, basalt_set_entries, basalt_workout_templates, basalt_template_exercises, basalt_programs, basalt_race_plans | ✓ | — |
| `activity` | basalt_walks (route column: see caveat), basalt_shoes | ✓ | — |
| `nutrition` | basalt_food_entries, basalt_daily_logs, basalt_water_entries, basalt_targets | opt-in extra | — |
| `body` | basalt_weight_entries | ✓ | ✓ |
| `sleep` | basalt_sleep_sessions | — | ✓ |
| `vitals` | basalt_vitals, basalt_checkins | — | ✓ |
| `cycle` | basalt_cycle_* (item 16, tables not yet built) | **never in a preset** | **never in a preset** |

Presets are client-side conveniences only — the server stores and enforces
the explicit domain array on the grant.

### Caveats stated up front

- **Walk routes are location history.** Sharing `activity` shares distance,
  duration, pace and splits; the `route` jsonb column goes with the row
  under plain RLS. If you want routes withheld from coaches, the clean
  mechanism is a view without the route column and grantee reads pointed at
  the view — more moving parts. **Default proposal: share walks without a
  route-stripping view, and say plainly in the grant UI that routes are
  included.** Flag if you want the view instead.
- **Storage buckets are NOT shared.** Food photos and recipe photos stay
  owner-only; no storage policy changes in this design.
- **Same-project caveat:** grants reference `auth.users` in the shared
  Arise/Basalt project. Only `basalt_`-prefixed objects are touched, per
  the migration-safety rule. The DECOMMISSION plan carries grants with it.
- **AI surfaces:** Edge Functions run as the caller; a grantee's calls see
  only their own ledger. Nothing to change.

## Client surfaces (after the migration is approved)

- **Settings → Sharing:** create a grant (role preset → editable domain
  checklist → 8-char code shown once with its 48 h expiry), list live
  grants with their domains, revoke with one tap. Revoke keeps the row
  (`revoked_at`) so both parties see the history.
- **Shared with me:** a read-only viewer listing owners who granted you
  access and, per domain, the same receipt components the owner sees —
  rendered from the same loaders, which now simply pass an `ownerId`
  filter instead of defaulting to self. Every screen carries a srcnote:
  "Read-only · shared by <name> · they can revoke at any time".
- Instrumented: grant created / claimed / revoked, viewer opened.

## Testing plan

- Engine tests for the domain-preset mapping and grant-line copy.
- A committed **live RLS probe** (like the eval harness, using the test
  account + a second seeded account): grantee sees granted domains, loses
  access the moment `revoked_at` is set, never sees ungranted domains,
  cannot write anything, cannot redeem an expired/foreign code. Run
  `get_advisors` after the migration per the standing invariant.

## What I need from you (STOP-POINT B)

1. **OK to apply the migration** (grants table + redeem function + the
   SELECT policy per table in the matrix)?
2. The **walk-route caveat**: include routes under `activity` (default) or
   build the route-stripping view?
3. Any domain you want moved between presets before this ships?
