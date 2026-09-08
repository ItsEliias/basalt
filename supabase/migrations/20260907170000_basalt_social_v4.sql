-- V4 social Extra (STOP POINT B design, approved): friends by invite code,
-- weekly challenges, friends-only aggregates. The law: cross-account data
-- is ONLY aggregates published by the owner's own device — no policy
-- grants any read into another user's raw tables. Everything here is
-- basalt_-prefixed; every table cascades from auth.users so unconditional
-- account deletion can never be blocked.

-- 1 · Invites — private to their owner; redemption only via definer RPC.
create table if not exists public.basalt_friend_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz
);
alter table public.basalt_friend_invites enable row level security;
create policy "invites own select" on public.basalt_friend_invites
  for select using (owner_id = auth.uid());
create policy "invites own insert" on public.basalt_friend_invites
  for insert with check (owner_id = auth.uid());
create policy "invites own delete" on public.basalt_friend_invites
  for delete using (owner_id = auth.uid());
-- no update policy: only the RPC below marks redemption.

-- 2 · Friendships — ordered pair, written only by the RPC.
create table if not exists public.basalt_friends (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.basalt_friends enable row level security;
create policy "friends member select" on public.basalt_friends
  for select using (auth.uid() in (user_a, user_b));
create policy "friends member delete" on public.basalt_friends
  for delete using (auth.uid() in (user_a, user_b));
-- no insert policy: basalt_redeem_friend_invite is the only writer.

create or replace function public.basalt_redeem_friend_invite(invite_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv record;
  lo uuid;
  hi uuid;
begin
  if uid is null then
    raise exception 'Not signed in.';
  end if;
  select * into inv from public.basalt_friend_invites
    where code = invite_code and redeemed_at is null and expires_at > now()
    for update;
  if inv is null then
    raise exception 'Invalid or expired code.';
  end if;
  if inv.owner_id = uid then
    raise exception 'That is your own code.';
  end if;
  lo := least(inv.owner_id, uid);
  hi := greatest(inv.owner_id, uid);
  if exists (select 1 from public.basalt_friends where user_a = lo and user_b = hi) then
    raise exception 'Already friends.';
  end if;
  insert into public.basalt_friends (user_a, user_b) values (lo, hi);
  update public.basalt_friend_invites
    set redeemed_by = uid, redeemed_at = now() where id = inv.id;
end;
$$;
grant execute on function public.basalt_redeem_friend_invite(text) to authenticated;

-- 3 · Challenges.
create table if not exists public.basalt_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('steps','sessions','logged_days')),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on <= starts_on + 31)
);
create table if not exists public.basalt_challenge_members (
  challenge_id uuid not null references public.basalt_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create or replace function public.basalt_is_challenge_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.basalt_challenge_members
    where challenge_id = cid and user_id = auth.uid()
  );
$$;
grant execute on function public.basalt_is_challenge_member(uuid) to authenticated;

alter table public.basalt_challenges enable row level security;
create policy "challenges member select" on public.basalt_challenges
  for select using (public.basalt_is_challenge_member(id) or creator_id = auth.uid());
create policy "challenges creator insert" on public.basalt_challenges
  for insert with check (creator_id = auth.uid());
create policy "challenges creator delete" on public.basalt_challenges
  for delete using (creator_id = auth.uid());

alter table public.basalt_challenge_members enable row level security;
create policy "members member select" on public.basalt_challenge_members
  for select using (public.basalt_is_challenge_member(challenge_id));
create policy "members self insert" on public.basalt_challenge_members
  for insert with check (
    user_id = auth.uid()
    and (
      exists (select 1 from public.basalt_challenges c
              where c.id = challenge_id and c.creator_id = auth.uid())
      or exists (
        select 1 from public.basalt_challenges c
        join public.basalt_friends f
          on (f.user_a = least(c.creator_id, auth.uid())
          and f.user_b = greatest(c.creator_id, auth.uid()))
        where c.id = challenge_id
      )
    )
  );
create policy "members self delete" on public.basalt_challenge_members
  for delete using (user_id = auth.uid());

-- 4 · Progress — the owner's device upserts its own aggregate.
create table if not exists public.basalt_challenge_progress (
  challenge_id uuid not null references public.basalt_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  value numeric not null,
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id, day)
);
alter table public.basalt_challenge_progress enable row level security;
create policy "progress member select" on public.basalt_challenge_progress
  for select using (public.basalt_is_challenge_member(challenge_id));
create policy "progress self insert" on public.basalt_challenge_progress
  for insert with check (user_id = auth.uid());
create policy "progress self update" on public.basalt_challenge_progress
  for update using (user_id = auth.uid());
create policy "progress self delete" on public.basalt_challenge_progress
  for delete using (user_id = auth.uid());

-- 5 · "N friends logged today" — one self-published boolean per day.
create table if not exists public.basalt_friend_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  logged boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.basalt_friend_days enable row level security;
create policy "frienddays self write" on public.basalt_friend_days
  for insert with check (user_id = auth.uid());
create policy "frienddays self update" on public.basalt_friend_days
  for update using (user_id = auth.uid());
create policy "frienddays self delete" on public.basalt_friend_days
  for delete using (user_id = auth.uid());
create policy "frienddays friends select" on public.basalt_friend_days
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.basalt_friends f
      where f.user_a = least(user_id, auth.uid())
        and f.user_b = greatest(user_id, auth.uid())
    )
  );

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
