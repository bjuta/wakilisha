-- Permanent verifier for Slice 3 governed external identifier admission.
-- Safe to run repeatedly. Raises on authority or data-contract drift.

do $verify$
declare
  v_definition text;
begin
  if to_regclass('public.registry_external_identifier_assertions') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('public.registry_canonical_write_events') is null
  then
    raise exception 'Slice 3 external identifier admission authority is incomplete';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_external_identifier_admin'
      and actor.status='active'
      and actor.capability_profile->'operation_family'
          @> '["registry.external_identifier_assertion.admit/v1"]'::jsonb
  ) then
    raise exception 'External identifier admin actor is missing or malformed';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_external_identifier_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception 'External identifier admin executor binding drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key=
          'registry.external_identifier_assertion.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key=
          'admit_registry_external_identifier_assertion'
      and operation_type.risk_class='medium'
      and operation_type.allowed_subject_types=
          array['external_identifier_assertion']::text[]
      and not operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'External identifier admission operation is not exactly enabled';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key=
          'registry.external_identifier_assertion.reviewed_reconcile'
      and operation_type.operation_version=1
      and operation_type.enabled
  ) then
    raise exception 'External identifier reviewed reconcile enabled prematurely';
  end if;

  if to_regprocedure(
       'platform_private.registry_external_identifier_admin_current_user_v1()'
     ) is null
     or to_regprocedure(
       'platform_private.registry_external_identifier_subject_lock_v1(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_external_identifier_candidate_state_v1(text,uuid,text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_external_identifier_existing_v1(text,uuid,text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.record_registry_external_identifier_admin_evidence_v1(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_external_identifier_admin_grant_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_external_identifier_admin_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_external_identifier_admin_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_external_identifier_candidate_v1(text,uuid,text,text)'
     ) is null
  then
    raise exception 'External identifier admission functions are incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_external_identifier_candidate_v1(text,uuid,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_external_identifier_candidate_v1(text,uuid,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_external_identifier_candidate_v1(text,uuid,text,text)',
       'EXECUTE'
     )
  then
    raise exception 'External identifier public wrapper ACL drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_external_identifier_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_external_identifier_admin_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'External identifier private executor leaked execution authority';
  end if;

  if has_table_privilege(
       'anon',
       'public.registry_external_identifier_assertions',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'public.registry_external_identifier_assertions',
       'INSERT'
     )
     or has_table_privilege(
       'service_role',
       'public.registry_external_identifier_assertions',
       'INSERT'
     )
  then
    raise exception 'External identifier assertion table leaked direct insert authority';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants standing_grant
    where standing_grant.actor_key='registry_external_identifier_admin'
      and standing_grant.status='active'
      and standing_grant.valid_from<=now()
      and standing_grant.expires_at>now()
  ) then
    raise exception 'External identifier admin gained standing autonomous authority';
  end if;

  select pg_get_functiondef(
    'platform_private.registry_external_identifier_candidate_state_v1(text,uuid,text,text)'::regprocedure
  )
  into v_definition;

  if position('apple_music_track_id' in v_definition)=0
     or position('apple_music_album_id' in v_definition)=0
     or position('apple_music_id' in v_definition)=0
     or position('spotify_artist_id' in v_definition)=0
     or position('spotify_id' in v_definition)=0
     or position('conflicting_current_assertion_count' in v_definition)=0
     or position('review_only_duplicate_assignment' in v_definition)=0
  then
    raise exception 'Retained provider candidate-state contract drifted';
  end if;

  select pg_get_functiondef(
    'public.admin_admit_registry_external_identifier_candidate_v1(text,uuid,text,text)'::regprocedure
  )
  into v_definition;

  if position('WK_EXTERNAL_IDENTIFIER_REVIEW_REQUIRED' in v_definition)=0
     or position('registry.external_identifier_assertion.admit' in v_definition)=0
     or position('verify_registry_external_identifier_admin_v1' in v_definition)=0
  then
    raise exception 'External identifier admission composition drifted';
  end if;

  if exists (
    select 1
    from public.registry_external_identifier_assertions assertion
    join platform_private.registry_evidence_assertions evidence
      on evidence.id=assertion.evidence_assertion_id
    where evidence.source_kind='retained_registry_metadata'
      and (
        evidence.subject_type<>'external_identifier_assertion'
        or evidence.subject_id<>assertion.id
        or evidence.claim_key<>'registry.external_identifier_assertion.admit'
        or evidence.trust_class<>'INTERNAL_FACT'
        or assertion.assertion_status<>'candidate'
        or assertion.verification_method is not null
        or assertion.verified_by is not null
        or assertion.verified_at is not null
        or assertion.scheme_key not in ('apple_music','spotify')
        or num_nonnulls(
             assertion.artist_id,
             assertion.track_id,
             assertion.release_id
           )<>1
        or num_nonnulls(
             assertion.work_id,
             assertion.person_resource_id,
             assertion.organization_resource_id
           )<>0
      )
  ) then
    raise exception 'Retained-metadata external identifier assertion lifecycle drifted';
  end if;

  if exists (
    select 1
    from platform_private.registry_mutation_operations operation
    where operation.actor_key='registry_external_identifier_admin'
      and operation.operation_key=
          'registry.external_identifier_assertion.admit'
      and operation.status='succeeded'
      and (
        operation.affected_rows<>1
        or operation.verifier_status<>'passed'
        or (
          select count(*)
          from platform_private.registry_operation_write_events write_link
          where write_link.operation_id=operation.id
        )<>1
      )
  ) then
    raise exception 'Completed external identifier operations are not exactly verified';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_write_events write_link
    join platform_private.registry_mutation_operations operation
      on operation.id=write_link.operation_id
    join public.registry_canonical_write_events event
      on event.id=write_link.canonical_write_event_id
    where operation.actor_key='registry_external_identifier_admin'
      and (
        event.target_path<>
          'public.registry_external_identifier_assertions'
        or event.action<>'admit_external_identifier_assertion'
        or event.status<>'succeeded'
        or event.actor<>'system:registry_external_identifier_admin'
      )
  ) then
    raise exception 'External identifier canonical write-event causality drifted';
  end if;

  raise notice 'MUSIC_METADATA_SLICE3_EXTERNAL_IDENTIFIER_ADMISSION_V1_PASS';
end
$verify$;
