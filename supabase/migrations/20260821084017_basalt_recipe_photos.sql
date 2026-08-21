-- Recipe cover photos — downloaded into a private bucket at import time
-- (never hotlinked; source thumbnails rot or get taken down). cover_url was
-- added in the original V1 recipes migration but never wired to any app
-- code; renaming to cover_path makes the column honest about what it now
-- holds — a private storage path, not a public URL.
alter table public.basalt_recipes rename column cover_url to cover_path;

insert into storage.buckets (id, name, public)
values ('basalt-recipe-photos', 'basalt-recipe-photos', false)
on conflict (id) do nothing;

create policy basalt_recipe_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'basalt-recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy basalt_recipe_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'basalt-recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy basalt_recipe_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'basalt-recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
