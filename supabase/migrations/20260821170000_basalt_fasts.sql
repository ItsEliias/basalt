-- Fasting module: window rows + the opt-in flag. Off by default; additive.
create table public.basalt_fasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.basalt_fasts enable row level security;
create policy basalt_fasts_own on public.basalt_fasts
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_profiles
  add column if not exists fasting_enabled boolean not null default false;
