-- Display preferences (Settings → Display): text size and row/card density.
-- Comfortable density defaults on for every new profile row per the
-- legibility revision; existing rows backfill to the same default via the
-- column default (no migration-time UPDATE needed).
alter table public.basalt_profiles
  add column if not exists text_scale text not null default 'system'
    check (text_scale in ('system', 'plus1', 'plus2')),
  add column if not exists density text not null default 'comfortable'
    check (density in ('comfortable', 'compact'));
