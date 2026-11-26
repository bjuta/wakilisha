-- Complete chart-origin Artist Intake grant convergence.
-- Forward repair only; preserve the original typed materialization authority.
begin;
do $preflight$
begin
  if md5(pg_get_functiondef('platform_private.issue_registry_artist_intake_create_grant_v1(uuid,uuid,uuid,jsonb)'::regprocedure))
       is distinct from '339c6f0bc02385b421e5c5450e0e085b'
     or md5(pg_get_functiondef('platform_private.record_registry_artist_intake_creation_evidence_v1(uuid,uuid,text,text,text)'::regprocedure))
       is distinct from '49455a1a6b821ef6b35d6585dfb712e8'
     or md5(pg_get_functiondef('platform_private.registry_artist_intake_review_snapshot_v1(uuid)'::regprocedure))
       is distinct from '3ebac8ef2d6762188ee7f243a8a707c2'
  then
    raise exception 'STOP: Artist Intake grant/evidence/review preimage drifted';
  end if;
end
$preflight$;

CREATE OR REPLACE FUNCTION platform_private.issue_registry_artist_intake_create_grant_v1(p_staging_id uuid, p_evidence_assertion_id uuid, p_future_artist_id uuid, p_plan_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private', 'auth', 'extensions'
AS $function$
declare
  v_user_id uuid;
  v_review jsonb;
  v_provider text;
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_idempotency_key text;
  v_grant_id uuid;
begin
  v_user_id:=platform_private.registry_artist_intake_current_admin_v1();

  -- Resolve the source from the current accepted, unapplied, receipt-bound
  -- review. Never infer source authority from evidence or a caller argument.
  v_review:=platform_private.registry_artist_intake_review_snapshot_v1(p_staging_id);
  select run.provider into v_provider
  from public.provider_intake_runs run
  where run.id=(v_review->>'intake_run_id')::uuid
    and run.mode='artist_intake'
    and run.provider_entity_type='artist'
    and run.provider in ('csv_manual_upload','charts2_chart_observation');
  if not found
     or v_review->>'match_status' is distinct from 'no_match'
     or v_review->>'target_registry_artist_id' is not null
     or p_future_artist_id is distinct from
        platform_private.registry_artist_intake_deterministic_uuid_v1(p_staging_id)
  then
    raise exception using errcode='42501',
      message='Artist intake grant requires the exact reviewed no-match identity.';
  end if;
  if v_provider='charts2_chart_observation' then
    perform platform_private.assert_charts2_artist_intake_receipt_v1(p_staging_id);
  end if;

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.artist.create'
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or v_operation_type.capability_key<>'create_registry_artist'
     or not ('artist'=any(v_operation_type.allowed_subject_types))
     or v_operation_type.max_rows_ceiling<1
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501', message='Registry Artist creation operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.subject_id<>p_future_artist_id
     or v_evidence.claim_key<>'registry.artist.identity.create'
     or v_evidence.trust_class<>'EXTERNAL_EVIDENCE'
     or v_evidence.source_kind is distinct from v_provider
     or v_evidence.source_payload_fingerprint is distinct from v_review->>'review_fingerprint'
     or v_evidence.source_ref<>'artist-intake-staging:'||p_staging_id::text
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501', message='Artist intake creation evidence is not bound to this exact review and caller.';
  end if;

  if p_plan_payload->>'operation_key'<>'registry.artist.create'
     or coalesce((p_plan_payload->>'operation_version')::integer,0)<>1
     or p_plan_payload->>'evidence_assertion_id' is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint' is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'trust_class' is distinct from v_evidence.trust_class
     or p_plan_payload->>'policy_ruleset_version'<>'registry-materialization-v1'
  then
    raise exception using errcode='42501', message='Artist intake creation plan is not bound to current evidence authority.';
  end if;

  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(p_plan_payload);
  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','artist',
          'subject_id',p_future_artist_id::text,
          'expected_state_fingerprint',null
        )
      )::text,
      'sha256'
    ),
    'hex'
  );
  v_idempotency_key:='artist-intake-create:'||p_staging_id::text;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_artist_intake_admin'
    and execution_grant.operation_key='registry.artist.create'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.max_rows<>1
    then
      raise exception using errcode='23505', message='Artist intake idempotency key is bound to different authority.';
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
  ) values (
    'registry_artist_intake_admin',
    'create_registry_artist',
    null,
    'registry.artist.create',
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
  ) values (
    v_grant_id,
    'artist',
    p_future_artist_id,
    null
  );

  return v_grant_id;
end
$function$;

-- The existing public RPC, owner, ACL, broker, verifier and typed writer
-- remain unchanged; the private issuer is not exposed as an RPC.
commit;
