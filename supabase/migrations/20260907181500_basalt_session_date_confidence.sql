-- Historical imports carry week-precision dates. 'day' stays the default
-- for everything the app writes live; anything but 'day' is excluded from
-- PR detection and progression by the client-side eligibility rule.
alter table public.basalt_workout_sessions
  add column if not exists date_confidence text not null default 'day'
  check (date_confidence in ('day', 'week'));
