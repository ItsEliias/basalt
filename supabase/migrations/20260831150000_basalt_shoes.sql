-- Shoe mileage (V3 Phase 4.13). Shoes are named things walks attribute
-- distance to; the threshold is the USER'S number, not ours — the app
-- shows published guidance in a srcnote and never nags. Additive only:
-- new table + one nullable column on basalt_walks.

create table if not exists public.basalt_shoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  threshold_km numeric check (threshold_km is null or threshold_km > 0),
  retired boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists basalt_shoes_user_idx
  on public.basalt_shoes (user_id, retired);

alter table public.basalt_shoes enable row level security;

create policy "basalt_shoes_select_own" on public.basalt_shoes
  for select using (auth.uid() = user_id);
create policy "basalt_shoes_insert_own" on public.basalt_shoes
  for insert with check (auth.uid() = user_id);
create policy "basalt_shoes_update_own" on public.basalt_shoes
  for update using (auth.uid() = user_id);
create policy "basalt_shoes_delete_own" on public.basalt_shoes
  for delete using (auth.uid() = user_id);

alter table public.basalt_walks
  add column if not exists shoe_id uuid references public.basalt_shoes(id) on delete set null;
