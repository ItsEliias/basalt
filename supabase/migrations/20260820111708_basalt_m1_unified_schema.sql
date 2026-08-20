-- Basalt M1 unified schema (migration report §3), namespaced basalt_ because
-- this project is shared with the Arise app. No gamification columns anywhere.
-- RLS auth.uid() = user_id on every user table. Every synced row carries
-- source (+ ext_source/ext_id where key-based dedupe applies).

-- ─── Identity & targets ──────────────────────────────────────────────────────

create table public.basalt_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  biological_sex text check (biological_sex in ('female','male','intersex','prefer_not_to_say')),
  birthdate date,
  age_years int check (age_years between 5 and 120),
  height_cm numeric check (height_cm > 0),
  activity_level text check (activity_level in ('sedentary','light','moderate','very','extreme')),
  goal_types text[] not null default '{}',
  goal_weight_kg numeric check (goal_weight_kg > 0),
  weekly_target_kg numeric,
  conditions text[] not null default '{}',
  medications text[] not null default '{}',
  habits jsonb not null default '{}'::jsonb,
  dietary_flags text[] not null default '{}',
  diet_patterns text[] not null default '{}',
  train_location text check (train_location in ('gym','home','both')),
  equipment text[] not null default '{}',
  job_activity text,
  exercise_frequency text,
  typical_sleep text,
  stress_level text,
  motivations text[] not null default '{}',
  checkin_preference text check (checkin_preference in ('quiet','weekly','daily')),
  use_metric boolean not null default true,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.basalt_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_date date not null,
  calories int not null,
  protein_g int not null,
  carbs_g int not null,
  fat_g int not null,
  fiber_g int not null,
  sugar_cap_g int,
  sodium_cap_mg int,
  water_ml int,
  steps int,
  sleep_min int,
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, effective_date)
);

-- ─── Daily parent + nutrition ────────────────────────────────────────────────

create table public.basalt_daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  calories_eaten numeric not null default 0,
  calories_burned numeric not null default 0,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.basalt_food_entries (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.basalt_daily_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snacks')),
  food_name text not null,
  brand text,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  sugar numeric not null default 0,
  sodium_mg numeric not null default 0,
  saturated_fat numeric not null default 0,
  serving_size numeric not null default 100,
  serving_unit text not null default 'g',
  quantity numeric not null default 1,
  barcode text,
  micros jsonb,
  photo_path text,
  source text not null default 'manual',
  ext_source text,
  ext_id text,
  created_at timestamptz not null default now()
);
create index basalt_food_entries_log_idx on public.basalt_food_entries (log_id);
create index basalt_food_entries_user_created_idx on public.basalt_food_entries (user_id, created_at desc);
create unique index basalt_food_entries_ext_key on public.basalt_food_entries (user_id, ext_source, ext_id) where ext_id is not null;

create table public.basalt_food_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  brand text,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  sugar numeric not null default 0,
  sodium_mg numeric not null default 0,
  saturated_fat numeric not null default 0,
  serving_size numeric not null default 100,
  serving_unit text not null default 'g',
  quantity numeric not null default 1,
  barcode text,
  use_count int not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, food_name, brand)
);

-- ─── Training (Oathbound set_entry shape, ported to Postgres) ───────────────

create table public.basalt_exercises (
  id uuid primary key default gen_random_uuid(),
  ext_id text not null,
  source text not null,
  name text not null,
  category text,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text,
  difficulty text,
  instructions text[] not null default '{}',
  image_urls text[] not null default '{}',
  video_url text,
  created_at timestamptz not null default now(),
  unique (source, ext_id)
);
create index basalt_exercises_primary_muscles_idx on public.basalt_exercises using gin (primary_muscles);
create index basalt_exercises_name_idx on public.basalt_exercises (lower(name));

create table public.basalt_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  session_rpe numeric check (session_rpe is null or (session_rpe >= 0 and session_rpe <= 10)),
  source text not null default 'manual',
  ext_id text,
  created_at timestamptz not null default now()
);
create index basalt_workout_sessions_user_idx on public.basalt_workout_sessions (user_id, started_at desc);
create unique index basalt_workout_sessions_ext_key on public.basalt_workout_sessions (user_id, ext_id) where ext_id is not null;

create table public.basalt_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.basalt_workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid references public.basalt_exercises(id),
  exercise_name text not null,
  order_index int not null default 0,
  superset_group int,
  rest_seconds int,
  notes text,
  feedback text check (feedback is null or feedback in ('too_easy','right','too_hard')),
  created_at timestamptz not null default now()
);
create index basalt_session_exercises_session_idx on public.basalt_session_exercises (session_id, order_index);
create index basalt_session_exercises_user_exercise_idx on public.basalt_session_exercises (user_id, exercise_id);

create table public.basalt_set_entries (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.basalt_session_exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number int not null,
  set_type text not null default 'normal' check (set_type in ('normal','warmup','dropset','failure')),
  reps int check (reps is null or reps >= 0),
  weight_kg numeric check (weight_kg is null or weight_kg >= 0),
  duration_s int check (duration_s is null or duration_s >= 0),
  rir numeric check (rir is null or (rir >= 0 and rir <= 10)),
  rpe numeric check (rpe is null or (rpe >= 0 and rpe <= 10)),
  rest_s int,
  comment text,
  completed_at timestamptz not null default now(),
  unique (session_exercise_id, set_number)
);
create index basalt_set_entries_user_idx on public.basalt_set_entries (user_id, completed_at desc);

-- ─── Movement & recovery ─────────────────────────────────────────────────────

create table public.basalt_walks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  distance_m numeric not null default 0,
  duration_s int not null default 0,
  elevation_gain_m numeric,
  avg_pace_s_per_km numeric,
  route jsonb,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create index basalt_walks_user_idx on public.basalt_walks (user_id, started_at desc);

create table public.basalt_step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  steps int not null default 0,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.basalt_weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric not null check (weight_kg > 0),
  source text not null default 'manual',
  ext_id text,
  created_at timestamptz not null default now()
);
create index basalt_weight_entries_user_idx on public.basalt_weight_entries (user_id, measured_at desc);
create unique index basalt_weight_entries_ext_key on public.basalt_weight_entries (user_id, ext_id) where ext_id is not null;

create table public.basalt_sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  bedtime timestamptz,
  waketime timestamptz,
  quality int check (quality is null or (quality between 1 and 5)),
  source text not null default 'manual',
  ext_id text,
  created_at timestamptz not null default now()
);
create index basalt_sleep_sessions_user_idx on public.basalt_sleep_sessions (user_id, date desc);
create unique index basalt_sleep_sessions_ext_key on public.basalt_sleep_sessions (user_id, ext_id) where ext_id is not null;

create table public.basalt_sleep_stages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.basalt_sleep_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null check (stage in ('deep','light','rem','awake','sleeping','unknown')),
  start_time timestamptz not null,
  end_time timestamptz not null
);
create index basalt_sleep_stages_session_idx on public.basalt_sleep_stages (session_id);

create table public.basalt_hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ts timestamptz not null default now(),
  date date not null,
  ml int not null check (ml > 0),
  source text not null default 'manual',
  ext_id text
);
create index basalt_hydration_logs_user_date_idx on public.basalt_hydration_logs (user_id, date);
create unique index basalt_hydration_logs_ext_key on public.basalt_hydration_logs (user_id, ext_id) where ext_id is not null;

create table public.basalt_mindfulness_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  minutes numeric not null default 0,
  kind text not null default 'unguided' check (kind in ('box','478','coherent','unguided','imported')),
  source text not null default 'manual',
  ext_id text,
  created_at timestamptz not null default now()
);
create index basalt_mindfulness_sessions_user_idx on public.basalt_mindfulness_sessions (user_id, started_at desc);
create unique index basalt_mindfulness_sessions_ext_key on public.basalt_mindfulness_sessions (user_id, ext_id) where ext_id is not null;

-- ─── updated_at maintenance ──────────────────────────────────────────────────

create or replace function public.basalt_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger basalt_profiles_touch
  before update on public.basalt_profiles
  for each row execute function public.basalt_touch_updated_at();

-- ─── Row-level security ──────────────────────────────────────────────────────

alter table public.basalt_profiles enable row level security;
create policy basalt_profiles_own on public.basalt_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

alter table public.basalt_targets enable row level security;
create policy basalt_targets_own on public.basalt_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_daily_logs enable row level security;
create policy basalt_daily_logs_own on public.basalt_daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_food_entries enable row level security;
create policy basalt_food_entries_own on public.basalt_food_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_food_favorites enable row level security;
create policy basalt_food_favorites_own on public.basalt_food_favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Shared read-only reference data: everyone signed in can read, nobody can
-- write from the client (the seeder runs with the service role).
alter table public.basalt_exercises enable row level security;
create policy basalt_exercises_read on public.basalt_exercises
  for select to authenticated using (true);

alter table public.basalt_workout_sessions enable row level security;
create policy basalt_workout_sessions_own on public.basalt_workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_session_exercises enable row level security;
create policy basalt_session_exercises_own on public.basalt_session_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_set_entries enable row level security;
create policy basalt_set_entries_own on public.basalt_set_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_walks enable row level security;
create policy basalt_walks_own on public.basalt_walks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_step_logs enable row level security;
create policy basalt_step_logs_own on public.basalt_step_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_weight_entries enable row level security;
create policy basalt_weight_entries_own on public.basalt_weight_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_sleep_sessions enable row level security;
create policy basalt_sleep_sessions_own on public.basalt_sleep_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_sleep_stages enable row level security;
create policy basalt_sleep_stages_own on public.basalt_sleep_stages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_hydration_logs enable row level security;
create policy basalt_hydration_logs_own on public.basalt_hydration_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_mindfulness_sessions enable row level security;
create policy basalt_mindfulness_sessions_own on public.basalt_mindfulness_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Full-cascade wipe of the caller's Basalt data ───────────────────────────
-- Deletes every Basalt row belonging to auth.uid(). The auth user record
-- itself is handled by the delete-account Edge Function (service role),
-- which calls this first and removes the auth user only when the account
-- has no Arise-app rows (shared project caveat, documented in CLAUDE.md).

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
  -- Children cascade from their parents; explicit deletes keep it obvious
  -- and complete even if a table ever loses its FK.
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
  delete from public.basalt_targets where user_id = uid;
  delete from public.basalt_profiles where id = uid;
end;
$$;

revoke all on function public.basalt_delete_my_data() from public;
grant execute on function public.basalt_delete_my_data() to authenticated;
