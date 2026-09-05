-- Repair Auth signup Person provisioning after shared Resource Version convergence.
--
-- 20260815084011 correctly forced Person-path deferred integrity checks inside
-- the postgres-owned provisioning function, but it named the then-current
-- Article-only Resource pointer constraint.
--
-- 20260826161426 later retired that constraint and replaced it with the shared
-- resources_resource_version_pointer_integrity constraint without updating this
-- provisioning function. Auth signup therefore aborts when the deferred Person
-- provisioning trigger executes.
--
-- This forward repair transforms PostgreSQL's own current function definition
-- by replacing exactly the two stale constraint-name references. No other
-- function byte, grant, owner, search path, or table authority is changed.

begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'repair-auth-signup-resource-version-integrity-context',
    0
  )
);

create temporary table auth_signup_resource_integrity_baseline
on commit drop
as
select
  pg_catalog.pg_get_functiondef(p.oid) as definition,
  p.proowner,
  p.prosecdef,
  p.proconfig,
  p.proacl
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'editorial'
  and p.proname = 'provision_person_for_user_profile_insert'
  and pg_catalog.pg_get_function_identity_arguments(p.oid) = '';

do $auth_signup_resource_integrity_preflight$
declare
  v_definition text;
  v_owner text;
  v_security_definer boolean;
  v_config text[];
  v_trigger record;
begin
  if (
    select count(*)
    from auth_signup_resource_integrity_baseline
  ) <> 1 then
    raise exception
      'STOP: Auth signup Person provisioning function baseline is not singular';
  end if;

  select
    baseline.definition,
    pg_catalog.pg_get_userbyid(baseline.proowner),
    baseline.prosecdef,
    baseline.proconfig
  into
    v_definition,
    v_owner,
    v_security_definer,
    v_config
  from auth_signup_resource_integrity_baseline baseline;

  if md5(v_definition) <>
     '744e12363c2fc436d54faa5a2cd2a909' then
    raise exception
      'STOP: Auth signup Person provisioning function drifted before repair';
  end if;

  if (
       length(v_definition)
       - length(
           replace(
             v_definition,
             'resources_article_version_pointer_integrity',
             ''
           )
         )
     ) / length('resources_article_version_pointer_integrity') <> 2
     or position(
          'resources_resource_version_pointer_integrity'
          in v_definition
        ) <> 0
  then
    raise exception
      'STOP: stale Auth signup Resource pointer context is not the expected two-reference shape';
  end if;

  if v_owner <> 'postgres'
     or not v_security_definer
     or v_config is distinct from
        array[
          'search_path=pg_catalog, public, editorial'
        ]::text[]
  then
    raise exception
      'STOP: Auth signup Person provisioning security posture drifted';
  end if;

  if not pg_catalog.has_function_privilege(
       'supabase_auth_admin',
       'editorial.provision_person_for_user_profile_insert()',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'editorial.provision_person_for_user_profile_insert()',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'editorial.provision_person_for_user_profile_insert()',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Auth signup Person provisioning grants drifted';
  end if;

  if pg_catalog.has_table_privilege(
       'supabase_auth_admin',
       'editorial.resources',
       'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'supabase_auth_admin',
       'editorial.people',
       'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'supabase_auth_admin',
       'editorial.person_identity_links',
       'SELECT'
     )
  then
    raise exception
      'STOP: Auth service unexpectedly has direct Person editorial table access';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgrelid = 'editorial.resources'::regclass
      and t.tgname =
          'resources_article_version_pointer_integrity'
      and not t.tgisinternal
  ) then
    raise exception
      'STOP: retired Article-only Resource pointer constraint still exists';
  end if;

  for v_trigger in
    select *
    from (
      values
        (
          'editorial.resources'::regclass,
          'resources_resource_version_pointer_integrity'
        ),
        (
          'editorial.resources'::regclass,
          'resources_binding_integrity'
        ),
        (
          'editorial.people'::regclass,
          'people_binding_integrity'
        ),
        (
          'editorial.people'::regclass,
          'people_identity_integrity'
        ),
        (
          'editorial.people'::regclass,
          'people_merge_cycle_integrity'
        ),
        (
          'editorial.person_identity_links'::regclass,
          'person_identity_links_preferred_integrity'
        )
    ) expected(relid, trigger_name)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_trigger t
      where t.tgrelid = v_trigger.relid
        and t.tgname = v_trigger.trigger_name
        and t.tgdeferrable
        and t.tginitdeferred
        and not t.tgisinternal
    ) then
      raise exception
        'STOP: expected deferred integrity constraint % is missing or drifted',
        v_trigger.trigger_name;
    end if;
  end loop;
end;
$auth_signup_resource_integrity_preflight$;

do $auth_signup_resource_integrity_repair$
declare
  v_definition text;
  v_repaired_definition text;
begin
  select baseline.definition
  into v_definition
  from auth_signup_resource_integrity_baseline baseline;

  v_repaired_definition :=
    replace(
      v_definition,
      'resources_article_version_pointer_integrity',
      'resources_resource_version_pointer_integrity'
    );

  if v_repaired_definition = v_definition
     or (
       length(v_repaired_definition)
       - length(
           replace(
             v_repaired_definition,
             'resources_resource_version_pointer_integrity',
             ''
           )
         )
       ) / length('resources_resource_version_pointer_integrity') <> 2
  then
    raise exception
      'STOP: Auth signup Resource pointer transformation is not exact';
  end if;

  execute v_repaired_definition;
end;
$auth_signup_resource_integrity_repair$;

do $auth_signup_resource_integrity_postcheck$
declare
  v_expected_definition text;
  v_actual_definition text;
  v_owner oid;
  v_security_definer boolean;
  v_config text[];
  v_acl aclitem[];
begin
  select
    replace(
      baseline.definition,
      'resources_article_version_pointer_integrity',
      'resources_resource_version_pointer_integrity'
    )
  into v_expected_definition
  from auth_signup_resource_integrity_baseline baseline;

  select
    pg_catalog.pg_get_functiondef(p.oid),
    p.proowner,
    p.prosecdef,
    p.proconfig,
    p.proacl
  into
    v_actual_definition,
    v_owner,
    v_security_definer,
    v_config,
    v_acl
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'editorial'
    and p.proname = 'provision_person_for_user_profile_insert'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = '';

  if v_actual_definition is distinct from v_expected_definition then
    raise exception
      'STOP: Auth signup Person provisioning changed beyond the stale constraint identifier';
  end if;

  if position(
       'resources_article_version_pointer_integrity'
       in v_actual_definition
     ) <> 0
     or (
       length(v_actual_definition)
       - length(
           replace(
             v_actual_definition,
             'resources_resource_version_pointer_integrity',
             ''
           )
         )
       ) / length('resources_resource_version_pointer_integrity') <> 2
  then
    raise exception
      'STOP: Auth signup Resource pointer repair did not converge exactly';
  end if;

  if exists (
    select 1
    from auth_signup_resource_integrity_baseline baseline
    where baseline.proowner is distinct from v_owner
       or baseline.prosecdef is distinct from v_security_definer
       or baseline.proconfig is distinct from v_config
       or baseline.proacl is distinct from v_acl
  ) then
    raise exception
      'STOP: Auth signup Person provisioning owner, config, or grants changed';
  end if;

  if not pg_catalog.has_function_privilege(
       'supabase_auth_admin',
       'editorial.provision_person_for_user_profile_insert()',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'editorial.provision_person_for_user_profile_insert()',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'editorial.provision_person_for_user_profile_insert()',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: repaired Auth signup Person provisioning grants are invalid';
  end if;
end;
$auth_signup_resource_integrity_postcheck$;

commit;

