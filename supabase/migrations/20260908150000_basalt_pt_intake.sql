-- PT intake (V4 Phase 8a) — one additive jsonb on the profile carrying
-- everything the split generator and meal planner need that the profile
-- didn't already hold: experience, schedule, equipment inventory with
-- weights, limitation note, diet preferences, optional measurements.
-- RLS unchanged (self-scoped); profiles are already in both wipe paths.

alter table public.basalt_profiles
  add column if not exists pt_intake jsonb;
