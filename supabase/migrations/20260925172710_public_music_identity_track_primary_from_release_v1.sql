-- Public music identity / #1068
-- Reviewed Release-primary -> Track-primary admission authority.
--
-- Scope:
-- - one existing active Track;
-- - one exact open governed public-identity review;
-- - exactly one active Release membership;
-- - exactly one active primary Artist credit on that Release;
-- - zero active Track primary credits and zero active Track credit_order=1 rows before first admission;
-- - exact-current replay is a verified no-op only for this authority's own row;
-- - insert-only Track↔Artist primary credit admission;
-- - truthful source='release_primary_review';
-- - no Track slug, Release, redirect, Chart, Community or review-status mutation.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'public-music-identity-track-primary-from-release-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_review_items') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_release_tracks') is null
     or to_regclass('public.registry_release_artists') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('platform_private.system_actors') is null
     or to_regclass('platform_private.system_actor_executor_bindings') is null
  then
    raise exception
      'STOP: governed Registry relation foundations required by #1068 are missing';
  end if;

  if to_regprocedure(
       'platform_private.registry_subject_state_fingerprint(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_artist_credit_collision_state_v1(uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_relation_collision_fingerprint_v1(jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_plan_fingerprint(jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_execution_target_set_fingerprint(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_execution_grant_has_current_authority(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_registry_mutation_operation(text,uuid)'
     ) is null
  then
    raise exception
      'STOP: shared Registry operation/collision primitives required by #1068 are missing';
  end if;

  if exists (
       select 1
       from platform_private.system_actors
       where actor_key='registry_release_primary_admin'
     )
     or exists (
       select 1
       from platform_private.registry_operation_types
       where operation_key=
         'registry.track_artist_credit.release_primary_reviewed_admit'
     )
     or to_regprocedure(
          'platform_private.registry_release_primary_review_current_admin_v1()'
        ) is not null
     or to_regprocedure(
          'platform_private.registry_release_primary_review_relation_uuid_v1(uuid,uuid)'
        ) is not null
     or to_regprocedure(
          'platform_private.registry_release_primary_review_snapshot_v1(uuid,uuid)'
        ) is not null
     or to_regprocedure(
          'platform_private.record_registry_release_primary_review_evidence_v1(uuid,uuid,jsonb)'
        ) is not null
     or to_regprocedure(
          'platform_private.issue_registry_release_primary_review_grant_v1(uuid,uuid,jsonb,text)'
        ) is not null
     or to_regprocedure(
          'platform_private.execute_registry_release_primary_review_admit_v1(uuid)'
        ) is not null
     or to_regprocedure(
          'platform_private.verify_registry_release_primary_review_admit_v1(uuid)'
        ) is not null
     or to_regprocedure(
          'public.admin_admit_registry_track_primary_from_release_v1(uuid,uuid,uuid,text)'
        ) is not null
  then
    raise exception
      'STOP: Release-primary reviewed Track-credit authority already exists; audit before reapplying';
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
  'admit_registry_track_primary_from_release_review',
  'Admit Registry Track primary Artist from Release review',
  'Admit one exact reviewed primary Track-to-Artist credit from one unambiguous active Release primary Artist without changing unrelated credits.',
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
  'registry.track_artist_credit.release_primary_reviewed_admit',
  1,
  'admit_registry_track_primary_from_release_review',
  'high',
  array['track']::text[],
  true,
  1,
  1,
  300,
  true,
  true,
  true,
  'Admit one reviewed primary Track Artist credit from exactly one active Release and exactly one active Release primary Artist.'
);

insert into platform_private.system_actors (
  actor_key,
  label,
  actor_kind,
  status,
  capability_profile
)
values (
  'registry_release_primary_admin',
  'Registry Release Primary Review Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_family',
      jsonb_build_array(
        'registry.track_artist_credit.release_primary_reviewed_admit/v1'
      )
  )
);

insert into platform_private.system_actor_executor_bindings (
  actor_key,
  executor_kind,
  executor_key,
  status
)
values (
  'registry_release_primary_admin',
  'database_role',
  'authenticator',
  'active'
);

create function
platform_private.registry_release_primary_review_current_admin_v1()
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
       where binding.actor_key='registry_release_primary_admin'
         and binding.executor_kind='database_role'
         and binding.executor_key=session_user
         and binding.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Current transport is not the Registry Release-primary review admin broker.';
  end if;

  return v_user_id;
end
$$;

create function
platform_private.registry_release_primary_review_relation_uuid_v1(
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
  if p_track_id is null or p_artist_id is null then
    raise exception using errcode='22023',
      message='Track ID and Artist ID are required.';
  end if;

  v_hex:=encode(
    extensions.digest(
      'track.release-primary-review:'||
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

create function
platform_private.registry_release_primary_review_snapshot_v1(
  p_review_id uuid,
  p_track_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private,extensions
as $$
declare
  v_review public.registry_review_items%rowtype;
  v_track public.registry_tracks%rowtype;
  v_membership public.registry_release_tracks%rowtype;
  v_release public.registry_releases%rowtype;
  v_release_credit public.registry_release_artists%rowtype;
  v_artist public.registry_artists%rowtype;
  v_review_count integer;
  v_membership_count integer;
  v_release_primary_count integer;
  v_track_primary_count integer;
  v_order_one_count integer;
  v_exact_current_count integer;
  v_relation_id uuid;
  v_collision_state jsonb;
  v_evidence_state jsonb;
  v_evidence_fingerprint text;
  v_admission_state text;
begin
  if p_review_id is null or p_track_id is null then
    raise exception using errcode='22023',
      message='Review ID and Track ID are required.';
  end if;

  select count(*)::integer
  into v_review_count
  from public.registry_review_items review
  where review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_id=p_track_id::text
    and review.source_payload->>'ruleId' in (
      'track_slug_identity_noise',
      'track_slug_credit_evidence_gap'
    );

  if v_review_count<>1 then
    raise exception using errcode='23514',
      message='Release-primary admission requires exactly one open governed Track slug review.';
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
      message='Review is not the exact open governed public-music-identity Track review.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_track_id
    and track.status='active';

  if not found
     or nullif(btrim(coalesce(v_track.isrc,'')),'') is null
  then
    raise exception using errcode='42501',
      message='Release-primary admission requires an active ISRC-bound Registry Track.';
  end if;

  select count(*)::integer
  into v_membership_count
  from public.registry_release_tracks membership
  join public.registry_releases release
    on release.id=membership.release_id
   and release.status='active'
  where membership.track_id=p_track_id
    and membership.status='active';

  if v_membership_count<>1 then
    raise exception using errcode='23514',
      message='Release-primary admission V1 requires exactly one active Release membership.';
  end if;

  select membership.*
  into v_membership
  from public.registry_release_tracks membership
  join public.registry_releases release
    on release.id=membership.release_id
   and release.status='active'
  where membership.track_id=p_track_id
    and membership.status='active';

  select release.*
  into v_release
  from public.registry_releases release
  where release.id=v_membership.release_id
    and release.status='active';

  select count(*)::integer
  into v_release_primary_count
  from public.registry_release_artists credit
  where credit.release_id=v_release.id
    and credit.status='active'
    and credit.is_primary is true
    and credit.artist_id is not null;

  if v_release_primary_count<>1 then
    raise exception using errcode='23514',
      message='Release-primary admission requires exactly one resolved active primary Artist credit on the active Release.';
  end if;

  select credit.*
  into v_release_credit
  from public.registry_release_artists credit
  where credit.release_id=v_release.id
    and credit.status='active'
    and credit.is_primary is true
    and credit.artist_id is not null;

  if v_release_credit.artist_id is null then
    raise exception using errcode='23514',
      message='Release primary credit is not bound to a Registry Artist.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=v_release_credit.artist_id
    and artist.status='active';

  if not found then
    raise exception using errcode='23514',
      message='Release primary Artist is not an active Registry Artist.';
  end if;

  v_relation_id:=
    platform_private.registry_release_primary_review_relation_uuid_v1(
      p_track_id,
      v_artist.id
    );

  v_evidence_state:=jsonb_build_object(
    'review',
      jsonb_build_object(
        'id',v_review.id,
        'status',v_review.status,
        'review_type',v_review.review_type,
        'entity_type',v_review.entity_type,
        'source_id',v_review.source_id,
        'source_payload',v_review.source_payload
      ),
    'track',
      jsonb_build_object(
        'id',v_track.id,
        'status',v_track.status,
        'isrc',v_track.isrc,
        'slug',v_track.slug,
        'title',v_track.title
      ),
    'membership',to_jsonb(v_membership),
    'release',
      jsonb_build_object(
        'id',v_release.id,
        'status',v_release.status,
        'slug',v_release.slug,
        'title',v_release.title
      ),
    'release_primary_credit',to_jsonb(v_release_credit),
    'artist',
      jsonb_build_object(
        'id',v_artist.id,
        'status',v_artist.status,
        'slug',v_artist.slug,
        'display_name',v_artist.display_name
      )
  );

  v_evidence_fingerprint:=encode(
    extensions.digest(v_evidence_state::text,'sha256'),
    'hex'
  );

  select count(*)::integer
  into v_track_primary_count
  from public.registry_track_artists credit
  where credit.track_id=p_track_id
    and credit.status='active'
    and credit.is_primary is true;

  select count(*)::integer
  into v_order_one_count
  from public.registry_track_artists credit
  where credit.track_id=p_track_id
    and credit.status='active'
    and credit.credit_order=1;

  select count(*)::integer
  into v_exact_current_count
  from public.registry_track_artists credit
  where credit.id=v_relation_id
    and credit.track_id=p_track_id
    and credit.artist_id=v_artist.id
    and credit.artist_slug is not distinct from v_artist.slug
    and credit.artist_name_text is not distinct from v_artist.display_name
    and credit.role='primary_artist'
    and credit.is_primary is true
    and credit.is_featured is false
    and credit.credit_order=1
    and credit.display_credit is not distinct from v_artist.display_name
    and credit.source='release_primary_review'
    and credit.confidence=100
    and credit.status='active'
    and credit.metadata->>'source_review_id'=v_review.id::text
    and credit.metadata->>'source_release_id'=v_release.id::text
    and credit.metadata->>'source_release_membership_id'=v_membership.id::text
    and credit.metadata->>'source_release_primary_credit_id'=v_release_credit.id::text
    and credit.metadata->>'release_evidence_fingerprint'=v_evidence_fingerprint
    and credit.metadata->>'admission_contract'='registry-release-primary-review-v1';

  v_collision_state:=
    platform_private.registry_track_artist_credit_collision_state_v1(
      v_relation_id,
      p_track_id,
      v_artist.id
    );

  if v_track_primary_count=0
     and v_order_one_count=0
  then
    if jsonb_array_length(v_collision_state)<>0 then
      raise exception using errcode='23505',
        message='Release-primary admission collides with existing Track Artist relation state.';
    end if;

    v_admission_state:='admit';
  elsif v_track_primary_count=1
     and v_order_one_count=1
     and v_exact_current_count=1
  then
    v_admission_state:='already_current';
  else
    raise exception using errcode='23514',
      message='Track primary Artist credit authority is no longer empty or exactly current for this reviewed Release evidence.';
  end if;

  return jsonb_build_object(
    'admission_state',v_admission_state,
    'review_id',v_review.id,
    'rule_id',v_review.source_payload->>'ruleId',
    'rule_version',v_review.source_payload->>'ruleVersion',
    'track_id',v_track.id,
    'track_state_fingerprint',
      platform_private.registry_subject_state_fingerprint(
        'track',
        v_track.id
      ),
    'release_id',v_release.id,
    'release_membership_id',v_membership.id,
    'release_primary_credit_id',v_release_credit.id,
    'artist_id',v_artist.id,
    'artist_slug',v_artist.slug,
    'artist_name',v_artist.display_name,
    'relation_id',v_relation_id,
    'collision_state',v_collision_state,
    'collision_fingerprint',
      platform_private.registry_relation_collision_fingerprint_v1(
        v_collision_state
      ),
    'release_evidence_state',v_evidence_state,
    'release_evidence_fingerprint',v_evidence_fingerprint
  );
end
$$;

create function
platform_private.record_registry_release_primary_review_evidence_v1(
  p_review_id uuid,
  p_track_id uuid,
  p_snapshot jsonb
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
  v_user_id:=
    platform_private.registry_release_primary_review_current_admin_v1();

  if p_snapshot is null
     or jsonb_typeof(p_snapshot)<>'object'
     or p_snapshot->>'review_id' is distinct from p_review_id::text
     or p_snapshot->>'track_id' is distinct from p_track_id::text
     or nullif(
          btrim(p_snapshot->>'release_evidence_fingerprint'),
          ''
        ) is null
  then
    raise exception using errcode='22023',
      message='Release-primary reviewed evidence requires the exact governed snapshot.';
  end if;

  v_claim:=jsonb_build_object(
    'review_id',p_review_id,
    'track_id',p_track_id,
    'release_id',p_snapshot->>'release_id',
    'release_membership_id',p_snapshot->>'release_membership_id',
    'release_primary_credit_id',
      p_snapshot->>'release_primary_credit_id',
    'artist_id',p_snapshot->>'artist_id',
    'relation_id',p_snapshot->>'relation_id',
    'rule_id',p_snapshot->>'rule_id',
    'rule_version',p_snapshot->>'rule_version',
    'release_evidence_fingerprint',
      p_snapshot->>'release_evidence_fingerprint'
  );

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','track',
        'subject_id',p_track_id::text,
        'claim_key',
          'registry.track_artist_credit.release_primary_reviewed_admit',
        'claim_payload',v_claim,
        'trust_class','INTERNAL_FACT',
        'source_kind','release_primary_review',
        'source_ref','registry-review:'||p_review_id::text,
        'source_payload_fingerprint',
          p_snapshot->>'release_evidence_fingerprint',
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
    'registry.track_artist_credit.release_primary_reviewed_admit',
    v_claim,
    'INTERNAL_FACT',
    'release_primary_review',
    'registry-review:'||p_review_id::text,
    p_snapshot->>'release_evidence_fingerprint',
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

create function
platform_private.issue_registry_release_primary_review_grant_v1(
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
  v_user_id:=
    platform_private.registry_release_primary_review_current_admin_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key=
        'registry.track_artist_credit.release_primary_reviewed_admit'
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or v_operation_type.capability_key<>
        'admit_registry_track_primary_from_release_review'
     or not ('track'=any(v_operation_type.allowed_subject_types))
     or not v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<>1
     or v_operation_type.max_grant_ttl_seconds<>300
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Release-primary reviewed admission operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>p_track_id
     or v_evidence.claim_key<>
        'registry.track_artist_credit.release_primary_reviewed_admit'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'release_primary_review'
     or v_evidence.recorded_by_principal_key<>
        'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Release-primary review evidence is not bound to this exact caller and Track.';
  end if;

  if p_plan_payload->>'operation_key'
       <>'registry.track_artist_credit.release_primary_reviewed_admit'
     or coalesce(
          (p_plan_payload->>'operation_version')::integer,
          0
        )<>1
     or p_plan_payload->>'track_id'
          is distinct from p_track_id::text
     or p_plan_payload->>'expected_track_state_fingerprint'
          is distinct from p_expected_track_state_fingerprint
     or p_plan_payload->>'evidence_assertion_id'
          is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint'
          is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'release_evidence_fingerprint'
          is distinct from v_evidence.source_payload_fingerprint
     or p_plan_payload->>'trust_class'
          is distinct from v_evidence.trust_class
     or p_plan_payload->>'policy_ruleset_version'
          <>'registry-release-primary-review-v1'
  then
    raise exception using errcode='42501',
      message='Release-primary reviewed admission plan is not bound to current evidence authority.';
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
      (p_plan_payload->>'review_id')||':'||
      p_track_id::text||':'||
      (p_plan_payload->>'artist_id')||':'||
      (p_plan_payload->>'release_evidence_fingerprint'),
      'sha256'
    ),
    'hex'
  );

  v_idempotency_key:=
    'release-primary-review-v1:'||v_idempotency_hash;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_release_primary_admin'
    and execution_grant.operation_key=
        'registry.track_artist_credit.release_primary_reviewed_admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.max_rows<>1
       or platform_private.registry_execution_target_set_fingerprint(
            v_existing.id
          )<>v_target_fingerprint
    then
      raise exception using errcode='23505',
        message='Release-primary review idempotency key is bound to different authority.';
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
    'registry_release_primary_admin',
    'admit_registry_track_primary_from_release_review',
    null,
    'registry.track_artist_credit.release_primary_reviewed_admit',
    1,
    p_plan_payload,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-release-primary-review-v1',
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
    p_track_id,
    p_expected_track_state_fingerprint
  );

  if platform_private.registry_execution_target_set_fingerprint(
       v_grant_id
     )<>v_target_fingerprint
  then
    raise exception using errcode='23514',
      message='Release-primary exact target-set fingerprint drifted.';
  end if;

  return v_grant_id;
end
$$;

create function
platform_private.execute_registry_release_primary_review_admit_v1(
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
  v_snapshot jsonb;
  v_relation_id uuid;
  v_artist_id uuid;
  v_before jsonb:=null;
  v_after jsonb;
  v_event_id uuid;
  v_after_fingerprint text;
  v_rows integer:=0;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_release_primary_admin',
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
     or v_grant.actor_key<>'registry_release_primary_admin'
     or v_grant.operation_key<>
        'registry.track_artist_credit.release_primary_reviewed_admit'
     or v_grant.operation_version<>1
     or v_grant.capability_key<>
        'admit_registry_track_primary_from_release_review'
     or v_grant.max_rows<>1
     or v_grant.required_user_capability_key<>'manage_registry'
     or v_grant.policy_ruleset_version<>
        'registry-release-primary-review-v1'
  then
    raise exception using errcode='42501',
      message='Release-primary execution grant is malformed.';
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
      message='Release-primary execution grant target is malformed.';
  end if;

  v_plan:=v_grant.plan_payload;

  if v_plan->>'track_id'
       is distinct from v_target.subject_id::text
     or v_plan->>'expected_track_state_fingerprint'
          is distinct from v_target.expected_state_fingerprint
  then
    raise exception using errcode='42501',
      message='Release-primary execution plan is not bound to the exact Track target.';
  end if;

  perform track.id
  from public.registry_tracks track
  where track.id=v_target.subject_id
  for update;

  if platform_private.registry_subject_state_fingerprint(
       'track',
       v_target.subject_id
     ) is distinct from v_target.expected_state_fingerprint
  then
    raise exception using errcode='40001',
      message='Registry Track changed after Release-primary grant issuance.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.assertion_fingerprint
          is distinct from v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>v_target.subject_id
     or v_evidence.claim_key<>
        'registry.track_artist_credit.release_primary_reviewed_admit'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'release_primary_review'
     or v_evidence.source_payload_fingerprint
          is distinct from v_plan->>'release_evidence_fingerprint'
  then
    raise exception using errcode='42501',
      message='Release-primary execution evidence no longer matches the exact plan.';
  end if;

  v_snapshot:=
    platform_private.registry_release_primary_review_snapshot_v1(
      (v_plan->>'review_id')::uuid,
      v_target.subject_id
    );

  if v_snapshot->>'admission_state'<>'admit'
     or v_snapshot->>'artist_id'
       is distinct from v_plan->>'artist_id'
     or v_snapshot->>'relation_id'
          is distinct from v_plan->>'relation_id'
     or v_snapshot->>'release_id'
          is distinct from v_plan->>'release_id'
     or v_snapshot->>'release_membership_id'
          is distinct from v_plan->>'release_membership_id'
     or v_snapshot->>'release_primary_credit_id'
          is distinct from v_plan->>'release_primary_credit_id'
     or v_snapshot->>'release_evidence_fingerprint'
          is distinct from v_plan->>'release_evidence_fingerprint'
     or v_snapshot->>'collision_fingerprint'
          is distinct from v_plan->>'collision_fingerprint'
  then
    raise exception using errcode='40001',
      message='Release-primary evidence changed after grant issuance.';
  end if;

  v_relation_id:=(v_plan->>'relation_id')::uuid;
  v_artist_id:=(v_plan->>'artist_id')::uuid;

  if exists (
       select 1
       from public.registry_track_artists credit
       where credit.track_id=v_target.subject_id
         and credit.status='active'
         and (
           credit.is_primary is true
           or credit.credit_order=1
         )
     )
  then
    raise exception using errcode='23514',
      message='Track acquired primary or credit-order-one authority before Release-primary insertion.';
  end if;

  if jsonb_array_length(
       platform_private.registry_track_artist_credit_collision_state_v1(
         v_relation_id,
         v_target.subject_id,
         v_artist_id
       )
     )<>0
  then
    raise exception using errcode='23505',
      message='Release-primary insertion collides with current Track Artist relation state.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  insert into public.registry_track_artists (
    id,
    track_id,
    artist_id,
    artist_slug,
    artist_name_text,
    role,
    is_primary,
    is_featured,
    credit_order,
    display_credit,
    source,
    confidence,
    status,
    metadata
  )
  values (
    v_relation_id,
    v_target.subject_id,
    v_artist_id,
    v_snapshot->>'artist_slug',
    v_snapshot->>'artist_name',
    'primary_artist',
    true,
    false,
    1,
    v_snapshot->>'artist_name',
    'release_primary_review',
    100,
    'active',
    jsonb_build_object(
      'source_review_id',v_plan->>'review_id',
      'source_release_id',v_plan->>'release_id',
      'source_release_membership_id',
        v_plan->>'release_membership_id',
      'source_release_primary_credit_id',
        v_plan->>'release_primary_credit_id',
      'release_evidence_fingerprint',
        v_plan->>'release_evidence_fingerprint',
      'admission_contract',
        'registry-release-primary-review-v1'
    )
  );

  get diagnostics v_rows=row_count;

  if v_rows<>1 then
    raise exception using errcode='23514',
      message='Release-primary admission did not insert exactly one Track Artist credit.';
  end if;

  select to_jsonb(credit)
  into v_after
  from public.registry_track_artists credit
  where credit.id=v_relation_id;

  if v_after is null
     or v_after->>'track_id'<>v_target.subject_id::text
     or v_after->>'artist_id'<>v_artist_id::text
     or v_after->>'artist_slug'
          is distinct from v_snapshot->>'artist_slug'
     or v_after->>'artist_name_text'
          is distinct from v_snapshot->>'artist_name'
     or v_after->>'role'<>'primary_artist'
     or (v_after->>'is_primary')::boolean is not true
     or (v_after->>'is_featured')::boolean is not false
     or (v_after->>'credit_order')::integer<>1
     or v_after->>'display_credit'
          is distinct from v_snapshot->>'artist_name'
     or v_after->>'source'<>'release_primary_review'
     or (v_after->>'confidence')::integer<>100
     or v_after->>'status'<>'active'
     or v_after->'metadata'->>'source_review_id'
          is distinct from v_plan->>'review_id'
     or v_after->'metadata'->>'release_evidence_fingerprint'
          is distinct from v_plan->>'release_evidence_fingerprint'
  then
    raise exception using errcode='23514',
      message='Release-primary admission did not produce exact canonical Track credit semantics.';
  end if;

  v_after_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'track_artist_credit',
      v_relation_id
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
    'track_artist_credit',
    v_relation_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'primary_artist_credit',
    'public.registry_track_artists',
    v_before,
    v_after,
    'admit_release_primary_reviewed_credit',
    'succeeded',
    'system:registry_release_primary_admin'
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
        'review_id',v_plan->>'review_id',
        'release_id',v_plan->>'release_id',
        'artist_id',v_artist_id,
        'relation_id',v_relation_id,
        'evidence_assertion_id',v_evidence.id,
        'canonical_write_event_id',v_event_id,
        'relation_state_fingerprint',v_after_fingerprint,
        'release_evidence_fingerprint',
          v_plan->>'release_evidence_fingerprint'
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

create function
platform_private.verify_registry_release_primary_review_admit_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,extensions
as $$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_plan jsonb;
  v_relation_id uuid;
  v_current jsonb;
  v_event_count integer;
  v_primary_count integer;
  v_membership_count integer;
  v_release_primary_count integer;
  v_review_count integer;
  v_release_state jsonb;
  v_release_state_fingerprint text;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_release_primary_admin'
     or v_operation.operation_key<>
        'registry.track_artist_credit.release_primary_reviewed_admit'
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Release-primary reviewed Track-credit operation not found.';
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
    v_failure:='operation_not_succeeded_with_exact_row_count';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;

  if v_failure is null
     and (
       not found
       or v_grant.actor_key<>'registry_release_primary_admin'
       or v_grant.operation_key<>
          'registry.track_artist_credit.release_primary_reviewed_admit'
       or v_grant.operation_version<>1
       or v_grant.capability_key<>
          'admit_registry_track_primary_from_release_review'
       or v_grant.max_rows<>1
       or v_grant.required_user_capability_key<>'manage_registry'
       or v_grant.policy_ruleset_version<>
          'registry-release-primary-review-v1'
     )
  then
    v_failure:='execution_grant_mismatch';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_relation_id:=(v_plan->>'relation_id')::uuid;

    select to_jsonb(credit)
    into v_current
    from public.registry_track_artists credit
    where credit.id=v_relation_id;

    if v_current is null
       or v_current->>'track_id'<>v_plan->>'track_id'
       or v_current->>'artist_id'<>v_plan->>'artist_id'
       or v_current->>'role'<>'primary_artist'
       or (v_current->>'is_primary')::boolean is not true
       or (v_current->>'is_featured')::boolean is not false
       or (v_current->>'credit_order')::integer<>1
       or v_current->>'source'<>'release_primary_review'
       or (v_current->>'confidence')::integer<>100
       or v_current->>'status'<>'active'
       or v_current->'metadata'->>'source_review_id'
            is distinct from v_plan->>'review_id'
       or v_current->'metadata'->>'source_release_id'
            is distinct from v_plan->>'release_id'
       or v_current->'metadata'->>'source_release_membership_id'
            is distinct from v_plan->>'release_membership_id'
       or v_current->'metadata'->>'source_release_primary_credit_id'
            is distinct from v_plan->>'release_primary_credit_id'
       or v_current->'metadata'->>'release_evidence_fingerprint'
            is distinct from v_plan->>'release_evidence_fingerprint'
       or v_current->'metadata'->>'admission_contract'
            <>'registry-release-primary-review-v1'
    then
      v_failure:='canonical_release_primary_credit_semantics_mismatch';
    end if;
  end if;

  if v_failure is null then
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

  if v_failure is null then
    select count(*)::integer
    into v_review_count
    from public.registry_review_items review
    where review.status='open'
      and review.review_type='mizizi_data_hygiene'
      and review.entity_type='track'
      and review.source_id=v_plan->>'track_id'
      and review.source_payload->>'ruleId' in (
        'track_slug_identity_noise',
        'track_slug_credit_evidence_gap'
      );

    if v_review_count<>1 then
      v_failure:='governed_review_cardinality_changed_after_admission';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_membership_count
    from public.registry_release_tracks membership
    join public.registry_releases release
      on release.id=membership.release_id
     and release.status='active'
    where membership.track_id=(v_plan->>'track_id')::uuid
      and membership.status='active';

    if v_membership_count<>1 then
      v_failure:='release_membership_cardinality_changed_after_admission';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_release_primary_count
    from public.registry_release_artists credit
    where credit.release_id=(v_plan->>'release_id')::uuid
      and credit.status='active'
      and credit.is_primary is true
      and credit.artist_id is not null;

    if v_release_primary_count<>1 then
      v_failure:='release_primary_cardinality_changed_after_admission';
    end if;
  end if;

  if v_failure is null
     and platform_private.registry_subject_state_fingerprint(
       'track_artist_credit',
       v_relation_id
     ) is distinct from
       v_operation.result_payload->>'relation_state_fingerprint'
  then
    v_failure:='canonical_release_primary_credit_changed_after_admission';
  end if;

  if v_failure is null then
    select jsonb_build_object(
      'review',
        jsonb_build_object(
          'id',review.id,
          'status',review.status,
          'review_type',review.review_type,
          'entity_type',review.entity_type,
          'source_id',review.source_id,
          'source_payload',review.source_payload
        ),
      'track',
        jsonb_build_object(
          'id',track.id,
          'status',track.status,
          'isrc',track.isrc,
          'slug',track.slug,
          'title',track.title
        ),
      'membership',to_jsonb(membership),
      'release',
        jsonb_build_object(
          'id',release.id,
          'status',release.status,
          'slug',release.slug,
          'title',release.title
        ),
      'release_primary_credit',to_jsonb(release_credit),
      'artist',
        jsonb_build_object(
          'id',artist.id,
          'status',artist.status,
          'slug',artist.slug,
          'display_name',artist.display_name
        )
    )
    into v_release_state
    from public.registry_review_items review
    join public.registry_tracks track
      on track.id=(v_plan->>'track_id')::uuid
    join public.registry_release_tracks membership
      on membership.id=(v_plan->>'release_membership_id')::uuid
     and membership.track_id=track.id
     and membership.status='active'
    join public.registry_releases release
      on release.id=(v_plan->>'release_id')::uuid
     and release.id=membership.release_id
     and release.status='active'
    join public.registry_release_artists release_credit
      on release_credit.id=
         (v_plan->>'release_primary_credit_id')::uuid
     and release_credit.release_id=release.id
     and release_credit.status='active'
     and release_credit.is_primary is true
    join public.registry_artists artist
      on artist.id=(v_plan->>'artist_id')::uuid
     and artist.id=release_credit.artist_id
     and artist.status='active'
    where review.id=(v_plan->>'review_id')::uuid
      and review.status='open'
      and review.review_type='mizizi_data_hygiene'
      and review.entity_type='track'
      and review.source_id=track.id::text;

    if v_release_state is null then
      v_failure:='release_review_evidence_no_longer_current';
    else
      v_release_state_fingerprint:=encode(
        extensions.digest(v_release_state::text,'sha256'),
        'hex'
      );

      if v_release_state_fingerprint
           is distinct from v_plan->>'release_evidence_fingerprint'
      then
        v_failure:='release_review_evidence_changed_after_admission';
      end if;
    end if;
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
      and event.field_name='primary_artist_credit'
      and event.target_path='public.registry_track_artists'
      and event.action='admit_release_primary_reviewed_credit'
      and event.status='succeeded'
      and event.actor='system:registry_release_primary_admin';

    if v_event_count<>1 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set verifier_status='passed',
        result_payload=result_payload||jsonb_build_object(
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
      error_code='registry_release_primary_review_verification_failed',
      error_message=v_failure,
      result_payload=result_payload||jsonb_build_object(
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

create function
public.admin_admit_registry_track_primary_from_release_v1(
  p_review_id uuid,
  p_track_id uuid,
  p_expected_artist_id uuid,
  p_expected_track_state_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid;
  v_snapshot jsonb;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
begin
  v_user_id:=
    platform_private.registry_release_primary_review_current_admin_v1();

  if p_expected_artist_id is null
     or nullif(
          btrim(coalesce(p_expected_track_state_fingerprint,'')),
          ''
        ) is null
  then
    raise exception using errcode='22023',
      message='Expected Artist and Track-state fingerprint are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry.track_artist_credit.release_primary_reviewed_admit:'||
      p_track_id::text,
      0
    )
  );

  v_snapshot:=
    platform_private.registry_release_primary_review_snapshot_v1(
      p_review_id,
      p_track_id
    );

  if v_snapshot->>'artist_id'
       is distinct from p_expected_artist_id::text
  then
    raise exception using errcode='40001',
      message='Release primary Artist differs from the reviewed expected Artist.';
  end if;

  if v_snapshot->>'track_state_fingerprint'
       is distinct from lower(
         btrim(p_expected_track_state_fingerprint)
       )
  then
    raise exception using errcode='40001',
      message='Registry Track changed since the reviewed admission audit.';
  end if;

  if v_snapshot->>'admission_state'='already_current' then
    return jsonb_build_object(
      'review_id',p_review_id,
      'track_id',p_track_id,
      'release_id',v_snapshot->>'release_id',
      'artist_id',p_expected_artist_id,
      'relation_id',v_snapshot->>'relation_id',
      '_authority',
        jsonb_build_object(
          'mode','already_current',
          'verified',true,
          'operation_key',
            'registry.track_artist_credit.release_primary_reviewed_admit',
          'operation_version',1
        )
    );
  end if;

  if v_snapshot->>'admission_state'<>'admit' then
    raise exception using errcode='23514',
      message='Release-primary reviewed admission state is not executable.';
  end if;

  v_evidence_id:=
    platform_private.record_registry_release_primary_review_evidence_v1(
      p_review_id,
      p_track_id,
      v_snapshot
    );

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  v_plan:=jsonb_build_object(
    'operation_key',
      'registry.track_artist_credit.release_primary_reviewed_admit',
    'operation_version',1,
    'review_id',p_review_id,
    'rule_id',v_snapshot->>'rule_id',
    'rule_version',v_snapshot->>'rule_version',
    'track_id',p_track_id,
    'expected_track_state_fingerprint',
      v_snapshot->>'track_state_fingerprint',
    'release_id',v_snapshot->>'release_id',
    'release_membership_id',
      v_snapshot->>'release_membership_id',
    'release_primary_credit_id',
      v_snapshot->>'release_primary_credit_id',
    'artist_id',v_snapshot->>'artist_id',
    'artist_slug',v_snapshot->>'artist_slug',
    'artist_name',v_snapshot->>'artist_name',
    'relation_id',v_snapshot->>'relation_id',
    'collision_fingerprint',
      v_snapshot->>'collision_fingerprint',
    'release_evidence_fingerprint',
      v_snapshot->>'release_evidence_fingerprint',
    'evidence_assertion_id',v_evidence.id,
    'evidence_assertion_fingerprint',
      v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version',
      'registry-release-primary-review-v1'
  );

  v_grant_id:=
    platform_private.issue_registry_release_primary_review_grant_v1(
      v_evidence.id,
      p_track_id,
      v_plan,
      v_snapshot->>'track_state_fingerprint'
    );

  select *
  into v_execution
  from platform_private.execute_registry_release_primary_review_admit_v1(
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_release_primary_review_admit_v1(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='Release-primary reviewed Track-credit independent verification failed.';
  end if;

  return jsonb_build_object(
    'review_id',p_review_id,
    'track_id',p_track_id,
    'release_id',v_snapshot->>'release_id',
    'artist_id',p_expected_artist_id,
    'relation_id',v_snapshot->>'relation_id',
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status,
    'idempotent_replay',v_execution.idempotent_replay,
    '_authority',
      jsonb_build_object(
        'mode','exact_operation',
        'verified',true,
        'operation_key',
          'registry.track_artist_credit.release_primary_reviewed_admit',
        'operation_version',1
      )
  );
end
$$;

revoke all on function
  public.admin_admit_registry_track_primary_from_release_v1(
    uuid,uuid,uuid,text
  )
from public,anon,service_role;

grant execute on function
  public.admin_admit_registry_track_primary_from_release_v1(
    uuid,uuid,uuid,text
  )
to authenticated;

revoke all on function
  platform_private.registry_release_primary_review_current_admin_v1()
from public,anon,authenticated,service_role;

revoke all on function
  platform_private.registry_release_primary_review_relation_uuid_v1(uuid,uuid)
from public,anon,authenticated,service_role;

revoke all on function
  platform_private.registry_release_primary_review_snapshot_v1(uuid,uuid)
from public,anon,authenticated,service_role;

revoke all on function
  platform_private.record_registry_release_primary_review_evidence_v1(uuid,uuid,jsonb)
from public,anon,authenticated,service_role;

revoke all on function
  platform_private.issue_registry_release_primary_review_grant_v1(uuid,uuid,jsonb,text)
from public,anon,authenticated,service_role;

revoke all on function
  platform_private.execute_registry_release_primary_review_admit_v1(uuid)
from public,anon,authenticated,service_role;

revoke all on function
  platform_private.verify_registry_release_primary_review_admit_v1(uuid)
from public,anon,authenticated,service_role;

do $postflight$
begin
  if exists (
       select 1
       from public.role_capabilities
       where capability_key=
         'admit_registry_track_primary_from_release_review'
     )
  then
    raise exception
      'STOP: Release-primary reviewed admission capability leaked into product roles';
  end if;

  if exists (
       select 1
       from platform_private.system_actor_capability_grants
       where actor_key='registry_release_primary_admin'
     )
  then
    raise exception
      'STOP: Release-primary reviewed admission must not install standing System Actor grants';
  end if;
end
$postflight$;

commit;
