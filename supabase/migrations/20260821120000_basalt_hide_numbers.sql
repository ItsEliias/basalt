-- Hide-the-numbers mode (ED-sensitive log-only nutrition): a per-account
-- display preference. Additive; scoped to basalt_profiles only.
alter table public.basalt_profiles
  add column if not exists hide_numbers boolean not null default false;
