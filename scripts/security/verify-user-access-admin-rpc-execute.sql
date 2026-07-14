with targets(name) as (
  values
    ('assign_user_role_admin'),
    ('record_admin_audit'),
    ('record_password_reset_admin'),
    ('revoke_user_role_admin'),
    ('revoke_user_scope_admin'),
    ('suspend_user_access_admin'),
    ('upsert_user_scope_admin')
), audited as (
  select
    p.oid::regprocedure::text as function_signature,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join targets t on t.name = p.proname
  where n.nspname = 'public'
)
select *
from audited
where anon_execute
   or authenticated_execute
   or not service_role_execute;
