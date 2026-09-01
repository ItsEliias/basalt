-- Camera-PPG calibration rows (V3.1 H1). One row per debug-screen
-- reading: the camera's RMSSD + quality metrics, and the wearable's
-- simultaneous RMSSD typed in beside it. This table exists to answer ONE
-- question — does the camera agree with the watch on this user's own
-- hardware — before the feature is allowed to feed readiness. Additive;
-- RLS as everywhere.

create table if not exists public.basalt_ppg_calibration (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null default now(),
  camera_rmssd numeric,
  camera_bpm numeric,
  quality jsonb not null default '{}'::jsonb,
  watch_rmssd numeric,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists basalt_ppg_calibration_user_idx
  on public.basalt_ppg_calibration (user_id, taken_at desc);

alter table public.basalt_ppg_calibration enable row level security;

create policy "basalt_ppg_calibration_select_own" on public.basalt_ppg_calibration
  for select using ((select auth.uid()) = user_id);
create policy "basalt_ppg_calibration_insert_own" on public.basalt_ppg_calibration
  for insert with check ((select auth.uid()) = user_id);
create policy "basalt_ppg_calibration_update_own" on public.basalt_ppg_calibration
  for update using ((select auth.uid()) = user_id);
create policy "basalt_ppg_calibration_delete_own" on public.basalt_ppg_calibration
  for delete using ((select auth.uid()) = user_id);

-- The deletion guard (deletion-coverage.test.ts) demands every new table
-- join BOTH wipe paths in the same change. SQL path:
create or replace function public.basalt_delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in.';
  end if;
  delete from public.basalt_set_entries where user_id = uid;
  delete from public.basalt_session_exercises where user_id = uid;
  delete from public.basalt_workout_sessions where user_id = uid;
  delete from public.basalt_sleep_stages where user_id = uid;
  delete from public.basalt_sleep_sessions where user_id = uid;
  delete from public.basalt_food_entries where user_id = uid;
  delete from public.basalt_food_favorites where user_id = uid;
  delete from public.basalt_daily_logs where user_id = uid;
  delete from public.basalt_hydration_logs where user_id = uid;
  delete from public.basalt_mindfulness_sessions where user_id = uid;
  delete from public.basalt_walks where user_id = uid;
  delete from public.basalt_step_logs where user_id = uid;
  delete from public.basalt_vitals where user_id = uid;
  delete from public.basalt_checkins where user_id = uid;
  delete from public.basalt_fasts where user_id = uid;
  delete from public.basalt_beacons where user_id = uid;
  delete from public.basalt_progress_photos where user_id = uid;
  delete from public.basalt_weight_entries where user_id = uid;
  delete from public.basalt_meal_plans where user_id = uid;
  delete from public.basalt_grocery_items where user_id = uid;
  delete from public.basalt_recipe_ingredients where user_id = uid;
  delete from public.basalt_recipe_steps where user_id = uid;
  delete from public.basalt_recipes where user_id = uid;
  delete from public.basalt_workout_templates where user_id = uid;
  delete from public.basalt_template_exercises where user_id = uid;
  delete from public.basalt_programs where user_id = uid;
  delete from public.basalt_race_plans where user_id = uid;
  delete from public.basalt_shoes where user_id = uid;
  delete from public.basalt_cycle_entries where user_id = uid;
  delete from public.basalt_ppg_calibration where user_id = uid;
  delete from public.basalt_pair_days where user_id = uid;
  delete from public.basalt_share_grants where owner_id = uid or grantee_id = uid;
  delete from public.basalt_pairs where a_id = uid or b_id = uid;
  delete from public.basalt_targets where user_id = uid;
  delete from public.basalt_profiles where id = uid;
end;
$$;
