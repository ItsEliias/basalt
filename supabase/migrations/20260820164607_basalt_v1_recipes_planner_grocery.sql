-- Basalt V1: recipes persisted in Postgres at last (they lived in
-- AsyncStorage in the source app), meal plans, and the grocery list.
-- Scoped entirely to basalt_ objects per the migration-safety rule.

create table public.basalt_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  serves numeric not null default 1 check (serves > 0),
  total_time_min int,
  cover_url text,
  source_url text,
  source text not null default 'manual',
  calories_per_serve numeric not null default 0,
  protein_per_serve numeric not null default 0,
  carbs_per_serve numeric not null default 0,
  fat_per_serve numeric not null default 0,
  fiber_per_serve numeric not null default 0,
  /* false while imported macros wear the ~ (unconfirmed) marker. */
  macros_confirmed boolean not null default true,
  created_at timestamptz not null default now()
);
create index basalt_recipes_user_idx on public.basalt_recipes (user_id, created_at desc);

create table public.basalt_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.basalt_recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null default 0,
  qty numeric,
  unit text,
  name text not null,
  aisle text
);
create index basalt_recipe_ingredients_recipe_idx on public.basalt_recipe_ingredients (recipe_id, position);

create table public.basalt_recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.basalt_recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null default 0,
  text text not null
);
create index basalt_recipe_steps_recipe_idx on public.basalt_recipe_steps (recipe_id, position);

create table public.basalt_meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal_slot text not null check (meal_slot in ('breakfast','lunch','dinner','snacks')),
  recipe_id uuid references public.basalt_recipes(id) on delete cascade,
  serves numeric not null default 1 check (serves > 0),
  note text,
  created_at timestamptz not null default now()
);
create index basalt_meal_plans_user_date_idx on public.basalt_meal_plans (user_id, date);

create table public.basalt_grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  qty numeric,
  unit text,
  aisle text not null default 'other',
  checked boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index basalt_grocery_items_user_idx on public.basalt_grocery_items (user_id, aisle, position);

alter table public.basalt_recipes enable row level security;
create policy basalt_recipes_own on public.basalt_recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.basalt_recipe_ingredients enable row level security;
create policy basalt_recipe_ingredients_own on public.basalt_recipe_ingredients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.basalt_recipe_steps enable row level security;
create policy basalt_recipe_steps_own on public.basalt_recipe_steps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.basalt_meal_plans enable row level security;
create policy basalt_meal_plans_own on public.basalt_meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.basalt_grocery_items enable row level security;
create policy basalt_grocery_items_own on public.basalt_grocery_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Extend the wipe function to cover the new tables (children cascade from
-- recipes, deleted explicitly anyway for completeness).
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
  delete from public.basalt_weight_entries where user_id = uid;
  delete from public.basalt_meal_plans where user_id = uid;
  delete from public.basalt_grocery_items where user_id = uid;
  delete from public.basalt_recipe_ingredients where user_id = uid;
  delete from public.basalt_recipe_steps where user_id = uid;
  delete from public.basalt_recipes where user_id = uid;
  delete from public.basalt_targets where user_id = uid;
  delete from public.basalt_profiles where id = uid;
end;
$$;
