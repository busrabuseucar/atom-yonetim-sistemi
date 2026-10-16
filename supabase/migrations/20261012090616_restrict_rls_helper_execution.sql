-- Some Supabase projects install this optional event helper; clean databases do not.
-- The initial migration enables RLS explicitly on all application tables.
do $$
begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
 end if;
end;
$$;
