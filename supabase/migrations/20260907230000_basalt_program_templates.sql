-- Programmes Extra (V4 Phase 6b) — additive columns on basalt_programs so
-- a programme can carry its template, length and nutrition stance.
-- Existing rows (user-declared training days) are untouched; RLS already
-- self-scoped on this table.

alter table public.basalt_programs
  add column if not exists template_id text,
  add column if not exists weeks smallint,
  add column if not exists rate_pct numeric;
