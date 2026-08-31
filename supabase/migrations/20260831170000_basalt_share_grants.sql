-- Sharing (V3 Phase 4C item 15) — per docs/SHARING-RLS-DESIGN.md,
-- approved at STOP-POINT B (route-stripping view variant chosen).
--
-- One grants table; every shared table gains ONE additional permissive
-- SELECT policy that re-checks the live grant inside RLS, so revocation
-- cuts access at the next query by construction. Grantees can never
-- write: no insert/update/delete policy anywhere references a grant.
-- Walk ROUTES are location history: basalt_walks gets NO grantee policy
-- at all — shared walks are read only through basalt_walks_shared, a
-- security-barrier view that carries every column except route.
-- Additive only; every object is basalt_-prefixed.

-- ── The grants table ────────────────────────────────────────────────

create table if not exists public.basalt_share_grants (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  grantee_id  uuid references auth.users(id) on delete cascade,
  role        text not null check (role in ('coach', 'caregiver', 'custom')),
  domains     text[] not null check (array_length(domains, 1) >= 1),
  invite_code text not null default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  expires_at  timestamptz not null default now() + interval '48 hours',
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint basalt_share_no_self check (grantee_id is null or grantee_id <> owner_id)
);

create unique index if not exists basalt_share_grants_code_idx
  on public.basalt_share_grants (invite_code);
create index if not exists basalt_share_grants_owner_idx
  on public.basalt_share_grants (owner_id);
create index if not exists basalt_share_grants_grantee_idx
  on public.basalt_share_grants (grantee_id) where revoked_at is null;

alter table public.basalt_share_grants enable row level security;

create policy "basalt_share_grants_select_party" on public.basalt_share_grants
  for select using ((select auth.uid()) = owner_id or (select auth.uid()) = grantee_id);
create policy "basalt_share_grants_insert_own" on public.basalt_share_grants
  for insert with check ((select auth.uid()) = owner_id and grantee_id is null);
create policy "basalt_share_grants_update_own" on public.basalt_share_grants
  for update using ((select auth.uid()) = owner_id);
create policy "basalt_share_grants_delete_own" on public.basalt_share_grants
  for delete using ((select auth.uid()) = owner_id);

-- ── Invite-code redemption ──────────────────────────────────────────
-- SECURITY DEFINER on purpose (same pattern as basalt_delete_my_data):
-- an RLS SELECT policy permissive enough for a grantee to find an
-- unclaimed grant by code would let anyone enumerate codes.

create or replace function public.basalt_redeem_share_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare g uuid;
begin
  update basalt_share_grants
     set grantee_id = auth.uid()
   where invite_code = upper(trim(p_code))
     and grantee_id is null
     and revoked_at is null
     and expires_at > now()
     and owner_id <> auth.uid()
  returning id into g;
  if g is null then
    raise exception 'Code invalid, expired, or already used.';
  end if;
  return g;
end $$;

revoke execute on function public.basalt_redeem_share_code(text) from anon, public;
grant execute on function public.basalt_redeem_share_code(text) to authenticated;

-- ── Route-stripping view for walks ──────────────────────────────────
-- Owner-rights + security_barrier: the embedded predicate is the whole
-- access control, and the route column simply does not exist here.

create or replace view public.basalt_walks_shared
with (security_barrier = true) as
select
  w.id, w.user_id, w.started_at, w.ended_at, w.distance_m, w.duration_s,
  w.elevation_gain_m, w.avg_pace_s_per_km, w.source, w.shoe_id
from public.basalt_walks w
where w.user_id = auth.uid()
   or exists (
        select 1 from public.basalt_share_grants g
        where g.owner_id = w.user_id
          and g.grantee_id = auth.uid()
          and g.revoked_at is null
          and 'activity' = any (g.domains)
      );

revoke all on public.basalt_walks_shared from anon, public;
grant select on public.basalt_walks_shared to authenticated;

-- ── Grantee SELECT policies, per the domain matrix ──────────────────
-- training
create policy "basalt_workout_sessions_select_shared" on public.basalt_workout_sessions
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'training' = any (g.domains)));
create policy "basalt_session_exercises_select_shared" on public.basalt_session_exercises
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'training' = any (g.domains)));
create policy "basalt_set_entries_select_shared" on public.basalt_set_entries
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'training' = any (g.domains)));
create policy "basalt_workout_templates_select_shared" on public.basalt_workout_templates
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'training' = any (g.domains)));
create policy "basalt_template_exercises_select_shared" on public.basalt_template_exercises
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'training' = any (g.domains)));
create policy "basalt_programs_select_shared" on public.basalt_programs
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'training' = any (g.domains)));
create policy "basalt_race_plans_select_shared" on public.basalt_race_plans
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'training' = any (g.domains)));

-- activity (walks deliberately absent — view only)
create policy "basalt_shoes_select_shared" on public.basalt_shoes
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'activity' = any (g.domains)));
create policy "basalt_step_logs_select_shared" on public.basalt_step_logs
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'activity' = any (g.domains)));

-- nutrition
create policy "basalt_food_entries_select_shared" on public.basalt_food_entries
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'nutrition' = any (g.domains)));
create policy "basalt_daily_logs_select_shared" on public.basalt_daily_logs
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'nutrition' = any (g.domains)));
create policy "basalt_hydration_logs_select_shared" on public.basalt_hydration_logs
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'nutrition' = any (g.domains)));
create policy "basalt_targets_select_shared" on public.basalt_targets
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'nutrition' = any (g.domains)));

-- body
create policy "basalt_weight_entries_select_shared" on public.basalt_weight_entries
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'body' = any (g.domains)));

-- sleep (sessions only — stages stay owner-only, the display-only law)
create policy "basalt_sleep_sessions_select_shared" on public.basalt_sleep_sessions
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'sleep' = any (g.domains)));

-- vitals
create policy "basalt_vitals_select_shared" on public.basalt_vitals
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'vitals' = any (g.domains)));
create policy "basalt_checkins_select_shared" on public.basalt_checkins
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'vitals' = any (g.domains)));
