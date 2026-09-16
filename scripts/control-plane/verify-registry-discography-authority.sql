-- Read-only verifier for #945 Gate A Discography Exact-Set Authority V1.
-- Safe for clean Preview and Production after the candidate migration exists.

do $verify$
declare
  v_count integer;
  v_operation platform_private.registry_operation_types%rowtype;
  v_definition text;
begin
  if to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
  then
    raise exception 'Discography V1 governance substrate is missing';
  end if;

  select count(*)::integer
  into v_count
  from public.capability_definitions
  where capability_key in (
    'apply_registry_discography_plan',
    'admit_registry_release_provider_profile',
    'admit_registry_track_provider_profile',
    'admit_registry_artist_discography_summary',
    'replace_registry_release_artist_set',
    'replace_registry_release_track_set',
    'replace_registry_track_artist_credit_set'
  )
    and domain = 'registry';

  if v_count <> 7 then
    raise exception 'Discography V1 capability vocabulary is incomplete';
  end if;

  if exists (
    select 1
    from public.role_capabilities
    where capability_key in (
      'apply_registry_discography_plan',
      'admit_registry_release_provider_profile',
      'admit_registry_track_provider_profile',
      'admit_registry_artist_discography_summary',
      'replace_registry_release_artist_set',
      'replace_registry_release_track_set',
      'replace_registry_track_artist_credit_set'
    )
  ) then
    raise exception 'Discography V1 internal operation capability leaked into a standing product role';
  end if;

  select count(*)::integer
  into v_count
  from platform_private.registry_operation_types
  where operation_key in (
    'registry.discography.apply',
    'registry.release.provider_profile.admit',
    'registry.track.provider_profile.admit',
    'registry.artist.discography_summary.admit',
    'registry.release_artist_set.replace',
    'registry.release_track_set.replace',
    'registry.track_artist_credit_set.replace'
  );

  if v_count <> 7 then
    raise exception 'Discography V1 operation family is incomplete';
  end if;

  for v_operation in
    select *
    from platform_private.registry_operation_types
    where operation_key in (
      'registry.discography.apply',
      'registry.release.provider_profile.admit',
      'registry.track.provider_profile.admit',
      'registry.artist.discography_summary.admit',
      'registry.release_artist_set.replace',
      'registry.release_track_set.replace',
      'registry.track_artist_credit_set.replace'
    )
  loop
    if v_operation.operation_version <> 1
       or v_operation.max_targets <> 1
       or v_operation.max_grant_ttl_seconds <> 300
       or not v_operation.requires_existing_target
       or not v_operation.requires_human_approval
       or not v_operation.requires_verifier
       or not v_operation.enabled
    then
      raise exception 'Discography V1 operation semantics drifted: %', v_operation.operation_key;
    end if;
  end loop;

  if exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key in (
      'registry.discography.apply',
      'registry.release.provider_profile.admit',
      'registry.track.provider_profile.admit',
      'registry.artist.discography_summary.admit',
      'registry.release_artist_set.replace',
      'registry.release_track_set.replace',
      'registry.track_artist_credit_set.replace'
    )
      and (
        (operation_type.operation_key = 'registry.discography.apply'
          and (operation_type.capability_key <> 'apply_registry_discography_plan'
            or operation_type.risk_class <> 'high'
            or operation_type.allowed_subject_types <> array['artist']::text[]
            or operation_type.max_rows_ceiling <> 1000))
        or (operation_type.operation_key = 'registry.release.provider_profile.admit'
          and (operation_type.capability_key <> 'admit_registry_release_provider_profile'
            or operation_type.risk_class <> 'medium'
            or operation_type.allowed_subject_types <> array['release']::text[]
            or operation_type.max_rows_ceiling <> 1))
        or (operation_type.operation_key = 'registry.track.provider_profile.admit'
          and (operation_type.capability_key <> 'admit_registry_track_provider_profile'
            or operation_type.risk_class <> 'medium'
            or operation_type.allowed_subject_types <> array['track']::text[]
            or operation_type.max_rows_ceiling <> 1))
        or (operation_type.operation_key = 'registry.artist.discography_summary.admit'
          and (operation_type.capability_key <> 'admit_registry_artist_discography_summary'
            or operation_type.risk_class <> 'medium'
            or operation_type.allowed_subject_types <> array['artist']::text[]
            or operation_type.max_rows_ceiling <> 1))
        or (operation_type.operation_key = 'registry.release_artist_set.replace'
          and (operation_type.capability_key <> 'replace_registry_release_artist_set'
            or operation_type.risk_class <> 'high'
            or operation_type.allowed_subject_types <> array['release']::text[]
            or operation_type.max_rows_ceiling <> 64))
        or (operation_type.operation_key = 'registry.release_track_set.replace'
          and (operation_type.capability_key <> 'replace_registry_release_track_set'
            or operation_type.risk_class <> 'high'
            or operation_type.allowed_subject_types <> array['release']::text[]
            or operation_type.max_rows_ceiling <> 400))
        or (operation_type.operation_key = 'registry.track_artist_credit_set.replace'
          and (operation_type.capability_key <> 'replace_registry_track_artist_credit_set'
            or operation_type.risk_class <> 'high'
            or operation_type.allowed_subject_types <> array['track']::text[]
            or operation_type.max_rows_ceiling <> 64))
      )
  ) then
    raise exception 'Discography V1 operation capability/risk/ceiling mapping drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key = 'registry.release.create'
      and operation_type.operation_version = 1
      and operation_type.capability_key = 'create_registry_release'
      and operation_type.allowed_subject_types = array['release']::text[]
      and operation_type.max_targets = 1
      and operation_type.max_rows_ceiling = 1
      and operation_type.max_grant_ttl_seconds = 300
      and not operation_type.requires_existing_target
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Release Create V1 is not enabled with its accepted identity-only contract';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key = 'registry_discography_admin'
      and actor.actor_kind = 'automation'
      and actor.status = 'active'
      and actor.capability_profile ->> 'authority_mode' = 'human_exact_grant'
      and actor.capability_profile ->> 'required_user_capability' = 'manage_registry'
  )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = 'registry_discography_admin'
         and binding.executor_kind = 'database_role'
         and binding.executor_key = 'authenticator'
         and binding.status = 'active'
     )
  then
    raise exception 'Discography V1 admin broker binding drifted';
  end if;

  if to_regprocedure('platform_private.registry_release_artist_set_v1(uuid)') is null
     or to_regprocedure('platform_private.registry_release_track_set_v1(uuid)') is null
     or to_regprocedure('platform_private.registry_track_artist_credit_set_v1(uuid)') is null
     or to_regprocedure('platform_private.registry_discography_set_fingerprint_v1(jsonb)') is null
     or to_regprocedure('platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)') is null
     or to_regprocedure('platform_private.execute_registry_discography_operation_v1(uuid)') is null
     or to_regprocedure('platform_private.verify_registry_discography_operation_v1(uuid)') is null
     or to_regprocedure('public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text)') is null
     or to_regprocedure('public.admin_preview_registry_discography_evidence_v1(uuid)') is null
     or to_regprocedure('public.admin_create_registry_discography_artist_shell_v1(uuid,text)') is null
     or to_regprocedure('public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)') is null
     or to_regprocedure('public.admin_verify_registry_discography_operation_v1(uuid)') is null
  then
    raise exception 'Discography V1 function authority is incomplete';
  end if;

  select pg_get_functiondef(to_regprocedure('platform_private.execute_registry_materialization_v1(text,uuid)'))
  into v_definition;
  if position('registry.release.create' in v_definition) = 0
     or position('insert into public.registry_releases' in lower(v_definition)) = 0
  then
    raise exception 'Shared materialization executor does not implement Release Create V1';
  end if;

  select pg_get_functiondef(to_regprocedure('platform_private.verify_registry_materialization_v1(uuid)'))
  into v_definition;
  if position('registry.release.create' in v_definition) = 0 then
    raise exception 'Shared materialization verifier does not implement Release Create V1';
  end if;

  if has_function_privilege('anon','platform_private.execute_registry_discography_operation_v1(uuid)','EXECUTE')
     or has_function_privilege('authenticated','platform_private.execute_registry_discography_operation_v1(uuid)','EXECUTE')
     or has_function_privilege('service_role','platform_private.execute_registry_discography_operation_v1(uuid)','EXECUTE')
     or has_function_privilege('anon','platform_private.verify_registry_discography_operation_v1(uuid)','EXECUTE')
     or has_function_privilege('authenticated','platform_private.verify_registry_discography_operation_v1(uuid)','EXECUTE')
     or has_function_privilege('service_role','platform_private.verify_registry_discography_operation_v1(uuid)','EXECUTE')
     or has_function_privilege('anon','platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)','EXECUTE')
     or has_function_privilege('authenticated','platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)','EXECUTE')
     or has_function_privilege('service_role','platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)','EXECUTE')
  then
    raise exception 'Discography V1 private exact-grant/executor authority leaked';
  end if;

  if has_function_privilege('anon','public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text)','EXECUTE')
     or has_function_privilege('service_role','public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text)','EXECUTE')
     or has_function_privilege('anon','public.admin_preview_registry_discography_evidence_v1(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.admin_preview_registry_discography_evidence_v1(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_preview_registry_discography_evidence_v1(uuid)','EXECUTE')
     or has_function_privilege('anon','public.admin_create_registry_discography_artist_shell_v1(uuid,text)','EXECUTE')
     or has_function_privilege('service_role','public.admin_create_registry_discography_artist_shell_v1(uuid,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_create_registry_discography_artist_shell_v1(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.admin_verify_registry_discography_operation_v1(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.admin_verify_registry_discography_operation_v1(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_verify_registry_discography_operation_v1(uuid)','EXECUTE')
  then
    raise exception 'Discography V1 public wrapper grants drifted';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants grant_row
    where grant_row.actor_key = 'mizizi'
      and grant_row.capability_key in (
        'apply_registry_discography_plan',
        'admit_registry_release_provider_profile',
        'admit_registry_track_provider_profile',
        'admit_registry_artist_discography_summary',
        'replace_registry_release_artist_set',
        'replace_registry_release_track_set',
        'replace_registry_track_artist_credit_set',
        'create_registry_release'
      )
      and grant_row.status = 'active'
      and grant_row.valid_from <= now()
      and grant_row.expires_at > now()
  ) then
    raise exception 'MIZIZI gained standing Discography V1 authority';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants grant_row
    where grant_row.actor_key = 'registry_discography_admin'
      and grant_row.status = 'active'
      and grant_row.valid_from <= now()
      and grant_row.expires_at > now()
  ) then
    raise exception 'Discography V1 human broker unexpectedly has a standing System-Actor capability grant';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.actor_key = 'registry_discography_admin'
      and execution_grant.operation_key in (
        'registry.discography.apply',
        'registry.artist.create',
        'registry.track.create',
        'registry.release.create',
        'registry.release.provider_profile.admit',
        'registry.track.provider_profile.admit',
        'registry.artist.discography_summary.admit',
        'registry.release_artist_set.replace',
        'registry.release_track_set.replace',
        'registry.track_artist_credit_set.replace'
      )
      and (
        execution_grant.operation_version <> 1
        or execution_grant.issued_by_user_id is null
        or execution_grant.issued_by_principal_key <> 'user:' || execution_grant.issued_by_user_id::text
        or execution_grant.system_actor_capability_grant_id is not null
        or execution_grant.required_user_capability_key <> 'manage_registry'
      )
  ) then
    raise exception 'Discography V1 exact grant escaped human manage_registry authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.actor_key = 'registry_discography_admin'
      and execution_grant.status = 'active'
      and execution_grant.expires_at > now()
  ) then
    raise exception 'Discography V1 has active exact grants at verifier rest state';
  end if;

  if has_table_privilege('authenticated','public.registry_artists','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.registry_tracks','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.registry_releases','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.registry_release_artists','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.registry_release_tracks','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.registry_track_artists','INSERT,UPDATE,DELETE')
  then
    raise exception 'Ordinary authenticated role gained direct canonical Registry DML';
  end if;
end
$verify$;

select 'REGISTRY_DISCOGRAPHY_AUTHORITY_V1_PASS' as status;
