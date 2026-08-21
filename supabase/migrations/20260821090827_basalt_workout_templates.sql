-- Named, reusable workout templates — the gap between a one-off logged
-- session and a plan the user can start from again ("Pull — Week 1",
-- "Pull — Week 2"). Mirrors the workout_sessions/session_exercises shape:
-- one template row, many ordered exercise rows carrying target sets/reps/
-- weight. No set_entries analogue — targets are a plan, not logged data.
create table public.basalt_workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text not null default 'gym' check (location in ('gym', 'home')),
  notes text,
  created_at timestamptz not null default now()
);
create index basalt_workout_templates_user_idx on public.basalt_workout_templates (user_id, created_at desc);

create table public.basalt_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.basalt_workout_templates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid references public.basalt_exercises(id),
  exercise_name text not null,
  order_index int not null default 0,
  target_sets int not null default 3 check (target_sets > 0),
  target_reps int check (target_reps is null or target_reps >= 0),
  target_weight_kg numeric check (target_weight_kg is null or target_weight_kg >= 0),
  notes text
);
create index basalt_template_exercises_template_idx on public.basalt_template_exercises (template_id, order_index);

alter table public.basalt_workout_templates enable row level security;
create policy basalt_workout_templates_own on public.basalt_workout_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.basalt_template_exercises enable row level security;
create policy basalt_template_exercises_own on public.basalt_template_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
