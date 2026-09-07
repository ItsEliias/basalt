-- Supplements checklist (supplements Extra, V4 Phase 4). The user's own
-- list, ticked per day. Basalt never suggests a product and never proposes
-- a dose — dose_note is the user's words, stored verbatim.

create table if not exists public.basalt_supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dose_note text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.basalt_supplements enable row level security;
create policy "supplements self select" on public.basalt_supplements
  for select using (user_id = auth.uid());
create policy "supplements self insert" on public.basalt_supplements
  for insert with check (user_id = auth.uid());
create policy "supplements self update" on public.basalt_supplements
  for update using (user_id = auth.uid());
create policy "supplements self delete" on public.basalt_supplements
  for delete using (user_id = auth.uid());

create table if not exists public.basalt_supplement_checks (
  supplement_id uuid not null references public.basalt_supplements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (supplement_id, day)
);
alter table public.basalt_supplement_checks enable row level security;
create policy "supplement checks self select" on public.basalt_supplement_checks
  for select using (user_id = auth.uid());
create policy "supplement checks self insert" on public.basalt_supplement_checks
  for insert with check (user_id = auth.uid());
create policy "supplement checks self delete" on public.basalt_supplement_checks
  for delete using (user_id = auth.uid());

-- Wipe list — append-only, same migration as the tables (deletion law).
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
  delete from public.basalt_supplement_checks where user_id = uid;
  delete from public.basalt_supplements where user_id = uid;
  delete from public.basalt_share_grants where owner_id = uid or grantee_id = uid;
  delete from public.basalt_pairs where a_id = uid or b_id = uid;
  delete from public.basalt_friend_invites where owner_id = uid;
  delete from public.basalt_friends where user_a = uid or user_b = uid;
  delete from public.basalt_challenge_progress where user_id = uid;
  delete from public.basalt_challenge_members where user_id = uid;
  delete from public.basalt_challenges where creator_id = uid;
  delete from public.basalt_friend_days where user_id = uid;
  delete from public.basalt_targets where user_id = uid;
  delete from public.basalt_profiles where id = uid;
end;
$$;
