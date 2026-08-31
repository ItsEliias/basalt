-- 1-v-1 co-op (V3 Phase 4C item 17). Two people, one pair, and the ONLY
-- thing that crosses between them is a boolean per day: "showed up".
-- Each member computes their own dots client-side from their own ledger
-- and publishes just the booleans — no entries, no numbers, no scores
-- ever leave either account. No feed, no leaderboard, no points; the
-- forbidden list is re-checked in the engine's pinned copy tests.

create table if not exists public.basalt_pairs (
  id uuid primary key default gen_random_uuid(),
  a_id uuid not null references auth.users(id) on delete cascade,
  b_id uuid references auth.users(id) on delete cascade,
  invite_code text not null default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  expires_at timestamptz not null default now() + interval '48 hours',
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint basalt_pairs_no_self check (b_id is null or b_id <> a_id)
);

create unique index if not exists basalt_pairs_code_idx on public.basalt_pairs (invite_code);
create index if not exists basalt_pairs_a_idx on public.basalt_pairs (a_id) where ended_at is null;
create index if not exists basalt_pairs_b_idx on public.basalt_pairs (b_id) where ended_at is null;

alter table public.basalt_pairs enable row level security;

create policy "basalt_pairs_select_member" on public.basalt_pairs
  for select using ((select auth.uid()) = a_id or (select auth.uid()) = b_id);
create policy "basalt_pairs_insert_own" on public.basalt_pairs
  for insert with check ((select auth.uid()) = a_id and b_id is null);
create policy "basalt_pairs_update_member" on public.basalt_pairs
  for update using ((select auth.uid()) = a_id or (select auth.uid()) = b_id);

create or replace function public.basalt_join_pair(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare p uuid;
begin
  update basalt_pairs
     set b_id = auth.uid()
   where invite_code = upper(trim(p_code))
     and b_id is null
     and ended_at is null
     and expires_at > now()
     and a_id <> auth.uid()
  returning id into p;
  if p is null then
    raise exception 'Code invalid, expired, or already used.';
  end if;
  return p;
end $$;

revoke execute on function public.basalt_join_pair(text) from anon, public;
grant execute on function public.basalt_join_pair(text) to authenticated;

-- The published dots — booleans only, by design of the schema itself.
create table if not exists public.basalt_pair_days (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.basalt_pairs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  active boolean not null,
  unique (pair_id, user_id, date)
);

create index if not exists basalt_pair_days_pair_idx on public.basalt_pair_days (pair_id, date desc);

alter table public.basalt_pair_days enable row level security;

-- Both members of a live pair read the pair's dots; each writes only their own.
create policy "basalt_pair_days_select_member" on public.basalt_pair_days
  for select using (exists (select 1 from public.basalt_pairs p
    where p.id = pair_id and p.ended_at is null
      and ((select auth.uid()) = p.a_id or (select auth.uid()) = p.b_id)));
create policy "basalt_pair_days_insert_own" on public.basalt_pair_days
  for insert with check ((select auth.uid()) = user_id
    and exists (select 1 from public.basalt_pairs p
      where p.id = pair_id and p.ended_at is null
        and ((select auth.uid()) = p.a_id or (select auth.uid()) = p.b_id)));
create policy "basalt_pair_days_update_own" on public.basalt_pair_days
  for update using ((select auth.uid()) = user_id);
create policy "basalt_pair_days_delete_own" on public.basalt_pair_days
  for delete using ((select auth.uid()) = user_id);
