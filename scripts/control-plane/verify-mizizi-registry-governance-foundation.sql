\set ON_ERROR_STOP on

-- Read-only post-apply verifier for the Slice 2 Registry governance foundation.
-- It proves structure and inertness; it does not create grants or operations.

do $verify$
declare
  v_missing text[] := array[]::text[];
  v_mizizi_binding_count integer;
begin
  if to_regclass('platform_private.system_actor_capability_grants') is null then
    v_missing := array_append(v_missing, 'system_actor_capability_grants');
  end if;
  if to_regclass('platform_private.registry_operation_types') is null then
    v_missing := array_append(v_missing, 'registry_operation_types');
  end if;
  if to_regclass('platform_private.registry_execution_grants') is null then
    v_missing := array_append(v_missing, 'registry_execution_grants');
  end if;
  if to_regclass('platform_private.registry_execution_grant_targets') is null then
    v_missing := array_append(v_missing, 'registry_execution_grant_targets');
  end if;
  if to_regclass('platform_private.registry_mutation_operations') is null then
    v_missing := array_append(v_missing, 'registry_mutation_operations');
  end if;
  if to_regclass('platform_private.registry_operation_write_events') is null then
    v_missing := array_append(v_missing, 'registry_operation_write_events');
  end if;

  if cardinality(v_missing) > 0 then
    raise exception
      'MIZIZI governance foundation missing: %',
      array_to_string(v_missing, ', ');
  end if;

  if to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('platform_private.registry_subject_exists(text,uuid)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
  then
    raise exception
      'MIZIZI governance foundation functions are incomplete';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
  ) then
    raise exception
      'Foundation acceptance requires zero System Actor capability grants';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
  ) then
    raise exception
      'Foundation acceptance requires zero enabled/declared Registry operation types';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
  )
     or exists (
       select 1
       from platform_private.registry_mutation_operations
     )
     or exists (
       select 1
       from platform_private.registry_operation_write_events
     )
  then
    raise exception
      'Foundation acceptance requires zero grants, operations, and operation write links';
  end if;

  select count(*)::integer
  into v_mizizi_binding_count
  from platform_private.system_actor_executor_bindings binding
  where binding.actor_key = 'mizizi'
    and binding.executor_kind = 'database_role'
    and binding.executor_key = 'postgres'
    and binding.status = 'active';

  if v_mizizi_binding_count <> 1 then
    raise exception
      'Existing MIZIZI postgres binding changed unexpectedly';
  end if;

  if has_table_privilege(
       'anon',
       'platform_private.registry_execution_grants',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.registry_execution_grants',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'service_role',
       'platform_private.registry_execution_grants',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'anon',
       'platform_private.registry_mutation_operations',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.registry_mutation_operations',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'service_role',
       'platform_private.registry_mutation_operations',
       'SELECT,INSERT,UPDATE,DELETE'
     )
  then
    raise exception
      'Foundation private tables expose direct browser/service-role privileges';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.begin_registry_mutation_operation(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.begin_registry_mutation_operation(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.begin_registry_mutation_operation(text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Foundation begin-operation function leaked execution authority';
  end if;
end
$verify$;

select
  'MIZIZI_REGISTRY_GOVERNANCE_FOUNDATION_PASS' as verdict,
  (select count(*) from platform_private.system_actor_capability_grants) as capability_grants,
  (select count(*) from platform_private.registry_operation_types) as operation_types,
  (select count(*) from platform_private.registry_execution_grants) as execution_grants,
  (select count(*) from platform_private.registry_mutation_operations) as mutation_operations;
