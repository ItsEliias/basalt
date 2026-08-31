-- Programs — the periodization engine's first-class object (V3 Phase 4.2).
-- A program is the user's own declared week structure: which days train,
-- when the mesocycle started. Its non-training days are the planned-rest
-- source for the rest-aware streak rule. Additive only; RLS as everywhere.

create table if not exists public.basalt_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_on date not null,
  training_days smallint[] not null default '{1,3,5}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists basalt_programs_user_idx
  on public.basalt_programs (user_id, active);

alter table public.basalt_programs enable row level security;

create policy "basalt_programs_select_own" on public.basalt_programs
  for select using (auth.uid() = user_id);
create policy "basalt_programs_insert_own" on public.basalt_programs
  for insert with check (auth.uid() = user_id);
create policy "basalt_programs_update_own" on public.basalt_programs
  for update using (auth.uid() = user_id);
create policy "basalt_programs_delete_own" on public.basalt_programs
  for delete using (auth.uid() = user_id);
