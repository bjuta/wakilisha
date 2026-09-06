-- Repair Auth signup Person provisioning when the surrounding transaction
-- has already forced deferred integrity constraints to IMMEDIATE.
--
-- Existing authority:
-- - user_profiles_person_provisioning is DEFERRABLE INITIALLY DEFERRED;
-- - provisioning is postgres-owned SECURITY DEFINER;
-- - the function already flushes Person integrity constraints before return.
--
-- Defect:
-- If the caller enters provisioning with those constraints already IMMEDIATE,
-- create_person_for_identity() inserts editorial.resources before
-- editorial.people, so resources_binding_integrity fires too early and rejects
-- the temporary half-built Person Resource.
--
-- Repair:
-- Defer only the existing Person-path integrity constraints immediately before
-- ensure_person_for_user(), then keep the existing explicit IMMEDIATE flush and
-- final DEFERRED restoration unchanged.
--
-- No table authority, owner, grants, search path, Resource model, or Person
-- identity semantics are widened.

begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'repair-auth-signup-person-immediate-constraint-context',
    0
  )
);

create temporary table auth_signup_person_context_baseline
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

do $auth_signup_person_context_preflight$
declare
  v_definition text;
  v_owner text;
  v_security_definer boolean;
  v_config text[];
  v_anchor text :=
    E'  perform editorial.ensure_person_for_user(\n'
    || E'    new.user_id\n'
    || E'  );';
begin
  if (
    select count(*)
    from auth_signup_person_context_baseline
  ) <> 1 then
    raise exception
      'STOP: Auth signup Person provisioning baseline is not singular';
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
  from auth_signup_person_context_baseline baseline;

  if position(v_anchor in v_definition) = 0
     or (
       length(v_definition)
       - length(replace(v_definition, v_anchor, ''))
     ) / length(v_anchor) <> 1
  then
    raise exception
      'STOP: Auth signup Person provisioning anchor drifted';
  end if;

  if position(
       E'  set constraints\n'
       || E'    editorial.resources_resource_version_pointer_integrity,\n'
       || E'    editorial.resources_binding_integrity,\n'
       || E'    editorial.people_binding_integrity,\n'
       || E'    editorial.people_identity_integrity,\n'
       || E'    editorial.people_merge_cycle_integrity,\n'
       || E'    editorial.person_identity_links_preferred_integrity\n'
       || E'  deferred;\n\n'
       || E'  perform editorial.ensure_person_for_user('
       in v_definition
     ) <> 0
  then
    raise exception
      'STOP: Auth signup Person constraint-context repair already exists';
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
end;
$auth_signup_person_context_preflight$;

do $auth_signup_person_context_repair$
declare
  v_definition text;
  v_repaired_definition text;
  v_anchor text :=
    E'  perform editorial.ensure_person_for_user(\n'
    || E'    new.user_id\n'
    || E'  );';
  v_replacement text :=
    E'  set constraints\n'
    || E'    editorial.resources_resource_version_pointer_integrity,\n'
    || E'    editorial.resources_binding_integrity,\n'
    || E'    editorial.people_binding_integrity,\n'
    || E'    editorial.people_identity_integrity,\n'
    || E'    editorial.people_merge_cycle_integrity,\n'
    || E'    editorial.person_identity_links_preferred_integrity\n'
    || E'  deferred;\n\n'
    || E'  perform editorial.ensure_person_for_user(\n'
    || E'    new.user_id\n'
    || E'  );';
begin
  select baseline.definition
  into v_definition
  from auth_signup_person_context_baseline baseline;

  v_repaired_definition :=
    replace(
      v_definition,
      v_anchor,
      v_replacement
    );

  if v_repaired_definition = v_definition then
    raise exception
      'STOP: Auth signup Person context transformation was a no-op';
  end if;

  execute v_repaired_definition;
end;
$auth_signup_person_context_repair$;

do $auth_signup_person_context_postcheck$
declare
  v_baseline_definition text;
  v_actual_definition text;
  v_expected_definition text;
  v_owner oid;
  v_security_definer boolean;
  v_config text[];
  v_acl aclitem[];
  v_anchor text :=
    E'  perform editorial.ensure_person_for_user(\n'
    || E'    new.user_id\n'
    || E'  );';
  v_replacement text :=
    E'  set constraints\n'
    || E'    editorial.resources_resource_version_pointer_integrity,\n'
    || E'    editorial.resources_binding_integrity,\n'
    || E'    editorial.people_binding_integrity,\n'
    || E'    editorial.people_identity_integrity,\n'
    || E'    editorial.people_merge_cycle_integrity,\n'
    || E'    editorial.person_identity_links_preferred_integrity\n'
    || E'  deferred;\n\n'
    || E'  perform editorial.ensure_person_for_user(\n'
    || E'    new.user_id\n'
    || E'  );';
begin
  select baseline.definition
  into v_baseline_definition
  from auth_signup_person_context_baseline baseline;

  v_expected_definition :=
    replace(
      v_baseline_definition,
      v_anchor,
      v_replacement
    );

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
      'STOP: Auth signup Person provisioning changed beyond the exact context repair';
  end if;

  if exists (
    select 1
    from auth_signup_person_context_baseline baseline
    where baseline.proowner is distinct from v_owner
       or baseline.prosecdef is distinct from v_security_definer
       or baseline.proconfig is distinct from v_config
       or baseline.proacl is distinct from v_acl
  ) then
    raise exception
      'STOP: Auth signup Person provisioning owner, config, or grants changed';
  end if;
end;
$auth_signup_person_context_postcheck$;

commit;
