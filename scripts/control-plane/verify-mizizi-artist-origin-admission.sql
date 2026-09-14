-- Read-only verifier for MIZIZI Artist Origin Admission V1.
-- Safe for Preview and Production after the candidate migration exists.

do $verify$
declare
  v_operation platform_private.registry_operation_types%rowtype;
  v_capability_count integer;
  v_evidence_guard_count integer;
begin
  if to_regclass('platform_private.registry_evidence_assertions') is null then
    raise exception 'Registry evidence assertion authority is missing';
  end if;

  for v_capability_count in
    select count(*)::integer
    from public.capability_definitions
    where capability_key = 'admit_registry_artist_origin'
      and domain = 'registry'
  loop
    if v_capability_count <> 1 then
      raise exception 'Artist-origin capability definition drifted';
    end if;
  end loop;

  select operation_type.*
  into v_operation
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key = 'registry.artist_origin.admit'
    and operation_type.operation_version = 1;

  if not found
     or v_operation.capability_key <> 'admit_registry_artist_origin'
     or v_operation.risk_class <> 'low'
     or v_operation.allowed_subject_types <> array['artist']::text[]
     or not v_operation.requires_existing_target
     or v_operation.max_targets <> 1
     or v_operation.max_rows_ceiling <> 1
     or v_operation.max_grant_ttl_seconds <> 300
     or v_operation.requires_human_approval
     or not v_operation.requires_verifier
  then
    raise exception 'Artist-origin operation semantics drifted';
  end if;

  if to_regprocedure('platform_private.registry_is_valid_iso2(text)') is null
     or to_regprocedure(
       'platform_private.record_registry_artist_origin_evidence(text,uuid,text,numeric,text,text,text,timestamp with time zone)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_artist_origin_execution_grant(text,uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_artist_origin_admission(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_artist_origin_admission(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_issue_mizizi_artist_origin_capability_grant(timestamp with time zone,text)'
     ) is null
     or to_regprocedure(
       'public.admin_revoke_mizizi_artist_origin_capability_grant(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.admin_set_mizizi_artist_origin_operation_enabled(boolean,text)'
     ) is null
  then
    raise exception 'Artist Origin V1 function authority is incomplete';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'platform_private'
      and table_name = 'registry_execution_grants'
      and column_name = 'issued_by_principal_key'
      and is_nullable = 'NO'
  )
     or not exists (
       select 1
       from information_schema.columns
       where table_schema = 'platform_private'
         and table_name = 'registry_execution_grants'
         and column_name = 'policy_ruleset_version'
         and is_nullable = 'NO'
     )
     or not exists (
       select 1
       from information_schema.columns
       where table_schema = 'platform_private'
         and table_name = 'registry_execution_grants'
         and column_name = 'issued_by_user_id'
         and is_nullable = 'YES'
     )
  then
    raise exception 'Exact-grant policy issuer schema did not converge';
  end if;

  select count(*)::integer
  into v_evidence_guard_count
  from pg_trigger trigger_row
  join pg_class relation
    on relation.oid = trigger_row.tgrelid
  join pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'platform_private'
    and relation.relname = 'registry_evidence_assertions'
    and trigger_row.tgname =
      'registry_evidence_assertions_immutability_guard'
    and not trigger_row.tgisinternal;

  if v_evidence_guard_count <> 1 then
    raise exception 'Registry evidence immutability guard drifted';
  end if;

  if not platform_private.registry_is_valid_iso2('KE')
     or not platform_private.registry_is_valid_iso2('US')
     or platform_private.registry_is_valid_iso2('ke')
     or platform_private.registry_is_valid_iso2('ZZ')
     or platform_private.registry_is_valid_iso2('KEN')
  then
    raise exception 'Artist Origin V1 ISO2 policy is not strict';
  end if;

  if has_table_privilege(
       'anon',
       'platform_private.registry_evidence_assertions',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.registry_evidence_assertions',
       'SELECT'
     )
     or has_table_privilege(
       'service_role',
       'platform_private.registry_evidence_assertions',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'platform_private.registry_evidence_assertions',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.registry_evidence_assertions',
       'INSERT'
     )
     or has_table_privilege(
       'service_role',
       'platform_private.registry_evidence_assertions',
       'INSERT'
     )
  then
    raise exception 'Registry evidence assertion table leaked direct role authority';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.record_registry_artist_origin_evidence(text,uuid,text,numeric,text,text,text,timestamptz)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.record_registry_artist_origin_evidence(text,uuid,text,numeric,text,text,text,timestamptz)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.record_registry_artist_origin_evidence(text,uuid,text,numeric,text,text,text,timestamptz)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'platform_private.issue_registry_artist_origin_execution_grant(text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.issue_registry_artist_origin_execution_grant(text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.issue_registry_artist_origin_execution_grant(text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'platform_private.execute_registry_artist_origin_admission(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_artist_origin_admission(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_artist_origin_admission(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'platform_private.verify_registry_artist_origin_admission(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.verify_registry_artist_origin_admission(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.verify_registry_artist_origin_admission(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Artist Origin V1 private broker leaked direct role execution authority';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_issue_mizizi_artist_origin_capability_grant(timestamptz,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_issue_mizizi_artist_origin_capability_grant(timestamptz,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_issue_mizizi_artist_origin_capability_grant(timestamptz,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_set_mizizi_artist_origin_operation_enabled(boolean,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_set_mizizi_artist_origin_operation_enabled(boolean,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_set_mizizi_artist_origin_operation_enabled(boolean,text)',
       'EXECUTE'
     )
  then
    raise exception 'Artist Origin V1 human control RPC grants drifted';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants grant_row
    where grant_row.capability_key = 'admit_registry_artist_origin'
      and (
        grant_row.actor_key <> 'mizizi'
        or not (
          grant_row.scope @>
            jsonb_build_object(
              'operation_key', 'registry.artist_origin.admit',
              'operation_version', 1,
              'subject_type', 'artist',
              'max_rows', 1
            )
        )
      )
  ) then
    raise exception 'Artist-origin standing grant escaped its exact scope';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.operation_key = 'registry.artist_origin.admit'
      and (
        execution_grant.operation_version <> 1
        or execution_grant.capability_key <>
          'admit_registry_artist_origin'
        or execution_grant.max_rows <> 1
        or execution_grant.issued_by_principal_key <>
          'policy:registry-artist-origin-admission-v1'
        or execution_grant.policy_ruleset_version <>
          'registry-artist-origin-admission-v1'
      )
  ) then
    raise exception 'Artist-origin exact grant escaped V1 authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.operation_key = 'registry.artist_origin.admit'
      and (
        select count(*)
        from platform_private.registry_execution_grant_targets target
        where target.execution_grant_id = execution_grant.id
          and target.subject_type = 'artist'
          and target.expected_state_fingerprint is not null
      ) <> 1
  ) then
    raise exception 'Artist-origin exact grant target cardinality drifted';
  end if;

  if exists (
    select 1
    from platform_private.registry_mutation_operations operation
    where operation.operation_key = 'registry.artist_origin.admit'
      and (
        operation.operation_version <> 1
        or operation.capability_key <>
          'admit_registry_artist_origin'
        or operation.max_rows <> 1
        or operation.affected_rows > 1
      )
  ) then
    raise exception 'Artist-origin operation journal escaped one-row authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_write_events link
    join platform_private.registry_mutation_operations operation
      on operation.id = link.operation_id
    join public.registry_canonical_write_events event
      on event.id = link.canonical_write_event_id
    where operation.operation_key = 'registry.artist_origin.admit'
      and (
        event.registry_entity_type <> 'artist'
        or event.source_table <>
          'platform_private.registry_evidence_assertions'
        or event.action <> 'admit_origin'
        or event.field_name not in (
          'origin_iso2',
          'origin_confidence'
        )
        or event.target_path not in (
          'public.registry_artists.origin_iso2',
          'public.registry_artists.origin_confidence'
        )
      )
  ) then
    raise exception 'Artist-origin canonical write evidence escaped V1 fields';
  end if;
end
$verify$;

select
  'MIZIZI_ARTIST_ORIGIN_ADMISSION_V1_PASS' as result,
  (
    select enabled
    from platform_private.registry_operation_types
    where operation_key = 'registry.artist_origin.admit'
      and operation_version = 1
  ) as operation_enabled,
  (
    select count(*)
    from platform_private.system_actor_capability_grants
    where actor_key = 'mizizi'
      and capability_key = 'admit_registry_artist_origin'
      and status = 'active'
      and expires_at > now()
  ) as active_standing_grants,
  (
    select count(*)
    from platform_private.registry_execution_grants
    where operation_key = 'registry.artist_origin.admit'
  ) as exact_grants,
  (
    select count(*)
    from platform_private.registry_mutation_operations
    where operation_key = 'registry.artist_origin.admit'
  ) as operations,
  (
    select count(*)
    from platform_private.registry_mutation_operations
    where operation_key = 'registry.artist_origin.admit'
      and verifier_status = 'passed'
  ) as verified_operations;
