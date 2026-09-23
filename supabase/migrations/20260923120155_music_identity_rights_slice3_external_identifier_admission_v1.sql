-- WAKILISHA Music Identity & Rights Foundation
-- Slice 3: governed external identifier candidate admission.
--
-- Enables only registry.external_identifier_assertion.admit/v1.
-- Reviewed reconcile remains disabled.
-- No historical data is mutated by this migration.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'music-identity-rights-slice3-external-identifier-admission-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_external_identifier_assertions') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('platform_private.registry_execution_target_set_fingerprint(uuid)') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception
      'STOP: accepted Registry external-identifier authority foundation is missing';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.external_identifier_assertion.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key='admit_registry_external_identifier_assertion'
      and operation_type.risk_class='medium'
      and operation_type.allowed_subject_types=array['external_identifier_assertion']::text[]
      and not operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and not operation_type.enabled
  ) then
    raise exception
      'STOP: Slice 2 external identifier admission operation is missing, malformed, or already enabled';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.external_identifier_assertion.reviewed_reconcile'
      and operation_type.operation_version=1
      and not operation_type.enabled
  ) then
    raise exception
      'STOP: external identifier reviewed reconcile must remain disabled';
  end if;

  if exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_external_identifier_admin'
     )
     or to_regprocedure(
       'platform_private.registry_external_identifier_admin_current_user_v1()'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_external_identifier_candidate_state_v1(text,uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_external_identifier_subject_lock_v1(text,uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_external_identifier_existing_v1(text,uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.record_registry_external_identifier_admin_evidence_v1(uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'platform_private.issue_registry_external_identifier_admin_grant_v1(uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_external_identifier_admin_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_external_identifier_admin_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_admit_registry_external_identifier_candidate_v1(text,uuid,text,text)'
     ) is not null
  then
    raise exception
      'STOP: Slice 3 external identifier admission runtime already exists; audit before reapplying';
  end if;
end
$preflight$;

insert into platform_private.system_actors (
  actor_key,
  label,
  actor_kind,
  status,
  capability_profile
)
values (
  'registry_external_identifier_admin',
  'Registry External Identifier Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_family',
      jsonb_build_array(
        'registry.external_identifier_assertion.admit/v1'
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
  'registry_external_identifier_admin',
  'database_role',
  'authenticator',
  'active'
);

update platform_private.registry_operation_types
set
  enabled=true,
  description=
    'Admit one exact retained-evidence external identifier candidate through the human reviewed Slice 3 broker.'
where operation_key='registry.external_identifier_assertion.admit'
  and operation_version=1
  and capability_key='admit_registry_external_identifier_assertion'
  and not enabled;

create function
platform_private.registry_external_identifier_admin_current_user_v1()
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
    where binding.actor_key='registry_external_identifier_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry external identifier admin broker.';
  end if;

  return v_user_id;
end
$$;

create function
platform_private.registry_external_identifier_subject_lock_v1(
  p_subject_type text,
  p_subject_id uuid
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
begin
  if p_subject_type='artist' then
    perform 1
    from public.registry_artists artist
    where artist.id=p_subject_id
      and artist.status<>'archived'
    for update;
  elsif p_subject_type='track' then
    perform 1
    from public.registry_tracks track
    where track.id=p_subject_id
      and track.status<>'archived'
    for update;
  elsif p_subject_type='release' then
    perform 1
    from public.registry_releases release
    where release.id=p_subject_id
      and release.status<>'archived'
    for update;
  else
    raise exception using errcode='22023',
      message='Slice 3 provider identifier admission supports only artist, track, or release subjects.';
  end if;

  if not found then
    raise exception using errcode='P0002',
      message='Registry identifier subject is missing or archived.';
  end if;
end
$$;

create function
platform_private.registry_external_identifier_candidate_state_v1(
  p_subject_type text,
  p_subject_id uuid,
  p_scheme_key text,
  p_source_value text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public
as $$
declare
  v_scheme text:=lower(nullif(btrim(coalesce(p_scheme_key,'')),''));
  v_value text:=nullif(btrim(coalesce(p_source_value,'')),'');
  v_metadata jsonb;
  v_status text;
  v_source_keys text[]:='{}'::text[];
  v_assignment_count integer:=0;
  v_assertion_conflict_count integer:=0;
begin
  if p_subject_id is null or v_scheme is null or v_value is null then
    raise exception using errcode='22023',
      message='subject, scheme, and source value are required.';
  end if;

  if p_subject_type='artist' then
    select artist.metadata,artist.status
    into v_metadata,v_status
    from public.registry_artists artist
    where artist.id=p_subject_id;
  elsif p_subject_type='track' then
    select track.metadata,track.status
    into v_metadata,v_status
    from public.registry_tracks track
    where track.id=p_subject_id;
  elsif p_subject_type='release' then
    select release.metadata,release.status
    into v_metadata,v_status
    from public.registry_releases release
    where release.id=p_subject_id;
  else
    raise exception using errcode='22023',
      message='Slice 3 provider identifier admission supports only artist, track, or release subjects.';
  end if;

  if not found or v_status='archived' then
    raise exception using errcode='P0002',
      message='Registry identifier subject is missing or archived.';
  end if;

  if p_subject_type='artist' and v_scheme='apple_music' then
    if nullif(btrim(v_metadata->>'apple_music_id'),'')=v_value then
      v_source_keys:=array['apple_music_id']::text[];
    end if;

    select count(distinct artist.id)::integer
    into v_assignment_count
    from public.registry_artists artist
    where nullif(btrim(artist.metadata->>'apple_music_id'),'')=v_value;

  elsif p_subject_type='artist' and v_scheme='spotify' then
    if nullif(btrim(v_metadata->>'spotify_artist_id'),'')=v_value then
      v_source_keys:=array_append(v_source_keys,'spotify_artist_id');
    end if;
    if nullif(btrim(v_metadata->>'spotify_id'),'')=v_value then
      v_source_keys:=array_append(v_source_keys,'spotify_id');
    end if;

    select count(distinct artist.id)::integer
    into v_assignment_count
    from public.registry_artists artist
    where (
        nullif(btrim(artist.metadata->>'spotify_artist_id'),'')=v_value
        or nullif(btrim(artist.metadata->>'spotify_id'),'')=v_value
      );

  elsif p_subject_type='track' and v_scheme='apple_music' then
    if nullif(btrim(v_metadata->>'apple_music_track_id'),'')=v_value then
      v_source_keys:=array['apple_music_track_id']::text[];
    end if;

    select count(distinct track.id)::integer
    into v_assignment_count
    from public.registry_tracks track
    where nullif(btrim(track.metadata->>'apple_music_track_id'),'')=v_value;

  elsif p_subject_type='release' and v_scheme='apple_music' then
    if nullif(btrim(v_metadata->>'apple_music_album_id'),'')=v_value then
      v_source_keys:=array['apple_music_album_id']::text[];
    end if;

    select count(distinct release.id)::integer
    into v_assignment_count
    from public.registry_releases release
    where nullif(btrim(release.metadata->>'apple_music_album_id'),'')=v_value;

  else
    raise exception using errcode='22023',
      message='Subject/scheme pair is outside the accepted Slice 3 retained-provider contract.';
  end if;

  if p_subject_type='artist' then
    select count(*)::integer
    into v_assertion_conflict_count
    from public.registry_external_identifier_assertions assertion
    where assertion.artist_id is not null
      and assertion.artist_id<>p_subject_id
      and assertion.scheme_key=v_scheme
      and assertion.comparison_value=v_value
      and assertion.issuer_namespace is null
      and assertion.valid_to is null
      and assertion.assertion_status not in ('rejected','superseded');
  elsif p_subject_type='track' then
    select count(*)::integer
    into v_assertion_conflict_count
    from public.registry_external_identifier_assertions assertion
    where assertion.track_id is not null
      and assertion.track_id<>p_subject_id
      and assertion.scheme_key=v_scheme
      and assertion.comparison_value=v_value
      and assertion.issuer_namespace is null
      and assertion.valid_to is null
      and assertion.assertion_status not in ('rejected','superseded');
  elsif p_subject_type='release' then
    select count(*)::integer
    into v_assertion_conflict_count
    from public.registry_external_identifier_assertions assertion
    where assertion.release_id is not null
      and assertion.release_id<>p_subject_id
      and assertion.scheme_key=v_scheme
      and assertion.comparison_value=v_value
      and assertion.issuer_namespace is null
      and assertion.valid_to is null
      and assertion.assertion_status not in ('rejected','superseded');
  end if;

  if cardinality(v_source_keys)=0 then
    raise exception using errcode='23514',
      message='WK_STALE_EXTERNAL_IDENTIFIER_SOURCE: retained Registry metadata no longer carries this exact provider identifier.';
  end if;

  return jsonb_build_object(
    'subject_type',p_subject_type,
    'subject_id',p_subject_id::text,
    'subject_status',v_status,
    'scheme_key',v_scheme,
    'source_value',v_value,
    'comparison_value',v_value,
    'source_keys',to_jsonb(v_source_keys),
    'canonical_entity_count',v_assignment_count,
    'conflicting_current_assertion_count',v_assertion_conflict_count,
    'candidate_state',
      case
        when v_assignment_count=1
         and v_assertion_conflict_count=0
          then 'deterministic_candidate'
        else 'review_only_duplicate_assignment'
      end
  );
end
$$;

create function
platform_private.registry_external_identifier_existing_v1(
  p_subject_type text,
  p_subject_id uuid,
  p_scheme_key text,
  p_comparison_value text
)
returns uuid
language plpgsql
stable
security definer
set search_path=pg_catalog,public
as $
declare
  v_assertion_id uuid;
begin
  if p_subject_type='artist' then
    select assertion.id
    into v_assertion_id
    from public.registry_external_identifier_assertions assertion
    where assertion.artist_id=p_subject_id
      and assertion.scheme_key=p_scheme_key
      and assertion.comparison_value=p_comparison_value
      and assertion.issuer_namespace is null
      and assertion.valid_to is null
      and assertion.assertion_status not in ('rejected','superseded')
    order by
      case assertion.assertion_status
        when 'accepted' then 0
        when 'candidate' then 1
        when 'disputed' then 2
        else 3
      end,
      assertion.created_at,
      assertion.id
    limit 1;
  elsif p_subject_type='track' then
    select assertion.id
    into v_assertion_id
    from public.registry_external_identifier_assertions assertion
    where assertion.track_id=p_subject_id
      and assertion.scheme_key=p_scheme_key
      and assertion.comparison_value=p_comparison_value
      and assertion.issuer_namespace is null
      and assertion.valid_to is null
      and assertion.assertion_status not in ('rejected','superseded')
    order by
      case assertion.assertion_status
        when 'accepted' then 0
        when 'candidate' then 1
        when 'disputed' then 2
        else 3
      end,
      assertion.created_at,
      assertion.id
    limit 1;
  elsif p_subject_type='release' then
    select assertion.id
    into v_assertion_id
    from public.registry_external_identifier_assertions assertion
    where assertion.release_id=p_subject_id
      and assertion.scheme_key=p_scheme_key
      and assertion.comparison_value=p_comparison_value
      and assertion.issuer_namespace is null
      and assertion.valid_to is null
      and assertion.assertion_status not in ('rejected','superseded')
    order by
      case assertion.assertion_status
        when 'accepted' then 0
        when 'candidate' then 1
        when 'disputed' then 2
        else 3
      end,
      assertion.created_at,
      assertion.id
    limit 1;
  else
    raise exception using errcode='22023',
      message='Unsupported Registry identifier subject type.';
  end if;

  return v_assertion_id;
end
$;

create function
platform_private.record_registry_external_identifier_admin_evidence_v1(
  p_future_assertion_id uuid,
  p_candidate_state jsonb
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid;
  v_source_payload_fingerprint text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
  v_source_ref text;
begin
  v_user_id:=
    platform_private.registry_external_identifier_admin_current_user_v1();

  if p_future_assertion_id is null
     or p_candidate_state is null
     or jsonb_typeof(p_candidate_state)<>'object'
     or p_candidate_state->>'candidate_state'<>'deterministic_candidate'
     or coalesce((p_candidate_state->>'canonical_entity_count')::integer,0)<>1
     or coalesce(
          (p_candidate_state->>'conflicting_current_assertion_count')::integer,
          0
        )<>0
  then
    raise exception using errcode='22023',
      message='Exact deterministic external identifier candidate state is required.';
  end if;

  v_source_payload_fingerprint:=
    encode(
      extensions.digest(p_candidate_state::text,'sha256'),
      'hex'
    );

  v_source_ref:=
    'retained-registry-metadata:'||
    (p_candidate_state->>'subject_type')||':'||
    (p_candidate_state->>'subject_id')||':'||
    (p_candidate_state->>'scheme_key');

  v_assertion_fingerprint:=
    encode(
      extensions.digest(
        jsonb_build_object(
          'subject_type','external_identifier_assertion',
          'subject_id',p_future_assertion_id::text,
          'claim_key','registry.external_identifier_assertion.admit',
          'claim_payload',p_candidate_state,
          'trust_class','INTERNAL_FACT',
          'source_kind','retained_registry_metadata',
          'source_ref',v_source_ref,
          'source_payload_fingerprint',v_source_payload_fingerprint,
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
    'external_identifier_assertion',
    p_future_assertion_id,
    'registry.external_identifier_assertion.admit',
    p_candidate_state,
    'INTERNAL_FACT',
    'retained_registry_metadata',
    v_source_ref,
    v_source_payload_fingerprint,
    now(),
    'user:'||v_user_id::text,
    v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint)
  do nothing
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
platform_private.issue_registry_external_identifier_admin_grant_v1(
  p_evidence_assertion_id uuid,
  p_future_assertion_id uuid
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
  v_plan jsonb;
  v_plan_fingerprint text;
  v_target_set jsonb;
  v_target_fingerprint text;
  v_idempotency_key text;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_grant_id uuid;
begin
  v_user_id:=
    platform_private.registry_external_identifier_admin_current_user_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.external_identifier_assertion.admit'
    and operation_type.operation_version=1
    and operation_type.capability_key='admit_registry_external_identifier_assertion'
    and operation_type.enabled;

  if not found
     or v_operation_type.allowed_subject_types<>
          array['external_identifier_assertion']::text[]
     or v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<>1
     or v_operation_type.max_grant_ttl_seconds<>300
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry external identifier admission operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'external_identifier_assertion'
     or v_evidence.subject_id<>p_future_assertion_id
     or v_evidence.claim_key<>'registry.external_identifier_assertion.admit'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'retained_registry_metadata'
     or v_evidence.recorded_by_principal_key<>
          'user:'||v_user_id::text
     or v_evidence.claim_payload->>'candidate_state'<>
          'deterministic_candidate'
     or coalesce(
          (v_evidence.claim_payload->>'canonical_entity_count')::integer,
          0
        )<>1
     or coalesce(
          (v_evidence.claim_payload->>'conflicting_current_assertion_count')::integer,
          0
        )<>0
  then
    raise exception using errcode='42501',
      message='Evidence is not caller-bound deterministic external identifier authority.';
  end if;

  v_plan:=jsonb_build_object(
    'operation_key','registry.external_identifier_assertion.admit',
    'operation_version',1,
    'future_assertion_id',p_future_assertion_id::text,
    'candidate_state',v_evidence.claim_payload,
    'candidate_state_fingerprint',
      encode(
        extensions.digest(v_evidence.claim_payload::text,'sha256'),
        'hex'
      ),
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version',
      'registry-external-identifier-admission-v1'
  );

  v_plan_fingerprint:=
    platform_private.registry_plan_fingerprint(v_plan);

  v_target_set:=jsonb_build_array(
    jsonb_build_object(
      'subject_type','external_identifier_assertion',
      'subject_id',p_future_assertion_id::text,
      'expected_state_fingerprint',null
    )
  );

  v_target_fingerprint:=
    encode(
      extensions.digest(v_target_set::text,'sha256'),
      'hex'
    );

  v_idempotency_key:=
    'registry-external-id-admit:'||
    encode(
      extensions.digest(
        (
          v_evidence.assertion_fingerprint||':'||
          p_future_assertion_id::text
        ),
        'sha256'
      ),
      'hex'
    );

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_external_identifier_admin'
    and execution_grant.operation_key=
          'registry.external_identifier_assertion.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
    then
      raise exception using errcode='23505',
        message='External identifier idempotency key is bound to different authority.';
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
    'registry_external_identifier_admin',
    'admit_registry_external_identifier_assertion',
    null,
    'registry.external_identifier_assertion.admit',
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-external-identifier-admission-v1',
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
    'external_identifier_assertion',
    p_future_assertion_id,
    null
  );

  if platform_private.registry_execution_target_set_fingerprint(v_grant_id)
       <> v_target_fingerprint
  then
    raise exception using errcode='23514',
      message='External identifier exact target-set fingerprint drifted.';
  end if;

  return v_grant_id;
end
$$;

create function
platform_private.execute_registry_external_identifier_admin_v1(
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
set search_path=pg_catalog,public,platform_private,extensions
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_candidate jsonb;
  v_current_candidate jsonb;
  v_current_candidate_fingerprint text;
  v_subject_type text;
  v_subject_id uuid;
  v_scheme text;
  v_value text;
  v_existing_assertion_id uuid;
  v_inserted public.registry_external_identifier_assertions%rowtype;
  v_event_id uuid;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_external_identifier_admin',
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
     or v_grant.actor_key<>'registry_external_identifier_admin'
     or v_grant.operation_key<>
          'registry.external_identifier_assertion.admit'
     or v_grant.operation_version<>1
     or v_grant.capability_key<>
          'admit_registry_external_identifier_assertion'
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>
          'registry-external-identifier-admission-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Slice 3 external identifier admission grant.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or v_target.subject_type<>'external_identifier_assertion'
     or v_target.expected_state_fingerprint is not null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     )<>1
  then
    raise exception using errcode='42501',
      message='External identifier admission requires one exact future assertion target.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_candidate:=v_plan->'candidate_state';

  if (v_plan-array[
       'operation_key',
       'operation_version',
       'future_assertion_id',
       'candidate_state',
       'candidate_state_fingerprint',
       'evidence_assertion_id',
       'evidence_assertion_fingerprint',
       'trust_class',
       'policy_ruleset_version'
     ]::text[])<>'{}'::jsonb
     or v_plan->>'operation_key'<>
          'registry.external_identifier_assertion.admit'
     or coalesce((v_plan->>'operation_version')::integer,0)<>1
     or v_plan->>'future_assertion_id'<>v_target.subject_id::text
     or v_plan->>'policy_ruleset_version'<>
          'registry-external-identifier-admission-v1'
  then
    raise exception using errcode='42501',
      message='External identifier execution plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>'external_identifier_assertion'
     or v_evidence.subject_id<>v_target.subject_id
     or v_evidence.claim_key<>'registry.external_identifier_assertion.admit'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'retained_registry_metadata'
     or v_evidence.assertion_fingerprint<>
          v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.claim_payload<>v_candidate
  then
    raise exception using errcode='42501',
      message='Bound external identifier evidence no longer satisfies the exact plan.';
  end if;

  v_subject_type:=v_candidate->>'subject_type';
  v_subject_id:=(v_candidate->>'subject_id')::uuid;
  v_scheme:=v_candidate->>'scheme_key';
  v_value:=v_candidate->>'source_value';

  perform platform_private.registry_external_identifier_subject_lock_v1(
    v_subject_type,
    v_subject_id
  );

  v_current_candidate:=
    platform_private.registry_external_identifier_candidate_state_v1(
      v_subject_type,
      v_subject_id,
      v_scheme,
      v_value
    );

  v_current_candidate_fingerprint:=
    encode(
      extensions.digest(v_current_candidate::text,'sha256'),
      'hex'
    );

  if v_current_candidate_fingerprint<>
       v_plan->>'candidate_state_fingerprint'
     or v_current_candidate->>'candidate_state'<>
          'deterministic_candidate'
     or coalesce(
          (v_current_candidate->>'canonical_entity_count')::integer,
          0
        )<>1
     or coalesce(
          (v_current_candidate->>'conflicting_current_assertion_count')::integer,
          0
        )<>0
  then
    raise exception using errcode='P0001',
      message='WK_STALE_EXTERNAL_IDENTIFIER_CANDIDATE: retained provider identity changed after review.';
  end if;

  v_existing_assertion_id:=
    platform_private.registry_external_identifier_existing_v1(
      v_subject_type,
      v_subject_id,
      v_scheme,
      v_value
    );

  if v_existing_assertion_id is not null then
    raise exception using errcode='23505',
      message='An equivalent current external identifier assertion already exists.';
  end if;

  if v_subject_type='artist' then
    insert into public.registry_external_identifier_assertions (
      id,
      artist_id,
      scheme_key,
      source_value,
      comparison_value,
      assertion_status,
      evidence_assertion_id
    )
    values (
      v_target.subject_id,
      v_subject_id,
      v_scheme,
      v_value,
      v_value,
      'candidate',
      v_evidence.id
    )
    returning * into v_inserted;
  elsif v_subject_type='track' then
    insert into public.registry_external_identifier_assertions (
      id,
      track_id,
      scheme_key,
      source_value,
      comparison_value,
      assertion_status,
      evidence_assertion_id
    )
    values (
      v_target.subject_id,
      v_subject_id,
      v_scheme,
      v_value,
      v_value,
      'candidate',
      v_evidence.id
    )
    returning * into v_inserted;
  elsif v_subject_type='release' then
    insert into public.registry_external_identifier_assertions (
      id,
      release_id,
      scheme_key,
      source_value,
      comparison_value,
      assertion_status,
      evidence_assertion_id
    )
    values (
      v_target.subject_id,
      v_subject_id,
      v_scheme,
      v_value,
      v_value,
      'candidate',
      v_evidence.id
    )
    returning * into v_inserted;
  else
    raise exception using errcode='22023',
      message='Unsupported external identifier subject type.';
  end if;

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
    v_subject_type,
    v_subject_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'external_identifier.'||v_scheme,
    'public.registry_external_identifier_assertions',
    null,
    to_jsonb(v_inserted),
    'admit_external_identifier_assertion',
    'succeeded',
    'system:registry_external_identifier_admin'
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
  set
    affected_rows=1,
    status='succeeded',
    verifier_status='pending',
    result_payload=jsonb_build_object(
      'external_identifier_assertion_id',v_inserted.id,
      'canonical_subject_type',v_subject_type,
      'canonical_subject_id',v_subject_id,
      'scheme_key',v_scheme,
      'source_value',v_value,
      'assertion_status',v_inserted.assertion_status,
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

create function
platform_private.verify_registry_external_identifier_admin_v1(
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
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_assertion public.registry_external_identifier_assertions%rowtype;
  v_plan jsonb;
  v_candidate jsonb;
  v_subject_type text;
  v_subject_id uuid;
  v_event_count integer;
  v_valid_event_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_external_identifier_admin'
     or v_operation.operation_key<>
          'registry.external_identifier_assertion.admit'
     or v_operation.operation_version<>1
     or v_operation.capability_key<>
          'admit_registry_external_identifier_assertion'
  then
    raise exception using errcode='P0002',
      message='Registry External Identifier Admin V1 operation not found.';
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
       or v_grant.actor_key<>'registry_external_identifier_admin'
       or v_grant.policy_ruleset_version<>
            'registry-external-identifier-admission-v1'
     )
  then
    v_failure:='execution_grant_missing_or_wrong_actor';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_candidate:=v_plan->'candidate_state';
    v_subject_type:=v_candidate->>'subject_type';
    v_subject_id:=(v_candidate->>'subject_id')::uuid;

    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id=v_grant.id
      and target.subject_type='external_identifier_assertion';

    if not found
       or (
         select count(*)
         from platform_private.registry_execution_grant_targets target_count
         where target_count.execution_grant_id=v_grant.id
       )<>1
    then
      v_failure:='exact_future_assertion_target_missing';
    end if;
  end if;

  if v_failure is null then
    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=(v_plan->>'evidence_assertion_id')::uuid
      and assertion.subject_type='external_identifier_assertion'
      and assertion.subject_id=v_target.subject_id
      and assertion.claim_key='registry.external_identifier_assertion.admit'
      and assertion.trust_class='INTERNAL_FACT'
      and assertion.source_kind='retained_registry_metadata'
      and assertion.assertion_fingerprint=
          v_plan->>'evidence_assertion_fingerprint';

    if not found or v_evidence.claim_payload<>v_candidate then
      v_failure:='bound_evidence_missing';
    end if;
  end if;

  if v_failure is null then
    select assertion.*
    into v_assertion
    from public.registry_external_identifier_assertions assertion
    where assertion.id=v_target.subject_id;

    if not found
       or v_assertion.scheme_key<>v_candidate->>'scheme_key'
       or v_assertion.source_value<>v_candidate->>'source_value'
       or v_assertion.comparison_value<>
            v_candidate->>'comparison_value'
       or v_assertion.assertion_status<>'candidate'
       or v_assertion.verification_method is not null
       or v_assertion.verified_by is not null
       or v_assertion.verified_at is not null
       or v_assertion.evidence_assertion_id<>v_evidence.id
       or (
         v_subject_type='artist'
         and (
           v_assertion.artist_id<>v_subject_id
           or num_nonnulls(
                v_assertion.track_id,
                v_assertion.release_id,
                v_assertion.work_id,
                v_assertion.person_resource_id,
                v_assertion.organization_resource_id
              )<>0
         )
       )
       or (
         v_subject_type='track'
         and (
           v_assertion.track_id<>v_subject_id
           or num_nonnulls(
                v_assertion.artist_id,
                v_assertion.release_id,
                v_assertion.work_id,
                v_assertion.person_resource_id,
                v_assertion.organization_resource_id
              )<>0
         )
       )
       or (
         v_subject_type='release'
         and (
           v_assertion.release_id<>v_subject_id
           or num_nonnulls(
                v_assertion.artist_id,
                v_assertion.track_id,
                v_assertion.work_id,
                v_assertion.person_resource_id,
                v_assertion.organization_resource_id
              )<>0
         )
       )
    then
      v_failure:='external_identifier_assertion_state_mismatch';
    end if;
  end if;

  if v_failure is null
     and encode(
           extensions.digest(
             platform_private.registry_external_identifier_candidate_state_v1(
               v_subject_type,
               v_subject_id,
               v_candidate->>'scheme_key',
               v_candidate->>'source_value'
             )::text,
             'sha256'
           ),
           'hex'
         )<>v_plan->>'candidate_state_fingerprint'
  then
    v_failure:='retained_provider_candidate_state_changed';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    where link.operation_id=v_operation.id;

    select count(*)::integer
    into v_valid_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type=v_subject_type
      and event.registry_entity_id=v_subject_id::text
      and event.source_suggestion_id=v_evidence.id::text
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.field_name=
          'external_identifier.'||(v_candidate->>'scheme_key')
      and event.target_path=
          'public.registry_external_identifier_assertions'
      and event.action='admit_external_identifier_assertion'
      and event.status='succeeded'
      and event.actor='system:registry_external_identifier_admin'
      and event.before_value is null
      and event.after_value->>'id'=v_assertion.id::text;

    if v_event_count<>1 or v_valid_event_count<>1 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set
      verifier_status='passed',
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
  set
    verifier_status='failed',
    error_code='registry_external_identifier_admin_verification_failed',
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

create function
public.admin_admit_registry_external_identifier_candidate_v1(
  p_subject_type text,
  p_subject_id uuid,
  p_scheme_key text,
  p_source_value text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid;
  v_subject_type text:=lower(nullif(btrim(coalesce(p_subject_type,'')),''));
  v_scheme text:=lower(nullif(btrim(coalesce(p_scheme_key,'')),''));
  v_value text:=nullif(btrim(coalesce(p_source_value,'')),'');
  v_candidate jsonb;
  v_existing_assertion_id uuid;
  v_existing public.registry_external_identifier_assertions%rowtype;
  v_future_assertion_id uuid;
  v_evidence_id uuid;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_assertion public.registry_external_identifier_assertions%rowtype;
begin
  v_user_id:=
    platform_private.registry_external_identifier_admin_current_user_v1();

  if v_subject_type is null
     or p_subject_id is null
     or v_scheme is null
     or v_value is null
  then
    raise exception using errcode='22023',
      message='subject type, subject id, scheme, and source value are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry-external-id:'||
      v_subject_type||':'||
      p_subject_id::text||':'||
      v_scheme||':'||
      v_value,
      0
    )
  );

  perform platform_private.registry_external_identifier_subject_lock_v1(
    v_subject_type,
    p_subject_id
  );

  v_candidate:=
    platform_private.registry_external_identifier_candidate_state_v1(
      v_subject_type,
      p_subject_id,
      v_scheme,
      v_value
    );

  if v_candidate->>'candidate_state'<>'deterministic_candidate'
     or coalesce(
          (v_candidate->>'canonical_entity_count')::integer,
          0
        )<>1
     or coalesce(
          (v_candidate->>'conflicting_current_assertion_count')::integer,
          0
        )<>0
  then
    raise exception using errcode='23514',
      message='WK_EXTERNAL_IDENTIFIER_REVIEW_REQUIRED: provider identifier is assigned to more than one canonical UUID.';
  end if;

  v_existing_assertion_id:=
    platform_private.registry_external_identifier_existing_v1(
      v_subject_type,
      p_subject_id,
      v_scheme,
      v_value
    );

  if v_existing_assertion_id is not null then
    select assertion.*
    into v_existing
    from public.registry_external_identifier_assertions assertion
    where assertion.id=v_existing_assertion_id;

    return to_jsonb(v_existing)||
      jsonb_build_object(
        '_authority',
        jsonb_build_object(
          'mode','already_current',
          'verified',true,
          'operation_key',
            'registry.external_identifier_assertion.admit',
          'operation_version',1
        )
      );
  end if;

  v_future_assertion_id:=gen_random_uuid();

  v_evidence_id:=
    platform_private.record_registry_external_identifier_admin_evidence_v1(
      v_future_assertion_id,
      v_candidate
    );

  v_grant_id:=
    platform_private.issue_registry_external_identifier_admin_grant_v1(
      v_evidence_id,
      v_future_assertion_id
    );

  select *
  into v_exec
  from platform_private.execute_registry_external_identifier_admin_v1(
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_external_identifier_admin_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='WK_EXTERNAL_IDENTIFIER_VERIFIER_FAILED: external identifier admission verification failed.';
  end if;

  select assertion.*
  into v_assertion
  from public.registry_external_identifier_assertions assertion
  where assertion.id=v_future_assertion_id;

  if not found then
    raise exception using errcode='P0002',
      message='Verified external identifier assertion is missing.';
  end if;

  return to_jsonb(v_assertion)||
    jsonb_build_object(
      '_authority',
      jsonb_build_object(
        'mode','exact_operation',
        'verified',true,
        'operation_id',v_exec.operation_id,
        'execution_grant_id',v_grant_id,
        'evidence_assertion_id',v_evidence_id,
        'idempotent_replay',v_exec.idempotent_replay,
        'operation_key',
          'registry.external_identifier_assertion.admit',
        'operation_version',1
      )
    );
end
$$;

revoke all on function
  platform_private.registry_external_identifier_admin_current_user_v1(),
  platform_private.registry_external_identifier_subject_lock_v1(text,uuid),
  platform_private.registry_external_identifier_candidate_state_v1(text,uuid,text,text),
  platform_private.registry_external_identifier_existing_v1(text,uuid,text,text),
  platform_private.record_registry_external_identifier_admin_evidence_v1(uuid,jsonb),
  platform_private.issue_registry_external_identifier_admin_grant_v1(uuid,uuid),
  platform_private.execute_registry_external_identifier_admin_v1(uuid),
  platform_private.verify_registry_external_identifier_admin_v1(uuid)
from public,anon,authenticated,service_role;

revoke all on function
  public.admin_admit_registry_external_identifier_candidate_v1(
    text,uuid,text,text
  )
from public,anon,service_role;

grant execute on function
  public.admin_admit_registry_external_identifier_candidate_v1(
    text,uuid,text,text
  )
to authenticated;

do $proof$
declare
  v_definition text;
begin
  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_external_identifier_admin'
      and actor.status='active'
      and actor.capability_profile->'operation_family'
          @> '["registry.external_identifier_assertion.admit/v1"]'::jsonb
  ) then
    raise exception
      'Registry external identifier admin actor drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_external_identifier_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception
      'Registry external identifier admin authenticator binding drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key=
          'registry.external_identifier_assertion.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key=
          'admit_registry_external_identifier_assertion'
      and operation_type.enabled
      and operation_type.allowed_subject_types=
          array['external_identifier_assertion']::text[]
      and not operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception
      'External identifier admission operation did not enable exactly';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key=
          'registry.external_identifier_assertion.reviewed_reconcile'
      and operation_type.operation_version=1
      and operation_type.enabled
  ) then
    raise exception
      'External identifier reviewed reconcile enabled prematurely';
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
    raise exception
      'External identifier admission public wrapper grants drifted';
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
    raise exception
      'External identifier private executor leaked role authority';
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
    raise exception
      'External identifier assertion table leaked direct insert authority';
  end if;

  select pg_get_functiondef(
    'public.admin_admit_registry_external_identifier_candidate_v1(text,uuid,text,text)'::regprocedure
  )
  into v_definition;

  if position('WK_EXTERNAL_IDENTIFIER_REVIEW_REQUIRED' in v_definition)=0
     or position('registry.external_identifier_assertion.admit' in v_definition)=0
     or position('verify_registry_external_identifier_admin_v1' in v_definition)=0
  then
    raise exception
      'External identifier admission public composition drifted';
  end if;

  if exists (
       select 1
       from platform_private.registry_execution_grants execution_grant
       where execution_grant.actor_key='registry_external_identifier_admin'
     )
     or exists (
       select 1
       from platform_private.registry_mutation_operations operation
       where operation.actor_key='registry_external_identifier_admin'
     )
  then
    raise exception
      'External identifier admission migration activated durable execution residue';
  end if;
end
$proof$;

commit;
