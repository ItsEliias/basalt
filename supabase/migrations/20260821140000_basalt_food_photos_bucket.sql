-- Private storage bucket for food-entry photos. Additive; every policy is
-- basalt_-named and scoped to this bucket + the caller's own folder.
insert into storage.buckets (id, name, public)
values ('basalt-food-photos', 'basalt-food-photos', false)
on conflict (id) do nothing;

create policy basalt_food_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'basalt-food-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy basalt_food_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'basalt-food-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy basalt_food_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'basalt-food-photos' and (storage.foldername(name))[1] = auth.uid()::text);
