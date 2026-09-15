do $verify_account_retirement_data_api_boundary$
declare
  v_public_oid oid;
  v_orchestrator_oid oid;
  v_core_oid oid;
  v_orchestrator_definition text;
  v_core_definition text;
  v_function_count bigint;
begin
  v_public_oid := to_regprocedure(
    'public.retire_account_identity(uuid,uuid,bigint,uuid,text,text,uuid)'
  );
  v_orchestrator_oid := to_regprocedure(
    'account_identity_private.retire_account_identity(uuid,uuid,bigint,uuid,text,text,uuid)'
  );
  v_core_oid := to_regprocedure(
    'account_identity_private.retire_account_identity_core(uuid,uuid,bigint,uuid,text,text,uuid)'
  );

  if v_public_oid is null
     or v_orchestrator_oid is null
     or v_core_oid is null
  then
    raise exception
      'STOP: retirement facade/orchestrator/core is incomplete';
  end if;

  if exists (
       select 1
       from pg_proc
       where oid = v_public_oid
         and prosecdef
     )
     or (
       select count(*)
       from pg_proc
       where oid in (v_orchestrator_oid, v_core_oid)
         and prosecdef
         and pg_get_userbyid(proowner) = 'postgres'
     ) <> 2
  then
    raise exception
      'STOP: retirement security modes are invalid';
  end if;

  if not has_schema_privilege(
       'authenticated',
       'account_identity_private',
       'USAGE'
     )
     or has_schema_privilege(
       'anon',
       'account_identity_private',
       'USAGE'
     )
     or not has_function_privilege(
       'authenticated',
       v_orchestrator_oid,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       v_core_oid,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: private retirement ACL is invalid';
  end if;

  if has_table_privilege(
       'authenticated',
       'editorial.people',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'auth.users',
       'SELECT'
     )
  then
    raise exception
      'STOP: authenticated gained forbidden direct retirement-table access';
  end if;

  if exists (
       select 1
       from pg_proc
       where oid =
         'editorial.assert_person_identity_integrity()'::regprocedure
         and prosecdef
     )
     or exists (
       select 1
       from pg_proc
       where oid =
         'editorial.assert_person_merge_cycle_integrity()'::regprocedure
         and prosecdef
     )
  then
    raise exception
      'STOP: Person integrity trigger functions were globally privilege-escalated';
  end if;

  if not exists (
       select 1
       from pg_trigger
       where tgname = 'people_identity_integrity'
         and tgrelid = 'editorial.people'::regclass
         and tgdeferrable
         and tginitdeferred
     )
     or not exists (
       select 1
       from pg_trigger
       where tgname = 'people_merge_cycle_integrity'
         and tgrelid = 'editorial.people'::regclass
         and tgdeferrable
         and tginitdeferred
     )
     or not exists (
       select 1
       from pg_trigger
       where tgname = 'person_identity_links_preferred_integrity'
         and tgrelid =
             'editorial.person_identity_links'::regclass
         and tgdeferrable
         and tginitdeferred
     )
  then
    raise exception
      'STOP: deferred Person identity constraints moved';
  end if;

  select pg_get_functiondef(v_orchestrator_oid)
  into v_orchestrator_definition;

  if position(
       'editorial.resources_resource_version_pointer_integrity'
       in lower(v_orchestrator_definition)
     ) = 0
     or position(
       'editorial.resources_binding_integrity'
       in lower(v_orchestrator_definition)
     ) = 0
     or position(
       'editorial.people_binding_integrity'
       in lower(v_orchestrator_definition)
     ) = 0
     or position(
       'editorial.people_identity_integrity'
       in lower(v_orchestrator_definition)
     ) = 0
     or position(
       'editorial.people_merge_cycle_integrity'
       in lower(v_orchestrator_definition)
     ) = 0
     or position(
       'editorial.person_identity_links_preferred_integrity'
       in lower(v_orchestrator_definition)
     ) = 0
     or position('immediate' in lower(v_orchestrator_definition)) = 0
     or position('deferred' in lower(v_orchestrator_definition)) = 0
     or position(
       'retire_account_identity_core'
       in lower(v_orchestrator_definition)
     ) = 0
  then
    raise exception
      'STOP: privileged deferred-integrity flush contract moved';
  end if;

  select pg_get_functiondef(v_core_oid)
  into v_core_definition;

  if position(
       'public.unlink_person_identity('
       in lower(v_core_definition)
     ) = 0
     or position(
       'delete from auth.users'
       in lower(v_core_definition)
     ) = 0
     or position(
       'editorial.retired_account_identities'
       in lower(v_core_definition)
     ) = 0
  then
    raise exception
      'STOP: original retirement core authority moved';
  end if;

  select count(*)
  into v_function_count
  from pg_proc function_row
  join pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'account_identity_private';

  if v_function_count <> 2 then
    raise exception
      'STOP: private retirement schema must contain exactly two functions, found %',
      v_function_count;
  end if;
end;
$verify_account_retirement_data_api_boundary$;

select
  'ACCOUNT_RETIREMENT_DATA_API_BOUNDARY_PASS'
    as verification_result;
