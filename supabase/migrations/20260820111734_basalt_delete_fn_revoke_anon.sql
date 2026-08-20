-- basalt_delete_my_data is for signed-in users only (it raises on null
-- auth.uid() anyway, but anon should not even be able to invoke it).
revoke execute on function public.basalt_delete_my_data() from anon;
