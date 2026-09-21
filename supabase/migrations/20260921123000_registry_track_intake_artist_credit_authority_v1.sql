-- MIZIZI Slice 3 Track Intake Artist Credit authority.
--
-- Reuses registry.track_artist_credit.admit/v1 without changing the accepted
-- Chart/Discography executor. Track Intake gets its own caller-bound issuer
-- and executor so provenance is track_intake_review rather than chart_admission.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-track-intake-artist-credit-authority-v1',
    0
  )
);

do $preflight$
begin
  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_track_intake_admin'
         and actor.status='active'
     )
     or not exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key='registry.track_artist_credit.admit'
         and operation_type.operation_version=1
         and operation_type.capability_key='admit_registry_track_artist_credit'
         and operation_type.enabled
     )
     or to_regprocedure('platform_private.registry_track_intake_current_admin_v1()') is null
     or to_regprocedure('platform_private.registry_track_intake_review_snapshot_v1(uuid)') is null
     or to_regprocedure('platform_private.registry_track_intake_deterministic_track_uuid_v1(uuid)') is null
     or to_regprocedure('platform_private.registry_track_artist_credit_collision_state_v1(uuid,uuid,uuid)') is null
     or to_regprocedure('platform_private.registry_relation_collision_fingerprint_v1(jsonb)') is null
     or to_regprocedure('platform_private.registry_credit_role_v1(text)') is null
     or to_regprocedure('platform_private.registry_credit_order_v1(integer)') is null
     or to_regprocedure('platform_private.registry_relation_confidence_v1(integer)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
     or to_regprocedure('platform_private.verify_registry_materialization_core_v1(uuid)') is null
  then
    raise exception
      'STOP: accepted Track Intake/Registry credit authority dependency is missing';
  end if;

  if to_regprocedure('platform_private.registry_track_intake_deterministic_credit_uuid_v1(uuid)') is not null
     or to_regprocedure('platform_private.record_registry_track_intake_credit_evidence_v1(uuid,uuid,uuid,uuid,text,integer,text)') is not null
     or to_regprocedure('platform_private.issue_registry_track_intake_credit_grant_v1(uuid,uuid,uuid,jsonb)') is not null
     or to_regprocedure('platform_private.execute_registry_track_intake_credit_v1(uuid)') is not null
     or to_regprocedure('public.admin_admit_registry_track_intake_credit_v1(uuid,uuid)') is not null
  then
    raise exception
      'STOP: Track Intake Artist Credit authority already exists; audit before reapplying';
  end if;
end
$preflight$;

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
          || jsonb_build_array('registry.track_artist_credit.admit/v1')
        )
      ) operation(value)
    ),
    true
  )
where actor_key='registry_track_intake_admin';

create function platform_private.registry_track_intake_deterministic_credit_uuid_v1(
  p_source_credit_id uuid
)
returns uuid
language plpgsql
immutable
security definer
set search_path=pg_catalog,extensions
as $$
declare
  v_hex text;
begin
  if p_source_credit_id is null then
    raise exception using errcode='22023',
      message='Track Intake source credit ID is required.';
  end if;

  v_hex:=encode(
    extensions.digest(
      'track.intake.credit:'||p_source_credit_id::text,
      'sha256'
    ),
    'hex'
  );

  return (
    substr(v_hex,1,8)||'-'||
    substr(v_hex,9,4)||'-'||
    '5'||substr(v_hex,14,3)||'-'||
    '8'||substr(v_hex,18,3)||'-'||
    substr(v_hex,21,12)
  )::uuid;
end
$$;

create function platform_private.record_registry_track_intake_credit_evidence_v1(
  p_suggestion_id uuid,
  p_source_credit_id uuid,
  p_future_credit_id uuid,
  p_track_id uuid,
  p_role text,
  p_credit_order integer,
  p_display_credit text
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid;
  v_review jsonb;
  v_source public.registry_provider_track_suggestion_artists%rowtype;
  v_claim jsonb;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();
  v_review:=platform_private.registry_track_intake_review_snapshot_v1(p_suggestion_id);

  select credit.*
  into v_source
  from public.registry_provider_track_suggestion_artists credit
  where credit.id=p_source_credit_id
    and credit.suggestion_id=p_suggestion_id;

  if not found
     or v_source.resolution_mode<>'existing_artist'
     or v_source.registry_artist_id is null
  then
    raise exception using errcode='42501',
      message='Track Intake reviewed credit is not bound to an existing Registry Artist.';
  end if;

  v_claim:=jsonb_build_object(
    'suggestion_id',p_suggestion_id,
    'source_credit_id',p_source_credit_id,
    'future_credit_id',p_future_credit_id,
    'track_id',p_track_id,
    'artist_id',v_source.registry_artist_id,
    'role',p_role,
    'credit_order',p_credit_order,
    'display_credit',p_display_credit,
    'confidence',100,
    'review_fingerprint',v_review->>'review_fingerprint'
  );

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','track_artist_credit',
        'subject_id',p_future_credit_id::text,
        'claim_key','registry.track_artist_credit',
        'claim_payload',v_claim,
        'trust_class','INTERNAL_FACT',
        'source_kind','track_intake_review',
        'source_ref','track-intake-credit:'||p_source_credit_id::text,
        'source_payload_fingerprint',v_review->>'review_fingerprint',
        'recorded_by_principal_key','user:'||v_user_id::text
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_evidence_assertions (
    subject_type,
    subject_id,
    claim_key,
    claim_payload,
    trust_class,
    source_kind,
    source_ref,
    source_payload_fingerprint,
    observed_at,
    recorded_by_principal_key,
    assertion_fingerprint
  )
  values (
    'track_artist_credit',
    p_future_credit_id,
    'registry.track_artist_credit',
    v_claim,
    'INTERNAL_FACT',
    'track_intake_review',
    'track-intake-credit:'||p_source_credit_id::text,
    v_review->>'review_fingerprint',
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

create function platform_private.issue_registry_track_intake_credit_grant_v1(
  p_source_credit_id uuid,
  p_evidence_assertion_id uuid,
  p_future_credit_id uuid,
  p_plan_payload jsonb
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
  where operation_type.operation_key='registry.track_artist_credit.admit'
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or v_operation_type.capability_key<>'admit_registry_track_artist_credit'
     or not ('track_artist_credit'=any(v_operation_type.allowed_subject_types))
     or v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<1
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Track Artist Credit V1 operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track_artist_credit'
     or v_evidence.subject_id<>p_future_credit_id
     or v_evidence.claim_key<>'registry.track_artist_credit'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.source_ref<>'track-intake-credit:'||p_source_credit_id::text
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Track Intake credit evidence is not bound to this exact review and caller.';
  end if;

  if p_plan_payload->>'operation_key'<>'registry.track_artist_credit.admit'
     or coalesce((p_plan_payload->>'operation_version')::integer,0)<>1
     or p_plan_payload->>'credit_id' is distinct from p_future_credit_id::text
     or p_plan_payload->>'evidence_assertion_id' is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint' is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'trust_class' is distinct from v_evidence.trust_class
     or p_plan_payload->>'policy_ruleset_version'<>'registry-materialization-v1'
  then
    raise exception using errcode='42501',
      message='Track Intake credit plan is not bound to current evidence authority.';
  end if;

  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(p_plan_payload);
  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','track_artist_credit',
          'subject_id',p_future_credit_id::text,
          'expected_state_fingerprint',null
        )
      )::text,
      'sha256'
    ),
    'hex'
  );
  v_idempotency_key:='track-intake-credit-v1:'||p_source_credit_id::text;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_intake_admin'
    and execution_grant.operation_key='registry.track_artist_credit.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.max_rows<>1
    then
      raise exception using errcode='23505',
        message='Track Intake credit idempotency key is bound to different authority.';
    end if;
    return v_existing.id;
  end if;

  insert into platform_private.registry_execution_grants (
    actor_key,
    capability_key,
    system_actor_capability_grant_id,
    operation_key,
    operation_version,
    plan_payload,
    plan_fingerprint,
    target_set_fingerprint,
    max_rows,
    idempotency_key,
    status,
    issued_by_user_id,
    issued_by_principal_key,
    policy_ruleset_version,
    required_user_capability_key,
    issued_at,
    expires_at
  )
  values (
    'registry_track_intake_admin',
    'admit_registry_track_artist_credit',
    null,
    'registry.track_artist_credit.admit',
    1,
    p_plan_payload,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-materialization-v1',
    'manage_registry',
    now(),
    now()+interval '5 minutes'
  )
  returning id into v_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,
    subject_type,
    subject_id,
    expected_state_fingerprint
  )
  values (
    v_grant_id,
    'track_artist_credit',
    p_future_credit_id,
    null
  );

  return v_grant_id;
end
$$;

create function platform_private.execute_registry_track_intake_credit_v1(
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
  v_artist public.registry_artists%rowtype;
  v_collision_state jsonb;
  v_collision_fingerprint text;
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

  if v_begin.idempotent_replay
     and v_operation.status='succeeded'
  then
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
     or v_grant.operation_key<>'registry.track_artist_credit.admit'
     or v_grant.operation_version<>1
     or v_grant.capability_key<>'admit_registry_track_artist_credit'
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>'registry-materialization-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Track Intake Artist Credit V1 grant.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or v_target.subject_type<>'track_artist_credit'
     or v_target.expected_state_fingerprint is not null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     )<>1
  then
    raise exception using errcode='42501',
      message='Track Intake Artist Credit V1 requires one exact future credit target.';
  end if;

  v_plan:=v_grant.plan_payload;

  if (v_plan-array[
       'operation_key','operation_version','credit_id',
       'track_id','artist_id','role','credit_order',
       'display_credit','confidence',
       'collision_state_fingerprint',
       'evidence_assertion_id','evidence_assertion_fingerprint',
       'trust_class','policy_ruleset_version'
     ]::text[])<>'{}'::jsonb
     or v_plan->>'operation_key'<>'registry.track_artist_credit.admit'
     or coalesce((v_plan->>'operation_version')::integer,0)<>1
     or (v_plan->>'credit_id')::uuid<>v_target.subject_id
     or platform_private.registry_credit_role_v1(v_plan->>'role')
          is distinct from v_plan->>'role'
     or platform_private.registry_credit_order_v1(
          (v_plan->>'credit_order')::integer
        ) is distinct from (v_plan->>'credit_order')::integer
     or platform_private.registry_relation_confidence_v1(
          (v_plan->>'confidence')::integer
        ) is distinct from (v_plan->>'confidence')::integer
  then
    raise exception using errcode='42501',
      message='Track Intake Artist Credit V1 plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>'track_artist_credit'
     or v_evidence.subject_id<>v_target.subject_id
     or v_evidence.claim_key<>'registry.track_artist_credit'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.assertion_fingerprint is distinct from
        v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.recorded_by_principal_key is distinct from
        v_grant.issued_by_principal_key
  then
    raise exception using errcode='42501',
      message='Track Intake Artist Credit evidence no longer satisfies the exact grant.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=(v_plan->>'artist_id')::uuid
    and artist.status='active';

  if not found
     or not exists (
       select 1
       from public.registry_tracks track
       where track.id=(v_plan->>'track_id')::uuid
         and track.status='draft'
     )
  then
    raise exception using errcode='42501',
      message='Track Intake Artist Credit endpoints are not the expected active Artist and draft Track.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry.track_artist_credit.admit:'||
      (v_plan->>'track_id')||':'||(v_plan->>'artist_id'),
      0
    )
  );

  v_collision_state:=
    platform_private.registry_track_artist_credit_collision_state_v1(
      v_target.subject_id,
      (v_plan->>'track_id')::uuid,
      (v_plan->>'artist_id')::uuid
    );
  v_collision_fingerprint:=
    platform_private.registry_relation_collision_fingerprint_v1(
      v_collision_state
    );

  if v_collision_state<>'[]'::jsonb
     or v_collision_fingerprint is distinct from
        v_plan->>'collision_state_fingerprint'
  then
    raise exception using errcode='40001',
      message='Track Intake Artist credit collision state changed before execution.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  insert into public.registry_track_artists (
    id,track_id,artist_id,artist_slug,
    artist_name_text,role,is_primary,is_featured,
    credit_order,display_credit,source,confidence,
    status,metadata
  )
  values (
    v_target.subject_id,
    (v_plan->>'track_id')::uuid,
    (v_plan->>'artist_id')::uuid,
    v_artist.slug,
    v_artist.display_name,
    v_plan->>'role',
    (v_plan->>'role')='primary_artist',
    (v_plan->>'role')='featured_artist',
    (v_plan->>'credit_order')::integer,
    v_plan->>'display_credit',
    'track_intake_review',
    (v_plan->>'confidence')::integer,
    'active',
    '{}'::jsonb
  );

  get diagnostics v_rows=row_count;

  insert into public.registry_canonical_write_events (
    registry_entity_type,
    registry_entity_id,
    source_suggestion_id,
    source_table,
    field_name,
    target_path,
    before_value,
    after_value,
    action,
    status,
    actor
  )
  values (
    'track_artist_credit',
    v_target.subject_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'relationship',
    'public.registry_track_artists',
    null,
    jsonb_build_object(
      'id',v_target.subject_id,
      'track_id',(v_plan->>'track_id')::uuid,
      'artist_id',(v_plan->>'artist_id')::uuid,
      'role',v_plan->>'role',
      'credit_order',(v_plan->>'credit_order')::integer,
      'display_credit',v_plan->>'display_credit',
      'confidence',(v_plan->>'confidence')::integer,
      'source','track_intake_review',
      'status','active'
    ),
    'admit_relationship',
    'succeeded',
    'system:registry_track_intake_admin'
  )
  returning id into v_event_id;

  if v_rows<>1 or v_event_id is null then
    raise exception using errcode='40001',
      message='Track Intake Artist Credit lost its exact one-row boundary.';
  end if;

  insert into platform_private.registry_operation_write_events (
    operation_id,
    canonical_write_event_id
  )
  values (
    v_operation.id,
    v_event_id
  );

  update platform_private.registry_mutation_operations
  set affected_rows=1,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'subject_type','track_artist_credit',
        'subject_id',v_target.subject_id,
        'evidence_assertion_id',v_evidence.id,
        'canonical_write_event_id',v_event_id
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

create function public.admin_admit_registry_track_intake_credit_v1(
  p_suggestion_id uuid,
  p_source_credit_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid;
  v_review jsonb;
  v_source public.registry_provider_track_suggestion_artists%rowtype;
  v_track_id uuid;
  v_future_credit_id uuid;
  v_role text;
  v_display_credit text;
  v_collision jsonb;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_existing_grant platform_private.registry_execution_grants%rowtype;
  v_existing_evidence platform_private.registry_evidence_assertions%rowtype;
  v_execution record;
  v_verification record;
  v_credit public.registry_track_artists%rowtype;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();
  v_review:=platform_private.registry_track_intake_review_snapshot_v1(p_suggestion_id);

  select credit.*
  into v_source
  from public.registry_provider_track_suggestion_artists credit
  where credit.id=p_source_credit_id
    and credit.suggestion_id=p_suggestion_id;

  if not found
     or v_source.resolution_mode<>'existing_artist'
     or v_source.registry_artist_id is null
     or v_source.credit_role not in ('primary','featured')
     or not exists (
       select 1
       from public.registry_artists artist
       where artist.id=v_source.registry_artist_id
         and artist.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Track Intake credit is not a reviewed active existing Artist credit.';
  end if;

  v_track_id:=
    platform_private.registry_track_intake_deterministic_track_uuid_v1(
      p_suggestion_id
    );

  if not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_track_id
         and track.status='draft'
     )
  then
    raise exception using errcode='42501',
      message='Create and verify the Track Intake draft identity before admitting credits.';
  end if;

  v_future_credit_id:=
    platform_private.registry_track_intake_deterministic_credit_uuid_v1(
      p_source_credit_id
    );
  v_role:=case
    when v_source.credit_role='primary' then 'primary_artist'
    else 'featured_artist'
  end;
  v_display_credit:=coalesce(
    nullif(btrim(v_source.observed_name),''),
    (
      select artist.display_name
      from public.registry_artists artist
      where artist.id=v_source.registry_artist_id
    )
  );

  select execution_grant.*
  into v_existing_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_intake_admin'
    and execution_grant.operation_key='registry.track_artist_credit.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=
        'track-intake-credit-v1:'||p_source_credit_id::text;

  if found then
    select assertion.*
    into v_existing_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=
      (v_existing_grant.plan_payload->>'evidence_assertion_id')::uuid;

    if not found
       or v_existing_grant.issued_by_user_id<>v_user_id
       or v_existing_grant.plan_payload->>'credit_id'
            is distinct from v_future_credit_id::text
       or v_existing_grant.plan_payload->>'track_id'
            is distinct from v_track_id::text
       or v_existing_grant.plan_payload->>'artist_id'
            is distinct from v_source.registry_artist_id::text
       or v_existing_grant.plan_payload->>'role'
            is distinct from v_role
       or (v_existing_grant.plan_payload->>'credit_order')::integer
            is distinct from v_source.credit_order
       or v_existing_grant.plan_payload->>'display_credit'
            is distinct from v_display_credit
       or v_existing_evidence.source_payload_fingerprint
            is distinct from v_review->>'review_fingerprint'
    then
      raise exception using errcode='23514',
        message='Track Intake reviewed credit changed after the existing exact grant.';
    end if;

    v_grant_id:=v_existing_grant.id;
  else
    v_collision:=
      platform_private.registry_track_artist_credit_collision_state_v1(
        v_future_credit_id,
        v_track_id,
        v_source.registry_artist_id
      );

    if v_collision<>'[]'::jsonb then
      raise exception using errcode='23505',
        message='A canonical Track Artist credit already exists for this Track and Artist.';
    end if;

    v_evidence_id:=
      platform_private.record_registry_track_intake_credit_evidence_v1(
        p_suggestion_id,
        p_source_credit_id,
        v_future_credit_id,
        v_track_id,
        v_role,
        v_source.credit_order,
        v_display_credit
      );

    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=v_evidence_id;

    v_plan:=jsonb_build_object(
      'operation_key','registry.track_artist_credit.admit',
      'operation_version',1,
      'credit_id',v_future_credit_id,
      'track_id',v_track_id,
      'artist_id',v_source.registry_artist_id,
      'role',v_role,
      'credit_order',v_source.credit_order,
      'display_credit',v_display_credit,
      'confidence',100,
      'collision_state_fingerprint',
        platform_private.registry_relation_collision_fingerprint_v1(
          v_collision
        ),
      'evidence_assertion_id',v_evidence.id,
      'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
      'trust_class',v_evidence.trust_class,
      'policy_ruleset_version','registry-materialization-v1'
    );

    v_grant_id:=
      platform_private.issue_registry_track_intake_credit_grant_v1(
        p_source_credit_id,
        v_evidence.id,
        v_future_credit_id,
        v_plan
      );
  end if;

  select *
  into v_execution
  from platform_private.execute_registry_track_intake_credit_v1(
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_materialization_core_v1(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='Track Intake Artist credit independent verification failed.';
  end if;

  select credit.*
  into v_credit
  from public.registry_track_artists credit
  where credit.id=v_future_credit_id;

  if not found
     or v_credit.status<>'active'
     or v_credit.source<>'track_intake_review'
  then
    raise exception using errcode='23514',
      message='Track Intake Artist credit did not materialize with the expected provenance.';
  end if;

  return jsonb_build_object(
    'created',not v_execution.idempotent_replay,
    'credit',jsonb_build_object(
      'credit_id',v_credit.id,
      'track_id',v_credit.track_id,
      'artist_id',v_credit.artist_id,
      'role',v_credit.role,
      'credit_order',v_credit.credit_order,
      'source',v_credit.source,
      'status',v_credit.status
    ),
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status,
    'idempotent_replay',v_execution.idempotent_replay
  );
end
$$;

revoke all on function
  public.admin_admit_registry_track_intake_credit_v1(uuid,uuid)
  from public,anon,service_role;
grant execute on function
  public.admin_admit_registry_track_intake_credit_v1(uuid,uuid)
  to authenticated;

revoke all on function
  platform_private.registry_track_intake_deterministic_credit_uuid_v1(uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.record_registry_track_intake_credit_evidence_v1(uuid,uuid,uuid,uuid,text,integer,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.issue_registry_track_intake_credit_grant_v1(uuid,uuid,uuid,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.execute_registry_track_intake_credit_v1(uuid)
  from public,anon,authenticated,service_role;

commit;
