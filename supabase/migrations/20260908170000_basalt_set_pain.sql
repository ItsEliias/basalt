-- Pain flags on sets (V4 Phase 8d). 0–3, optional, the user's own word
-- for how a movement felt — never diagnosed, only respected: a flagged
-- exercise is proposed a substitution next session, and three flags in a
-- fortnight prompt "worth getting that looked at". Additive; RLS and
-- both wipe paths unchanged (set_entries already covered).

alter table public.basalt_set_entries
  add column if not exists pain smallint
  check (pain is null or (pain between 0 and 3));
