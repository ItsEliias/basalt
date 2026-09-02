-- Mobility sessions (V3.1 H3). One row per completed routine; the
-- optional self-assessment snapshot rides along so correlations can pick
-- mobility up later. No score column EXISTS — the assessment is four
-- independent position ratings that only reorder emphasis (the audit's
-- named trap is a mobility percentage; the schema refuses it). Additive;
-- RLS as everywhere; wipe coverage in the same change, as the deletion
-- guard demands.

create table if not exists public.basalt_mobility_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes numeric not null,
  assessment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists basalt_mobility_sessions_user_idx
  on public.basalt_mobility_sessions (user_id, started_at desc);

alter table public.basalt_mobility_sessions enable row level security;

create policy "basalt_mobility_sessions_select_own" on public.basalt_mobility_sessions
  for select using ((select auth.uid()) = user_id);
create policy "basalt_mobility_sessions_insert_own" on public.basalt_mobility_sessions
  for insert with check ((select auth.uid()) = user_id);
create policy "basalt_mobility_sessions_update_own" on public.basalt_mobility_sessions
  for update using ((select auth.uid()) = user_id);
create policy "basalt_mobility_sessions_delete_own" on public.basalt_mobility_sessions
  for delete using ((select auth.uid()) = user_id);

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
  delete from public.basalt_mobility_sessions where user_id = uid;
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
