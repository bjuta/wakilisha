-- MIZIZI Slice 3 Track Intake Track Activation authority.
--
-- Adds the smallest lifecycle operation required to preserve the accepted
-- Track Intake product semantic: reviewed canonicalization ends with an active
-- Track, while Track identity creation remains independently durable as draft.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-track-intake-track-activation-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.capability_definitions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regprocedure('platform_private.registry_track_intake_current_admin_v1()') is null
     or to_regprocedure('platform_private.registry_track_intake_review_snapshot_v1(uuid)') is null
     or to_regprocedure('platform_private.registry_track_intake_deterministic_track_uuid_v1(uuid)') is null
     or to_regprocedure('platform_private.registry_track_intake_deterministic_credit_uuid_v1(uuid)') is null
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
  then
    raise exception
      'STOP: accepted Track Intake/Registry lifecycle dependency is missing';
  end if;

  if exists (
       select 1
       from public.capability_definitions
       where capability_key='activate_registry_track'
     )
     or exists (
       select 1
       from platform_private.registry_operation_types
       where operation_key='registry.track.activate'
         and operation_version=1
     )
     or to_regprocedure('platform_private.registry_track_intake_activation_credit_state_v1(uuid,uuid)') is not null
     or to_regprocedure('platform_private.record_registry_track_intake_activation_evidence_v1(uuid,uuid,text,text)') is not null
     or to_regprocedure('platform_private.issue_registry_track_intake_activation_grant_v1(uuid,uuid,jsonb,text)') is not null
     or to_regprocedure('platform_private.execute_registry_track_intake_activation_v1(uuid)') is not null
     or to_regprocedure('platform_private.verify_registry_track_intake_activation_v1(uuid)') is not null
     or to_regprocedure('public.admin_activate_registry_track_intake_v1(uuid)') is not null
  then
    raise exception
      'STOP: Track Intake Track Activation authority already exists; audit before reapplying';
  end if;
end
$preflight$;

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values (
  'activate_registry_track',
  'Activate Registry Track',
  'Activate one exact evidence-bound draft Registry Track after its reviewed Track Intake credit set is complete.',
  'registry'
);

insert into platform_private.registry_operation_types (
  operation_key,
  operation_version,
  capability_key,
  risk_class,
  allowed_subject_types,
  requires_existing_target,
  max_targets,
  max_rows_ceiling,
  max_grant_ttl_seconds,
  requires_human_approval,
  requires_verifier,
  enabled,
  description
)
values (
  'registry.track.activate',
  1,
  'activate_registry_track',
  'medium',
  array['track']::text[],
  true,
  1,
  1,
  300,
  true,
  true,
  true,
  'Activate exactly one reviewed draft Registry Track after its exact Track Intake Artist-credit set is present.'
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
          || jsonb_build_array('registry.track.activate/v1')
        )
      ) operation(value)
    ),
    true
  )
where actor_key='registry_track_intake_admin';

create function platform_private.registry_track_intake_activation_credit_state_v1(
  p_suggestion_id uuid,
  p_track_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private,extensions
as $$
declare
  v_source_count integer;
  v_eligible_count integer;
  v_expected jsonb;
  v_actual jsonb;
  v_expected_fingerprint text;
begin
  select count(*)::integer
  into v_source_count
  from public.registry_provider_track_suggestion_artists source_credit
  where source_credit.suggestion_id=p_suggestion_id;

  select count(*)::integer
  into v_eligible_count
  from public.registry_provider_track_suggestion_artists source_credit
  join public.registry_artists artist
    on artist.id=source_credit.registry_artist_id
  where source_credit.suggestion_id=p_suggestion_id
    and source_credit.resolution_mode='existing_artist'
    and source_credit.credit_role in ('primary','featured')
    and artist.status='active';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'credit_id',
          platform_private.registry_track_intake_deterministic_credit_uuid_v1(
            source_credit.id
          ),
        'artist_id',source_credit.registry_artist_id,
        'role',case
          when source_credit.credit_role='primary'
            then 'primary_artist'
          else 'featured_artist'
        end,
        'credit_order',source_credit.credit_order,
        'display_credit',coalesce(
          nullif(btrim(source_credit.observed_name),''),
          artist.display_name
        ),
        'source','track_intake_review',
        'status','active'
      )
      order by source_credit.credit_order,source_credit.id
    ),
    '[]'::jsonb
  )
  into v_expected
  from public.registry_provider_track_suggestion_artists source_credit
  join public.registry_artists artist
    on artist.id=source_credit.registry_artist_id
  where source_credit.suggestion_id=p_suggestion_id
    and source_credit.resolution_mode='existing_artist'
    and source_credit.credit_role in ('primary','featured')
    and artist.status='active';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'credit_id',credit.id,
        'artist_id',credit.artist_id,
        'role',credit.role,
        'credit_order',credit.credit_order,
        'display_credit',credit.display_credit,
        'source',credit.source,
        'status',credit.status
      )
      order by credit.credit_order,credit.id
    ),
    '[]'::jsonb
  )
  into v_actual
  from public.registry_track_artists credit
  where credit.track_id=p_track_id
    and credit.status='active';

  v_expected_fingerprint:=encode(
    extensions.digest(v_expected::text,'sha256'),
    'hex'
  );

  return jsonb_build_object(
    'source_count',v_source_count,
    'eligible_count',v_eligible_count,
    'expected',v_expected,
    'actual',v_actual,
    'expected_fingerprint',v_expected_fingerprint,
    'matches',
      v_source_count>0
      and v_source_count=v_eligible_count
      and v_expected=v_actual
  );
end
$$;

create function platform_private.record_registry_track_intake_activation_evidence_v1(
  p_suggestion_id uuid,
  p_track_id uuid,
  p_review_fingerprint text,
  p_credit_set_fingerprint text
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

  if nullif(btrim(p_review_fingerprint),'') is null
     or nullif(btrim(p_credit_set_fingerprint),'') is null
  then
    raise exception using errcode='22023',
      message='Track Intake activation requires exact review and credit-set fingerprints.';
  end if;

  v_claim:=jsonb_build_object(
    'suggestion_id',p_suggestion_id,
    'track_id',p_track_id,
    'from_status','draft',
    'to_status','active',
    'review_fingerprint',p_review_fingerprint,
    'credit_set_fingerprint',p_credit_set_fingerprint
  );

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','track',
        'subject_id',p_track_id::text,
        'claim_key','registry.track.lifecycle.activate',
        'claim_payload',v_claim,
        'trust_class','INTERNAL_FACT',
        'source_kind','track_intake_review',
        'source_ref','track-intake-activation:'||p_suggestion_id::text,
        'source_payload_fingerprint',p_review_fingerprint,
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
    'track',
    p_track_id,
    'registry.track.lifecycle.activate',
    v_claim,
    'INTERNAL_FACT',
    'track_intake_review',
    'track-intake-activation:'||p_suggestion_id::text,
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

create function platform_private.issue_registry_track_intake_activation_grant_v1(
  p_suggestion_id uuid,
  p_evidence_assertion_id uuid,
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
  v_track_id uuid;
  v_grant_id uuid;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();
  v_track_id:=(p_plan_payload->>'track_id')::uuid;

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.track.activate'
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or v_operation_type.capability_key<>'activate_registry_track'
     or not ('track'=any(v_operation_type.allowed_subject_types))
     or not v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<1
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Track Activate V1 operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>v_track_id
     or v_evidence.claim_key<>'registry.track.lifecycle.activate'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.source_ref<>'track-intake-activation:'||p_suggestion_id::text
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Track Intake activation evidence is not bound to this exact review and caller.';
  end if;

  if p_plan_payload->>'operation_key'<>'registry.track.activate'
     or coalesce((p_plan_payload->>'operation_version')::integer,0)<>1
     or p_plan_payload->>'evidence_assertion_id' is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint' is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'trust_class' is distinct from v_evidence.trust_class
     or p_plan_payload->>'expected_state_fingerprint'
          is distinct from p_expected_state_fingerprint
     or p_plan_payload->>'policy_ruleset_version'<>'registry-track-activate-v1'
  then
    raise exception using errcode='42501',
      message='Track Intake activation plan is not bound to current evidence authority.';
  end if;

  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(p_plan_payload);
  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','track',
          'subject_id',v_track_id::text,
          'expected_state_fingerprint',p_expected_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );
  v_idempotency_key:='track-intake-activate-v1:'||p_suggestion_id::text;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_intake_admin'
    and execution_grant.operation_key='registry.track.activate'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.max_rows<>1
    then
      raise exception using errcode='23505',
        message='Track Intake activation idempotency key is bound to different authority.';
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
    'activate_registry_track',
    null,
    'registry.track.activate',
    1,
    p_plan_payload,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-track-activate-v1',
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
    'track',
    v_track_id,
    p_expected_state_fingerprint
  );

  return v_grant_id;
end
$$;

create function platform_private.execute_registry_track_intake_activation_v1(
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
  v_review jsonb;
  v_credit_state jsonb;
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
     or v_grant.operation_key<>'registry.track.activate'
     or v_grant.operation_version<>1
     or v_grant.capability_key<>'activate_registry_track'
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>'registry-track-activate-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Track Intake Track Activate V1 grant.';
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
      message='Track Activate V1 requires one exact existing Track target.';
  end if;

  v_plan:=v_grant.plan_payload;

  if (v_plan-array[
       'operation_key','operation_version','track_id',
       'suggestion_id','review_fingerprint','credit_set_fingerprint',
       'expected_state_fingerprint',
       'evidence_assertion_id','evidence_assertion_fingerprint',
       'trust_class','policy_ruleset_version'
     ]::text[])<>'{}'::jsonb
     or v_plan->>'operation_key'<>'registry.track.activate'
     or coalesce((v_plan->>'operation_version')::integer,0)<>1
     or (v_plan->>'track_id')::uuid<>v_target.subject_id
     or v_plan->>'expected_state_fingerprint'
          is distinct from v_target.expected_state_fingerprint
  then
    raise exception using errcode='42501',
      message='Track Intake Track Activate V1 plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>v_target.subject_id
     or v_evidence.claim_key<>'registry.track.lifecycle.activate'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.assertion_fingerprint is distinct from
        v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.recorded_by_principal_key is distinct from
        v_grant.issued_by_principal_key
  then
    raise exception using errcode='42501',
      message='Track Intake activation evidence no longer satisfies the exact grant.';
  end if;

  v_review:=
    platform_private.registry_track_intake_review_snapshot_v1(
      (v_plan->>'suggestion_id')::uuid
    );

  if v_review->>'review_fingerprint'
       is distinct from v_plan->>'review_fingerprint'
     or v_evidence.source_payload_fingerprint
       is distinct from v_review->>'review_fingerprint'
  then
    raise exception using errcode='23514',
      message='Track Intake review changed before Track activation.';
  end if;

  v_credit_state:=
    platform_private.registry_track_intake_activation_credit_state_v1(
      (v_plan->>'suggestion_id')::uuid,
      v_target.subject_id
    );

  if coalesce((v_credit_state->>'matches')::boolean,false) is not true
     or v_credit_state->>'expected_fingerprint'
          is distinct from v_plan->>'credit_set_fingerprint'
  then
    raise exception using errcode='23514',
      message='Track Intake reviewed Artist credits do not exactly match canonical Track credits.';
  end if;

  v_current_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'track',
      v_target.subject_id
    );

  if v_current_fingerprint is distinct from
       v_target.expected_state_fingerprint
  then
    raise exception using errcode='23514',
      message='Track state changed after activation grant issuance.';
  end if;

  select to_jsonb(track)
  into v_before
  from public.registry_tracks track
  where track.id=v_target.subject_id
  for update;

  if v_before is null
     or v_before->>'status'<>'draft'
  then
    raise exception using errcode='23514',
      message='Track Intake activation requires the exact draft Track.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  update public.registry_tracks
  set status='active',
      updated_at=now()
  where id=v_target.subject_id
    and status='draft';

  get diagnostics v_rows=row_count;

  select to_jsonb(track)
  into v_after
  from public.registry_tracks track
  where track.id=v_target.subject_id;

  if v_rows<>1
     or (v_before-'status'-'updated_at')
          is distinct from
        (v_after-'status'-'updated_at')
     or v_after->>'status'<>'active'
  then
    raise exception using errcode='23514',
      message='Track activation exceeded the exact lifecycle boundary.';
  end if;

  v_after_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'track',
      v_target.subject_id
    );

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
    'track',
    v_target.subject_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'status',
    'public.registry_tracks.status',
    jsonb_build_object('status','draft'),
    jsonb_build_object('status','active'),
    'activate',
    'succeeded',
    'system:registry_track_intake_admin'
  )
  returning id into v_event_id;

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

create function platform_private.verify_registry_track_intake_activation_v1(
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
     or v_operation.operation_key<>'registry.track.activate'
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Track Intake Track Activate V1 operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded'
     or v_operation.affected_rows<>1
  then
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
       or v_grant.operation_key<>'registry.track.activate'
       or v_grant.operation_version<>1
       or v_grant.policy_ruleset_version<>'registry-track-activate-v1'
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

  if v_failure is null
     and not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_target.subject_id
         and track.status='active'
     )
  then
    v_failure:='canonical_track_not_active';
  end if;

  if v_failure is null then
    v_current_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        'track',
        v_target.subject_id
      );

    if v_current_fingerprint is distinct from
       v_operation.result_payload->>'after_state_fingerprint'
    then
      v_failure:='canonical_track_state_changed_after_activation';
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
      and event.field_name='status'
      and event.target_path='public.registry_tracks.status'
      and event.action='activate'
      and event.status='succeeded'
      and event.actor='system:registry_track_intake_admin'
      and event.before_value=jsonb_build_object('status','draft')
      and event.after_value=jsonb_build_object('status','active');

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
              'status','passed',
              'verified_at',now()
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
      error_code='registry_track_activation_verification_failed',
      error_message=v_failure,
      result_payload=
        result_payload||
        jsonb_build_object(
          'verification',
          jsonb_build_object(
            'status','failed',
            'reason',v_failure,
            'verified_at',now()
          )
        ),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  verifier_status:='failed';
  return next;
end
$$;

create function public.admin_activate_registry_track_intake_v1(
  p_suggestion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid;
  v_review jsonb;
  v_track_id uuid;
  v_credit_state jsonb;
  v_expected_state_fingerprint text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_existing_grant platform_private.registry_execution_grants%rowtype;
  v_existing_evidence platform_private.registry_evidence_assertions%rowtype;
  v_execution record;
  v_verification record;
  v_track public.registry_tracks%rowtype;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();
  v_review:=platform_private.registry_track_intake_review_snapshot_v1(
    p_suggestion_id
  );
  v_track_id:=
    platform_private.registry_track_intake_deterministic_track_uuid_v1(
      p_suggestion_id
    );

  select execution_grant.*
  into v_existing_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_intake_admin'
    and execution_grant.operation_key='registry.track.activate'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=
        'track-intake-activate-v1:'||p_suggestion_id::text;

  if found then
    select assertion.*
    into v_existing_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=
      (v_existing_grant.plan_payload->>'evidence_assertion_id')::uuid;

    if not found
       or v_existing_grant.issued_by_user_id<>v_user_id
       or v_existing_grant.plan_payload->>'track_id'
            is distinct from v_track_id::text
       or v_existing_grant.plan_payload->>'review_fingerprint'
            is distinct from v_review->>'review_fingerprint'
       or v_existing_evidence.source_payload_fingerprint
            is distinct from v_review->>'review_fingerprint'
    then
      raise exception using errcode='23514',
        message='Track Intake review changed after the existing activation grant.';
    end if;

    v_grant_id:=v_existing_grant.id;
  else
    if not exists (
         select 1
         from public.registry_tracks track
         where track.id=v_track_id
           and track.status='draft'
       )
    then
      raise exception using errcode='42501',
        message='Track Intake activation requires the verified draft Track.';
    end if;

    v_credit_state:=
      platform_private.registry_track_intake_activation_credit_state_v1(
        p_suggestion_id,
        v_track_id
      );

    if coalesce((v_credit_state->>'matches')::boolean,false) is not true then
      raise exception using errcode='23514',
        message='Track Intake reviewed Artist credits do not exactly match canonical Track credits.';
    end if;

    v_expected_state_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        'track',
        v_track_id
      );

    if v_expected_state_fingerprint is null then
      raise exception using errcode='23514',
        message='Track Intake draft Track state fingerprint is missing.';
    end if;

    v_evidence_id:=
      platform_private.record_registry_track_intake_activation_evidence_v1(
        p_suggestion_id,
        v_track_id,
        v_review->>'review_fingerprint',
        v_credit_state->>'expected_fingerprint'
      );

    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=v_evidence_id;

    v_plan:=jsonb_build_object(
      'operation_key','registry.track.activate',
      'operation_version',1,
      'track_id',v_track_id,
      'suggestion_id',p_suggestion_id,
      'review_fingerprint',v_review->>'review_fingerprint',
      'credit_set_fingerprint',v_credit_state->>'expected_fingerprint',
      'expected_state_fingerprint',v_expected_state_fingerprint,
      'evidence_assertion_id',v_evidence.id,
      'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
      'trust_class',v_evidence.trust_class,
      'policy_ruleset_version','registry-track-activate-v1'
    );

    v_grant_id:=
      platform_private.issue_registry_track_intake_activation_grant_v1(
        p_suggestion_id,
        v_evidence.id,
        v_plan,
        v_expected_state_fingerprint
      );
  end if;

  select *
  into v_execution
  from platform_private.execute_registry_track_intake_activation_v1(
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_track_intake_activation_v1(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='Track Intake Track activation independent verification failed.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=v_track_id;

  if not found
     or v_track.status<>'active'
  then
    raise exception using errcode='23514',
      message='Track Intake Track did not materialize as active.';
  end if;

  return jsonb_build_object(
    'activated',not v_execution.idempotent_replay,
    'track',jsonb_build_object(
      'track_id',v_track.id,
      'track_slug',v_track.slug,
      'track_title',v_track.title,
      'status',v_track.status
    ),
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status,
    'idempotent_replay',v_execution.idempotent_replay
  );
end
$$;

revoke all on function
  public.admin_activate_registry_track_intake_v1(uuid)
  from public,anon,service_role;
grant execute on function
  public.admin_activate_registry_track_intake_v1(uuid)
  to authenticated;

revoke all on function
  platform_private.registry_track_intake_activation_credit_state_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.record_registry_track_intake_activation_evidence_v1(uuid,uuid,text,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.issue_registry_track_intake_activation_grant_v1(uuid,uuid,jsonb,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.execute_registry_track_intake_activation_v1(uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.verify_registry_track_intake_activation_v1(uuid)
  from public,anon,authenticated,service_role;

commit;
