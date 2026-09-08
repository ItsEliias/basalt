-- Wellbeing (V4 Phase 7) — the daily check-in grows energy and stress
-- beside the existing mood. Additive; RLS already self-scoped; no new
-- tables so both wipe paths are untouched.

alter table public.basalt_checkins
  add column if not exists energy int check (energy is null or (energy between 1 and 5)),
  add column if not exists stress int check (stress is null or (stress between 1 and 5));
