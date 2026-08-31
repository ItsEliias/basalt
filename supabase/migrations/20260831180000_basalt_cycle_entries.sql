-- Cycle tracking (V3 Phase 4C item 16). Facts logged by the user; every
-- prediction the app draws from them is a labelled estimate with an
-- uncertainty window from the user's OWN history. Private by default:
-- the 'cycle' share domain exists but no preset bundles it — sharing
-- happens only when the owner picks it explicitly. Additive only.

create table if not exists public.basalt_cycle_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  flow text check (flow in ('spotting', 'light', 'medium', 'heavy')),
  symptoms text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists basalt_cycle_entries_user_idx
  on public.basalt_cycle_entries (user_id, date desc);

alter table public.basalt_cycle_entries enable row level security;

create policy "basalt_cycle_entries_select_own" on public.basalt_cycle_entries
  for select using ((select auth.uid()) = user_id);
create policy "basalt_cycle_entries_insert_own" on public.basalt_cycle_entries
  for insert with check ((select auth.uid()) = user_id);
create policy "basalt_cycle_entries_update_own" on public.basalt_cycle_entries
  for update using ((select auth.uid()) = user_id);
create policy "basalt_cycle_entries_delete_own" on public.basalt_cycle_entries
  for delete using ((select auth.uid()) = user_id);

-- The 'cycle' share domain — separately granted or not at all.
create policy "basalt_cycle_entries_select_shared" on public.basalt_cycle_entries
  for select using (exists (select 1 from public.basalt_share_grants g
    where g.owner_id = user_id and g.grantee_id = (select auth.uid())
      and g.revoked_at is null and 'cycle' = any (g.domains)));
