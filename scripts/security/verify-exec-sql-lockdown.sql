-- Read-only verification for the exec_sql lockdown.

select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'exec_sql'
  and pg_get_function_identity_arguments(p.oid) = 'query text';

-- Expected:
-- anon_can_execute = false
-- authenticated_can_execute = false
-- service_role_can_execute = true
