-- Progress photo vault: private bucket + metadata rows. Excluded from
-- exports by default (app-side toggle); wiped by delete-account.
insert into storage.buckets (id, name, public)
values ('basalt-progress-photos', 'basalt-progress-photos', false)
on conflict (id) do nothing;

create policy basalt_progress_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'basalt-progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy basalt_progress_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'basalt-progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy basalt_progress_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'basalt-progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create table public.basalt_progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pose text not null check (pose in ('front', 'side', 'back')),
  taken_at timestamptz not null default now(),
  storage_path text not null,
  created_at timestamptz not null default now()
);
alter table public.basalt_progress_photos enable row level security;
create policy basalt_progress_photos_rows_own on public.basalt_progress_photos
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
