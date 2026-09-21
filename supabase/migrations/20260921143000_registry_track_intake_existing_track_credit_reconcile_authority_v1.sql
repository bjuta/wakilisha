-- MIZIZI Slice 3 Track Intake reviewed Artist-credit reconciliation authority.
--
-- Reconciles one reviewed Track Intake Artist credit against one existing
-- active Registry Track without deleting unrelated credits or resurrecting
-- archived history. Each reviewed source credit is independently durable.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-track-intake-existing-track-credit-reconcile-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.capability_definitions') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regprocedure('platform_private.registry_track_intake_current_admin_v1()') is null
     or to_regprocedure('platform_private.registry_track_intake_credit_review_snapshot_v1(uuid,uuid)') is null
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
  then
    raise exception
      'STOP: accepted Track Intake/Registry reconciliation dependency is missing';
  end if;

  if exists (
       select 1 from public.capability_definitions
       where capability_key='reconcile_registry_track_reviewed_artist_credit'
     )
     or exists (
       select 1 from platform_private.registry_operation_types
       where operation_key='registry.track_artist_credit.reviewed_reconcile'
         and operation_version=1
     )
     or to_regprocedure('platform_private.registry_track_intake_existing_credit_candidate_state_v1(uuid,uuid,uuid,text)') is not null
     or to_regprocedure('platform_private.registry_track_intake_existing_credit_candidate_fingerprint_v1(jsonb)') is not null
     or to_regprocedure('platform_private.registry_track_intake_reconciled_credit_uuid_v1(uuid,uuid)') is null
     or to_regprocedure('platform_private.record_registry_track_intake_existing_credit_evidence_v1(uuid,uuid,uuid,jsonb,text)') is not null
     or to_regprocedure('platform_private.issue_registry_track_intake_existing_credit_grant_v1(uuid,uuid,jsonb,text)') is not null
     or to_regprocedure('platform_private.execute_registry_track_intake_existing_credit_reconcile_v1(uuid)') is not null
     or to_regprocedure('platform_private.verify_registry_track_intake_existing_credit_reconcile_v1(uuid)') is not null
     or to_regprocedure('public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)') is not null
  then
    raise exception
      'STOP: Track Intake existing-Track credit reconciliation authority already exists; audit before reapplying';
  end if;
end
$preflight$;

insert into public.capability_definitions (
  capability_key,label,description,domain
)
values (
  'reconcile_registry_track_reviewed_artist_credit',
  'Reconcile Registry Track reviewed Artist credit',
  'Reconcile one exact reviewed Track Intake Artist credit against one existing draft or active Registry Track without deleting unrelated credits.',
  'registry'
);

insert into platform_private.registry_operation_types (
  operation_key,operation_version,capability_key,risk_class,
  allowed_subject_types,requires_existing_target,max_targets,
  max_rows_ceiling,max_grant_ttl_seconds,requires_human_approval,
  requires_verifier,enabled,description
)
values (
  'registry.track_artist_credit.reviewed_reconcile',
  1,
  'reconcile_registry_track_reviewed_artist_credit',
  'high',
  array['track']::text[],
  true,
  1,
  1,
  300,
  true,
  true,
  true,
  'Reconcile one reviewed Track Intake Artist credit against one existing Track while preserving unrelated Track credits.'
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
          || jsonb_build_array(
               'registry.track_artist_credit.reviewed_reconcile/v1'
             )
        )
      ) operation(value)
    ),
    true
  )
where actor_key='registry_track_intake_admin';

create function platform_private.registry_track_intake_existing_credit_candidate_state_v1(
  p_track_id uuid,
  p_source_credit_id uuid,
  p_artist_id uuid,
  p_artist_slug text
)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public
as $$
  select coalesce(
    jsonb_agg(
      to_jsonb(credit)
      order by
        case credit.status
          when 'active' then 0
          when 'needs_review' then 1
          when 'draft' then 2
          else 3
        end,
        case when credit.artist_id=p_artist_id then 0 else 1 end,
        credit.created_at,
        credit.id
    ),
    '[]'::jsonb
  )
  from public.registry_track_artists credit
  where credit.track_id=p_track_id
    and credit.status in ('active','needs_review','draft')
    and (
      credit.metadata->>'source_credit_id'=p_source_credit_id::text
      or credit.artist_id=p_artist_id
      or (
        nullif(btrim(p_artist_slug),'') is not null
        and lower(coalesce(credit.artist_slug,''))
            =lower(btrim(p_artist_slug))
      )
    );
$$;

create function platform_private.registry_track_intake_existing_credit_candidate_fingerprint_v1(
  p_state jsonb
)
returns text
language sql
immutable
security definer
set search_path=pg_catalog,extensions
as $$
  select encode(
    extensions.digest(
      coalesce(p_state,'[]'::jsonb)::text,
      'sha256'
    ),
    'hex'
  );
$$;

create function platform_private.record_registry_track_intake_existing_credit_evidence_v1(
  p_suggestion_id uuid,
  p_source_credit_id uuid,
  p_track_id uuid,
  p_desired jsonb,
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

  if p_desired is null
     or jsonb_typeof(p_desired)<>'object'
     or nullif(btrim(p_review_fingerprint),'') is null
  then
    raise exception using errcode='22023',
      message='Reviewed credit evidence requires exact desired state and review fingerprint.';
  end if;

  v_claim:=jsonb_build_object(
    'suggestion_id',p_suggestion_id,
    'source_credit_id',p_source_credit_id,
    'track_id',p_track_id,
    'desired',p_desired,
    'review_fingerprint',p_review_fingerprint
  );

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','track',
        'subject_id',p_track_id::text,
        'claim_key','registry.track_artist_credit.reviewed_reconcile',
        'claim_payload',v_claim,
        'trust_class','INTERNAL_FACT',
        'source_kind','track_intake_review',
        'source_ref','track-intake-existing-credit:'||p_source_credit_id::text,
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
    'registry.track_artist_credit.reviewed_reconcile',
    v_claim,
    'INTERNAL_FACT',
    'track_intake_review',
    'track-intake-existing-credit:'||p_source_credit_id::text,
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

create function platform_private.issue_registry_track_intake_existing_credit_grant_v1(
  p_evidence_assertion_id uuid,
  p_track_id uuid,
  p_plan_payload jsonb,
  p_expected_track_state_fingerprint text
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
  v_idempotency_hash text;
  v_idempotency_key text;
  v_grant_id uuid;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key=
        'registry.track_artist_credit.reviewed_reconcile'
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or v_operation_type.capability_key<>
        'reconcile_registry_track_reviewed_artist_credit'
     or not ('track'=any(v_operation_type.allowed_subject_types))
     or not v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<>1
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Track reviewed-credit reconciliation operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>p_track_id
     or v_evidence.claim_key<>
        'registry.track_artist_credit.reviewed_reconcile'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Track Intake reviewed-credit evidence is not bound to this exact caller and Track.';
  end if;

  if p_plan_payload->>'operation_key'
       <>'registry.track_artist_credit.reviewed_reconcile'
     or coalesce((p_plan_payload->>'operation_version')::integer,0)<>1
     or p_plan_payload->>'track_id' is distinct from p_track_id::text
     or p_plan_payload->>'expected_track_state_fingerprint'
          is distinct from p_expected_track_state_fingerprint
     or p_plan_payload->>'evidence_assertion_id'
          is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint'
          is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'trust_class'
          is distinct from v_evidence.trust_class
     or p_plan_payload->>'policy_ruleset_version'
          <>'registry-track-intake-credit-reconcile-v1'
  then
    raise exception using errcode='42501',
      message='Track Intake reviewed-credit plan is not bound to current evidence authority.';
  end if;

  v_plan_fingerprint:=
    platform_private.registry_plan_fingerprint(p_plan_payload);
  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','track',
          'subject_id',p_track_id::text,
          'expected_state_fingerprint',
            p_expected_track_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );

  v_idempotency_hash:=encode(
    extensions.digest(
      p_track_id::text||':'||
      (p_plan_payload->>'source_credit_id')||':'||
      (p_plan_payload->>'review_fingerprint'),
      'sha256'
    ),
    'hex'
  );
  v_idempotency_key:='track-credit-reconcile-v1:'||v_idempotency_hash;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_intake_admin'
    and execution_grant.operation_key=
        'registry.track_artist_credit.reviewed_reconcile'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.max_rows<>1
    then
      raise exception using errcode='23505',
        message='Track Intake reviewed-credit idempotency key is bound to different authority.';
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
    'reconcile_registry_track_reviewed_artist_credit',
    null,
    'registry.track_artist_credit.reviewed_reconcile',
    1,
    p_plan_payload,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-track-intake-credit-reconcile-v1',
    'manage_registry',
    now(),
    now()+interval '5 minutes'
  )
  returning id into v_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,subject_type,subject_id,expected_state_fingerprint
  )
  values (
    v_grant_id,'track',p_track_id,p_expected_track_state_fingerprint
  );

  return v_grant_id;
end
$$;

create function platform_private.execute_registry_track_intake_existing_credit_reconcile_v1(
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
  v_desired jsonb;
  v_review jsonb;
  v_candidate_state jsonb;
  v_candidate_fingerprint text;
  v_candidate_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_after_fingerprint text;
  v_event_id uuid;
  v_rows integer:=0;
  v_mode text;
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

  if not found
     or v_operation.status<>'authorized'
     or v_grant.actor_key<>'registry_track_intake_admin'
     or v_grant.operation_key<>
        'registry.track_artist_credit.reviewed_reconcile'
     or v_grant.operation_version<>1
     or v_grant.capability_key<>
        'reconcile_registry_track_reviewed_artist_credit'
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>
        'registry-track-intake-credit-reconcile-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Track Intake reviewed-credit reconciliation grant.';
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
      message='Reviewed-credit reconciliation requires one exact existing Track target.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_desired:=v_plan->'desired';

  if (v_plan-array[
       'operation_key','operation_version','suggestion_id',
       'source_credit_id','track_id','desired',
       'review_fingerprint','candidate_state_fingerprint',
       'expected_track_state_fingerprint',
       'evidence_assertion_id','evidence_assertion_fingerprint',
       'trust_class','policy_ruleset_version'
     ]::text[])<>'{}'::jsonb
     or v_plan->>'operation_key'
          <>'registry.track_artist_credit.reviewed_reconcile'
     or coalesce((v_plan->>'operation_version')::integer,0)<>1
     or (v_plan->>'track_id')::uuid<>v_target.subject_id
     or v_plan->>'expected_track_state_fingerprint'
          is distinct from v_target.expected_state_fingerprint
     or (v_desired-array[
          'relation_id','artist_id','artist_slug','artist_name_text',
          'role','is_primary','is_featured','credit_order',
          'display_credit','source','confidence','status','metadata'
        ]::text[])<>'{}'::jsonb
     or v_desired->>'source'<>'track_intake_review'
     or v_desired->>'status'<>'active'
     or (v_desired->>'track_id') is not null
     or (v_desired->>'confidence')::integer<>100
  then
    raise exception using errcode='42501',
      message='Track Intake reviewed-credit reconciliation plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>v_target.subject_id
     or v_evidence.claim_key<>
        'registry.track_artist_credit.reviewed_reconcile'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.assertion_fingerprint
          is distinct from v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.recorded_by_principal_key
          is distinct from v_grant.issued_by_principal_key
  then
    raise exception using errcode='42501',
      message='Track Intake reviewed-credit evidence no longer satisfies the exact grant.';
  end if;

  v_review:=
    platform_private.registry_track_intake_credit_review_snapshot_v1(
      (v_plan->>'suggestion_id')::uuid,
      (v_plan->>'source_credit_id')::uuid
    );

  if v_review->>'review_fingerprint'
       is distinct from v_plan->>'review_fingerprint'
     or v_evidence.source_payload_fingerprint
       is distinct from v_review->>'review_fingerprint'
  then
    raise exception using errcode='23514',
      message='Track Intake reviewed Artist credit changed before reconciliation.';
  end if;

  if platform_private.registry_subject_state_fingerprint(
       'track',v_target.subject_id
     ) is distinct from v_target.expected_state_fingerprint
  then
    raise exception using errcode='23514',
      message='Registry Track changed after reviewed-credit grant issuance.';
  end if;

  if not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_target.subject_id
         and track.status in ('draft','active')
     )
  then
    raise exception using errcode='42501',
      message='Reviewed-credit reconciliation requires an existing draft or active Registry Track.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry.track_artist_credit.reviewed_reconcile:'||
      v_target.subject_id::text||':'||
      (v_desired->>'artist_id'),
      0
    )
  );

  v_candidate_state:=
    platform_private.registry_track_intake_existing_credit_candidate_state_v1(
      v_target.subject_id,
      (v_plan->>'source_credit_id')::uuid,
      (v_desired->>'artist_id')::uuid,
      v_desired->>'artist_slug'
    );
  v_candidate_fingerprint:=
    platform_private.registry_track_intake_existing_credit_candidate_fingerprint_v1(
      v_candidate_state
    );

  if v_candidate_fingerprint
       is distinct from v_plan->>'candidate_state_fingerprint'
  then
    raise exception using errcode='23514',
      message='Registry Track Artist-credit candidate state changed after grant issuance.';
  end if;

  if jsonb_array_length(v_candidate_state)>1 then
    raise exception using errcode='23514',
      message='Existing Registry Track has ambiguous live/reviewable Artist-credit candidates.';
  end if;

  if jsonb_array_length(v_candidate_state)=1 then
    v_candidate_id:=(v_candidate_state->0->>'id')::uuid;

    select to_jsonb(credit)
    into v_before
    from public.registry_track_artists credit
    where credit.id=v_candidate_id
    for update;

    if v_before is null then
      raise exception using errcode='23514',
        message='Reviewed Artist-credit candidate disappeared before reconciliation.';
    end if;

    if v_before->>'track_id'=v_target.subject_id::text
       and v_before->>'artist_id'=v_desired->>'artist_id'
       and v_before->>'artist_slug' is not distinct from v_desired->>'artist_slug'
       and v_before->>'artist_name_text' is not distinct from v_desired->>'artist_name_text'
       and v_before->>'role'=v_desired->>'role'
       and (v_before->>'is_primary')::boolean=(v_desired->>'is_primary')::boolean
       and (v_before->>'is_featured')::boolean=(v_desired->>'is_featured')::boolean
       and (v_before->>'credit_order')::integer=(v_desired->>'credit_order')::integer
       and v_before->>'display_credit' is not distinct from v_desired->>'display_credit'
       and v_before->>'source'='track_intake_review'
       and (v_before->>'confidence')::integer=100
       and v_before->>'status'='active'
       and v_before->'metadata'->>'source_credit_id'=
           (v_plan->>'source_credit_id')
    then
      v_mode:='already_current';
      v_rows:=0;
    else
      if exists (
           select 1
           from public.registry_track_artists collision
           where collision.track_id=v_target.subject_id
             and collision.id<>v_candidate_id
             and collision.status='active'
             and (
               collision.artist_id=(v_desired->>'artist_id')::uuid
               or lower(coalesce(collision.artist_slug,''))
                  =lower(v_desired->>'artist_slug')
             )
         )
      then
        raise exception using errcode='23505',
          message='Reviewed Artist-credit reconciliation collides with another active Track credit.';
      end if;

      update platform_private.registry_mutation_operations
      set status='executing',
          started_at=coalesce(started_at,now()),
          updated_at=now()
      where id=v_operation.id;

      update public.registry_track_artists credit
      set artist_id=(v_desired->>'artist_id')::uuid,
          artist_slug=v_desired->>'artist_slug',
          artist_name_text=v_desired->>'artist_name_text',
          role=v_desired->>'role',
          is_primary=(v_desired->>'is_primary')::boolean,
          is_featured=(v_desired->>'is_featured')::boolean,
          credit_order=(v_desired->>'credit_order')::integer,
          display_credit=v_desired->>'display_credit',
          source='track_intake_review',
          confidence=100,
          status='active',
          metadata=coalesce(credit.metadata,'{}'::jsonb)
            || coalesce(v_desired->'metadata','{}'::jsonb),
          updated_at=now()
      where credit.id=v_candidate_id;

      get diagnostics v_rows=row_count;
      v_mode:='updated';
    end if;
  else
    v_candidate_id:=(v_desired->>'relation_id')::uuid;

    if exists (
         select 1
         from public.registry_track_artists collision
         where collision.id=v_candidate_id
            or (
              collision.track_id=v_target.subject_id
              and collision.status='active'
              and (
                collision.artist_id=(v_desired->>'artist_id')::uuid
                or lower(coalesce(collision.artist_slug,''))
                   =lower(v_desired->>'artist_slug')
              )
            )
       )
    then
      raise exception using errcode='23505',
        message='Reviewed Artist-credit insertion collides with existing Registry relation state.';
    end if;

    update platform_private.registry_mutation_operations
    set status='executing',
        started_at=coalesce(started_at,now()),
        updated_at=now()
    where id=v_operation.id;

    insert into public.registry_track_artists (
      id,track_id,artist_id,artist_slug,artist_name_text,
      role,is_primary,is_featured,credit_order,display_credit,
      source,confidence,status,metadata
    )
    values (
      v_candidate_id,
      v_target.subject_id,
      (v_desired->>'artist_id')::uuid,
      v_desired->>'artist_slug',
      v_desired->>'artist_name_text',
      v_desired->>'role',
      (v_desired->>'is_primary')::boolean,
      (v_desired->>'is_featured')::boolean,
      (v_desired->>'credit_order')::integer,
      v_desired->>'display_credit',
      'track_intake_review',
      100,
      'active',
      coalesce(v_desired->'metadata','{}'::jsonb)
    );

    get diagnostics v_rows=row_count;
    v_mode:='inserted';
  end if;

  select to_jsonb(credit)
  into v_after
  from public.registry_track_artists credit
  where credit.id=v_candidate_id;

  if v_after is null
     or v_after->>'track_id'<>v_target.subject_id::text
     or v_after->>'artist_id'<>v_desired->>'artist_id'
     or v_after->>'artist_slug' is distinct from v_desired->>'artist_slug'
     or v_after->>'artist_name_text' is distinct from v_desired->>'artist_name_text'
     or v_after->>'role'<>v_desired->>'role'
     or (v_after->>'is_primary')::boolean<>(v_desired->>'is_primary')::boolean
     or (v_after->>'is_featured')::boolean<>(v_desired->>'is_featured')::boolean
     or (v_after->>'credit_order')::integer<>(v_desired->>'credit_order')::integer
     or v_after->>'display_credit' is distinct from v_desired->>'display_credit'
     or v_after->>'source'<>'track_intake_review'
     or (v_after->>'confidence')::integer<>100
     or v_after->>'status'<>'active'
     or v_after->'metadata'->>'source_credit_id'<>
        (v_plan->>'source_credit_id')
  then
    raise exception using errcode='23514',
      message='Reviewed Artist-credit reconciliation did not produce exact canonical semantics.';
  end if;

  v_after_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'track_artist_credit',v_candidate_id
    );

  if v_rows=1 then
    insert into public.registry_canonical_write_events (
      registry_entity_type,registry_entity_id,source_suggestion_id,
      source_table,field_name,target_path,before_value,after_value,
      action,status,actor
    )
    values (
      'track_artist_credit',
      v_candidate_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'reviewed_credit',
      'public.registry_track_artists',
      v_before,
      v_after,
      'reconcile_reviewed_credit',
      'succeeded',
      'system:registry_track_intake_admin'
    )
    returning id into v_event_id;

    insert into platform_private.registry_operation_write_events (
      operation_id,canonical_write_event_id
    )
    values (v_operation.id,v_event_id);
  end if;

  update platform_private.registry_mutation_operations
  set affected_rows=v_rows,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'subject_type','track',
        'subject_id',v_target.subject_id,
        'source_credit_id',v_plan->>'source_credit_id',
        'relation_id',v_candidate_id,
        'mode',v_mode,
        'evidence_assertion_id',v_evidence.id,
        'canonical_write_event_id',v_event_id,
        'relation_state_fingerprint',v_after_fingerprint
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

create function platform_private.verify_registry_track_intake_existing_credit_reconcile_v1(
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
  v_plan jsonb;
  v_desired jsonb;
  v_relation_id uuid;
  v_current jsonb;
  v_event_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_track_intake_admin'
     or v_operation.operation_key<>
        'registry.track_artist_credit.reviewed_reconcile'
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Track Intake reviewed-credit reconciliation operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded'
     or v_operation.affected_rows not in (0,1)
  then
    v_failure:='operation_not_succeeded_with_bounded_row_count';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;

  if v_failure is null
     and (
       not found
       or v_grant.actor_key<>'registry_track_intake_admin'
       or v_grant.operation_key<>
          'registry.track_artist_credit.reviewed_reconcile'
       or v_grant.operation_version<>1
       or v_grant.policy_ruleset_version<>
          'registry-track-intake-credit-reconcile-v1'
     )
  then
    v_failure:='execution_grant_mismatch';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_desired:=v_plan->'desired';
    v_relation_id:=(v_operation.result_payload->>'relation_id')::uuid;

    select to_jsonb(credit)
    into v_current
    from public.registry_track_artists credit
    where credit.id=v_relation_id;

    if v_current is null
       or v_current->>'track_id'<>v_plan->>'track_id'
       or v_current->>'artist_id'<>v_desired->>'artist_id'
       or v_current->>'artist_slug' is distinct from v_desired->>'artist_slug'
       or v_current->>'artist_name_text'
            is distinct from v_desired->>'artist_name_text'
       or v_current->>'role'<>v_desired->>'role'
       or (v_current->>'is_primary')::boolean
            <>(v_desired->>'is_primary')::boolean
       or (v_current->>'is_featured')::boolean
            <>(v_desired->>'is_featured')::boolean
       or (v_current->>'credit_order')::integer
            <>(v_desired->>'credit_order')::integer
       or v_current->>'display_credit'
            is distinct from v_desired->>'display_credit'
       or v_current->>'source'<>'track_intake_review'
       or (v_current->>'confidence')::integer<>100
       or v_current->>'status'<>'active'
       or v_current->'metadata'->>'source_credit_id'<>
          (v_plan->>'source_credit_id')
    then
      v_failure:='canonical_reviewed_credit_semantics_mismatch';
    end if;
  end if;

  if v_failure is null
     and platform_private.registry_subject_state_fingerprint(
       'track_artist_credit',v_relation_id
     ) is distinct from
       v_operation.result_payload->>'relation_state_fingerprint'
  then
    v_failure:='canonical_reviewed_credit_state_changed_after_reconciliation';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type='track_artist_credit'
      and event.registry_entity_id=v_relation_id::text
      and event.source_table=
          'platform_private.registry_evidence_assertions'
      and event.field_name='reviewed_credit'
      and event.target_path='public.registry_track_artists'
      and event.action='reconcile_reviewed_credit'
      and event.status='succeeded'
      and event.actor='system:registry_track_intake_admin';

    if v_operation.affected_rows=0 and v_event_count<>0 then
      v_failure:='verified_noop_has_unexpected_write_event';
    elsif v_operation.affected_rows=1 and v_event_count<>1 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set verifier_status='passed',
        result_payload=result_payload||jsonb_build_object(
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
      error_code='registry_track_intake_credit_reconcile_verification_failed',
      error_message=v_failure,
      result_payload=result_payload||jsonb_build_object(
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

create function public.admin_reconcile_registry_track_intake_credit_v1(
  p_suggestion_id uuid,
  p_source_credit_id uuid,
  p_registry_track_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid;
  v_review jsonb;
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_source public.registry_provider_track_suggestion_artists%rowtype;
  v_artist public.registry_artists%rowtype;
  v_role text;
  v_display_credit text;
  v_desired jsonb;
  v_candidate_state jsonb;
  v_candidate_fingerprint text;
  v_expected_track_state text;
  v_relation_id uuid;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();
  v_review:=platform_private.registry_track_intake_credit_review_snapshot_v1(
    p_suggestion_id,
    p_source_credit_id
  );

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id=p_suggestion_id;

  if not found
     or v_suggestion.status<>'needs_review'
     or (
       v_suggestion.canonical_track_id is not null
       and v_suggestion.canonical_track_id<>p_registry_track_id
     )
     or (
       v_suggestion.canonicalized_track_id is not null
       and v_suggestion.canonicalized_track_id<>p_registry_track_id
     )
  then
    raise exception using errcode='42501',
      message='Track Intake item is not reviewable for this existing draft or active Registry Track.';
  end if;

  if not exists (
       select 1
       from public.registry_tracks track
       where track.id=p_registry_track_id
         and track.status in ('draft','active')
     )
  then
    raise exception using errcode='42501',
      message='Reviewed-credit reconciliation requires an existing draft or active Registry Track.';
  end if;

  select credit.*
  into v_source
  from public.registry_provider_track_suggestion_artists credit
  where credit.id=p_source_credit_id
    and credit.suggestion_id=p_suggestion_id;

  if not found
     or v_source.resolution_mode<>'existing_artist'
     or v_source.registry_artist_id is null
     or v_source.credit_role not in ('primary','featured')
  then
    raise exception using errcode='42501',
      message='Track Intake source credit is not a reviewed existing-Artist credit.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=v_source.registry_artist_id
    and artist.status='active';

  if not found then
    raise exception using errcode='42501',
      message='Track Intake reviewed Artist is no longer active.';
  end if;

  if exists (
       select 1
       from public.registry_provider_track_suggestion_artists other_credit
       where other_credit.suggestion_id=p_suggestion_id
         and other_credit.id<>p_source_credit_id
         and other_credit.resolution_mode='existing_artist'
         and other_credit.registry_artist_id=v_source.registry_artist_id
     )
  then
    raise exception using errcode='23514',
      message='Track Intake review contains the same Registry Artist more than once.';
  end if;

  v_role:=case
    when v_source.credit_role='featured' then 'featured_artist'
    else 'primary_artist'
  end;
  v_display_credit:=coalesce(
    nullif(btrim(v_source.observed_name),''),
    v_artist.display_name
  );
  v_relation_id:=
    platform_private.registry_track_intake_reconciled_credit_uuid_v1(
      p_registry_track_id,
      p_source_credit_id
    );

  v_desired:=jsonb_build_object(
    'relation_id',v_relation_id,
    'artist_id',v_artist.id,
    'artist_slug',v_artist.slug,
    'artist_name_text',v_artist.display_name,
    'role',v_role,
    'is_primary',v_role='primary_artist',
    'is_featured',v_role='featured_artist',
    'credit_order',v_source.credit_order,
    'display_credit',v_display_credit,
    'source','track_intake_review',
    'confidence',100,
    'status','active',
    'metadata',jsonb_build_object(
      'source_suggestion_id',p_suggestion_id::text,
      'source_credit_id',p_source_credit_id::text,
      'observed_name',v_source.observed_name,
      'reconcile_contract',
        'registry-track-intake-credit-reconcile-v1'
    )
  );

  v_candidate_state:=
    platform_private.registry_track_intake_existing_credit_candidate_state_v1(
      p_registry_track_id,
      p_source_credit_id,
      v_artist.id,
      v_artist.slug
    );

  if jsonb_array_length(v_candidate_state)>1 then
    raise exception using errcode='23514',
      message='Existing Registry Track has ambiguous live/reviewable Artist-credit candidates.';
  end if;

  v_candidate_fingerprint:=
    platform_private.registry_track_intake_existing_credit_candidate_fingerprint_v1(
      v_candidate_state
    );
  v_expected_track_state:=
    platform_private.registry_subject_state_fingerprint(
      'track',p_registry_track_id
    );

  v_evidence_id:=
    platform_private.record_registry_track_intake_existing_credit_evidence_v1(
      p_suggestion_id,
      p_source_credit_id,
      p_registry_track_id,
      v_desired,
      v_review->>'review_fingerprint'
    );

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  v_plan:=jsonb_build_object(
    'operation_key','registry.track_artist_credit.reviewed_reconcile',
    'operation_version',1,
    'suggestion_id',p_suggestion_id,
    'source_credit_id',p_source_credit_id,
    'track_id',p_registry_track_id,
    'desired',v_desired,
    'review_fingerprint',v_review->>'review_fingerprint',
    'candidate_state_fingerprint',v_candidate_fingerprint,
    'expected_track_state_fingerprint',v_expected_track_state,
    'evidence_assertion_id',v_evidence.id,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version',
      'registry-track-intake-credit-reconcile-v1'
  );

  v_grant_id:=
    platform_private.issue_registry_track_intake_existing_credit_grant_v1(
      v_evidence.id,
      p_registry_track_id,
      v_plan,
      v_expected_track_state
    );

  select *
  into v_execution
  from platform_private.execute_registry_track_intake_existing_credit_reconcile_v1(
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_track_intake_existing_credit_reconcile_v1(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='Track Intake reviewed Artist-credit reconciliation independent verification failed.';
  end if;

  return jsonb_build_object(
    'track_id',p_registry_track_id,
    'source_credit_id',p_source_credit_id,
    'relation_id',
      (
        select operation.result_payload->>'relation_id'
        from platform_private.registry_mutation_operations operation
        where operation.id=v_execution.operation_id
      ),
    'mode',
      (
        select operation.result_payload->>'mode'
        from platform_private.registry_mutation_operations operation
        where operation.id=v_execution.operation_id
      ),
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status,
    'idempotent_replay',v_execution.idempotent_replay
  );
end
$$;

revoke all on function
  public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)
  from public,anon,service_role;
grant execute on function
  public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)
  to authenticated;

revoke all on function
  platform_private.registry_track_intake_existing_credit_candidate_state_v1(uuid,uuid,uuid,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.registry_track_intake_existing_credit_candidate_fingerprint_v1(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.record_registry_track_intake_existing_credit_evidence_v1(uuid,uuid,uuid,jsonb,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.issue_registry_track_intake_existing_credit_grant_v1(uuid,uuid,jsonb,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.execute_registry_track_intake_existing_credit_reconcile_v1(uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.verify_registry_track_intake_existing_credit_reconcile_v1(uuid)
  from public,anon,authenticated,service_role;

do $postflight$
begin
  if exists (
       select 1
       from public.role_capabilities
       where capability_key=
         'reconcile_registry_track_reviewed_artist_credit'
     )
  then
    raise exception
      'STOP: reviewed-credit reconciliation operation capability leaked into product roles';
  end if;
end
$postflight$;

commit;
