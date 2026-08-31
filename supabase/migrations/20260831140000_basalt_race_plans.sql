-- Race plans (V3 Phase 4.11). One row = one plan: the target race, the
-- date, and the ONE basis result the Riegel model derives everything
-- from. The plan itself is never stored — it recomputes deterministically
-- from these inputs via the published engine; `done` holds the ticked
-- session keys ("w3s1"). Additive only; RLS as everywhere.

create table if not exists public.basalt_race_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  race_key text not null check (race_key in ('5k', '10k', 'half', 'marathon')),
  race_date date not null,
  basis_dist_m numeric not null check (basis_dist_m > 0),
  basis_seconds numeric not null check (basis_seconds > 0),
  done jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists basalt_race_plans_user_idx
  on public.basalt_race_plans (user_id, active);

alter table public.basalt_race_plans enable row level security;

create policy "basalt_race_plans_select_own" on public.basalt_race_plans
  for select using (auth.uid() = user_id);
create policy "basalt_race_plans_insert_own" on public.basalt_race_plans
  for insert with check (auth.uid() = user_id);
create policy "basalt_race_plans_update_own" on public.basalt_race_plans
  for update using (auth.uid() = user_id);
create policy "basalt_race_plans_delete_own" on public.basalt_race_plans
  for delete using (auth.uid() = user_id);
