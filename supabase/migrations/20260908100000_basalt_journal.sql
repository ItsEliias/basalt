-- Journal (journal Extra, V4 Phase 7) — cloud side, used ONLY when the
-- separate cloud-sync switch is on; the default journal never leaves the
-- phone. RLS self-only; both wipe paths extended in this migration.

create table if not exists public.basalt_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  text text not null,
  created_at timestamptz not null default now()
);
alter table public.basalt_journal_entries enable row level security;
create policy "journal self select" on public.basalt_journal_entries
  for select using (user_id = auth.uid());
create policy "journal self insert" on public.basalt_journal_entries
  for insert with check (user_id = auth.uid());
create policy "journal self update" on public.basalt_journal_entries
  for update using (user_id = auth.uid());
create policy "journal self delete" on public.basalt_journal_entries
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
  delete from public.basalt_journal_entries where user_id = uid;
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
