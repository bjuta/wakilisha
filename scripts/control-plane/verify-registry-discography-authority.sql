-- Read-only verifier for #945 Gate A Discography Exact-Set Authority V1.
-- Safe for clean Preview and Production after the candidate migrations exist.

do $verify$
declare
  v_count integer;
  v_operation platform_private.registry_operation_types%rowtype;
  v_definition text;
  v_role text;
  v_signature text;
begin
  if to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('platform_private.registry_discography_provider_snapshots') is null
     or to_regclass('platform_private.registry_discography_review_plans') is null
  then
    raise exception 'Discography V1 governance substrate is missing';
  end if;

  -- Discography must fit around the accepted shared governance envelopes rather
  -- than widening them for large provider observations or exact-set plans.
  if not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid='platform_private.registry_evidence_assertions'::regclass
         and pg_get_constraintdef(constraint_row.oid) like '%octet_length%16384%'
     )
     or not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid='platform_private.registry_execution_grants'::regclass
         and pg_get_constraintdef(constraint_row.oid) like '%octet_length%32768%'
     )
  then
    raise exception 'Shared Registry evidence/grant payload ceilings drifted';
  end if;

  if not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid='platform_private.registry_discography_provider_snapshots'::regclass
         and pg_get_constraintdef(constraint_row.oid) like '%2097152%'
     )
     or not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid='platform_private.registry_discography_review_plans'::regclass
         and pg_get_constraintdef(constraint_row.oid) like '%131072%'
     )
     or not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid='platform_private.registry_discography_review_plans'::regclass
         and pg_get_constraintdef(constraint_row.oid) like '%4194304%'
     )
  then
    raise exception 'Discography immutable storage payload ceilings drifted';
  end if;

  if not exists (
       select 1
       from pg_trigger trigger_row
       where trigger_row.tgrelid='platform_private.registry_discography_provider_snapshots'::regclass
         and trigger_row.tgname='registry_discography_provider_snapshots_immutable'
         and not trigger_row.tgisinternal
         and trigger_row.tgenabled<>'D'
     )
     or not exists (
       select 1
       from pg_trigger trigger_row
       where trigger_row.tgrelid='platform_private.registry_discography_review_plans'::regclass
         and trigger_row.tgname='registry_discography_review_plans_immutable'
         and not trigger_row.tgisinternal
         and trigger_row.tgenabled<>'D'
     )
  then
    raise exception 'Discography immutable storage mutation guards are missing';
  end if;

  foreach v_role in array array['public','anon','authenticated','service_role']
  loop
    if has_table_privilege(v_role,'platform_private.registry_discography_provider_snapshots','SELECT')
       or has_table_privilege(v_role,'platform_private.registry_discography_provider_snapshots','INSERT')
       or has_table_privilege(v_role,'platform_private.registry_discography_provider_snapshots','UPDATE')
       or has_table_privilege(v_role,'platform_private.registry_discography_provider_snapshots','DELETE')
       or has_table_privilege(v_role,'platform_private.registry_discography_provider_snapshots','TRUNCATE')
       or has_table_privilege(v_role,'platform_private.registry_discography_review_plans','SELECT')
       or has_table_privilege(v_role,'platform_private.registry_discography_review_plans','INSERT')
       or has_table_privilege(v_role,'platform_private.registry_discography_review_plans','UPDATE')
       or has_table_privilege(v_role,'platform_private.registry_discography_review_plans','DELETE')
       or has_table_privilege(v_role,'platform_private.registry_discography_review_plans','TRUNCATE')
    then
      raise exception 'Discography immutable storage leaked table authority to role %',v_role;
    end if;
  end loop;

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

  foreach v_signature in array array[
    'platform_private.registry_release_artist_set_v1(uuid)',
    'platform_private.registry_release_track_set_v1(uuid)',
    'platform_private.registry_track_artist_credit_set_v1(uuid)',
    'platform_private.registry_discography_set_fingerprint_v1(jsonb)',
    'platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)',
    'platform_private.registry_discography_observation_fingerprint_v1(jsonb)',
    'platform_private.registry_discography_validate_observation_v1(uuid,jsonb,text)',
    'platform_private.record_registry_discography_provider_evidence_v1(uuid,jsonb,text)',
    'platform_private.freeze_registry_discography_review_plan_v1(uuid,uuid,jsonb)',
    'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)',
    'platform_private.execute_registry_discography_operation_v1(uuid)',
    'platform_private.verify_registry_discography_operation_v1(uuid)',
    'public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text)',
    'public.admin_preview_registry_discography_evidence_v1(uuid)',
    'public.admin_create_registry_discography_artist_shell_v1(uuid,text)',
    'public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)',
    'public.admin_verify_registry_discography_operation_v1(uuid)'
  ]
  loop
    if to_regprocedure(v_signature) is null then
      raise exception 'Discography V1 function authority is incomplete: %',v_signature;
    end if;
  end loop;

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

  select regexp_replace(
    pg_get_functiondef(
      to_regprocedure('platform_private.registry_discography_validate_observation_v1(uuid,jsonb,text)')
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ) into v_definition;
  if position('p_source_payload_fingerprint' in v_definition)=0
     or position('acquired_at' in v_definition)=0
  then
    raise exception 'Discography provider evidence does not bind source payload fingerprint and acquisition time';
  end if;

  -- Release Artist primary-credit parsing must preserve the primary side of a
  -- featured credit without promoting the featured side to primary.
  if not platform_private.registry_discography_credit_includes_artist_v1(
       'Primary Artist feat. Guest Artist',
       'Primary Artist'
     )
     or platform_private.registry_discography_credit_includes_artist_v1(
       'Primary Artist feat. Guest Artist',
       'Guest Artist'
     )
     or not platform_private.registry_discography_credit_includes_artist_v1(
       'Primary Artist & Guest Artist',
       'Guest Artist'
     )
  then
    raise exception 'Discography Release Artist primary-credit parsing drifted';
  end if;

  -- Multiple selected provider Albums must not resolve to one canonical Track
  -- with conflicting provider-profile facts.
  select pg_get_functiondef(
    to_regprocedure('platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)')
  ) into v_definition;
  if position('v_track_buckets->v_track_key' in v_definition)=0
     or position('is distinct from v_profile' in v_definition)=0
     or position(
       'Selected provider Albums resolve to one canonical Track with conflicting provider profile facts.'
       in v_definition
     )=0
  then
    raise exception 'Discography canonical Track provider-profile ambiguity guard drifted';
  end if;

  -- Exact grants must use semantic idempotency keys, never a state fingerprint
  -- or null in the idempotency-key argument slot.
  select regexp_replace(
    pg_get_functiondef(
      to_regprocedure('public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)')
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ) into v_definition;
  v_definition := regexp_replace(v_definition,'[[:space:]]+','','g');
  if position('v_grant_plan,v_expected_state,v_max_rows' in v_definition)>0
     or position('v_grant_plan,null,1' in v_definition)>0
     or position('v_parent_plan,v_expected_state,1' in v_definition)>0
     or position('v_grant_plan,v_idempotency_key,v_max_rows' in v_definition)=0
     or position('v_parent_plan,v_parent_idempotency,1' in v_definition)=0
  then
    raise exception 'Discography reviewed execution is not bound to semantic idempotency-key authority';
  end if;

  select regexp_replace(
    pg_get_functiondef(
      to_regprocedure('public.admin_create_registry_discography_artist_shell_v1(uuid,text)')
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ) into v_definition;
  v_definition := regexp_replace(v_definition,'[[:space:]]+','','g');
  if position('v_plan,null,1' in v_definition)>0
     or position('v_plan,v_idempotency_key,1' in v_definition)=0
  then
    raise exception 'Discography Artist-shell grant is not bound to its semantic idempotency key';
  end if;

  foreach v_signature in array array[
    'platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)',
    'platform_private.registry_discography_observation_fingerprint_v1(jsonb)',
    'platform_private.registry_discography_validate_observation_v1(uuid,jsonb,text)',
    'platform_private.record_registry_discography_provider_evidence_v1(uuid,jsonb,text)',
    'platform_private.freeze_registry_discography_review_plan_v1(uuid,uuid,jsonb)',
    'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)',
    'platform_private.execute_registry_discography_operation_v1(uuid)',
    'platform_private.verify_registry_discography_operation_v1(uuid)'
  ]
  loop
    foreach v_role in array array['public','anon','authenticated','service_role']
    loop
      if has_function_privilege(v_role,v_signature,'EXECUTE') then
        raise exception 'Discography V1 private function leaked EXECUTE to role %: %',v_role,v_signature;
      end if;
    end loop;
  end loop;

  foreach v_signature in array array[
    'public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text)',
    'public.admin_preview_registry_discography_evidence_v1(uuid)',
    'public.admin_create_registry_discography_artist_shell_v1(uuid,text)',
    'public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)',
    'public.admin_verify_registry_discography_operation_v1(uuid)'
  ]
  loop
    if has_function_privilege('public',v_signature,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
       or not has_function_privilege('authenticated',v_signature,'EXECUTE')
    then
      raise exception 'Discography V1 public wrapper grant drifted: %',v_signature;
    end if;
  end loop;

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

  if has_table_privilege('authenticated','public.registry_artists','INSERT')
     or has_table_privilege('authenticated','public.registry_artists','UPDATE')
     or has_table_privilege('authenticated','public.registry_artists','DELETE')
     or has_table_privilege('authenticated','public.registry_tracks','INSERT')
     or has_table_privilege('authenticated','public.registry_tracks','UPDATE')
     or has_table_privilege('authenticated','public.registry_tracks','DELETE')
     or has_table_privilege('authenticated','public.registry_releases','INSERT')
     or has_table_privilege('authenticated','public.registry_releases','UPDATE')
     or has_table_privilege('authenticated','public.registry_releases','DELETE')
     or has_table_privilege('authenticated','public.registry_release_artists','INSERT')
     or has_table_privilege('authenticated','public.registry_release_artists','UPDATE')
     or has_table_privilege('authenticated','public.registry_release_artists','DELETE')
     or has_table_privilege('authenticated','public.registry_release_tracks','INSERT')
     or has_table_privilege('authenticated','public.registry_release_tracks','UPDATE')
     or has_table_privilege('authenticated','public.registry_release_tracks','DELETE')
     or has_table_privilege('authenticated','public.registry_track_artists','INSERT')
     or has_table_privilege('authenticated','public.registry_track_artists','UPDATE')
     or has_table_privilege('authenticated','public.registry_track_artists','DELETE')
  then
    raise exception 'Ordinary authenticated role gained direct canonical Registry DML';
  end if;
end
$verify$;

select 'REGISTRY_DISCOGRAPHY_AUTHORITY_V1_PASS' as status;
