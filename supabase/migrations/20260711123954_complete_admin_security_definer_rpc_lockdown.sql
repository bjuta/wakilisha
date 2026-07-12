do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname like 'admin\_%' escape '\'
  loop
    execute format('revoke execute on function %s from public, anon', f.fn);
    execute format('grant execute on function %s to authenticated, service_role', f.fn);
  end loop;
end
$$;;
