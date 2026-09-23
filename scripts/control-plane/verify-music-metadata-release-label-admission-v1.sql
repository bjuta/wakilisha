-- Permanent verifier for Slice 3 governed Release-to-Label admission.
-- Safe to run repeatedly. Raises on authority or runtime drift.

do $verify$
declare
  v_definition text;
begin
  if to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_labels') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('public.registry_canonical_write_events') is null
  then
    raise exception 'Slice 3 Release Label authority is incomplete';
  end if;

  if not exists (
    select 1
    from public.capability_definitions capability
    where capability.capability_key='admit_registry_release_label_link'
      and capability.domain='registry'
  ) then
    raise exception 'Release Label capability is missing';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.release.label_link.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key='admit_registry_release_label_link'
      and operation_type.risk_class='medium'
      and operation_type.allowed_subject_types=array['release']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Release Label operation type drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_release_label_admin'
      and actor.status='active'
      and actor.capability_profile->'operation_family'
          @> '["registry.release.label_link.admit/v1"]'::jsonb
  ) then
    raise exception 'Release Label admin actor is missing or malformed';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_release_label_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception 'Release Label authenticator binding drifted';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants standing_grant
    where standing_grant.actor_key='registry_release_label_admin'
      and standing_grant.status='active'
      and standing_grant.valid_from<=now()
      and standing_grant.expires_at>now()
  ) then
    raise exception 'Release Label actor gained standing autonomous authority';
  end if;

  if to_regprocedure(
       'platform_private.registry_release_label_admin_current_user_v1()'
     ) is null
     or to_regprocedure(
       'platform_private.registry_release_label_normalize_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_release_label_candidate_state_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.record_registry_release_label_admin_evidence_v1(uuid,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_release_label_admin_grant_v1(uuid,uuid,jsonb,text)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_release_label_admin_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_release_label_admin_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)'
     ) is null
  then
    raise exception 'Release Label runtime functions are incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Release Label public wrapper ACL drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_release_label_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_release_label_admin_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Release Label private executor leaked execution authority';
  end if;

  select pg_get_functiondef(
    'platform_private.registry_release_label_normalize_v1(text)'::regprocedure
  )
  into v_definition;

  if position('[[:space:]]+' in v_definition)=0
     or position('regexp_replace' in v_definition)=0
  then
    raise exception 'Release Label normalization contract drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.registry_release_label_candidate_state_v1(uuid,uuid)'::regprocedure
  )
  into v_definition;

  if position('record_label' in v_definition)=0
     or position('exact_label_match_count' in v_definition)=0
     or position('exact_organization_match_count' in v_definition)=0
     or position('review_only' in v_definition)=0
  then
    raise exception 'Release Label candidate-state contract drifted';
  end if;

  select pg_get_functiondef(
    'public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)'::regprocedure
  )
  into v_definition;

  if position('WK_RELEASE_LABEL_REVIEW_REQUIRED' in v_definition)=0
     or position('registry.release.label_link.admit' in v_definition)=0
     or position('verify_registry_release_label_admin_v1' in v_definition)=0
     or position('already_current' in v_definition)=0
  then
    raise exception 'Release Label public composition drifted';
  end if;

  if exists (
    select 1
    from platform_private.registry_evidence_assertions evidence
    where evidence.claim_key='registry.release.label_link.admit'
      and (
        evidence.subject_type<>'release'
        or evidence.trust_class<>'INTERNAL_FACT'
        or evidence.source_kind<>'retained_registry_metadata'
        or coalesce(
             (evidence.claim_payload->>'exact_label_match_count')::integer,
             0
           )<>1
        or coalesce(
             (evidence.claim_payload->>'exact_organization_match_count')::integer,
             0
           )<>0
      )
  ) then
    raise exception 'Release Label evidence lifecycle drifted';
  end if;

  if exists (
    select 1
    from platform_private.registry_mutation_operations operation
    where operation.actor_key='registry_release_label_admin'
      and operation.operation_key='registry.release.label_link.admit'
      and operation.status='succeeded'
      and (
        operation.affected_rows<>1
        or operation.verifier_status<>'passed'
        or (
          select count(*)
          from platform_private.registry_operation_write_events link
          where link.operation_id=operation.id
        )<>1
      )
  ) then
    raise exception 'Completed Release Label operations are not exactly verified';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_write_events link
    join platform_private.registry_mutation_operations operation
      on operation.id=link.operation_id
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where operation.actor_key='registry_release_label_admin'
      and (
        event.registry_entity_type<>'release'
        or event.source_table<>
             'platform_private.registry_evidence_assertions'
        or event.field_name<>'label_id'
        or event.target_path<>'public.registry_releases.label_id'
        or event.action<>'admit_release_label_link'
        or event.status<>'succeeded'
        or event.actor<>'system:registry_release_label_admin'
      )
  ) then
    raise exception 'Release Label canonical write-event causality drifted';
  end if;

  raise notice 'MUSIC_METADATA_SLICE3_RELEASE_LABEL_ADMISSION_V1_PASS';
end
$verify$;
