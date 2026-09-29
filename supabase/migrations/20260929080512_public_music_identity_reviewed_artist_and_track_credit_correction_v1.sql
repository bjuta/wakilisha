-- WAKILISHA / Public Music Identity / #1094
-- Reviewed Artist identity composition + one-credit Track correction authority.
--
-- Purpose:
-- - admit public-music-identity review as truthful reviewed Artist-create evidence;
-- - create/activate a missing canonical Artist from one exact open #1094 review;
-- - reconcile exactly one reviewed Track Artist credit per operation;
-- - preserve unrelated credits and fail closed on ambiguity/collision;
-- - bind every mutation to authenticated manage_registry review evidence;
-- - independently verify update/insert/no-op receipts.
--
-- This deliberately does NOT reuse:
-- - Track Intake source-credit provenance;
-- - Apple-Music Discography exact-set replacement;
-- - Release-primary inference.

begin;

set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'public-music-identity-reviewed-artist-track-credit-correction-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_review_items') is null
     or to_regclass('public.registry_canonicalization_decisions') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regprocedure(
          'platform_private.execute_registry_reviewed_artist_identity_materialization_v1(text,text,text,text,text,text,jsonb,text)'
        ) is null
     or to_regprocedure(
          'platform_private.registry_track_intake_existing_credit_candidate_fingerprint_v1(jsonb)'
        ) is null
     or to_regprocedure(
          'platform_private.registry_subject_state_fingerprint(text,uuid)'
        ) is null
     or to_regprocedure(
          'platform_private.registry_plan_fingerprint(jsonb)'
        ) is null
     or to_regprocedure(
          'platform_private.begin_registry_mutation_operation(text,uuid)'
        ) is null
  then
    raise exception
      'STOP: accepted reviewed Artist / Registry operation authority is missing';
  end if;

  if exists (
       select 1
       from platform_private.registry_operation_types
       where operation_key='registry.track_artist_credit.reviewed_reconcile'
         and operation_version=2
     )
     or exists (
       select 1 from platform_private.system_actors
       where actor_key='registry_public_music_identity_credit_admin'
     )
     or to_regprocedure(
          'platform_private.registry_public_music_identity_current_admin_v1()'
        ) is not null
     or to_regprocedure(
          'platform_private.registry_public_music_identity_credit_relation_uuid_v1(uuid,uuid,uuid,uuid)'
        ) is not null
     or to_regprocedure(
          'platform_private.registry_public_music_identity_credit_candidate_state_v1(uuid,uuid,uuid,text)'
        ) is not null
     or to_regprocedure(
          'platform_private.registry_public_music_identity_credit_review_snapshot_v1(uuid,uuid,uuid,uuid,text,integer,text)'
        ) is not null
     or to_regprocedure(
          'platform_private.record_registry_public_music_identity_credit_evidence_v1(uuid,uuid,uuid,jsonb,text)'
        ) is not null
     or to_regprocedure(
          'platform_private.issue_registry_public_music_identity_credit_grant_v1(uuid,uuid,jsonb,text)'
        ) is not null
     or to_regprocedure(
          'platform_private.execute_registry_public_music_identity_credit_reconcile_v2(uuid)'
        ) is not null
     or to_regprocedure(
          'platform_private.verify_registry_public_music_identity_credit_reconcile_v2(uuid)'
        ) is not null
     or to_regprocedure(
          'public.admin_materialize_public_music_identity_reviewed_artist_v1(uuid,uuid,text,text,text)'
        ) is not null
     or to_regprocedure(
          'public.admin_reconcile_public_music_identity_track_credit_v1(uuid,uuid,uuid,uuid,text,integer,text)'
        ) is not null
  then
    raise exception
      'STOP: Public-music-identity reviewed Artist/credit correction authority already exists; audit before reapplying';
  end if;
end
$preflight$;

-- Extend the already-reviewed Artist creation kernel with one truthful evidence
-- source. Existing source/capability pairs remain unchanged.
create or replace function platform_private.execute_registry_reviewed_artist_identity_materialization_v1(
  p_source_kind text,
  p_source_ref text,
  p_display_name text,
  p_normalized_name text,
  p_slug text,
  p_source_payload_fingerprint text,
  p_claim_payload jsonb,
  p_required_user_capability_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid:=auth.uid();
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_future_id uuid;
  v_future_hex text;
  v_collision jsonb;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_assertion_fingerprint text;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_idempotency_key text;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
  v_artist public.registry_artists%rowtype;
begin
  if v_user_id is null
     or nullif(btrim(p_source_kind),'') is null
     or nullif(btrim(p_source_ref),'') is null
     or nullif(btrim(p_display_name),'') is null
     or nullif(btrim(p_normalized_name),'') is null
     or nullif(btrim(p_slug),'') is null
     or p_source_payload_fingerprint is null
     or p_source_payload_fingerprint !~ '^[0-9a-f]{64}$'
     or nullif(btrim(p_required_user_capability_key),'') is null
     or p_claim_payload is null
     or jsonb_typeof(p_claim_payload)<>'object'
     or octet_length(p_claim_payload::text)>16000
  then
    raise exception using errcode='22023',
      message='Reviewed Artist identity materialization input is malformed.';
  end if;

  if not (
    (
      p_source_kind='artist_claim_review'
      and p_source_ref like 'artist-claim:%'
      and p_required_user_capability_key in ('manage_users','manage_registry')
    )
    or (
      p_source_kind='missing_artist_intake_review'
      and p_source_ref like 'missing-artist-intake:%'
      and p_required_user_capability_key in (
        'manage_registry','manage_review_queue'
      )
    )
    or (
      p_source_kind='artist_decouple_review'
      and p_source_ref like 'artist-decouple:%'
      and p_required_user_capability_key='manage_registry'
    )
    or (
      p_source_kind='public_music_identity_review'
      and p_source_ref like 'public-music-identity-review:%'
      and p_required_user_capability_key='manage_registry'
    )
  ) then
    raise exception using errcode='42501',
      message='Reviewed Artist identity source/capability pair is outside the accepted contract.';
  end if;

  if not coalesce(
       public.current_user_has_capability(p_required_user_capability_key),
       false
     )
  then
    raise exception using errcode='42501',
      message='Current user does not hold the exact reviewed Artist identity capability.';
  end if;

  if not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key='registry_artist_identity_review'
         and binding.executor_kind='database_role'
         and binding.executor_key=session_user
         and binding.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Current transport is not the reviewed Artist identity broker.';
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
    raise exception using errcode='42501',
      message='Registry Artist creation operation is disabled or malformed.';
  end if;

  v_future_hex:=encode(
    extensions.digest(
      p_source_kind||':'||btrim(p_source_ref)||':'||
      p_source_payload_fingerprint,
      'sha256'
    ),
    'hex'
  );
  v_future_id:=(
    substr(v_future_hex,1,8)||'-'||
    substr(v_future_hex,9,4)||'-'||
    '5'||substr(v_future_hex,14,3)||'-'||
    '8'||substr(v_future_hex,18,3)||'-'||
    substr(v_future_hex,21,12)
  )::uuid;

  v_idempotency_key:=
    'reviewed-artist-create:'||
    encode(
      extensions.digest(
        p_source_kind||':'||btrim(p_source_ref)||':'||
        p_source_payload_fingerprint,
        'sha256'
      ),
      'hex'
    );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_idempotency_key,0)
  );

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_artist_identity_review'
    and execution_grant.operation_key='registry.artist.create'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.max_rows<>1
       or v_existing.plan_payload->>'artist_id'
            is distinct from v_future_id::text
       or v_existing.plan_payload->>'display_name'
            is distinct from btrim(p_display_name)
       or v_existing.plan_payload->>'normalized_name'
            is distinct from btrim(p_normalized_name)
       or v_existing.plan_payload->>'slug'
            is distinct from btrim(p_slug)
    then
      raise exception using errcode='23505',
        message='Reviewed Artist identity idempotency key is bound to different authority.';
    end if;

    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=
      (v_existing.plan_payload->>'evidence_assertion_id')::uuid;

    if not found
       or v_evidence.subject_type<>'artist'
       or v_evidence.subject_id<>v_future_id
       or v_evidence.claim_key<>'registry.artist.identity.create'
       or v_evidence.claim_payload<>p_claim_payload
       or v_evidence.trust_class<>'INTERNAL_FACT'
       or v_evidence.source_kind<>p_source_kind
       or v_evidence.source_ref<>btrim(p_source_ref)
       or v_evidence.source_payload_fingerprint<>p_source_payload_fingerprint
       or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
       or v_existing.plan_payload->>'evidence_assertion_fingerprint'
            is distinct from v_evidence.assertion_fingerprint
    then
      raise exception using errcode='23505',
        message='Reviewed Artist identity retry does not match prior exact evidence.';
    end if;

    select *
    into v_execution
    from platform_private.execute_registry_materialization_v1(
      'registry_artist_identity_review',
      v_existing.id
    );

    select *
    into v_verification
    from platform_private.verify_registry_materialization_v1(
      v_execution.operation_id
    );

    if v_verification.verifier_status<>'passed' then
      raise exception using errcode='23514',
        message='Reviewed Artist identity replay verification failed.';
    end if;

    select artist.*
    into v_artist
    from public.registry_artists artist
    where artist.id=v_future_id;

    if not found
       or v_artist.slug is distinct from btrim(p_slug)
       or v_artist.display_name is distinct from btrim(p_display_name)
    then
      raise exception using errcode='40001',
        message='Reviewed Artist identity replay no longer resolves to the exact Artist.';
    end if;

    return jsonb_build_object(
      'artist_id',v_artist.id,
      'artist_slug',v_artist.slug,
      'display_name',v_artist.display_name,
      'status',v_artist.status,
      'operation_id',v_execution.operation_id,
      'verifier_status',v_verification.verifier_status,
      'idempotent_replay',true
    );
  end if;

  v_collision:=
    platform_private.registry_artist_creation_collision_state_v1(
      v_future_id,
      p_display_name
    );

  if v_collision<>'[]'::jsonb then
    raise exception using errcode='40001',
      message='Reviewed Artist identity collides with current Registry authority.';
  end if;

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','artist',
        'subject_id',v_future_id::text,
        'claim_key','registry.artist.identity.create',
        'claim_payload',p_claim_payload,
        'trust_class','INTERNAL_FACT',
        'source_kind',p_source_kind,
        'source_ref',btrim(p_source_ref),
        'source_payload_fingerprint',p_source_payload_fingerprint,
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
    'artist',
    v_future_id,
    'registry.artist.identity.create',
    p_claim_payload,
    'INTERNAL_FACT',
    p_source_kind,
    btrim(p_source_ref),
    p_source_payload_fingerprint,
    now(),
    'user:'||v_user_id::text,
    v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint) do nothing
  returning id into v_evidence_id;

  if v_evidence_id is null then
    select assertion.id
    into v_evidence_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint=v_assertion_fingerprint;
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.subject_id<>v_future_id
     or v_evidence.claim_key<>'registry.artist.identity.create'
     or v_evidence.claim_payload<>p_claim_payload
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>p_source_kind
     or v_evidence.source_ref<>btrim(p_source_ref)
     or v_evidence.source_payload_fingerprint<>p_source_payload_fingerprint
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Reviewed Artist identity evidence is not bound to the exact reviewed source.';
  end if;

  v_plan:=jsonb_build_object(
    'operation_key','registry.artist.create',
    'operation_version',1,
    'artist_id',v_future_id,
    'display_name',btrim(p_display_name),
    'normalized_name',btrim(p_normalized_name),
    'slug',btrim(p_slug),
    'collision_state_fingerprint',
      platform_private.registry_identity_creation_collision_fingerprint_v1(
        v_collision
      ),
    'evidence_assertion_id',v_evidence.id,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-materialization-v1'
  );

  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(v_plan);
  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','artist',
          'subject_id',v_future_id::text,
          'expected_state_fingerprint',null
        )
      )::text,
      'sha256'
    ),
    'hex'
  );
  insert into platform_private.registry_execution_grants (
    actor_key,capability_key,system_actor_capability_grant_id,
    operation_key,operation_version,plan_payload,plan_fingerprint,
    target_set_fingerprint,max_rows,idempotency_key,status,
    issued_by_user_id,issued_by_principal_key,policy_ruleset_version,
    required_user_capability_key,issued_at,expires_at
  )
  values (
    'registry_artist_identity_review',
    v_operation_type.capability_key,
    null,
    'registry.artist.create',
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-materialization-v1',
    p_required_user_capability_key,
    now(),
    now()+interval '5 minutes'
  )
  returning id into v_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,subject_type,subject_id,expected_state_fingerprint
  )
  values (
    v_grant_id,'artist',v_future_id,null
  );

  select *
  into v_execution
  from platform_private.execute_registry_materialization_v1(
    'registry_artist_identity_review',
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_materialization_v1(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='Reviewed Artist identity materialization independent verification failed.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=v_future_id;

  if not found or v_artist.status<>'draft' then
    raise exception using errcode='40001',
      message='Reviewed Artist identity did not materialize as an exact draft.';
  end if;

  return jsonb_build_object(
    'artist_id',v_artist.id,
    'artist_slug',v_artist.slug,
    'display_name',v_artist.display_name,
    'status',v_artist.status,
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status,
    'idempotent_replay',v_execution.idempotent_replay
  );
end
$$;

update platform_private.system_actors actor
set capability_profile=jsonb_set(
      coalesce(actor.capability_profile,'{}'::jsonb),
      '{review_sources}',
      (
        select jsonb_agg(value order by value::text)
        from (
          select distinct value
          from jsonb_array_elements(
            coalesce(actor.capability_profile->'review_sources','[]'::jsonb)
            || jsonb_build_array('public_music_identity_review')
          )
        ) source(value)
      ),
      true
    )
where actor.actor_key='registry_artist_identity_review';

insert into platform_private.registry_operation_types (
  operation_key,operation_version,capability_key,risk_class,
  allowed_subject_types,requires_existing_target,max_targets,
  max_rows_ceiling,max_grant_ttl_seconds,requires_human_approval,
  requires_verifier,enabled,description
)
values (
  'registry.track_artist_credit.reviewed_reconcile',
  2,
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
  'Reconcile one exact public-music-identity reviewed Track Artist credit while preserving unrelated credits.'
);

insert into platform_private.system_actors (
  actor_key,label,actor_kind,status,capability_profile
)
values (
  'registry_public_music_identity_credit_admin',
  'Registry Public Music Identity Credit Review Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_family',
      jsonb_build_array(
        'registry.track_artist_credit.reviewed_reconcile/v2'
      ),
    'review_source','public_music_identity_review'
  )
);

insert into platform_private.system_actor_executor_bindings (
  actor_key,executor_kind,executor_key,status
)
values (
  'registry_public_music_identity_credit_admin',
  'database_role',
  'authenticator',
  'active'
);

create function platform_private.registry_public_music_identity_current_admin_v1()
returns uuid
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid:=auth.uid();
begin
  if v_user_id is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key='registry_public_music_identity_credit_admin'
         and binding.executor_kind='database_role'
         and binding.executor_key=session_user
         and binding.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Current transport is not the public-music-identity credit review broker.';
  end if;

  return v_user_id;
end
$$;

create function platform_private.registry_public_music_identity_credit_relation_uuid_v1(
  p_review_id uuid,
  p_decision_id uuid,
  p_track_id uuid,
  p_artist_id uuid
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
  if p_review_id is null
     or p_decision_id is null
     or p_track_id is null
     or p_artist_id is null
  then
    raise exception using errcode='22023',
      message='Review, decision, Track and Artist IDs are required.';
  end if;

  v_hex:=encode(
    extensions.digest(
      'public-music-identity-credit:'||
      p_review_id::text||':'||
      p_decision_id::text||':'||
      p_track_id::text||':'||
      p_artist_id::text,
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

create function platform_private.registry_public_music_identity_credit_candidate_state_v1(
  p_track_id uuid,
  p_relation_id uuid,
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
        case when credit.id=p_relation_id then 0 else 1 end,
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
      credit.id=p_relation_id
      or credit.artist_id=p_artist_id
      or (
        nullif(btrim(p_artist_slug),'') is not null
        and lower(coalesce(credit.artist_slug,''))
            =lower(btrim(p_artist_slug))
      )
    );
$$;

create function platform_private.registry_public_music_identity_credit_review_snapshot_v1(
  p_review_id uuid,
  p_decision_id uuid,
  p_track_id uuid,
  p_artist_id uuid,
  p_role text,
  p_credit_order integer,
  p_display_credit text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private,extensions
as $$
declare
  v_review public.registry_review_items%rowtype;
  v_decision public.registry_canonicalization_decisions%rowtype;
  v_track public.registry_tracks%rowtype;
  v_artist public.registry_artists%rowtype;
  v_relation_id uuid;
  v_candidate_state jsonb;
  v_desired jsonb;
  v_review_fingerprint text;
  v_evidence_text text;
begin
  perform platform_private.registry_public_music_identity_current_admin_v1();

  if p_review_id is null
     or p_decision_id is null
     or p_track_id is null
     or p_artist_id is null
     or p_role not in ('primary_artist','featured_artist')
     or p_credit_order is null
     or p_credit_order<1
     or p_credit_order>1000
     or nullif(btrim(coalesce(p_display_credit,'')),'') is null
     or octet_length(btrim(p_display_credit))>500
  then
    raise exception using errcode='22023',
      message='Reviewed Track credit correction input is malformed.';
  end if;

  select review.*
  into v_review
  from public.registry_review_items review
  where review.id=p_review_id
    and review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_id=p_track_id::text
    and (
      (
        review.source_payload->>'ruleId'='track_slug_identity_noise'
        and review.source_payload->>'ruleVersion'='1.1.0'
      )
      or
      (
        review.source_payload->>'ruleId'='track_slug_credit_evidence_gap'
        and review.source_payload->>'ruleVersion'='1.3.0'
      )
    );

  if not found then
    raise exception using errcode='42501',
      message='Review is not an exact open governed public-music-identity Track review.';
  end if;

  select decision.*
  into v_decision
  from public.registry_canonicalization_decisions decision
  where decision.id=p_decision_id
    and decision.review_item_id=p_review_id
    and decision.entity_type='track'
    and decision.entity_id=p_track_id
    and decision.status='recorded'
    and decision.metadata->>'programmeKey'=
        'public_music_identity_track_actual_zero_v1'
    and decision.metadata->>'decisionStage'='human_review_recorded'
    and coalesce((decision.metadata->>'reviewResolved')::boolean,false)=false
    and decision.decision_type in (
      'public_music_identity_safe_slug_repair',
      'public_music_identity_credit_correction_required'
    );

  if not found then
    raise exception using errcode='42501',
      message='Decision is not the exact recorded public-music-identity human review authority.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_track_id
    and track.status='active';

  if not found then
    raise exception using errcode='42501',
      message='Reviewed credit correction requires an active canonical Track.';
  end if;

  if nullif(v_decision.before_payload->>'currentSlug','')
       is not null
     and v_track.slug is distinct from v_decision.before_payload->>'currentSlug'
  then
    raise exception using errcode='40001',
      message='Track route identity changed after the reviewed decision.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status='active';

  if not found then
    raise exception using errcode='42501',
      message='Reviewed credit correction requires an active canonical Artist.';
  end if;

  v_evidence_text:=lower(
    coalesce(v_review.source_payload#>>'{evidence,title}','')||' '||
    coalesce(v_review.summary,'')||' '||
    coalesce(v_decision.after_payload->>'notes','')
  );

  if position(lower(v_artist.display_name) in v_evidence_text)=0
     and position(lower(v_artist.slug) in v_evidence_text)=0
  then
    raise exception using errcode='23514',
      message='Requested Artist is not present in the frozen review/decision evidence.';
  end if;

  v_relation_id:=
    platform_private.registry_public_music_identity_credit_relation_uuid_v1(
      p_review_id,p_decision_id,p_track_id,p_artist_id
    );

  v_candidate_state:=
    platform_private.registry_public_music_identity_credit_candidate_state_v1(
      p_track_id,v_relation_id,p_artist_id,v_artist.slug
    );

  if jsonb_array_length(v_candidate_state)>1 then
    raise exception using errcode='23514',
      message='Reviewed Track Artist credit has ambiguous live/reviewable candidates.';
  end if;

  if jsonb_array_length(v_candidate_state)=1 then
    v_relation_id:=(v_candidate_state->0->>'id')::uuid;
  end if;

  v_desired:=jsonb_build_object(
    'relation_id',v_relation_id,
    'artist_id',v_artist.id,
    'artist_slug',v_artist.slug,
    'artist_name_text',v_artist.display_name,
    'role',p_role,
    'is_primary',p_role='primary_artist',
    'is_featured',p_role='featured_artist',
    'credit_order',p_credit_order,
    'display_credit',btrim(p_display_credit),
    'source','public_music_identity_review',
    'confidence',100,
    'status','active',
    'metadata',jsonb_build_object(
      'source_review_id',p_review_id::text,
      'source_decision_id',p_decision_id::text,
      'correction_contract',
        'public-music-identity-reviewed-credit-reconcile-v1'
    )
  );

  v_review_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'review_id',v_review.id,
        'review_source_payload',v_review.source_payload,
        'review_candidate_payload',v_review.candidate_payload,
        'decision_id',v_decision.id,
        'decision_type',v_decision.decision_type,
        'decision_after_payload',v_decision.after_payload,
        'decision_metadata',v_decision.metadata,
        'desired',v_desired
      )::text,
      'sha256'
    ),
    'hex'
  );

  return jsonb_build_object(
    'review_id',v_review.id,
    'decision_id',v_decision.id,
    'decision_type',v_decision.decision_type,
    'track_id',v_track.id,
    'track_state_fingerprint',
      platform_private.registry_subject_state_fingerprint(
        'track',v_track.id
      ),
    'artist_id',v_artist.id,
    'artist_slug',v_artist.slug,
    'artist_name',v_artist.display_name,
    'relation_id',v_relation_id,
    'candidate_state',v_candidate_state,
    'candidate_state_fingerprint',
      platform_private.registry_track_intake_existing_credit_candidate_fingerprint_v1(
        v_candidate_state
      ),
    'desired',v_desired,
    'review_fingerprint',v_review_fingerprint
  );
end
$$;

create function platform_private.record_registry_public_music_identity_credit_evidence_v1(
  p_review_id uuid,
  p_decision_id uuid,
  p_track_id uuid,
  p_snapshot jsonb,
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
  v_user_id:=platform_private.registry_public_music_identity_current_admin_v1();

  if p_snapshot is null
     or jsonb_typeof(p_snapshot)<>'object'
     or p_snapshot->>'review_id' is distinct from p_review_id::text
     or p_snapshot->>'decision_id' is distinct from p_decision_id::text
     or p_snapshot->>'track_id' is distinct from p_track_id::text
     or p_review_fingerprint is null
     or p_review_fingerprint!~'^[0-9a-f]{64}$'
  then
    raise exception using errcode='22023',
      message='Public-music-identity reviewed credit evidence is malformed.';
  end if;

  v_claim:=jsonb_build_object(
    'review_id',p_review_id,
    'decision_id',p_decision_id,
    'track_id',p_track_id,
    'desired',p_snapshot->'desired',
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
        'source_kind','public_music_identity_review',
        'source_ref',
          'public-music-identity-review:'||
          p_review_id::text||':decision:'||p_decision_id::text,
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
    'public_music_identity_review',
    'public-music-identity-review:'||
      p_review_id::text||':decision:'||p_decision_id::text,
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

create function platform_private.issue_registry_public_music_identity_credit_grant_v1(
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
  v_idempotency_key text;
  v_grant_id uuid;
begin
  v_user_id:=platform_private.registry_public_music_identity_current_admin_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key=
        'registry.track_artist_credit.reviewed_reconcile'
    and operation_type.operation_version=2
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
      message='Public-music-identity reviewed credit operation is disabled or malformed.';
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
     or v_evidence.source_kind<>'public_music_identity_review'
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Public-music-identity reviewed credit evidence is not caller-bound.';
  end if;

  if p_plan_payload->>'operation_key'
       <>'registry.track_artist_credit.reviewed_reconcile'
     or coalesce((p_plan_payload->>'operation_version')::integer,0)<>2
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
          <>'public-music-identity-reviewed-credit-reconcile-v1'
  then
    raise exception using errcode='42501',
      message='Public-music-identity reviewed credit plan is not evidence-bound.';
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

  v_idempotency_key:=
    'public-music-identity-credit-v2:'||
    encode(
      extensions.digest(
        (p_plan_payload->>'review_id')||':'||
        (p_plan_payload->>'decision_id')||':'||
        (p_plan_payload->'desired'->>'artist_id')||':'||
        (p_plan_payload->>'review_fingerprint'),
        'sha256'
      ),
      'hex'
    );

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key=
        'registry_public_music_identity_credit_admin'
    and execution_grant.operation_key=
        'registry.track_artist_credit.reviewed_reconcile'
    and execution_grant.operation_version=2
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.max_rows<>1
    then
      raise exception using errcode='23505',
        message='Public-music-identity reviewed credit idempotency is bound to different authority.';
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
    'registry_public_music_identity_credit_admin',
    'reconcile_registry_track_reviewed_artist_credit',
    null,
    'registry.track_artist_credit.reviewed_reconcile',
    2,
    p_plan_payload,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'public-music-identity-reviewed-credit-reconcile-v1',
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

create function platform_private.execute_registry_public_music_identity_credit_reconcile_v2(
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
  v_snapshot jsonb;
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
    'registry_public_music_identity_credit_admin',
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
     or v_grant.actor_key<>
        'registry_public_music_identity_credit_admin'
     or v_grant.operation_key<>
        'registry.track_artist_credit.reviewed_reconcile'
     or v_grant.operation_version<>2
     or v_grant.capability_key<>
        'reconcile_registry_track_reviewed_artist_credit'
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>
        'public-music-identity-reviewed-credit-reconcile-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a public-music-identity reviewed credit grant.';
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
      message='Reviewed credit reconciliation requires one exact Track target.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_desired:=v_plan->'desired';

  if (v_plan-array[
       'operation_key','operation_version','review_id','decision_id',
       'track_id','desired','review_fingerprint',
       'candidate_state_fingerprint','expected_track_state_fingerprint',
       'evidence_assertion_id','evidence_assertion_fingerprint',
       'trust_class','policy_ruleset_version'
     ]::text[])<>'{}'::jsonb
     or v_plan->>'operation_key'
          <>'registry.track_artist_credit.reviewed_reconcile'
     or coalesce((v_plan->>'operation_version')::integer,0)<>2
     or (v_plan->>'track_id')::uuid<>v_target.subject_id
     or v_plan->>'expected_track_state_fingerprint'
          is distinct from v_target.expected_state_fingerprint
     or (v_desired-array[
          'relation_id','artist_id','artist_slug','artist_name_text',
          'role','is_primary','is_featured','credit_order',
          'display_credit','source','confidence','status','metadata'
        ]::text[])<>'{}'::jsonb
     or v_desired->>'source'<>'public_music_identity_review'
     or v_desired->>'status'<>'active'
     or (v_desired->>'confidence')::integer<>100
     or v_desired->>'role' not in ('primary_artist','featured_artist')
     or (v_desired->>'is_primary')::boolean
          is distinct from (v_desired->>'role'='primary_artist')
     or (v_desired->>'is_featured')::boolean
          is distinct from (v_desired->>'role'='featured_artist')
  then
    raise exception using errcode='42501',
      message='Public-music-identity reviewed credit plan is malformed.';
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
     or v_evidence.source_kind<>'public_music_identity_review'
     or v_evidence.assertion_fingerprint
          is distinct from v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.recorded_by_principal_key
          is distinct from v_grant.issued_by_principal_key
  then
    raise exception using errcode='42501',
      message='Reviewed credit evidence no longer satisfies the exact grant.';
  end if;

  v_snapshot:=
    platform_private.registry_public_music_identity_credit_review_snapshot_v1(
      (v_plan->>'review_id')::uuid,
      (v_plan->>'decision_id')::uuid,
      v_target.subject_id,
      (v_desired->>'artist_id')::uuid,
      v_desired->>'role',
      (v_desired->>'credit_order')::integer,
      v_desired->>'display_credit'
    );

  if v_snapshot->>'review_fingerprint'
       is distinct from v_plan->>'review_fingerprint'
     or v_evidence.source_payload_fingerprint
       is distinct from v_snapshot->>'review_fingerprint'
  then
    raise exception using errcode='23514',
      message='Public-music-identity reviewed credit changed before reconciliation.';
  end if;

  if platform_private.registry_subject_state_fingerprint(
       'track',v_target.subject_id
     ) is distinct from v_target.expected_state_fingerprint
  then
    raise exception using errcode='23514',
      message='Registry Track changed after reviewed credit grant issuance.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry.track_artist_credit.reviewed_reconcile/v2:'||
      v_target.subject_id::text||':'||
      (v_desired->>'artist_id'),
      0
    )
  );

  v_candidate_state:=
    platform_private.registry_public_music_identity_credit_candidate_state_v1(
      v_target.subject_id,
      (v_desired->>'relation_id')::uuid,
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
      message='Track Artist-credit candidate state changed after grant issuance.';
  end if;

  if jsonb_array_length(v_candidate_state)>1 then
    raise exception using errcode='23514',
      message='Reviewed Track Artist credit has ambiguous live/reviewable candidates.';
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
        message='Reviewed Track Artist-credit candidate disappeared.';
    end if;
  else
    v_candidate_id:=(v_desired->>'relation_id')::uuid;
    v_before:=null;
  end if;

  if v_desired->>'role'='primary_artist'
     and exists (
       select 1
       from public.registry_track_artists collision
       where collision.track_id=v_target.subject_id
         and collision.status='active'
         and collision.is_primary is true
         and collision.id<>v_candidate_id
     )
  then
    raise exception using errcode='23505',
      message='Reviewed primary correction would create multiple active primary Track credits.';
  end if;

  if exists (
       select 1
       from public.registry_track_artists collision
       where collision.track_id=v_target.subject_id
         and collision.status='active'
         and collision.credit_order=(v_desired->>'credit_order')::integer
         and collision.id<>v_candidate_id
     )
  then
    raise exception using errcode='23505',
      message='Reviewed credit correction would collide with an occupied active credit order.';
  end if;

  if v_before is not null then
    if v_before->>'track_id'=v_target.subject_id::text
       and v_before->>'artist_id'=v_desired->>'artist_id'
       and v_before->>'artist_slug' is not distinct from v_desired->>'artist_slug'
       and v_before->>'artist_name_text' is not distinct from v_desired->>'artist_name_text'
       and v_before->>'role'=v_desired->>'role'
       and (v_before->>'is_primary')::boolean=(v_desired->>'is_primary')::boolean
       and (v_before->>'is_featured')::boolean=(v_desired->>'is_featured')::boolean
       and (v_before->>'credit_order')::integer=(v_desired->>'credit_order')::integer
       and v_before->>'display_credit' is not distinct from v_desired->>'display_credit'
       and v_before->>'source'='public_music_identity_review'
       and (v_before->>'confidence')::integer=100
       and v_before->>'status'='active'
       and v_before->'metadata'->>'source_review_id'=
           (v_plan->>'review_id')
       and v_before->'metadata'->>'source_decision_id'=
           (v_plan->>'decision_id')
       and v_before->'metadata'->>'correction_contract'=
           'public-music-identity-reviewed-credit-reconcile-v1'
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
          message='Reviewed credit correction collides with another active Track credit.';
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
          source='public_music_identity_review',
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
        message='Reviewed credit insertion collides with Registry relation state.';
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
      'public_music_identity_review',
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
     or v_after->>'source'<>'public_music_identity_review'
     or (v_after->>'confidence')::integer<>100
     or v_after->>'status'<>'active'
     or v_after->'metadata'->>'source_review_id'<>(v_plan->>'review_id')
     or v_after->'metadata'->>'source_decision_id'<>(v_plan->>'decision_id')
     or v_after->'metadata'->>'correction_contract'
          <>'public-music-identity-reviewed-credit-reconcile-v1'
  then
    raise exception using errcode='23514',
      message='Reviewed Track Artist-credit correction did not produce exact canonical semantics.';
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
      (v_plan->>'decision_id'),
      'public.registry_canonicalization_decisions',
      'reviewed_credit',
      'public.registry_track_artists',
      v_before,
      v_after,
      'reconcile_public_music_identity_reviewed_credit',
      'succeeded',
      'system:registry_public_music_identity_credit_admin'
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
        'review_id',v_plan->>'review_id',
        'decision_id',v_plan->>'decision_id',
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

create function platform_private.verify_registry_public_music_identity_credit_reconcile_v2(
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
  v_primary_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>
        'registry_public_music_identity_credit_admin'
     or v_operation.operation_key<>
        'registry.track_artist_credit.reviewed_reconcile'
     or v_operation.operation_version<>2
  then
    raise exception using errcode='P0002',
      message='Public-music-identity reviewed credit operation not found.';
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
       or v_grant.actor_key<>
          'registry_public_music_identity_credit_admin'
       or v_grant.operation_key<>
          'registry.track_artist_credit.reviewed_reconcile'
       or v_grant.operation_version<>2
       or v_grant.policy_ruleset_version<>
          'public-music-identity-reviewed-credit-reconcile-v1'
       or v_grant.required_user_capability_key<>'manage_registry'
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
       or v_current->>'source'<>'public_music_identity_review'
       or (v_current->>'confidence')::integer<>100
       or v_current->>'status'<>'active'
       or v_current->'metadata'->>'source_review_id'<>v_plan->>'review_id'
       or v_current->'metadata'->>'source_decision_id'<>v_plan->>'decision_id'
       or v_current->'metadata'->>'correction_contract'
            <>'public-music-identity-reviewed-credit-reconcile-v1'
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

  if v_failure is null
     and v_desired->>'role'='primary_artist'
  then
    select count(*)::integer
    into v_primary_count
    from public.registry_track_artists credit
    where credit.track_id=(v_plan->>'track_id')::uuid
      and credit.status='active'
      and credit.is_primary is true;

    if v_primary_count<>1 then
      v_failure:='track_primary_credit_cardinality_mismatch';
    end if;
  end if;

  if v_failure is null
     and not exists (
       select 1
       from public.registry_review_items review
       join public.registry_canonicalization_decisions decision
         on decision.id=(v_plan->>'decision_id')::uuid
        and decision.review_item_id=review.id
       where review.id=(v_plan->>'review_id')::uuid
         and review.status='open'
         and review.source_id=v_plan->>'track_id'
         and decision.status='recorded'
         and decision.metadata->>'programmeKey'=
             'public_music_identity_track_actual_zero_v1'
         and coalesce(
               (decision.metadata->>'reviewResolved')::boolean,
               false
             )=false
     )
  then
    v_failure:='review_or_decision_authority_no_longer_current';
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
          'public.registry_canonicalization_decisions'
      and event.field_name='reviewed_credit'
      and event.target_path='public.registry_track_artists'
      and event.action=
          'reconcile_public_music_identity_reviewed_credit'
      and event.status='succeeded'
      and event.actor=
          'system:registry_public_music_identity_credit_admin';

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
      error_code=
        'public_music_identity_reviewed_credit_reconcile_verification_failed',
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

create function public.admin_materialize_public_music_identity_reviewed_artist_v1(
  p_review_id uuid,
  p_decision_id uuid,
  p_display_name text,
  p_slug text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid:=auth.uid();
  v_review public.registry_review_items%rowtype;
  v_decision public.registry_canonicalization_decisions%rowtype;
  v_display_name text;
  v_slug text;
  v_normalized_name text;
  v_evidence_text text;
  v_source_fingerprint text;
  v_materialized jsonb;
  v_artist public.registry_artists%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if v_user_id is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  v_display_name:=nullif(
    btrim(regexp_replace(coalesce(p_display_name,''),'[[:space:]]+',' ','g')),
    ''
  );
  v_slug:=public.wk_slugify_text(coalesce(nullif(btrim(p_slug),''),v_display_name));
  v_normalized_name:=
    platform_private.registry_identity_normalize_text_v1(v_display_name);

  if v_display_name is null
     or length(v_display_name)<2
     or nullif(v_slug,'') is null
     or v_slug<>public.wk_slugify_text(v_display_name)
  then
    raise exception using errcode='22023',
      message='Reviewed Artist display name/slug is invalid.';
  end if;

  select review.*
  into v_review
  from public.registry_review_items review
  where review.id=p_review_id
    and review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_payload->>'ruleId' in (
      'track_slug_identity_noise',
      'track_slug_credit_evidence_gap'
    );

  if not found then
    raise exception using errcode='42501',
      message='Artist materialization requires an exact open public-music-identity review.';
  end if;

  select decision.*
  into v_decision
  from public.registry_canonicalization_decisions decision
  where decision.id=p_decision_id
    and decision.review_item_id=p_review_id
    and decision.entity_type='track'
    and decision.entity_id=v_review.source_id::uuid
    and decision.status='recorded'
    and decision.metadata->>'programmeKey'=
        'public_music_identity_track_actual_zero_v1'
    and decision.metadata->>'decisionStage'='human_review_recorded'
    and coalesce((decision.metadata->>'reviewResolved')::boolean,false)=false
    and decision.decision_type in (
      'public_music_identity_safe_slug_repair',
      'public_music_identity_credit_correction_required'
    );

  if not found then
    raise exception using errcode='42501',
      message='Artist materialization is not bound to the exact recorded review decision.';
  end if;

  v_evidence_text:=lower(
    coalesce(v_review.source_payload#>>'{evidence,title}','')||' '||
    coalesce(v_review.summary,'')||' '||
    coalesce(v_decision.after_payload->>'notes','')
  );

  if position(lower(v_display_name) in v_evidence_text)=0
     and position(lower(v_slug) in v_evidence_text)=0
  then
    raise exception using errcode='23514',
      message='Requested Artist identity is not present in frozen review/decision evidence.';
  end if;

  v_source_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'review_id',v_review.id,
        'review_source_payload',v_review.source_payload,
        'review_candidate_payload',v_review.candidate_payload,
        'decision_id',v_decision.id,
        'decision_type',v_decision.decision_type,
        'decision_after_payload',v_decision.after_payload,
        'decision_metadata',v_decision.metadata,
        'display_name',v_display_name,
        'slug',v_slug,
        'note',nullif(btrim(coalesce(p_note,'')),'')
      )::text,
      'sha256'
    ),
    'hex'
  );

  v_materialized:=
    platform_private.execute_registry_reviewed_artist_identity_materialization_v1(
      'public_music_identity_review',
      'public-music-identity-review:'||
        v_review.id::text||':'||v_decision.id::text,
      v_display_name,
      v_normalized_name,
      v_slug,
      v_source_fingerprint,
      jsonb_build_object(
        'review_id',v_review.id,
        'decision_id',v_decision.id,
        'track_id',v_review.source_id,
        'display_name',v_display_name,
        'slug',v_slug,
        'note',nullif(btrim(coalesce(p_note,'')),'')
      ),
      'manage_registry'
    );

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=(v_materialized->>'artist_id')::uuid
  for update;

  if not found
     or v_artist.slug<>v_slug
     or v_artist.display_name<>v_display_name
     or v_artist.status not in ('draft','active')
  then
    raise exception using errcode='40001',
      message='Reviewed Artist materialization no longer resolves to the exact canonical identity.';
  end if;

  if v_artist.status='draft' then
    v_before:=to_jsonb(v_artist);

    update public.registry_artists artist
    set status='active',
        metadata=coalesce(artist.metadata,'{}'::jsonb)
          || jsonb_build_object(
            'source','public_music_identity_review',
            'source_review_id',v_review.id::text,
            'source_decision_id',v_decision.id::text,
            'identity_operation_id',v_materialized->>'operation_id',
            'activated_by',v_user_id::text
          ),
        updated_at=now()
    where artist.id=v_artist.id
      and artist.status='draft'
    returning artist.*
    into v_artist;

    if not found then
      raise exception using errcode='40001',
        message='Reviewed Artist identity changed before activation.';
    end if;

    v_after:=to_jsonb(v_artist);

    insert into public.registry_canonical_write_events (
      registry_entity_type,registry_entity_id,source_suggestion_id,
      source_table,field_name,target_path,before_value,after_value,
      action,status,actor
    )
    values (
      'artist',v_artist.id::text,v_decision.id::text,
      'public.registry_canonicalization_decisions',
      'reviewed_identity_state','public.registry_artists',
      v_before,v_after,
      'activate_public_music_identity_reviewed_artist',
      'succeeded','user:'||v_user_id::text
    );
  end if;

  return jsonb_build_object(
    'review_id',v_review.id,
    'decision_id',v_decision.id,
    'artist_id',v_artist.id,
    'artist_slug',v_artist.slug,
    'display_name',v_artist.display_name,
    'status',v_artist.status,
    'operation_id',v_materialized->>'operation_id',
    'verifier_status',v_materialized->>'verifier_status',
    'idempotent_replay',v_materialized->'idempotent_replay'
  );
end
$$;

create function public.admin_reconcile_public_music_identity_track_credit_v1(
  p_review_id uuid,
  p_decision_id uuid,
  p_track_id uuid,
  p_artist_id uuid,
  p_role text,
  p_credit_order integer,
  p_display_credit text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_snapshot jsonb;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
  v_prior record;
  v_prior_desired jsonb;
  v_current jsonb;
begin
  perform platform_private.registry_public_music_identity_current_admin_v1();

  select
    operation.id as operation_id,
    operation.result_payload,
    execution_grant.plan_payload
  into v_prior
  from platform_private.registry_mutation_operations operation
  join platform_private.registry_execution_grants execution_grant
    on execution_grant.id=operation.execution_grant_id
  where operation.actor_key='registry_public_music_identity_credit_admin'
    and operation.operation_key='registry.track_artist_credit.reviewed_reconcile'
    and operation.operation_version=2
    and operation.status='succeeded'
    and operation.verifier_status='passed'
    and execution_grant.plan_payload->>'review_id'=p_review_id::text
    and execution_grant.plan_payload->>'decision_id'=p_decision_id::text
    and execution_grant.plan_payload->>'track_id'=p_track_id::text
    and execution_grant.plan_payload->'desired'->>'artist_id'=p_artist_id::text
    and execution_grant.plan_payload->'desired'->>'role'=p_role
    and (execution_grant.plan_payload->'desired'->>'credit_order')::integer
          =p_credit_order
    and execution_grant.plan_payload->'desired'->>'display_credit'
          is not distinct from btrim(p_display_credit)
  order by operation.completed_at desc nulls last,operation.id
  limit 1;

  if found then
    v_prior_desired:=v_prior.plan_payload->'desired';

    select to_jsonb(credit)
    into v_current
    from public.registry_track_artists credit
    where credit.id=(v_prior.result_payload->>'relation_id')::uuid;

    if v_current is not null
       and v_current->>'track_id'=p_track_id::text
       and v_current->>'artist_id'=p_artist_id::text
       and v_current->>'role'=p_role
       and (v_current->>'credit_order')::integer=p_credit_order
       and v_current->>'display_credit' is not distinct from btrim(p_display_credit)
       and v_current->>'artist_slug' is not distinct from v_prior_desired->>'artist_slug'
       and v_current->>'artist_name_text' is not distinct from v_prior_desired->>'artist_name_text'
       and (v_current->>'is_primary')::boolean=(v_prior_desired->>'is_primary')::boolean
       and (v_current->>'is_featured')::boolean=(v_prior_desired->>'is_featured')::boolean
       and v_current->>'source'='public_music_identity_review'
       and (v_current->>'confidence')::integer=100
       and v_current->>'status'='active'
       and v_current->'metadata'->>'source_review_id'=p_review_id::text
       and v_current->'metadata'->>'source_decision_id'=p_decision_id::text
       and v_current->'metadata'->>'correction_contract'
            ='public-music-identity-reviewed-credit-reconcile-v1'
    then
      return jsonb_build_object(
        'review_id',p_review_id,
        'decision_id',p_decision_id,
        'track_id',p_track_id,
        'artist_id',p_artist_id,
        'relation_id',v_prior.result_payload->>'relation_id',
        'mode','already_current',
        'operation_id',v_prior.operation_id,
        'verifier_status','passed',
        'idempotent_replay',true
      );
    end if;
  end if;

  v_snapshot:=
    platform_private.registry_public_music_identity_credit_review_snapshot_v1(
      p_review_id,p_decision_id,p_track_id,p_artist_id,
      p_role,p_credit_order,p_display_credit
    );

  v_evidence_id:=
    platform_private.record_registry_public_music_identity_credit_evidence_v1(
      p_review_id,
      p_decision_id,
      p_track_id,
      v_snapshot,
      v_snapshot->>'review_fingerprint'
    );

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  v_plan:=jsonb_build_object(
    'operation_key','registry.track_artist_credit.reviewed_reconcile',
    'operation_version',2,
    'review_id',p_review_id,
    'decision_id',p_decision_id,
    'track_id',p_track_id,
    'desired',v_snapshot->'desired',
    'review_fingerprint',v_snapshot->>'review_fingerprint',
    'candidate_state_fingerprint',
      v_snapshot->>'candidate_state_fingerprint',
    'expected_track_state_fingerprint',
      v_snapshot->>'track_state_fingerprint',
    'evidence_assertion_id',v_evidence.id,
    'evidence_assertion_fingerprint',
      v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version',
      'public-music-identity-reviewed-credit-reconcile-v1'
  );

  v_grant_id:=
    platform_private.issue_registry_public_music_identity_credit_grant_v1(
      v_evidence.id,
      p_track_id,
      v_plan,
      v_snapshot->>'track_state_fingerprint'
    );

  select *
  into v_execution
  from platform_private.execute_registry_public_music_identity_credit_reconcile_v2(
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_public_music_identity_credit_reconcile_v2(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='Public-music-identity reviewed Track-credit verification failed.';
  end if;

  return jsonb_build_object(
    'review_id',p_review_id,
    'decision_id',p_decision_id,
    'track_id',p_track_id,
    'artist_id',p_artist_id,
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
  public.admin_materialize_public_music_identity_reviewed_artist_v1(
    uuid,uuid,text,text,text
  )
from public,anon,service_role;

grant execute on function
  public.admin_materialize_public_music_identity_reviewed_artist_v1(
    uuid,uuid,text,text,text
  )
to authenticated;

revoke all on function
  public.admin_reconcile_public_music_identity_track_credit_v1(
    uuid,uuid,uuid,uuid,text,integer,text
  )
from public,anon,service_role;

grant execute on function
  public.admin_reconcile_public_music_identity_track_credit_v1(
    uuid,uuid,uuid,uuid,text,integer,text
  )
to authenticated;

revoke all on function
  platform_private.registry_public_music_identity_current_admin_v1(),
  platform_private.registry_public_music_identity_credit_relation_uuid_v1(uuid,uuid,uuid,uuid),
  platform_private.registry_public_music_identity_credit_candidate_state_v1(uuid,uuid,uuid,text),
  platform_private.registry_public_music_identity_credit_review_snapshot_v1(uuid,uuid,uuid,uuid,text,integer,text),
  platform_private.record_registry_public_music_identity_credit_evidence_v1(uuid,uuid,uuid,jsonb,text),
  platform_private.issue_registry_public_music_identity_credit_grant_v1(uuid,uuid,jsonb,text),
  platform_private.execute_registry_public_music_identity_credit_reconcile_v2(uuid),
  platform_private.verify_registry_public_music_identity_credit_reconcile_v2(uuid)
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
      'STOP: reviewed Track-credit correction capability leaked into product roles';
  end if;

  if exists (
       select 1
       from platform_private.system_actor_capability_grants
       where actor_key='registry_public_music_identity_credit_admin'
     )
  then
    raise exception
      'STOP: reviewed Track-credit correction must not install standing grants';
  end if;

  if exists (
       select 1
       from platform_private.registry_execution_grants
       where actor_key='registry_public_music_identity_credit_admin'
     )
  then
    raise exception
      'STOP: reviewed Track-credit correction migration must remain exact-grant inert';
  end if;

  if has_table_privilege(
       'authenticated',
       'public.registry_track_artists',
       'UPDATE'
     )
     or has_table_privilege(
       'authenticated',
       'public.registry_track_artists',
       'INSERT'
     )
  then
    raise exception
      'STOP: authenticated direct Track-credit mutation authority is not allowed';
  end if;
end
$postflight$;

commit;
