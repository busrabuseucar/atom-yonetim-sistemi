-- Keep automatic RLS enabled; prevent API users calling its privileged event helper.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
