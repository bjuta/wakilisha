-- MIZIZI Slice 3 Track Intake provider-neutral Track reviewed-profile authority.
--
-- Owns only the reviewed Track field family formerly written directly by
-- admin_resolve_registry_track_intake_enriched(). Release facts remain separate.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-track-intake-track-reviewed-profile-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.capability_definitions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regprocedure('platform_private.registry_track_intake_current_admin_v1()') is null
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_identity_canonical_isrc_v1(text)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
  then
    raise exception
      'STOP: accepted Track Intake/Registry profile authority dependency is missing';
  end if;

  if exists (
       select 1 from public.capability_definitions
       where capability_key='admit_registry_track_reviewed_profile'
     )
     or exists (
       select 1 from platform_private.registry_operation_types
       where operation_key='registry.track.reviewed_profile.admit'
         and operation_version=1
     )
     or to_regprocedure('platform_private.registry_track_intake_track_profile_snapshot_v1(uuid,uuid)') is not null
     or to_regprocedure('platform_private.record_registry_track_intake_track_profile_evidence_v1(uuid,uuid,jsonb,boolean,text)') is not null
     or to_regprocedure('platform_private.issue_registry_track_intake_track_profile_grant_v1(uuid,uuid,jsonb,text)') is not null
     or to_regprocedure('platform_private.execute_registry_track_intake_track_profile_v1(uuid)') is not null
     or to_regprocedure('platform_private.verify_registry_track_intake_track_profile_v1(uuid)') is not null
     or to_regprocedure('public.admin_admit_registry_track_intake_track_profile_v1(uuid,uuid,boolean)') is not null
  then
    raise exception
      'STOP: Track Intake Track reviewed-profile authority already exists; audit before reapplying';
  end if;
end
$preflight$;

insert into public.capability_definitions (
  capability_key,label,description,domain
)
values (
  'admit_registry_track_reviewed_profile',
  'Admit Registry Track reviewed profile',
  'Admit the bounded provider-neutral reviewed Track Intake field family for one existing Registry Track.',
  'registry'
);

insert into platform_private.registry_operation_types (
  operation_key,operation_version,capability_key,risk_class,
  allowed_subject_types,requires_existing_target,max_targets,
  max_rows_ceiling,max_grant_ttl_seconds,requires_human_approval,
  requires_verifier,enabled,description
)
values (
  'registry.track.reviewed_profile.admit',
  1,
  'admit_registry_track_reviewed_profile',
  'medium',
  array['track']::text[],
  true,
  1,
  1,
  300,
  true,
  true,
  true,
  'Admit the exact reviewed provider-neutral Track Intake profile fields for one existing Registry Track.'
);

update platform_private.system_actors
set capability_profile=
  jsonb_set(
    coalesce(capability_profile,'{}'::jsonb),
    '{operation_family}',
    (
      select jsonb_agg(value order by value::text)
      from (
        select distinct value
        from jsonb_array_elements(
          coalesce(capability_profile->'operation_family','[]'::jsonb)
          || jsonb_build_array('registry.track.reviewed_profile.admit/v1')
        )
      ) operation(value)
    ),
    true
  )
where actor_key='registry_track_intake_admin';

create function platform_private.registry_track_intake_track_profile_snapshot_v1(
  p_suggestion_id uuid,
  p_track_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid;
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_fields jsonb;
  v_payload jsonb;
  v_fingerprint text;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id=p_suggestion_id;

  if not found then
    raise exception using errcode='P0002',
      message='Track Intake item does not exist.';
  end if;

  if v_suggestion.status<>'needs_review'
     or (
       v_suggestion.canonical_track_id is not null
       and v_suggestion.canonical_track_id<>p_track_id
     )
     or (
       v_suggestion.canonicalized_track_id is not null
       and v_suggestion.canonicalized_track_id<>p_track_id
     )
  then
    raise exception using errcode='42501',
      message='Track Intake item is not eligible for this Registry Track profile target.';
  end if;

  if not exists (
       select 1
       from public.registry_tracks track
       where track.id=p_track_id
         and track.status in ('draft','active')
     )
  then
    raise exception using errcode='42501',
      message='Track Intake reviewed profile requires an existing draft or active Registry Track.';
  end if;

  select coalesce(
    jsonb_object_agg(
      enrichment.field_name,
      enrichment.suggested_value
      order by enrichment.field_name
    ),
    '{}'::jsonb
  )
  into v_fields
  from public.registry_enrichment_suggestions enrichment
  where enrichment.registry_entity_type='track'
    and enrichment.registry_entity_id=p_suggestion_id::text
    and enrichment.decision_status='approved'
    and enrichment.field_name in (
      'isrc','duration_ms','track_artwork_url','preview_url',
      'track_number','disc_number','explicit','genre'
    );

  v_payload:=jsonb_build_object(
    'suggestion_id',p_suggestion_id,
    'track_id',p_track_id,
    'canonical_track_id',v_suggestion.canonical_track_id,
    'canonicalized_track_id',v_suggestion.canonicalized_track_id,
    'approved_track_fields',v_fields
  );

  v_fingerprint:=encode(
    extensions.digest(v_payload::text,'sha256'),
    'hex'
  );

  return v_payload||jsonb_build_object(
    'review_fingerprint',v_fingerprint,
    'applying_user_id',v_user_id
  );
end
$$;

create function platform_private.record_registry_track_intake_track_profile_evidence_v1(
  p_suggestion_id uuid,
  p_track_id uuid,
  p_proposed jsonb,
  p_allow_overwrite boolean,
  p_review_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid;
  v_claim jsonb;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();

  v_claim:=jsonb_build_object(
    'suggestion_id',p_suggestion_id,
    'track_id',p_track_id,
    'proposed',p_proposed,
    'allow_overwrite',p_allow_overwrite,
    'review_fingerprint',p_review_fingerprint
  );

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','track',
        'subject_id',p_track_id::text,
        'claim_key','registry.track.reviewed_profile',
        'claim_payload',v_claim,
        'trust_class','INTERNAL_FACT',
        'source_kind','track_intake_review',
        'source_ref','track-intake-track-profile:'||p_suggestion_id::text||':'||p_track_id::text,
        'source_payload_fingerprint',p_review_fingerprint,
        'recorded_by_principal_key','user:'||v_user_id::text
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_evidence_assertions (
    subject_type,subject_id,claim_key,claim_payload,trust_class,
    source_kind,source_ref,source_payload_fingerprint,observed_at,
    recorded_by_principal_key,assertion_fingerprint
  )
  values (
    'track',
    p_track_id,
    'registry.track.reviewed_profile',
    v_claim,
    'INTERNAL_FACT',
    'track_intake_review',
    'track-intake-track-profile:'||p_suggestion_id::text||':'||p_track_id::text,
    p_review_fingerprint,
    now(),
    'user:'||v_user_id::text,
    v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint) do nothing
  returning id into v_assertion_id;

  if v_assertion_id is null then
    select assertion.id
    into v_assertion_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint=v_assertion_fingerprint;
  end if;

  return v_assertion_id;
end
$$;

create function platform_private.issue_registry_track_intake_track_profile_grant_v1(
  p_evidence_assertion_id uuid,
  p_track_id uuid,
  p_plan_payload jsonb,
  p_expected_state_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid;
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_idempotency_key text;
  v_grant_id uuid;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.track.reviewed_profile.admit'
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or v_operation_type.capability_key<>'admit_registry_track_reviewed_profile'
     or not ('track'=any(v_operation_type.allowed_subject_types))
     or not v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<1
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Track reviewed-profile operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>p_track_id
     or v_evidence.claim_key<>'registry.track.reviewed_profile'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Track Intake reviewed-profile evidence is not bound to this exact caller and Track.';
  end if;

  if p_plan_payload->>'operation_key'<>'registry.track.reviewed_profile.admit'
     or coalesce((p_plan_payload->>'operation_version')::integer,0)<>1
     or p_plan_payload->>'track_id' is distinct from p_track_id::text
     or p_plan_payload->>'expected_state_fingerprint' is distinct from p_expected_state_fingerprint
     or p_plan_payload->>'evidence_assertion_id' is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint' is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'trust_class' is distinct from v_evidence.trust_class
     or p_plan_payload->>'policy_ruleset_version'<>'registry-track-reviewed-profile-v1'
  then
    raise exception using errcode='42501',
      message='Track Intake reviewed-profile plan is not bound to current evidence authority.';
  end if;

  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(p_plan_payload);
  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','track',
          'subject_id',p_track_id::text,
          'expected_state_fingerprint',p_expected_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );
  v_idempotency_key:=
    'track-intake-track-profile-v1:'||
    (p_plan_payload->>'suggestion_id')||':'||
    p_track_id::text||':'||
    left(p_plan_payload->>'review_fingerprint',24)||':'||
    case when (p_plan_payload->>'allow_overwrite')::boolean then '1' else '0' end;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_intake_admin'
    and execution_grant.operation_key='registry.track.reviewed_profile.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.max_rows<>1
    then
      raise exception using errcode='23505',
        message='Track Intake Track profile idempotency key is bound to different authority.';
    end if;
    return v_existing.id;
  end if;

  insert into platform_private.registry_execution_grants (
    actor_key,capability_key,system_actor_capability_grant_id,
    operation_key,operation_version,plan_payload,plan_fingerprint,
    target_set_fingerprint,max_rows,idempotency_key,status,
    issued_by_user_id,issued_by_principal_key,policy_ruleset_version,
    required_user_capability_key,issued_at,expires_at
  )
  values (
    'registry_track_intake_admin',
    'admit_registry_track_reviewed_profile',
    null,
    'registry.track.reviewed_profile.admit',
    1,
    p_plan_payload,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-track-reviewed-profile-v1',
    'manage_registry',
    now(),
    now()+interval '5 minutes'
  )
  returning id into v_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,subject_type,subject_id,expected_state_fingerprint
  )
  values (
    v_grant_id,'track',p_track_id,p_expected_state_fingerprint
  );

  return v_grant_id;
end
$$;

create function platform_private.execute_registry_track_intake_track_profile_v1(
  p_execution_grant_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_proposed jsonb;
  v_review jsonb;
  v_before jsonb;
  v_after jsonb;
  v_current_fingerprint text;
  v_after_fingerprint text;
  v_event_id uuid;
  v_rows integer;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_track_intake_admin',
    p_execution_grant_id
  );

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_begin.operation_id
  for update;

  if v_begin.idempotent_replay and v_operation.status='succeeded' then
    operation_id:=v_operation.id;
    operation_status:=v_operation.status;
    verifier_status:=v_operation.verifier_status;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=p_execution_grant_id;

  if v_operation.status<>'authorized'
     or not found
     or v_grant.actor_key<>'registry_track_intake_admin'
     or v_grant.operation_key<>'registry.track.reviewed_profile.admit'
     or v_grant.operation_version<>1
     or v_grant.capability_key<>'admit_registry_track_reviewed_profile'
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>'registry-track-reviewed-profile-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Track Intake Track reviewed-profile grant.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or v_target.subject_type<>'track'
     or v_target.expected_state_fingerprint is null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     )<>1
  then
    raise exception using errcode='42501',
      message='Track reviewed-profile operation requires one exact existing Track target.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_proposed:=v_plan->'proposed';

  if (v_plan-array[
       'operation_key','operation_version','suggestion_id','track_id',
       'proposed','allow_overwrite','review_fingerprint',
       'expected_state_fingerprint','evidence_assertion_id',
       'evidence_assertion_fingerprint','trust_class',
       'policy_ruleset_version'
     ]::text[])<>'{}'::jsonb
     or v_plan->>'operation_key'<>'registry.track.reviewed_profile.admit'
     or coalesce((v_plan->>'operation_version')::integer,0)<>1
     or (v_plan->>'track_id')::uuid<>v_target.subject_id
     or v_plan->>'expected_state_fingerprint'
          is distinct from v_target.expected_state_fingerprint
     or (v_proposed-array[
          'isrc','duration_ms','artwork_url','preview_url',
          'track_number','disc_number','explicit','provider_genre'
        ]::text[])<>'{}'::jsonb
  then
    raise exception using errcode='42501',
      message='Track Intake Track reviewed-profile plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>v_target.subject_id
     or v_evidence.claim_key<>'registry.track.reviewed_profile'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.assertion_fingerprint is distinct from
        v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.recorded_by_principal_key is distinct from
        v_grant.issued_by_principal_key
  then
    raise exception using errcode='42501',
      message='Track reviewed-profile evidence no longer satisfies the exact grant.';
  end if;

  v_review:=
    platform_private.registry_track_intake_track_profile_snapshot_v1(
      (v_plan->>'suggestion_id')::uuid,
      v_target.subject_id
    );

  if v_review->>'review_fingerprint'
       is distinct from v_plan->>'review_fingerprint'
     or v_evidence.source_payload_fingerprint
       is distinct from v_review->>'review_fingerprint'
  then
    raise exception using errcode='23514',
      message='Track Intake reviewed Track profile changed before execution.';
  end if;

  v_current_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'track',v_target.subject_id
    );

  if v_current_fingerprint is distinct from v_target.expected_state_fingerprint then
    raise exception using errcode='23514',
      message='Registry Track changed after Track Intake profile grant issuance.';
  end if;

  select to_jsonb(track)
  into v_before
  from public.registry_tracks track
  where track.id=v_target.subject_id
    and track.status in ('draft','active')
  for update;

  if v_before is null then
    raise exception using errcode='42501',
      message='Track Intake reviewed profile target is unavailable.';
  end if;

  if not (v_plan->>'allow_overwrite')::boolean then
    if v_proposed ? 'isrc'
       and v_before->>'isrc' is not null
       and v_before->>'isrc' is distinct from v_proposed->>'isrc'
    then
      raise exception using errcode='23514',
        message='Accepted ISRC conflicts with the canonical Track.';
    end if;

    if v_proposed ? 'duration_ms'
       and v_before->>'duration_ms' is not null
       and (v_before->>'duration_ms')::integer
            is distinct from (v_proposed->>'duration_ms')::integer
    then
      raise exception using errcode='23514',
        message='Accepted duration conflicts with the canonical Track.';
    end if;

    if v_proposed ? 'artwork_url'
       and v_before->>'artwork_url' is not null
       and v_before->>'artwork_url' is distinct from v_proposed->>'artwork_url'
    then
      raise exception using errcode='23514',
        message='Accepted artwork conflicts with the canonical Track.';
    end if;
  end if;

  if v_proposed ? 'isrc'
     and v_proposed->>'isrc' is not null
     and exists (
       select 1
       from public.registry_tracks other_track
       where other_track.id<>v_target.subject_id
         and other_track.isrc=v_proposed->>'isrc'
     )
  then
    raise exception using errcode='23505',
      message='Accepted ISRC already belongs to another Registry Track.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  update public.registry_tracks track
  set
    isrc=case
      when v_proposed ? 'isrc' then nullif(v_proposed->>'isrc','')
      else track.isrc
    end,
    duration_ms=case
      when v_proposed ? 'duration_ms'
        then (v_proposed->>'duration_ms')::integer
      else track.duration_ms
    end,
    artwork_url=case
      when v_proposed ? 'artwork_url' then v_proposed->>'artwork_url'
      else track.artwork_url
    end,
    preview_url=case
      when v_proposed ? 'preview_url' then v_proposed->>'preview_url'
      else track.preview_url
    end,
    track_number=case
      when v_proposed ? 'track_number'
        then (v_proposed->>'track_number')::integer
      else track.track_number
    end,
    disc_number=case
      when v_proposed ? 'disc_number'
        then (v_proposed->>'disc_number')::integer
      else track.disc_number
    end,
    explicit=case
      when v_proposed ? 'explicit'
        then (v_proposed->>'explicit')::boolean
      else track.explicit
    end,
    metadata=case
      when v_proposed ? 'provider_genre'
           and v_proposed->>'provider_genre' is not null
        then coalesce(track.metadata,'{}'::jsonb)
             || jsonb_build_object(
                  'provider_genre',
                  v_proposed->>'provider_genre'
                )
      else track.metadata
    end,
    updated_at=now()
  where track.id=v_target.subject_id
    and track.status in ('draft','active');

  get diagnostics v_rows=row_count;

  select to_jsonb(track)
  into v_after
  from public.registry_tracks track
  where track.id=v_target.subject_id;

  if v_rows<>1
     or (
       v_before
       - array[
           'isrc','duration_ms','artwork_url','preview_url',
           'track_number','disc_number','explicit','metadata','updated_at'
         ]::text[]
     ) is distinct from (
       v_after
       - array[
           'isrc','duration_ms','artwork_url','preview_url',
           'track_number','disc_number','explicit','metadata','updated_at'
         ]::text[]
     )
     or (
       coalesce(v_before->'metadata','{}'::jsonb)-'provider_genre'
     ) is distinct from (
       coalesce(v_after->'metadata','{}'::jsonb)-'provider_genre'
     )
  then
    raise exception using errcode='23514',
      message='Track reviewed-profile execution exceeded the bounded field family.';
  end if;

  v_after_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'track',v_target.subject_id
    );

  insert into public.registry_canonical_write_events (
    registry_entity_type,registry_entity_id,source_suggestion_id,
    source_table,field_name,target_path,before_value,after_value,
    action,status,actor
  )
  values (
    'track',
    v_target.subject_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'reviewed_profile',
    'public.registry_tracks',
    jsonb_build_object(
      'isrc',v_before->'isrc',
      'duration_ms',v_before->'duration_ms',
      'artwork_url',v_before->'artwork_url',
      'preview_url',v_before->'preview_url',
      'track_number',v_before->'track_number',
      'disc_number',v_before->'disc_number',
      'explicit',v_before->'explicit',
      'provider_genre',v_before->'metadata'->'provider_genre'
    ),
    jsonb_build_object(
      'isrc',v_after->'isrc',
      'duration_ms',v_after->'duration_ms',
      'artwork_url',v_after->'artwork_url',
      'preview_url',v_after->'preview_url',
      'track_number',v_after->'track_number',
      'disc_number',v_after->'disc_number',
      'explicit',v_after->'explicit',
      'provider_genre',v_after->'metadata'->'provider_genre'
    ),
    'admit_reviewed_profile',
    'succeeded',
    'system:registry_track_intake_admin'
  )
  returning id into v_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,canonical_write_event_id
  )
  values (v_operation.id,v_event_id);

  update platform_private.registry_mutation_operations
  set affected_rows=1,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'subject_type','track',
        'subject_id',v_target.subject_id,
        'evidence_assertion_id',v_evidence.id,
        'canonical_write_event_id',v_event_id,
        'after_state_fingerprint',v_after_fingerprint
      ),
      completed_at=now(),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  operation_status:='succeeded';
  verifier_status:='pending';
  idempotent_replay:=v_begin.idempotent_replay;
  return next;
end
$$;

create function platform_private.verify_registry_track_intake_track_profile_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_event_count integer;
  v_current_fingerprint text;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_track_intake_admin'
     or v_operation.operation_key<>'registry.track.reviewed_profile.admit'
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Track Intake Track reviewed-profile operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded' or v_operation.affected_rows<>1 then
    v_failure:='operation_not_succeeded_exactly_once';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;

  if v_failure is null
     and (
       not found
       or v_grant.actor_key<>'registry_track_intake_admin'
       or v_grant.operation_key<>'registry.track.reviewed_profile.admit'
       or v_grant.operation_version<>1
       or v_grant.policy_ruleset_version<>'registry-track-reviewed-profile-v1'
     )
  then
    v_failure:='execution_grant_mismatch';
  end if;

  if v_failure is null then
    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id=v_grant.id;

    if not found
       or v_target.subject_type<>'track'
       or v_target.expected_state_fingerprint is null
       or (
         select count(*)
         from platform_private.registry_execution_grant_targets target_count
         where target_count.execution_grant_id=v_grant.id
       )<>1
    then
      v_failure:='exact_target_missing';
    end if;
  end if;

  if v_failure is null then
    v_current_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        'track',v_target.subject_id
      );

    if v_current_fingerprint is distinct from
       v_operation.result_payload->>'after_state_fingerprint'
    then
      v_failure:='canonical_track_state_changed_after_profile_admission';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type='track'
      and event.registry_entity_id=v_target.subject_id::text
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.field_name='reviewed_profile'
      and event.target_path='public.registry_tracks'
      and event.action='admit_reviewed_profile'
      and event.status='succeeded'
      and event.actor='system:registry_track_intake_admin';

    if v_event_count<>1 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set verifier_status='passed',
        result_payload=
          result_payload||
          jsonb_build_object(
            'verification',
            jsonb_build_object(
              'status','passed','verified_at',now()
            )
          ),
        updated_at=now()
    where id=v_operation.id;

    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  update platform_private.registry_mutation_operations
  set verifier_status='failed',
      error_code='registry_track_reviewed_profile_verification_failed',
      error_message=v_failure,
      result_payload=
        result_payload||
        jsonb_build_object(
          'verification',
          jsonb_build_object(
            'status','failed','reason',v_failure,'verified_at',now()
          )
        ),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  verifier_status:='failed';
  return next;
end
$$;

create function public.admin_admit_registry_track_intake_track_profile_v1(
  p_suggestion_id uuid,
  p_registry_track_id uuid,
  p_allow_overwrite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid;
  v_review jsonb;
  v_fields jsonb;
  v_proposed jsonb:='{}'::jsonb;
  v_track public.registry_tracks%rowtype;
  v_expected_state_fingerprint text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_existing_grant platform_private.registry_execution_grants%rowtype;
  v_idempotency_key text;
  v_execution record;
  v_verification record;
  v_is_current boolean;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();
  v_review:=
    platform_private.registry_track_intake_track_profile_snapshot_v1(
      p_suggestion_id,p_registry_track_id
    );
  v_fields:=v_review->'approved_track_fields';

  if v_fields ? 'isrc' then
    v_proposed:=v_proposed||jsonb_build_object(
      'isrc',
      platform_private.registry_identity_canonical_isrc_v1(
        nullif(btrim(v_fields->>'isrc'),'')
      )
    );
  end if;
  if v_fields ? 'duration_ms' then
    v_proposed:=v_proposed||jsonb_build_object(
      'duration_ms',nullif(v_fields->>'duration_ms','')::integer
    );
  end if;
  if v_fields ? 'track_artwork_url' then
    v_proposed:=v_proposed||jsonb_build_object(
      'artwork_url',nullif(btrim(v_fields->>'track_artwork_url'),'')
    );
  end if;
  if v_fields ? 'preview_url' then
    v_proposed:=v_proposed||jsonb_build_object(
      'preview_url',nullif(btrim(v_fields->>'preview_url'),'')
    );
  end if;
  if v_fields ? 'track_number' then
    v_proposed:=v_proposed||jsonb_build_object(
      'track_number',nullif(v_fields->>'track_number','')::integer
    );
  end if;
  if v_fields ? 'disc_number' then
    v_proposed:=v_proposed||jsonb_build_object(
      'disc_number',nullif(v_fields->>'disc_number','')::integer
    );
  end if;
  if v_fields ? 'explicit' then
    v_proposed:=v_proposed||jsonb_build_object(
      'explicit',nullif(v_fields->>'explicit','')::boolean
    );
  end if;
  if v_fields ? 'genre' then
    v_proposed:=v_proposed||jsonb_build_object(
      'provider_genre',nullif(btrim(v_fields->>'genre'),'')
    );
  end if;

  if v_proposed='{}'::jsonb then
    return jsonb_build_object(
      'mode','no_reviewed_fields',
      'applied',false,
      'track_id',p_registry_track_id
    );
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_registry_track_id
    and track.status in ('draft','active');

  if not found then
    raise exception using errcode='42501',
      message='Track Intake reviewed profile target is unavailable.';
  end if;

  v_idempotency_key:=
    'track-intake-track-profile-v1:'||
    p_suggestion_id::text||':'||
    p_registry_track_id::text||':'||
    left(v_review->>'review_fingerprint',24)||':'||
    case when p_allow_overwrite then '1' else '0' end;

  select execution_grant.*
  into v_existing_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_intake_admin'
    and execution_grant.operation_key='registry.track.reviewed_profile.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    v_grant_id:=v_existing_grant.id;
  else
    if not p_allow_overwrite then
      if v_proposed ? 'isrc'
         and v_track.isrc is not null
         and v_track.isrc is distinct from v_proposed->>'isrc'
      then
        raise exception using errcode='23514',
          message='Accepted ISRC conflicts with the canonical Track.';
      end if;
      if v_proposed ? 'duration_ms'
         and v_track.duration_ms is not null
         and v_track.duration_ms is distinct from
             (v_proposed->>'duration_ms')::integer
      then
        raise exception using errcode='23514',
          message='Accepted duration conflicts with the canonical Track.';
      end if;
      if v_proposed ? 'artwork_url'
         and v_track.artwork_url is not null
         and v_track.artwork_url is distinct from v_proposed->>'artwork_url'
      then
        raise exception using errcode='23514',
          message='Accepted artwork conflicts with the canonical Track.';
      end if;
    end if;

    v_is_current:=
      (not (v_proposed ? 'isrc')
       or v_track.isrc is not distinct from v_proposed->>'isrc')
      and
      (not (v_proposed ? 'duration_ms')
       or v_track.duration_ms is not distinct from
          (v_proposed->>'duration_ms')::integer)
      and
      (not (v_proposed ? 'artwork_url')
       or v_track.artwork_url is not distinct from v_proposed->>'artwork_url')
      and
      (not (v_proposed ? 'preview_url')
       or v_track.preview_url is not distinct from v_proposed->>'preview_url')
      and
      (not (v_proposed ? 'track_number')
       or v_track.track_number is not distinct from
          (v_proposed->>'track_number')::integer)
      and
      (not (v_proposed ? 'disc_number')
       or v_track.disc_number is not distinct from
          (v_proposed->>'disc_number')::integer)
      and
      (not (v_proposed ? 'explicit')
       or v_track.explicit is not distinct from
          (v_proposed->>'explicit')::boolean)
      and
      (
        not (v_proposed ? 'provider_genre')
        or v_proposed->>'provider_genre' is null
        or v_track.metadata->>'provider_genre'
             is not distinct from v_proposed->>'provider_genre'
      );

    if v_is_current then
      return jsonb_build_object(
        'mode','already_current',
        'applied',false,
        'track_id',p_registry_track_id
      );
    end if;

    if v_proposed ? 'isrc'
       and v_proposed->>'isrc' is not null
       and exists (
         select 1
         from public.registry_tracks other_track
         where other_track.id<>p_registry_track_id
           and other_track.isrc=v_proposed->>'isrc'
       )
    then
      raise exception using errcode='23505',
        message='Accepted ISRC already belongs to another Registry Track.';
    end if;

    v_expected_state_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        'track',p_registry_track_id
      );

    v_evidence_id:=
      platform_private.record_registry_track_intake_track_profile_evidence_v1(
        p_suggestion_id,
        p_registry_track_id,
        v_proposed,
        p_allow_overwrite,
        v_review->>'review_fingerprint'
      );

    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=v_evidence_id;

    v_plan:=jsonb_build_object(
      'operation_key','registry.track.reviewed_profile.admit',
      'operation_version',1,
      'suggestion_id',p_suggestion_id,
      'track_id',p_registry_track_id,
      'proposed',v_proposed,
      'allow_overwrite',p_allow_overwrite,
      'review_fingerprint',v_review->>'review_fingerprint',
      'expected_state_fingerprint',v_expected_state_fingerprint,
      'evidence_assertion_id',v_evidence.id,
      'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
      'trust_class',v_evidence.trust_class,
      'policy_ruleset_version','registry-track-reviewed-profile-v1'
    );

    v_grant_id:=
      platform_private.issue_registry_track_intake_track_profile_grant_v1(
        v_evidence.id,
        p_registry_track_id,
        v_plan,
        v_expected_state_fingerprint
      );
  end if;

  select *
  into v_execution
  from platform_private.execute_registry_track_intake_track_profile_v1(
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_track_intake_track_profile_v1(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='Track Intake Track reviewed-profile independent verification failed.';
  end if;

  return jsonb_build_object(
    'mode',case
      when v_execution.idempotent_replay then 'idempotent_replay'
      else 'executed'
    end,
    'applied',not v_execution.idempotent_replay,
    'track_id',p_registry_track_id,
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status,
    'idempotent_replay',v_execution.idempotent_replay
  );
end
$$;

revoke all on function
  public.admin_admit_registry_track_intake_track_profile_v1(uuid,uuid,boolean)
  from public,anon,service_role;
grant execute on function
  public.admin_admit_registry_track_intake_track_profile_v1(uuid,uuid,boolean)
  to authenticated;

revoke all on function
  platform_private.registry_track_intake_track_profile_snapshot_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.record_registry_track_intake_track_profile_evidence_v1(uuid,uuid,jsonb,boolean,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.issue_registry_track_intake_track_profile_grant_v1(uuid,uuid,jsonb,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.execute_registry_track_intake_track_profile_v1(uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.verify_registry_track_intake_track_profile_v1(uuid)
  from public,anon,authenticated,service_role;

do $postflight$
begin
  if exists (
       select 1
       from public.role_capabilities
       where capability_key='admit_registry_track_reviewed_profile'
     )
  then
    raise exception
      'STOP: Track reviewed-profile operation capability leaked into product roles';
  end if;
end
$postflight$;

commit;
