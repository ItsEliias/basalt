-- basalt_delete_my_data caught up to the V2/V3 schema. The function had
-- stopped at the V1 table list — a compliance bug the privacy pages were
-- about to publish over. Now covers every basalt_ table including the
-- two-sided ones (grants by owner OR grantee, pairs by either member;
-- pair_days cascade from their pair for both sides and are also wiped by
-- user_id for completeness). Append-only wipe list, same as the Edge
-- Function's — the two paths must always match.

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
  delete from public.basalt_pair_days where user_id = uid;
  delete from public.basalt_share_grants where owner_id = uid or grantee_id = uid;
  delete from public.basalt_pairs where a_id = uid or b_id = uid;
  delete from public.basalt_targets where user_id = uid;
  delete from public.basalt_profiles where id = uid;
end;
$$;
