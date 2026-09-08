-- Detail level (V4 Phase 8h) — a third axis beside theme and Extras:
-- simple | standard | full. Changes what is SHOWN, never what is
-- computed (conformance-tested). Additive; profiles already wiped.

alter table public.basalt_profiles
  add column if not exists detail text not null default 'standard'
  check (detail in ('simple', 'standard', 'full'));
