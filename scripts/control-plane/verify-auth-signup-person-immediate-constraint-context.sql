-- Permanent verification for the Auth signup Person immediate-constraint
-- context repair.
--
-- This verifier proves:
-- 1. provisioning security posture remains unchanged;
-- 2. the exact pre-provision DEFERRED guard exists;
-- 3. the real deferred trigger path survives a caller that starts with
--    SET CONSTRAINTS ALL IMMEDIATE;
-- 4. the verification fixture rolls back completely.

begin;

do $auth_signup_person_context_static_verification$
declare
  v_definition text;
  v_owner text;
  v_security_definer boolean;
  v_config text[];
  v_guard text :=
    E'  set constraints\n'
    || E'    editorial.resources_resource_version_pointer_integrity,\n'
    || E'    editorial.resources_binding_integrity,\n'
    || E'    editorial.people_binding_integrity,\n'
    || E'    editorial.people_identity_integrity,\n'
    || E'    editorial.people_merge_cycle_integrity,\n'
    || E'    editorial.person_identity_links_preferred_integrity\n'
    || E'  deferred;\n\n'
    || E'  perform editorial.ensure_person_for_user(';
begin
  select
    pg_catalog.pg_get_functiondef(p.oid),
    pg_catalog.pg_get_userbyid(p.proowner),
    p.prosecdef,
    p.proconfig
  into
    v_definition,
    v_owner,
    v_security_definer,
    v_config
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'editorial'
    and p.proname = 'provision_person_for_user_profile_insert'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = '';

  if v_definition is null then
    raise exception
      'STOP: Auth signup Person provisioning function is missing';
  end if;

  if position(v_guard in v_definition) = 0 then
    raise exception
      'STOP: pre-provision Person constraint deferral guard is missing';
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
      'STOP: Auth signup Person provisioning grants are invalid';
  end if;
end;
$auth_signup_person_context_static_verification$;

set constraints all immediate;

do $auth_signup_person_context_runtime_verification$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text :=
    'auth-signup-context-verifier-'
    || replace(v_user_id::text, '-', '')
    || '@example.invalid';
  v_person_count bigint;
  v_link_count bigint;
begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  )
  values (
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    jsonb_build_object(
      'provider',
      'email',
      'providers',
      jsonb_build_array('email')
    ),
    jsonb_build_object(
      'name',
      'Auth signup context verifier',
      'fixture',
      'rollback-only'
    ),
    now(),
    now(),
    false,
    false
  );

  select count(*)
  into v_link_count
  from editorial.person_identity_links link
  where link.user_id = v_user_id
    and link.link_state = 'active';

  select count(*)
  into v_person_count
  from editorial.people person
  join editorial.person_identity_links link
    on link.person_resource_id = person.resource_id
  where link.user_id = v_user_id
    and link.link_state = 'active';

  if v_link_count <> 1
     or v_person_count <> 1
  then
    raise exception
      'STOP: immediate-context Auth signup Person provisioning failed: links=%, people=%',
      v_link_count,
      v_person_count;
  end if;
end;
$auth_signup_person_context_runtime_verification$;

select jsonb_build_object(
  'verification',
  'PASS',
  'repair',
  'auth_signup_person_immediate_constraint_context',
  'fixture_persistence',
  'rollback-only'
) as auth_signup_person_context_verification;

rollback;
