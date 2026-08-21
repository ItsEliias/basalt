-- Live-location beacons. The row id doubles as the unguessable share token;
-- the public page reads through the Edge Function only (service role), so
-- RLS here is owner-only. Auto-expiry via expires_at; explicit stop via
-- ended_at.
create table public.basalt_beacons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours',
  ended_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_accuracy_m double precision,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.basalt_beacons enable row level security;
create policy basalt_beacons_own on public.basalt_beacons
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
