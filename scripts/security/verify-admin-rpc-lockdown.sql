-- Verify that SECURITY DEFINER admin RPCs are unavailable to anon while
-- remaining callable by authenticated admin clients and service_role.

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and p.proname like 'admin\_%' escape '\'
order by p.proname, identity_args;

-- Expected for every row:
-- anon_can_execute = false
-- authenticated_can_execute = true
-- service_role_can_execute = true

select count(*) as invalid_admin_rpc_grants
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and p.proname like 'admin\_%' escape '\'
  and (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    or not has_function_privilege('authenticated', p.oid, 'EXECUTE')
    or not has_function_privilege('service_role', p.oid, 'EXECUTE')
  );
