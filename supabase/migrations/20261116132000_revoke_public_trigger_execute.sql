-- INKR V5 security hardening: trigger functions are not RPC endpoints.
-- Legacy migrations left EXECUTE to PUBLIC on SECURITY DEFINER trigger functions.
-- Revoke those unnecessary permissions without changing existing trigger bindings.
-- No table, policy, user data or client-facing RPC permissions are modified.
do $$
declare
  fn record;
begin
  for fn in
    select p.proname
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype
  loop
    execute format(
      'revoke execute on function public.%I() from public, anon, authenticated',
      fn.proname
    );
  end loop;
end;
$$;
