-- Theme + Today layout (Settings → Display, beside text size and density).
-- Minimal / ledger default on for every new profile row and every existing
-- one via the column default (no migration-time UPDATE needed) — matches
-- the theme registry's own DEFAULT_THEME and the layouts doc's v1 default.
alter table public.basalt_profiles
  add column if not exists theme text not null default 'minimal'
    check (theme in ('minimal', 'humanist', 'athletic', 'brutalist', 'depth', 'atelier')),
  add column if not exists today_layout text not null default 'ledger'
    check (today_layout in ('ledger', 'tiles'));
