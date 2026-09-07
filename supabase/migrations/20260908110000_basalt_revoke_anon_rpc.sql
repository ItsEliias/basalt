-- Advisor pass (V4 pre-tester build): the two V4 social RPCs were
-- executable by `anon` (harmless — auth.uid() is null so both no-op or
-- raise — but there is no reason for them to be callable signed-out).
-- basalt_-scoped only; authenticated execution stays, it IS the design.

revoke execute on function public.basalt_is_challenge_member(uuid) from anon;
revoke execute on function public.basalt_redeem_friend_invite(text) from anon;
