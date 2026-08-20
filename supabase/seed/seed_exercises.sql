-- Seed basalt_exercises from free-exercise-db (public domain), idempotent on
-- (source, ext_id) — mirrors the quarry's seedExercises.ts mapping. Run as a
-- privileged role (RLS on basalt_exercises allows client reads only).
-- Applied 2026-08-20: 873 rows, 12 equipment kinds, 0 missing primary muscles.
with payload as (
  select content::jsonb as data
  from extensions.http_get('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json')
),
rows as (
  select jsonb_array_elements(data) as e from payload
)
insert into public.basalt_exercises
  (ext_id, source, name, category, primary_muscles, secondary_muscles, equipment, difficulty, instructions, image_urls, video_url)
select
  e->>'id',
  'free-exercise-db',
  e->>'name',
  e->>'category',
  coalesce(array(select jsonb_array_elements_text(e->'primaryMuscles')), '{}'),
  coalesce(array(select jsonb_array_elements_text(e->'secondaryMuscles')), '{}'),
  e->>'equipment',
  e->>'level',
  coalesce(array(select jsonb_array_elements_text(e->'instructions')), '{}'),
  coalesce(array(
    select 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/' || img
    from jsonb_array_elements_text(e->'images') img
  ), '{}'),
  null
from rows
on conflict (source, ext_id) do update set
  name = excluded.name,
  category = excluded.category,
  primary_muscles = excluded.primary_muscles,
  secondary_muscles = excluded.secondary_muscles,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  instructions = excluded.instructions,
  image_urls = excluded.image_urls;
