-- Monthly-challenge opt-in. Off by default; additive; basalt_-scoped.
alter table public.basalt_profiles
  add column if not exists challenge_enabled boolean not null default false;
