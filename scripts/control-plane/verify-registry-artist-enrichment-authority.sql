-- Read-only verifier for MIZIZI Slice 2 Artist Enrichment Authority V1.
-- Safe for Preview and Production after all three candidate migrations exist.

do $verify$
declare
  v_operation platform_private.registry_operation_types%rowtype;
  v_count integer;
begin
  if to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
  then
    raise exception 'Artist Enrichment V1 governance substrate is missing';
  end if;

  select count(*)::integer
  into v_count
  from public.capability_definitions
  where capability_key in (
    'admit_registry_artist_provider_profile',
    'admit_registry_artist_public_image',
    'admit_registry_artist_bio',
    'admit_registry_artist_type'
  )
    and domain = 'registry';

  if v_count <> 4 then
    raise exception 'Artist Enrichment V1 capability vocabulary drifted';
  end if;

  if exists (
    select 1
    from public.role_capabilities
    where capability_key in (
      'admit_registry_artist_provider_profile',
      'admit_registry_artist_public_image',
      'admit_registry_artist_bio',
      'admit_registry_artist_type'
    )
  ) then
    raise exception 'Artist Enrichment V1 operation capability leaked into a product role';
  end if;

  select count(*)::integer
  into v_count
  from platform_private.registry_operation_types
  where operation_key in (
    'registry.artist.provider_profile.admit',
    'registry.artist.public_image.admit',
    'registry.artist.bio.admit',
    'registry.artist.type.admit'
  );

  if v_count <> 4 then
    raise exception 'Artist Enrichment V1 operation family is incomplete';
  end if;

  for v_operation in
    select *
    from platform_private.registry_operation_types
    where operation_key in (
      'registry.artist.provider_profile.admit',
      'registry.artist.public_image.admit',
      'registry.artist.bio.admit',
      'registry.artist.type.admit'
    )
  loop
    if v_operation.operation_version <> 1
       or v_operation.allowed_subject_types <> array['artist']::text[]
       or not v_operation.requires_existing_target
       or v_operation.max_targets <> 1
       or v_operation.max_rows_ceiling <> 1
       or v_operation.max_grant_ttl_seconds <> 300
       or not v_operation.requires_human_approval
       or not v_operation.requires_verifier
       or not v_operation.enabled
    then
      raise exception 'Artist Enrichment V1 operation semantics drifted: %', v_operation.operation_key;
    end if;
  end loop;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where (operation_key, capability_key, risk_class) not in (
      ('registry.artist.provider_profile.admit','admit_registry_artist_provider_profile','medium'),
      ('registry.artist.public_image.admit','admit_registry_artist_public_image','medium'),
      ('registry.artist.bio.admit','admit_registry_artist_bio','medium'),
      ('registry.artist.type.admit','admit_registry_artist_type','high')
    )
      and operation_key in (
        'registry.artist.provider_profile.admit',
        'registry.artist.public_image.admit',
        'registry.artist.bio.admit',
        'registry.artist.type.admit'
      )
  ) then
    raise exception 'Artist Enrichment V1 operation capability/risk mapping drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key = 'registry_artist_enrichment_admin'
      and actor.actor_kind = 'automation'
      and actor.status = 'active'
      and actor.capability_profile ->> 'authority_mode' = 'human_exact_grant'
      and actor.capability_profile ->> 'required_user_capability' = 'manage_registry'
  )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = 'registry_artist_enrichment_admin'
         and binding.executor_kind = 'database_role'
         and binding.executor_key = 'authenticator'
         and binding.status = 'active'
     )
  then
    raise exception 'Artist Enrichment V1 admin broker binding drifted';
  end if;

  if to_regprocedure('platform_private.registry_artist_enrichment_claim_is_valid(text,jsonb,text)') is null
     or to_regprocedure('platform_private.registry_artist_enrichment_unowned_state_fingerprint(uuid,text)') is null
     or to_regprocedure('platform_private.record_registry_artist_enrichment_user_evidence(uuid,text,jsonb,text,text,text,timestamp with time zone)') is null
     or to_regprocedure('platform_private.issue_registry_artist_enrichment_user_execution_grant(uuid)') is null
     or to_regprocedure('platform_private.execute_registry_artist_enrichment_admission(uuid)') is null
     or to_regprocedure('platform_private.verify_registry_artist_enrichment_admission(uuid)') is null
     or to_regprocedure('public.admin_prepare_registry_artist_provider_profile_evidence(uuid,text,text,bigint,integer,text[],text,text,text,timestamp with time zone)') is null
     or to_regprocedure('public.admin_prepare_registry_artist_public_image_evidence(uuid,text,text,text,text,timestamp with time zone)') is null
     or to_regprocedure('public.admin_prepare_registry_artist_bio_evidence(uuid,text,text,text,text,text,timestamp with time zone)') is null
     or to_regprocedure('public.admin_prepare_registry_artist_type_evidence(uuid,text,text,text,text,text,timestamp with time zone)') is null
     or to_regprocedure('public.admin_execute_registry_artist_enrichment_evidence_admission(uuid)') is null
     or to_regprocedure('public.admin_verify_registry_artist_enrichment_admission(uuid)') is null
  then
    raise exception 'Artist Enrichment V1 reviewed-evidence function authority is incomplete';
  end if;

  if platform_private.registry_artist_enrichment_claim_is_valid(
       'registry.artist.provider_profile',
       jsonb_build_object('arbitrary_key', 'no'),
       'spotify'
     )
     or platform_private.registry_artist_enrichment_claim_is_valid(
       'registry.artist.type',
       jsonb_build_object('artist_type', 'corporation'),
       'name_heuristic'
     )
     or platform_private.registry_artist_enrichment_claim_is_valid(
       'registry.artist.type',
       jsonb_build_object('artist_type', 'solo'),
       'manual_review'
     )
     or platform_private.registry_artist_enrichment_claim_is_valid(
       'registry.artist.bio',
       jsonb_build_object('bio', repeat('x', 16100)),
       'apple_music'
     )
     or not platform_private.registry_artist_enrichment_claim_is_valid(
       'registry.artist.type',
       jsonb_build_object('artist_type', 'collective'),
       'name_heuristic'
     )
  then
    raise exception 'Artist Enrichment V1 typed claim policy drifted';
  end if;

  if has_function_privilege('anon','platform_private.execute_registry_artist_enrichment_admission(uuid)','EXECUTE')
     or has_function_privilege('authenticated','platform_private.execute_registry_artist_enrichment_admission(uuid)','EXECUTE')
     or has_function_privilege('service_role','platform_private.execute_registry_artist_enrichment_admission(uuid)','EXECUTE')
     or has_function_privilege('anon','platform_private.verify_registry_artist_enrichment_admission(uuid)','EXECUTE')
     or has_function_privilege('authenticated','platform_private.verify_registry_artist_enrichment_admission(uuid)','EXECUTE')
     or has_function_privilege('service_role','platform_private.verify_registry_artist_enrichment_admission(uuid)','EXECUTE')
     or has_function_privilege('anon','platform_private.issue_registry_artist_enrichment_user_execution_grant(uuid)','EXECUTE')
     or has_function_privilege('authenticated','platform_private.issue_registry_artist_enrichment_user_execution_grant(uuid)','EXECUTE')
     or has_function_privilege('service_role','platform_private.issue_registry_artist_enrichment_user_execution_grant(uuid)','EXECUTE')
  then
    raise exception 'Artist Enrichment V1 private broker leaked direct execution authority';
  end if;

  if has_function_privilege('authenticated','public.admin_execute_registry_artist_provider_profile_admission(uuid,text,text,bigint,integer,text[],text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_execute_registry_artist_public_image_admission(uuid,text,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_execute_registry_artist_bio_admission(uuid,text,text,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_execute_registry_artist_type_admission(uuid,text,text,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('anon','public.admin_execute_registry_artist_provider_profile_admission(uuid,text,text,bigint,integer,text[],text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('service_role','public.admin_execute_registry_artist_provider_profile_admission(uuid,text,text,bigint,integer,text[],text,text,text,timestamptz)','EXECUTE')
  then
    raise exception 'Artist Enrichment V1 raw-value execute bypass is callable';
  end if;

  if has_function_privilege('anon','public.admin_prepare_registry_artist_provider_profile_evidence(uuid,text,text,bigint,integer,text[],text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('service_role','public.admin_prepare_registry_artist_provider_profile_evidence(uuid,text,text,bigint,integer,text[],text,text,text,timestamptz)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_prepare_registry_artist_provider_profile_evidence(uuid,text,text,bigint,integer,text[],text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('anon','public.admin_prepare_registry_artist_public_image_evidence(uuid,text,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('service_role','public.admin_prepare_registry_artist_public_image_evidence(uuid,text,text,text,text,timestamptz)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_prepare_registry_artist_public_image_evidence(uuid,text,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('anon','public.admin_prepare_registry_artist_bio_evidence(uuid,text,text,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('service_role','public.admin_prepare_registry_artist_bio_evidence(uuid,text,text,text,text,text,timestamptz)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_prepare_registry_artist_bio_evidence(uuid,text,text,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('anon','public.admin_prepare_registry_artist_type_evidence(uuid,text,text,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('service_role','public.admin_prepare_registry_artist_type_evidence(uuid,text,text,text,text,text,timestamptz)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_prepare_registry_artist_type_evidence(uuid,text,text,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('anon','public.admin_execute_registry_artist_enrichment_evidence_admission(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.admin_execute_registry_artist_enrichment_evidence_admission(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_execute_registry_artist_enrichment_evidence_admission(uuid)','EXECUTE')
     or has_function_privilege('anon','public.admin_verify_registry_artist_enrichment_admission(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.admin_verify_registry_artist_enrichment_admission(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_verify_registry_artist_enrichment_admission(uuid)','EXECUTE')
  then
    raise exception 'Artist Enrichment V1 reviewed-evidence public grants drifted';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants grant_row
    where grant_row.actor_key = 'mizizi'
      and grant_row.capability_key in (
        'admit_registry_artist_provider_profile',
        'admit_registry_artist_public_image',
        'admit_registry_artist_bio',
        'admit_registry_artist_type'
      )
      and grant_row.status = 'active'
      and grant_row.valid_from <= now()
      and grant_row.expires_at > now()
  ) then
    raise exception 'MIZIZI gained standing Artist Enrichment V1 authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.operation_key in (
      'registry.artist.provider_profile.admit',
      'registry.artist.public_image.admit',
      'registry.artist.bio.admit',
      'registry.artist.type.admit'
    )
      and (
        execution_grant.actor_key <> 'registry_artist_enrichment_admin'
        or execution_grant.operation_version <> 1
        or execution_grant.max_rows <> 1
        or execution_grant.issued_by_user_id is null
        or execution_grant.issued_by_principal_key <> 'user:' || execution_grant.issued_by_user_id::text
        or execution_grant.system_actor_capability_grant_id is not null
        or execution_grant.required_user_capability_key <> 'manage_registry'
        or execution_grant.policy_ruleset_version not in (
          'registry-artist-provider-profile-admission-v1',
          'registry-artist-public-image-admission-v1',
          'registry-artist-bio-admission-v1',
          'registry-artist-type-admission-v1'
        )
      )
  ) then
    raise exception 'Artist Enrichment V1 exact grant escaped human one-Artist authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.operation_key in (
      'registry.artist.provider_profile.admit',
      'registry.artist.public_image.admit',
      'registry.artist.bio.admit',
      'registry.artist.type.admit'
    )
      and (
        select count(*)
        from platform_private.registry_execution_grant_targets target
        where target.execution_grant_id = execution_grant.id
          and target.subject_type = 'artist'
          and target.expected_state_fingerprint is not null
      ) <> 1
  ) then
    raise exception 'Artist Enrichment V1 exact target cardinality drifted';
  end if;

  if exists (
    select 1
    from platform_private.registry_mutation_operations operation
    where operation.operation_key in (
      'registry.artist.provider_profile.admit',
      'registry.artist.public_image.admit',
      'registry.artist.bio.admit',
      'registry.artist.type.admit'
    )
      and (
        operation.operation_version <> 1
        or operation.max_rows <> 1
        or operation.affected_rows > 1
      )
  ) then
    raise exception 'Artist Enrichment V1 journal escaped one-row authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_write_events link
    join platform_private.registry_mutation_operations operation
      on operation.id = link.operation_id
    join public.registry_canonical_write_events event
      on event.id = link.canonical_write_event_id
    where operation.operation_key in (
      'registry.artist.provider_profile.admit',
      'registry.artist.public_image.admit',
      'registry.artist.bio.admit',
      'registry.artist.type.admit'
    )
      and (
        event.registry_entity_type <> 'artist'
        or event.source_table <> 'platform_private.registry_evidence_assertions'
        or event.actor <> 'system:registry_artist_enrichment_admin'
        or (
          operation.operation_key = 'registry.artist.provider_profile.admit'
          and (
            event.action <> 'admit_artist_provider_profile'
            or event.field_name <> 'metadata.provider_profile'
            or event.target_path <> 'public.registry_artists.metadata'
          )
        )
        or (
          operation.operation_key = 'registry.artist.public_image.admit'
          and (
            event.action <> 'admit_artist_public_image'
            or event.field_name not in ('public_image_url','image_source_provider')
            or event.target_path not in (
              'public.registry_artists.public_image_url',
              'public.registry_artists.image_source_provider'
            )
          )
        )
        or (
          operation.operation_key = 'registry.artist.bio.admit'
          and (
            event.action <> 'admit_artist_bio'
            or event.field_name <> 'bio'
            or event.target_path <> 'public.registry_artists.bio'
          )
        )
        or (
          operation.operation_key = 'registry.artist.type.admit'
          and (
            event.action <> 'admit_artist_type'
            or event.field_name <> 'artist_type'
            or event.target_path <> 'public.registry_artists.artist_type'
          )
        )
      )
  ) then
    raise exception 'Artist Enrichment V1 canonical write evidence escaped typed field ownership';
  end if;

  select operation_type.*
  into v_operation
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key = 'registry.artist_origin.admit'
    and operation_type.operation_version = 1;

  if not found
     or v_operation.capability_key <> 'admit_registry_artist_origin'
     or v_operation.allowed_subject_types <> array['artist']::text[]
     or v_operation.max_targets <> 1
     or v_operation.max_rows_ceiling <> 1
     or not v_operation.requires_verifier
     or to_regprocedure('public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamp with time zone)') is null
     or to_regprocedure('public.admin_verify_registry_artist_origin_admission(uuid)') is null
  then
    raise exception 'Accepted Artist-origin authority regressed during enrichment convergence';
  end if;
end
$verify$;

select
  'REGISTRY_ARTIST_ENRICHMENT_AUTHORITY_V1_PASS' as result,
  (
    select count(*)
    from platform_private.registry_operation_types
    where operation_key in (
      'registry.artist.provider_profile.admit',
      'registry.artist.public_image.admit',
      'registry.artist.bio.admit',
      'registry.artist.type.admit'
    )
  ) as operation_types,
  (
    select count(*)
    from platform_private.registry_execution_grants
    where operation_key in (
      'registry.artist.provider_profile.admit',
      'registry.artist.public_image.admit',
      'registry.artist.bio.admit',
      'registry.artist.type.admit'
    )
  ) as exact_grants,
  (
    select count(*)
    from platform_private.registry_mutation_operations
    where operation_key in (
      'registry.artist.provider_profile.admit',
      'registry.artist.public_image.admit',
      'registry.artist.bio.admit',
      'registry.artist.type.admit'
    )
  ) as operations,
  (
    select count(*)
    from platform_private.registry_mutation_operations
    where operation_key in (
      'registry.artist.provider_profile.admit',
      'registry.artist.public_image.admit',
      'registry.artist.bio.admit',
      'registry.artist.type.admit'
    )
      and verifier_status = 'passed'
  ) as verified_operations;
