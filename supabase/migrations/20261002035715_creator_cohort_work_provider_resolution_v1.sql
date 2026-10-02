begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'creator-cohort-work-provider-resolution-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_works') is null
     or to_regclass('public.registry_track_work_links') is null
     or to_regclass('public.registry_external_identifier_assertions') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regprocedure(
       'platform_private.registry_identity_normalize_text_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_provenance_admin_current_user_v1()'
     ) is null
     or to_regprocedure(
       'public.admin_create_registry_work_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_track_work_link_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_external_identifier_admin_current_user_v1()'
     ) is null
     or to_regprocedure(
       'platform_private.record_registry_external_identifier_admin_evidence_v1(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_external_identifier_admin_grant_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_registry_mutation_operation(text,uuid)'
     ) is null
  then
    raise exception
      'STOP: accepted Work / external-identifier authority foundation is missing';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.work.create'
      and operation_type.operation_version=1
      and operation_type.capability_key='create_registry_work'
      and operation_type.enabled
      and operation_type.allowed_subject_types=array['work']::text[]
      and not operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception 'STOP: Registry Work creation authority is missing or malformed';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.track_work_link.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key='admit_registry_track_work_link'
      and operation_type.enabled
      and operation_type.allowed_subject_types=array['track_work_link']::text[]
      and not operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception 'STOP: Registry Track-to-Work authority is missing or malformed';
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
    raise exception 'STOP: Registry external identifier authority is missing or malformed';
  end if;

  if to_regprocedure(
       'platform_private.registry_provider_work_uuid_v1(text,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_provider_track_work_link_uuid_v1(uuid,uuid,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_work_external_identifier_candidate_state_v1(uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_work_external_identifier_existing_v1(uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_work_external_identifier_admin_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_work_external_identifier_admin_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'public.record_registry_work_provider_observation_v1(uuid,text,text,text,text,text,text,timestamp with time zone,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.admin_admit_registry_work_external_identifier_candidate_v1(uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'public.admin_admit_registry_work_provider_observation_v1(uuid,uuid)'
     ) is not null
  then
    raise exception
      'STOP: Work provider resolution V1 already exists; audit before reapplying';
  end if;
end
$preflight$;

alter table public.registry_external_identifier_assertions
  drop constraint registry_external_identifier_assertions_scheme_check;

alter table public.registry_external_identifier_assertions
  add constraint registry_external_identifier_assertions_scheme_check
  check (
    scheme_key = any (
      array[
        'isrc'::text,
        'iswc'::text,
        'isni'::text,
        'ipi'::text,
        'ipn'::text,
        'gtin'::text,
        'upc'::text,
        'ean'::text,
        'apple_music'::text,
        'spotify'::text,
        'youtube'::text,
        'soundcloud'::text,
        'musicbrainz'::text,
        'ddex_party_id'::text,
        'other_reviewed'::text
      ]
    )
  );

create function platform_private.registry_provider_work_uuid_v1(
  p_provider_key text,
  p_provider_work_id text
)
returns uuid
language plpgsql
immutable
security definer
set search_path=pg_catalog,extensions
as $uuid$
declare
  v_provider_key text:=
    lower(nullif(btrim(coalesce(p_provider_key,'')),''));
  v_provider_work_id text:=
    lower(nullif(btrim(coalesce(p_provider_work_id,'')),''));
  v_hex text;
begin
  if v_provider_key is null
     or v_provider_key !~ '^[a-z0-9_]+$'
     or v_provider_work_id is null
  then
    raise exception using errcode='22023',
      message='Provider key and provider Work identity are required.';
  end if;

  v_hex:=encode(
    extensions.digest(
      'work.provider:'||v_provider_key||':'||v_provider_work_id,
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
$uuid$;

create function platform_private.registry_provider_track_work_link_uuid_v1(
  p_track_id uuid,
  p_work_id uuid,
  p_relationship_kind text
)
returns uuid
language plpgsql
immutable
security definer
set search_path=pg_catalog,extensions
as $uuid$
declare
  v_relationship_kind text:=
    lower(nullif(btrim(coalesce(p_relationship_kind,'')),''));
  v_hex text;
begin
  if p_track_id is null
     or p_work_id is null
     or v_relationship_kind is null
  then
    raise exception using errcode='22023',
      message='Track, Work, and relationship kind are required.';
  end if;

  v_hex:=encode(
    extensions.digest(
      'track.work:'||
      p_track_id::text||':'||
      p_work_id::text||':'||
      v_relationship_kind,
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
$uuid$;

create function platform_private.registry_work_external_identifier_candidate_state_v1(
  p_work_id uuid,
  p_scheme_key text,
  p_source_value text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public
as $candidate$
declare
  v_scheme text:=
    lower(nullif(btrim(coalesce(p_scheme_key,'')),''));
  v_source text:=nullif(btrim(coalesce(p_source_value,'')),'');
  v_comparison text;
  v_metadata jsonb;
  v_status text;
  v_retained_source text;
  v_assignment_count integer:=0;
  v_assertion_conflict_count integer:=0;
  v_source_key text;
begin
  if p_work_id is null
     or v_scheme not in ('musicbrainz','iswc')
     or v_source is null
  then
    raise exception using errcode='22023',
      message='Work UUID plus MusicBrainz/ISWC source value are required.';
  end if;

  select work.metadata,work.status
  into v_metadata,v_status
  from public.registry_works work
  where work.id=p_work_id;

  if not found or v_status='archived' then
    raise exception using errcode='P0002',
      message='Registry Work is missing or archived.';
  end if;

  if v_scheme='musicbrainz' then
    v_source_key:='musicbrainz_work_id';
    v_retained_source:=
      lower(nullif(btrim(v_metadata->>'musicbrainz_work_id'),''));
    v_source:=lower(v_source);
    v_comparison:=v_source;

    if v_source !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      raise exception using errcode='22023',
        message='MusicBrainz Work MBID must be a UUID.';
    end if;

    select count(distinct work.id)::integer
    into v_assignment_count
    from public.registry_works work
    where work.status<>'archived'
      and lower(nullif(btrim(work.metadata->>'musicbrainz_work_id'),''))=
            v_comparison;
  else
    v_source_key:='iswc';
    v_retained_source:=
      upper(
        regexp_replace(
          coalesce(v_metadata->>'iswc',''),
          '[^A-Za-z0-9]',
          '',
          'g'
        )
      );
    v_comparison:=
      upper(
        regexp_replace(
          v_source,
          '[^A-Za-z0-9]',
          '',
          'g'
        )
      );

    if v_comparison !~ '^T[0-9]{10}$' then
      raise exception using errcode='22023',
        message='ISWC must normalize to T plus ten digits.';
    end if;

    select count(distinct work.id)::integer
    into v_assignment_count
    from public.registry_works work
    where work.status<>'archived'
      and upper(
            regexp_replace(
              coalesce(work.metadata->>'iswc',''),
              '[^A-Za-z0-9]',
              '',
              'g'
            )
          )=v_comparison;
  end if;

  if nullif(v_retained_source,'') is null
     or v_retained_source<>v_comparison
  then
    raise exception using errcode='23514',
      message='WK_STALE_WORK_EXTERNAL_IDENTIFIER_SOURCE: Work metadata no longer carries this exact provider identifier.';
  end if;

  select count(*)::integer
  into v_assertion_conflict_count
  from public.registry_external_identifier_assertions assertion
  where assertion.work_id is not null
    and assertion.work_id<>p_work_id
    and assertion.scheme_key=v_scheme
    and assertion.comparison_value=v_comparison
    and assertion.issuer_namespace is null
    and assertion.valid_to is null
    and assertion.assertion_status not in ('rejected','superseded');

  return jsonb_build_object(
    'subject_type','work',
    'subject_id',p_work_id::text,
    'subject_status',v_status,
    'scheme_key',v_scheme,
    'source_value',v_source,
    'comparison_value',v_comparison,
    'source_keys',jsonb_build_array(v_source_key),
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
$candidate$;

create function platform_private.registry_work_external_identifier_existing_v1(
  p_work_id uuid,
  p_scheme_key text,
  p_comparison_value text
)
returns uuid
language sql
stable
security definer
set search_path=pg_catalog,public
as $existing$
  select assertion.id
  from public.registry_external_identifier_assertions assertion
  where assertion.work_id=p_work_id
    and assertion.scheme_key=lower(btrim(p_scheme_key))
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
$existing$;
create function platform_private.execute_registry_work_external_identifier_admin_v1(
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
as $execute$
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
  v_work_id uuid;
  v_scheme text;
  v_source text;
  v_comparison text;
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
      message='Execution grant is not Registry external identifier authority.';
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
      message='Work external identifier admission requires one exact future assertion target.';
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
     or v_candidate->>'subject_type'<>'work'
  then
    raise exception using errcode='42501',
      message='Work external identifier execution plan is malformed.';
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
      message='Bound Work external identifier evidence no longer satisfies the exact plan.';
  end if;

  v_work_id:=(v_candidate->>'subject_id')::uuid;
  v_scheme:=v_candidate->>'scheme_key';
  v_source:=v_candidate->>'source_value';
  v_comparison:=v_candidate->>'comparison_value';

  perform 1
  from public.registry_works work
  where work.id=v_work_id
    and work.status<>'archived'
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Registry Work is missing or archived.';
  end if;

  v_current_candidate:=
    platform_private.registry_work_external_identifier_candidate_state_v1(
      v_work_id,
      v_scheme,
      v_source
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
      message='WK_STALE_WORK_EXTERNAL_IDENTIFIER_CANDIDATE: retained Work provider identity changed after review.';
  end if;

  v_existing_assertion_id:=
    platform_private.registry_work_external_identifier_existing_v1(
      v_work_id,
      v_scheme,
      v_comparison
    );

  if v_existing_assertion_id is not null then
    raise exception using errcode='23505',
      message='An equivalent current Work external identifier assertion already exists.';
  end if;

  insert into public.registry_external_identifier_assertions (
    id,
    work_id,
    scheme_key,
    source_value,
    comparison_value,
    assertion_status,
    evidence_assertion_id
  )
  values (
    v_target.subject_id,
    v_work_id,
    v_scheme,
    v_source,
    v_comparison,
    'candidate',
    v_evidence.id
  )
  returning * into v_inserted;

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
    'work',
    v_work_id::text,
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
      'canonical_subject_type','work',
      'canonical_subject_id',v_work_id,
      'scheme_key',v_scheme,
      'source_value',v_source,
      'comparison_value',v_comparison,
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
$execute$;
create function platform_private.verify_registry_work_external_identifier_admin_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,extensions
as $verify$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_assertion public.registry_external_identifier_assertions%rowtype;
  v_plan jsonb;
  v_candidate jsonb;
  v_work_id uuid;
  v_event_count integer:=0;
  v_valid_event_count integer:=0;
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
      message='Work External Identifier Admin V1 operation not found.';
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
       or v_grant.operation_key<>
            'registry.external_identifier_assertion.admit'
       or v_grant.operation_version<>1
       or v_grant.policy_ruleset_version<>
            'registry-external-identifier-admission-v1'
     )
  then
    v_failure:='execution_grant_missing_or_wrong_actor';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_candidate:=v_plan->'candidate_state';

    if v_candidate->>'subject_type'<>'work' then
      v_failure:='candidate_subject_is_not_work';
    else
      v_work_id:=(v_candidate->>'subject_id')::uuid;
    end if;
  end if;

  if v_failure is null then
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
    select evidence.*
    into v_evidence
    from platform_private.registry_evidence_assertions evidence
    where evidence.id=(v_plan->>'evidence_assertion_id')::uuid
      and evidence.subject_type='external_identifier_assertion'
      and evidence.subject_id=v_target.subject_id
      and evidence.claim_key='registry.external_identifier_assertion.admit'
      and evidence.trust_class='INTERNAL_FACT'
      and evidence.source_kind='retained_registry_metadata'
      and evidence.assertion_fingerprint=
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
       or v_assertion.work_id<>v_work_id
       or num_nonnulls(
            v_assertion.artist_id,
            v_assertion.track_id,
            v_assertion.release_id,
            v_assertion.person_resource_id,
            v_assertion.organization_resource_id
          )<>0
       or v_assertion.scheme_key<>v_candidate->>'scheme_key'
       or v_assertion.source_value<>v_candidate->>'source_value'
       or v_assertion.comparison_value<>v_candidate->>'comparison_value'
       or v_assertion.assertion_status<>'candidate'
       or v_assertion.verification_method is not null
       or v_assertion.verified_by is not null
       or v_assertion.verified_at is not null
       or v_assertion.evidence_assertion_id<>v_evidence.id
    then
      v_failure:='work_external_identifier_assertion_state_mismatch';
    end if;
  end if;

  if v_failure is null
     and encode(
           extensions.digest(
             platform_private.registry_work_external_identifier_candidate_state_v1(
               v_work_id,
               v_candidate->>'scheme_key',
               v_candidate->>'source_value'
             )::text,
             'sha256'
           ),
           'hex'
         )<>v_plan->>'candidate_state_fingerprint'
  then
    v_failure:='retained_work_provider_candidate_state_changed';
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
      and event.registry_entity_type='work'
      and event.registry_entity_id=v_work_id::text
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
    error_code='registry_work_external_identifier_verification_failed',
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
$verify$;

create function public.admin_admit_registry_work_external_identifier_candidate_v1(
  p_work_id uuid,
  p_scheme_key text,
  p_source_value text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $public_rpc$
declare
  v_user_id uuid;
  v_scheme text:=
    lower(nullif(btrim(coalesce(p_scheme_key,'')),''));
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

  if p_work_id is null
     or v_scheme not in ('musicbrainz','iswc')
     or nullif(btrim(coalesce(p_source_value,'')),'') is null
  then
    raise exception using errcode='22023',
      message='Work UUID plus MusicBrainz/ISWC source value are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry-work-external-id:'||
      p_work_id::text||':'||
      v_scheme||':'||
      p_source_value,
      0
    )
  );

  perform 1
  from public.registry_works work
  where work.id=p_work_id
    and work.status<>'archived'
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Registry Work is missing or archived.';
  end if;

  v_candidate:=
    platform_private.registry_work_external_identifier_candidate_state_v1(
      p_work_id,
      v_scheme,
      p_source_value
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
      message='WK_WORK_EXTERNAL_IDENTIFIER_REVIEW_REQUIRED: Work provider identifier is assigned to more than one canonical Work.';
  end if;

  v_existing_assertion_id:=
    platform_private.registry_work_external_identifier_existing_v1(
      p_work_id,
      v_scheme,
      v_candidate->>'comparison_value'
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
  from platform_private.execute_registry_work_external_identifier_admin_v1(
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_work_external_identifier_admin_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='WK_WORK_EXTERNAL_IDENTIFIER_VERIFIER_FAILED: Work external identifier verification failed.';
  end if;

  select assertion.*
  into v_assertion
  from public.registry_external_identifier_assertions assertion
  where assertion.id=v_future_assertion_id;

  if not found then
    raise exception using errcode='P0002',
      message='Verified Work external identifier assertion is missing.';
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
$public_rpc$;
create function public.record_registry_work_provider_observation_v1(
  p_track_id uuid,
  p_recording_isrc text,
  p_provider_key text,
  p_provider_recording_id text,
  p_provider_work_id text,
  p_work_title text,
  p_iswc text default null,
  p_observed_at timestamptz default now(),
  p_source_payload jsonb default '{}'::jsonb
)
returns table (
  work_id uuid,
  track_work_link_id uuid,
  work_evidence_assertion_id uuid,
  track_work_evidence_assertion_id uuid
)
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,extensions
as $observation$
declare
  v_request_role text:=
    coalesce(
      nullif(
        current_setting('request.jwt.claim.role',true),
        ''
      ),
      (
        nullif(
          current_setting('request.jwt.claims',true),
          ''
        )::jsonb->>'role'
      )
    );
  v_provider_key text:=
    lower(nullif(btrim(coalesce(p_provider_key,'')),''));
  v_isrc text:=
    upper(
      regexp_replace(
        coalesce(p_recording_isrc,''),
        '[^A-Za-z0-9]',
        '',
        'g'
      )
    );
  v_provider_recording_id text:=
    lower(nullif(btrim(coalesce(p_provider_recording_id,'')),''));
  v_provider_work_id text:=
    lower(nullif(btrim(coalesce(p_provider_work_id,'')),''));
  v_work_title text:=nullif(btrim(coalesce(p_work_title,'')),'');
  v_iswc_source text:=nullif(btrim(coalesce(p_iswc,'')),'');
  v_iswc_comparison text;
  v_track public.registry_tracks%rowtype;
  v_work public.registry_works%rowtype;
  v_work_id uuid;
  v_link_id uuid;
  v_work_candidate jsonb;
  v_link_candidate jsonb;
  v_metadata jsonb;
  v_source_payload_fingerprint text;
  v_work_assertion_fingerprint text;
  v_link_assertion_fingerprint text;
  v_work_evidence_id uuid;
  v_link_evidence_id uuid;
begin
  if v_request_role is distinct from 'service_role' then
    raise exception using errcode='42501',
      message='Service-role provider observation transport is required.';
  end if;

  if p_track_id is null
     or v_provider_key<>'musicbrainz'
     or v_isrc !~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'
     or v_provider_recording_id !~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or v_provider_work_id !~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or v_work_title is null
     or p_observed_at is null
     or p_observed_at<now()-interval '1 day'
     or p_observed_at>now()+interval '5 minutes'
     or p_source_payload is null
     or jsonb_typeof(p_source_payload)<>'object'
  then
    raise exception using errcode='22023',
      message='Exact fresh MusicBrainz Work observation is required.';
  end if;

  if v_iswc_source is not null then
    v_iswc_comparison:=
      upper(
        regexp_replace(
          v_iswc_source,
          '[^A-Za-z0-9]',
          '',
          'g'
        )
      );

    if v_iswc_comparison !~ '^T[0-9]{10}$' then
      raise exception using errcode='22023',
        message='Observed ISWC must normalize to T plus ten digits.';
    end if;
  end if;

  if lower(coalesce(p_source_payload->>'provider_key',''))<>
       v_provider_key
     or (p_source_payload->>'track_id') is distinct from p_track_id::text
     or upper(
          regexp_replace(
            coalesce(p_source_payload->>'source_isrc',''),
            '[^A-Za-z0-9]',
            '',
            'g'
          )
        )<>v_isrc
     or lower(coalesce(p_source_payload->>'recording_mbid',''))<>
          v_provider_recording_id
     or lower(coalesce(p_source_payload->>'work_mbid',''))<>
          v_provider_work_id
     or nullif(btrim(coalesce(p_source_payload->>'work_title','')),'')<>
          v_work_title
     or (
       v_iswc_source is null
       and nullif(btrim(coalesce(p_source_payload->>'iswc','')),'')
             is not null
     )
     or (
       v_iswc_source is not null
       and upper(
             regexp_replace(
               coalesce(p_source_payload->>'iswc',''),
               '[^A-Za-z0-9]',
               '',
               'g'
             )
           )<>v_iswc_comparison
     )
     or p_source_payload->>'recording_work_relationship_type'<>
          'performance'
     or coalesce(
          p_source_payload->'recording_work_relationship_attributes',
          '[]'::jsonb
        ) ? 'partial'
  then
    raise exception using errcode='23514',
      message='MusicBrainz source payload does not match the exact accepted observation.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_track_id
    and track.status<>'archived'
  for share;

  if not found then
    raise exception using errcode='P0002',
      message='Registry Track is missing or archived.';
  end if;

  if upper(
       regexp_replace(
         coalesce(v_track.isrc,''),
         '[^A-Za-z0-9]',
         '',
         'g'
       )
     )<>v_isrc
  then
    raise exception using errcode='23514',
      message='WK_STALE_WORK_PROVIDER_TRACK: Track ISRC changed after provider resolution.';
  end if;

  v_work_id:=
    platform_private.registry_provider_work_uuid_v1(
      v_provider_key,
      v_provider_work_id
    );

  v_link_id:=
    platform_private.registry_provider_track_work_link_uuid_v1(
      p_track_id,
      v_work_id,
      'embodies'
    );

  select work.*
  into v_work
  from public.registry_works work
  where work.id=v_work_id;

  if found then
    if v_work.status='archived' then
      raise exception using errcode='23514',
        message='Deterministic provider Work is archived and requires review.';
    end if;

    v_work_candidate:=jsonb_build_object(
      'title',v_work.title,
      'normalized_title',v_work.normalized_title,
      'metadata',v_work.metadata
    );
  else
    v_metadata:=
      jsonb_strip_nulls(
        jsonb_build_object(
          'work_resolution_source','musicbrainz',
          'musicbrainz_work_id',v_provider_work_id,
          'iswc',v_iswc_source
        )
      );

    v_work_candidate:=jsonb_build_object(
      'title',v_work_title,
      'normalized_title',
        platform_private.registry_identity_normalize_text_v1(
          v_work_title
        ),
      'metadata',v_metadata
    );
  end if;

  if exists (
    select 1
    from public.registry_external_identifier_assertions assertion
    where assertion.work_id is not null
      and assertion.work_id<>v_work_id
      and assertion.scheme_key='musicbrainz'
      and assertion.comparison_value=v_provider_work_id
      and assertion.valid_to is null
      and assertion.assertion_status not in ('rejected','superseded')
  ) then
    raise exception using errcode='23514',
      message='WK_WORK_PROVIDER_IDENTITY_CONFLICT: MusicBrainz Work is already bound to another WAKILISHA Work.';
  end if;

  if v_iswc_comparison is not null
     and exists (
       select 1
       from public.registry_external_identifier_assertions assertion
       where assertion.work_id is not null
         and assertion.work_id<>v_work_id
         and assertion.scheme_key='iswc'
         and assertion.comparison_value=v_iswc_comparison
         and assertion.valid_to is null
         and assertion.assertion_status not in ('rejected','superseded')
     )
  then
    raise exception using errcode='23514',
      message='WK_WORK_ISWC_CONFLICT: observed ISWC is already bound to another WAKILISHA Work.';
  end if;

  v_link_candidate:=jsonb_build_object(
    'track_id',p_track_id::text,
    'work_id',v_work_id::text,
    'relationship_kind','embodies',
    'valid_from',null,
    'valid_to',null
  );

  v_source_payload_fingerprint:=
    encode(
      extensions.digest(p_source_payload::text,'sha256'),
      'hex'
    );

  v_work_assertion_fingerprint:=
    encode(
      extensions.digest(
        jsonb_build_object(
          'subject_type','work',
          'subject_id',v_work_id::text,
          'claim_key','registry.work.create',
          'claim_payload',v_work_candidate,
          'trust_class','EXTERNAL_EVIDENCE',
          'source_kind','musicbrainz',
          'source_ref','musicbrainz:work:'||v_provider_work_id,
          'source_payload_fingerprint',v_source_payload_fingerprint,
          'recorded_by_principal_key','system:music_work_provider_resolver'
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
    'work',
    v_work_id,
    'registry.work.create',
    v_work_candidate,
    'EXTERNAL_EVIDENCE',
    'musicbrainz',
    'musicbrainz:work:'||v_provider_work_id,
    v_source_payload_fingerprint,
    p_observed_at,
    'system:music_work_provider_resolver',
    v_work_assertion_fingerprint
  )
  on conflict (assertion_fingerprint)
  do nothing
  returning id into v_work_evidence_id;

  if v_work_evidence_id is null then
    select evidence.id
    into v_work_evidence_id
    from platform_private.registry_evidence_assertions evidence
    where evidence.assertion_fingerprint=v_work_assertion_fingerprint;
  end if;

  v_link_assertion_fingerprint:=
    encode(
      extensions.digest(
        jsonb_build_object(
          'subject_type','track_work_link',
          'subject_id',v_link_id::text,
          'claim_key','registry.track_work_link.admit',
          'claim_payload',v_link_candidate,
          'trust_class','EXTERNAL_EVIDENCE',
          'source_kind','musicbrainz',
          'source_ref',
            'musicbrainz:recording:'||
            v_provider_recording_id||
            ':work:'||
            v_provider_work_id||
            ':track:'||
            p_track_id::text,
          'source_payload_fingerprint',v_source_payload_fingerprint,
          'recorded_by_principal_key','system:music_work_provider_resolver'
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
    'track_work_link',
    v_link_id,
    'registry.track_work_link.admit',
    v_link_candidate,
    'EXTERNAL_EVIDENCE',
    'musicbrainz',
    'musicbrainz:recording:'||
      v_provider_recording_id||
      ':work:'||
      v_provider_work_id||
      ':track:'||
      p_track_id::text,
    v_source_payload_fingerprint,
    p_observed_at,
    'system:music_work_provider_resolver',
    v_link_assertion_fingerprint
  )
  on conflict (assertion_fingerprint)
  do nothing
  returning id into v_link_evidence_id;

  if v_link_evidence_id is null then
    select evidence.id
    into v_link_evidence_id
    from platform_private.registry_evidence_assertions evidence
    where evidence.assertion_fingerprint=v_link_assertion_fingerprint;
  end if;

  work_id:=v_work_id;
  track_work_link_id:=v_link_id;
  work_evidence_assertion_id:=v_work_evidence_id;
  track_work_evidence_assertion_id:=v_link_evidence_id;
  return next;
end
$observation$;
create function public.admin_admit_registry_work_provider_observation_v1(
  p_work_evidence_assertion_id uuid,
  p_track_work_evidence_assertion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $admit$
declare
  v_user_id uuid;
  v_work_evidence platform_private.registry_evidence_assertions%rowtype;
  v_link_evidence platform_private.registry_evidence_assertions%rowtype;
  v_work_result jsonb;
  v_musicbrainz_result jsonb;
  v_iswc_result jsonb;
  v_link_result jsonb;
  v_work_id uuid;
  v_track_id uuid;
  v_musicbrainz_work_id text;
  v_iswc text;
begin
  v_user_id:=
    platform_private.registry_provenance_admin_current_user_v1();

  if p_work_evidence_assertion_id is null
     or p_track_work_evidence_assertion_id is null
  then
    raise exception using errcode='22023',
      message='Work and Track-to-Work evidence assertion IDs are required.';
  end if;

  select evidence.*
  into v_work_evidence
  from platform_private.registry_evidence_assertions evidence
  where evidence.id=p_work_evidence_assertion_id;

  select evidence.*
  into v_link_evidence
  from platform_private.registry_evidence_assertions evidence
  where evidence.id=p_track_work_evidence_assertion_id;

  if v_work_evidence.id is null
     or v_link_evidence.id is null
     or v_work_evidence.subject_type<>'work'
     or v_work_evidence.claim_key<>'registry.work.create'
     or v_work_evidence.trust_class<>'EXTERNAL_EVIDENCE'
     or v_work_evidence.source_kind<>'musicbrainz'
     or v_link_evidence.subject_type<>'track_work_link'
     or v_link_evidence.claim_key<>'registry.track_work_link.admit'
     or v_link_evidence.trust_class<>'EXTERNAL_EVIDENCE'
     or v_link_evidence.source_kind<>'musicbrainz'
     or v_work_evidence.source_payload_fingerprint<>
          v_link_evidence.source_payload_fingerprint
  then
    raise exception using errcode='42501',
      message='Exact paired MusicBrainz Work evidence is required.';
  end if;

  v_work_id:=v_work_evidence.subject_id;
  v_track_id:=(v_link_evidence.claim_payload->>'track_id')::uuid;

  if (v_link_evidence.claim_payload->>'work_id')::uuid<>v_work_id
     or v_link_evidence.claim_payload->>'relationship_kind'<>'embodies'
     or v_work_evidence.claim_payload->>'title' is null
     or v_work_evidence.claim_payload->>'normalized_title' is null
     or jsonb_typeof(v_work_evidence.claim_payload->'metadata')<>'object'
  then
    raise exception using errcode='23514',
      message='MusicBrainz Work evidence pair is malformed.';
  end if;

  v_musicbrainz_work_id:=
    lower(
      nullif(
        btrim(
          v_work_evidence.claim_payload#>>
            '{metadata,musicbrainz_work_id}'
        ),
        ''
      )
    );

  v_iswc:=
    nullif(
      btrim(
        v_work_evidence.claim_payload#>>'{metadata,iswc}'
      ),
      ''
    );

  if v_musicbrainz_work_id is null then
    raise exception using errcode='23514',
      message='MusicBrainz Work evidence lacks Work MBID.';
  end if;

  perform 1
  from public.registry_tracks track
  where track.id=v_track_id
    and track.status<>'archived'
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Track-to-Work Track is missing or archived.';
  end if;

  select public.admin_create_registry_work_v1(
    p_work_evidence_assertion_id
  )
  into v_work_result;

  if coalesce(
       (v_work_result#>>'{_authority,verified}')::boolean,
       false
     ) is not true
  then
    raise exception using errcode='23514',
      message='Verified Registry Work creation/replay is required.';
  end if;

  select public.admin_admit_registry_work_external_identifier_candidate_v1(
    v_work_id,
    'musicbrainz',
    v_musicbrainz_work_id
  )
  into v_musicbrainz_result;

  if coalesce(
       (v_musicbrainz_result#>>'{_authority,verified}')::boolean,
       false
     ) is not true
  then
    raise exception using errcode='23514',
      message='Verified MusicBrainz Work identifier admission is required.';
  end if;

  if v_iswc is not null then
    select public.admin_admit_registry_work_external_identifier_candidate_v1(
      v_work_id,
      'iswc',
      v_iswc
    )
    into v_iswc_result;

    if coalesce(
         (v_iswc_result#>>'{_authority,verified}')::boolean,
         false
       ) is not true
    then
      raise exception using errcode='23514',
        message='Verified Work ISWC admission is required.';
    end if;
  end if;

  select public.admin_admit_registry_track_work_link_v1(
    p_track_work_evidence_assertion_id
  )
  into v_link_result;

  if coalesce(
       (v_link_result#>>'{_authority,verified}')::boolean,
       false
     ) is not true
  then
    raise exception using errcode='23514',
      message='Verified Track-to-Work admission is required.';
  end if;

  return jsonb_build_object(
    'work_id',v_work_id,
    'track_id',v_track_id,
    'work',v_work_result,
    'musicbrainz_identifier',v_musicbrainz_result,
    'iswc_identifier',v_iswc_result,
    'track_work_link',v_link_result,
    '_authority',
      jsonb_build_object(
        'mode','composed_exact_operations',
        'verified',true,
        'source_kind','musicbrainz',
        'work_operation_key','registry.work.create',
        'external_identifier_operation_key',
          'registry.external_identifier_assertion.admit',
        'track_work_operation_key','registry.track_work_link.admit'
      )
  );
end
$admit$;

revoke all on function
  platform_private.registry_provider_work_uuid_v1(text,text),
  platform_private.registry_provider_track_work_link_uuid_v1(uuid,uuid,text),
  platform_private.registry_work_external_identifier_candidate_state_v1(uuid,text,text),
  platform_private.registry_work_external_identifier_existing_v1(uuid,text,text),
  platform_private.execute_registry_work_external_identifier_admin_v1(uuid),
  platform_private.verify_registry_work_external_identifier_admin_v1(uuid)
from public,anon,authenticated,service_role;

revoke all on function
  public.record_registry_work_provider_observation_v1(
    uuid,text,text,text,text,text,text,timestamp with time zone,jsonb
  )
from public,anon,authenticated;

grant execute on function
  public.record_registry_work_provider_observation_v1(
    uuid,text,text,text,text,text,text,timestamp with time zone,jsonb
  )
to service_role;

revoke all on function
  public.admin_admit_registry_work_external_identifier_candidate_v1(
    uuid,text,text
  ),
  public.admin_admit_registry_work_provider_observation_v1(
    uuid,uuid
  )
from public,anon,service_role;

grant execute on function
  public.admin_admit_registry_work_external_identifier_candidate_v1(
    uuid,text,text
  ),
  public.admin_admit_registry_work_provider_observation_v1(
    uuid,uuid
  )
to authenticated;

comment on function
  public.record_registry_work_provider_observation_v1(
    uuid,text,text,text,text,text,text,timestamp with time zone,jsonb
  )
is
  'Records exact MusicBrainz Recording-to-Work provider observations as append-only EXTERNAL_EVIDENCE. It has no canonical Work mutation authority.';

comment on function
  public.admin_admit_registry_work_provider_observation_v1(uuid,uuid)
is
  'Composes accepted Work creation, Work external identifier, and Track-to-Work operations from exact retained MusicBrainz provider evidence.';

comment on function
  public.admin_admit_registry_work_external_identifier_candidate_v1(uuid,text,text)
is
  'Adapts retained canonical Work metadata to the accepted Registry external identifier assertion operation for MusicBrainz MBID and ISWC.';

do $proof$
declare
  v_scheme_constraint text;
  v_observation text;
  v_admission text;
begin
  select pg_get_constraintdef(oid)
  into v_scheme_constraint
  from pg_constraint
  where conrelid='public.registry_external_identifier_assertions'::regclass
    and conname='registry_external_identifier_assertions_scheme_check';

  if v_scheme_constraint is null
     or position('musicbrainz' in lower(v_scheme_constraint))=0
     or position('iswc' in lower(v_scheme_constraint))=0
  then
    raise exception
      'Work provider resolution external identifier schemes drifted';
  end if;

  if has_function_privilege(
       'anon',
       'public.record_registry_work_provider_observation_v1(uuid,text,text,text,text,text,text,timestamp with time zone,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.record_registry_work_provider_observation_v1(uuid,text,text,text,text,text,text,timestamp with time zone,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.record_registry_work_provider_observation_v1(uuid,text,text,text,text,text,text,timestamp with time zone,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'Provider observation recorder grant boundary drifted';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_work_provider_observation_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_work_provider_observation_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_work_provider_observation_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Work provider admission wrapper grant boundary drifted';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_work_external_identifier_candidate_v1(uuid,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_work_external_identifier_candidate_v1(uuid,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_work_external_identifier_candidate_v1(uuid,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Work external identifier wrapper grant boundary drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_work_external_identifier_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_work_external_identifier_admin_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Work external identifier private executor leaked role authority';
  end if;

  select pg_get_functiondef(
    'public.record_registry_work_provider_observation_v1(uuid,text,text,text,text,text,text,timestamp with time zone,jsonb)'::regprocedure
  )
  into v_observation;

  if position('EXTERNAL_EVIDENCE' in v_observation)=0
     or position('system:music_work_provider_resolver' in v_observation)=0
     or position('registry_provider_work_uuid_v1' in v_observation)=0
     or position('registry_provider_track_work_link_uuid_v1' in v_observation)=0
  then
    raise exception
      'Provider observation recorder lost exact evidence identity contract';
  end if;

  select pg_get_functiondef(
    'public.admin_admit_registry_work_provider_observation_v1(uuid,uuid)'::regprocedure
  )
  into v_admission;

  if position('admin_create_registry_work_v1' in v_admission)=0
     or position('admin_admit_registry_work_external_identifier_candidate_v1' in v_admission)=0
     or position('admin_admit_registry_track_work_link_v1' in v_admission)=0
  then
    raise exception
      'Work provider admission stopped composing accepted typed authorities';
  end if;

  if exists (
       select 1
       from platform_private.registry_execution_grants execution_grant
       where execution_grant.status='active'
         and execution_grant.expires_at>now()
         and execution_grant.actor_key in (
           'registry_provenance_admin',
           'registry_external_identifier_admin'
         )
     )
  then
    raise exception
      'Work provider resolution migration left active execution authority at rest';
  end if;

  if exists (
       select 1
       from platform_private.registry_evidence_assertions evidence
       where evidence.recorded_by_principal_key=
             'system:music_work_provider_resolver'
     )
  then
    raise exception
      'Work provider resolution migration created runtime provider evidence';
  end if;
end
$proof$;

commit;
