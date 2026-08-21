-- Daily vitals rollups persisted from Health Connect — the history the
-- readiness baseline needs. Additive; basalt_-scoped.
create table public.basalt_vitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('hrv_rmssd', 'resting_hr')),
  value numeric not null,
  source text not null default 'health_connect',
  created_at timestamptz not null default now(),
  unique (user_id, date, kind)
);
alter table public.basalt_vitals enable row level security;
create policy basalt_vitals_own on public.basalt_vitals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
