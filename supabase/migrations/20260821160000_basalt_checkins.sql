-- Evening check-ins: boolean factors + optional mood, one row per day.
-- Feeds the correlations engine through the same published gates.
create table public.basalt_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  factors text[] not null default '{}',
  mood int check (mood is null or (mood between 1 and 5)),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
alter table public.basalt_checkins enable row level security;
create policy basalt_checkins_own on public.basalt_checkins
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
