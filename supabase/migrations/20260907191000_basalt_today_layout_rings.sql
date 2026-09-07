-- V4 Phase 3: 'rings' joins the per-surface Today layout options.
alter table public.basalt_profiles drop constraint basalt_profiles_today_layout_check;
alter table public.basalt_profiles add constraint basalt_profiles_today_layout_check
  check (today_layout = any (array['ledger'::text, 'tiles'::text, 'rings'::text]));
