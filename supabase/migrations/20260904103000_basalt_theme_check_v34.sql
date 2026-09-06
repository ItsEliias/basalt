-- V3.4: five expressive themes join the profile theme whitelist.
-- Scoped to basalt_profiles only (shared-project migration-safety rule).
alter table basalt_profiles drop constraint basalt_profiles_theme_check;
alter table basalt_profiles add constraint basalt_profiles_theme_check
  check (theme = any (array[
    'minimal'::text, 'humanist'::text, 'athletic'::text, 'brutalist'::text,
    'depth'::text, 'atelier'::text,
    'clay'::text, 'sticker'::text, 'gummy'::text, 'soft'::text, 'candyRings'::text
  ]));
