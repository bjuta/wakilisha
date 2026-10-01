-- WAKILISHA Creator Cohort Track ISRC Projection V1
--
-- Adds one narrow, human-exact-grant operation that promotes an ISRC already
-- retained on an accepted typed Apple Music Track provider link into:
--
--   1. one candidate registry_external_identifier_assertions row; and
--   2. the registry_tracks.isrc hot-path projection.
--
-- This migration installs authority only. It does not backfill any Track.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'creator-cohort-track-isrc-projection-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_track_provider_links') is null
     or to_regclass('public.registry_external_identifier_assertions') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('public.registry_tracks_isrc_unique') is null
     or to_regprocedure(
       'platform_private.registry_provider_link_admin_current_user_v1()'
     ) is null
     or to_regprocedure(
       'platform_private.registry_provider_link_state_fingerprint_v1(uuid,text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_subject_state_fingerprint(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_plan_fingerprint(jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_execution_target_set_fingerprint(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_registry_mutation_operation(text,uuid)'
     ) is null
     or to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null
  then
    raise exception
      'STOP: accepted Registry provider-link / mutation authority foundation is missing';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_provider_link_admin'
      and actor.status='active'
      and actor.capability_profile->>'authority_mode'='human_exact_grant'
      and actor.capability_profile->>'required_user_capability'='manage_registry'
  ) then
    raise exception
      'STOP: Registry Provider Link Admin actor is missing or malformed';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_provider_link_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception
      'STOP: Registry Provider Link Admin authenticator binding is missing';
  end if;

  if exists (
       select 1
       from public.capability_definitions capability
       where capability.capability_key='admit_registry_track_isrc_projection'
     )
     or exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key='registry.track.isrc_projection.admit'
     )
     or to_regprocedure(
       'platform_private.registry_track_isrc_normalize_v1(text)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_track_isrc_projection_candidate_state_v1(uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.record_registry_track_isrc_projection_evidence_v1(uuid,uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'platform_private.issue_registry_track_isrc_projection_grant_v1(uuid,uuid,uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_track_isrc_projection_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_track_isrc_projection_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)'
     ) is not null
  then
    raise exception
      'STOP: Track ISRC projection authority already exists; audit before reapplying';
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
  'admit_registry_track_isrc_projection',
  'Admit Registry Track ISRC projection',
  'Admit one collision-free retained typed provider ISRC into the Track identifier ledger and hot-path projection.',
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
  'registry.track.isrc_projection.admit',
  1,
  'admit_registry_track_isrc_projection',
  'medium',
  array['track']::text[],
  true,
  1,
  2,
  300,
  true,
  true,
  true,
  'Admit one exact retained Apple Music ISRC candidate as a candidate identifier assertion and null-only Track ISRC projection.'
);

update platform_private.system_actors actor
set
  capability_profile=jsonb_set(
    coalesce(actor.capability_profile,'{}'::jsonb),
    '{operation_family}',
    coalesce(
      actor.capability_profile->'operation_family',
      '[]'::jsonb
    ) || jsonb_build_array(
      'registry.track.isrc_projection.admit/v1'
    ),
    true
  )
where actor.actor_key='registry_provider_link_admin'
  and actor.status='active';

create function
platform_private.registry_track_isrc_normalize_v1(
  p_value text
)
returns text
language sql
immutable
security definer
set search_path=pg_catalog
as $normalize$
  select nullif(
    regexp_replace(
      upper(btrim(coalesce(p_value,''))),
      '[^A-Z0-9]',
      '',
      'g'
    ),
    ''
  );
$normalize$;

create function
platform_private.registry_track_isrc_projection_candidate_state_v1(
  p_track_id uuid,
  p_provider_link_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $candidate$
declare
  v_track public.registry_tracks%rowtype;
  v_link public.registry_track_provider_links%rowtype;
  v_source_isrc text;
  v_isrc text;
  v_payload_isrc text;
  v_payload_song_id text;
  v_current_track_isrc text;
  v_candidate_track_count integer:=0;
  v_existing_registry_track_count integer:=0;
  v_target_current_assertion_count integer:=0;
  v_conflicting_current_assertion_count integer:=0;
  v_exact_provider_evidence boolean:=false;
  v_candidate_state text;
begin
  if p_track_id is null or p_provider_link_id is null then
    raise exception using errcode='22023',
      message='Track and provider-link UUIDs are required.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_track_id;

  if not found or v_track.status='archived' then
    raise exception using errcode='P0002',
      message='Registry Track is missing or archived.';
  end if;

  select link.*
  into v_link
  from public.registry_track_provider_links link
  where link.id=p_provider_link_id
    and link.track_id=p_track_id;

  if not found then
    raise exception using errcode='P0002',
      message='Typed Track provider link is missing or belongs to another Track.';
  end if;

  v_source_isrc:=nullif(btrim(v_link.isrc),'');
  v_isrc:=
    platform_private.registry_track_isrc_normalize_v1(
      v_source_isrc
    );
  v_payload_isrc:=
    platform_private.registry_track_isrc_normalize_v1(
      v_link.raw_payload#>>'{song,attributes,isrc}'
    );
  v_payload_song_id:=
    nullif(
      btrim(v_link.raw_payload#>>'{song,id}'),
      ''
    );
  v_current_track_isrc:=
    platform_private.registry_track_isrc_normalize_v1(
      v_track.isrc
    );

  v_exact_provider_evidence:=
    v_link.provider_key='apple_music'
    and v_link.match_status='matched'
    and v_link.match_method='exact_title_artist'
    and coalesce(v_link.match_confidence,0)>=0.93
    and v_isrc is not null
    and v_isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'
    and v_payload_isrc=v_isrc
    and v_payload_song_id=v_link.provider_track_id;

  if v_isrc is not null then
    select count(distinct candidate_link.track_id)::integer
    into v_candidate_track_count
    from public.registry_track_provider_links candidate_link
    join public.registry_tracks candidate_track
      on candidate_track.id=candidate_link.track_id
    where candidate_link.provider_key='apple_music'
      and coalesce(candidate_link.match_status,'')
            not in ('rejected','superseded')
      and candidate_track.status<>'archived'
      and candidate_track.isrc is null
      and platform_private.registry_track_isrc_normalize_v1(
            candidate_link.isrc
          )=v_isrc;

    select count(distinct other_track.id)::integer
    into v_existing_registry_track_count
    from public.registry_tracks other_track
    where other_track.id<>p_track_id
      and other_track.status<>'archived'
      and platform_private.registry_track_isrc_normalize_v1(
            other_track.isrc
          )=v_isrc;

    select count(*)::integer
    into v_target_current_assertion_count
    from public.registry_external_identifier_assertions assertion
    where assertion.track_id=p_track_id
      and assertion.scheme_key='isrc'
      and assertion.valid_to is null
      and assertion.assertion_status
            not in ('rejected','superseded')
      and platform_private.registry_track_isrc_normalize_v1(
            assertion.comparison_value
          )=v_isrc;

    select count(*)::integer
    into v_conflicting_current_assertion_count
    from public.registry_external_identifier_assertions assertion
    where assertion.track_id is not null
      and assertion.track_id<>p_track_id
      and assertion.scheme_key='isrc'
      and assertion.valid_to is null
      and assertion.assertion_status
            not in ('rejected','superseded')
      and platform_private.registry_track_isrc_normalize_v1(
            assertion.comparison_value
          )=v_isrc;
  end if;

  v_candidate_state:=
    case
      when v_track.isrc is null
       and v_exact_provider_evidence
       and v_candidate_track_count=1
       and v_existing_registry_track_count=0
       and v_target_current_assertion_count=0
       and v_conflicting_current_assertion_count=0
        then 'deterministic_projection_candidate'
      when v_current_track_isrc=v_isrc
       and v_exact_provider_evidence
       and v_existing_registry_track_count=0
       and v_target_current_assertion_count=1
       and v_conflicting_current_assertion_count=0
        then 'already_current'
      else 'review_only'
    end;

  return jsonb_build_object(
    'track_id',v_track.id::text,
    'track_status',v_track.status,
    'track_title',v_track.title,
    'current_track_isrc',v_track.isrc,
    'provider_link_id',v_link.id::text,
    'provider_key',v_link.provider_key,
    'provider_track_id',v_link.provider_track_id,
    'provider_match_status',v_link.match_status,
    'provider_match_method',v_link.match_method,
    'provider_match_confidence',v_link.match_confidence,
    'source_isrc',v_source_isrc,
    'normalized_isrc',v_isrc,
    'provider_payload_isrc',v_payload_isrc,
    'provider_payload_song_id',v_payload_song_id,
    'candidate_track_count',v_candidate_track_count,
    'existing_registry_track_count',v_existing_registry_track_count,
    'target_current_assertion_count',v_target_current_assertion_count,
    'conflicting_current_assertion_count',
      v_conflicting_current_assertion_count,
    'candidate_state',v_candidate_state
  );
end
$candidate$;

create function
platform_private.record_registry_track_isrc_projection_evidence_v1(
  p_track_id uuid,
  p_provider_link_id uuid,
  p_candidate_state jsonb
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $evidence$
declare
  v_user_id uuid;
  v_source_payload_fingerprint text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
  v_source_ref text;
begin
  v_user_id:=
    platform_private.registry_provider_link_admin_current_user_v1();

  if p_track_id is null
     or p_provider_link_id is null
     or p_candidate_state is null
     or jsonb_typeof(p_candidate_state)<>'object'
     or p_candidate_state->>'candidate_state'<>
          'deterministic_projection_candidate'
     or p_candidate_state->>'track_id'<>p_track_id::text
     or p_candidate_state->>'provider_link_id'<>
          p_provider_link_id::text
     or p_candidate_state->>'provider_key'<>'apple_music'
     or nullif(p_candidate_state->>'normalized_isrc','') is null
     or coalesce(
          (p_candidate_state->>'candidate_track_count')::integer,
          0
        )<>1
     or coalesce(
          (p_candidate_state->>'existing_registry_track_count')::integer,
          0
        )<>0
     or coalesce(
          (p_candidate_state->>'target_current_assertion_count')::integer,
          0
        )<>0
     or coalesce(
          (p_candidate_state->>'conflicting_current_assertion_count')::integer,
          0
        )<>0
  then
    raise exception using errcode='22023',
      message='Exact deterministic Track ISRC projection candidate state is required.';
  end if;

  v_source_ref:=
    'retained-registry-provider-link:'||
    p_track_id::text||':'||
    p_provider_link_id::text;

  v_source_payload_fingerprint:=
    encode(
      extensions.digest(
        p_candidate_state::text,
        'sha256'
      ),
      'hex'
    );

  v_assertion_fingerprint:=
    encode(
      extensions.digest(
        jsonb_build_object(
          'subject_type','track',
          'subject_id',p_track_id::text,
          'claim_key','registry.track.isrc_projection.admit',
          'claim_payload',p_candidate_state,
          'trust_class','INTERNAL_FACT',
          'source_kind','retained_registry_provider_link',
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
    'track',
    p_track_id,
    'registry.track.isrc_projection.admit',
    p_candidate_state,
    'INTERNAL_FACT',
    'retained_registry_provider_link',
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
$evidence$;

create function
platform_private.issue_registry_track_isrc_projection_grant_v1(
  p_evidence_assertion_id uuid,
  p_track_id uuid,
  p_provider_link_id uuid,
  p_expected_track_state_fingerprint text,
  p_expected_provider_link_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $grant$
declare
  v_user_id uuid;
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_current_candidate jsonb;
  v_candidate_state_fingerprint text;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_target_set jsonb;
  v_target_fingerprint text;
  v_idempotency_key text;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_grant_id uuid;
begin
  v_user_id:=
    platform_private.registry_provider_link_admin_current_user_v1();

  if p_expected_track_state_fingerprint is null
     or p_expected_provider_link_fingerprint is null
  then
    raise exception using errcode='22023',
      message='Expected Track and provider-link fingerprints are required.';
  end if;

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.track.isrc_projection.admit'
    and operation_type.operation_version=1
    and operation_type.capability_key='admit_registry_track_isrc_projection'
    and operation_type.enabled;

  if not found
     or v_operation_type.allowed_subject_types<>array['track']::text[]
     or not v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<>2
     or v_operation_type.max_grant_ttl_seconds<>300
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Track ISRC projection operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>p_track_id
     or v_evidence.claim_key<>'registry.track.isrc_projection.admit'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'retained_registry_provider_link'
     or v_evidence.recorded_by_principal_key<>
          'user:'||v_user_id::text
     or v_evidence.claim_payload->>'provider_link_id'<>
          p_provider_link_id::text
  then
    raise exception using errcode='42501',
      message='Evidence is not caller-bound Track ISRC projection authority.';
  end if;

  v_current_candidate:=
    platform_private.registry_track_isrc_projection_candidate_state_v1(
      p_track_id,
      p_provider_link_id
    );

  if v_current_candidate is distinct from v_evidence.claim_payload
     or v_current_candidate->>'candidate_state'<>
          'deterministic_projection_candidate'
  then
    raise exception using errcode='23514',
      message='WK_STALE_TRACK_ISRC_CANDIDATE: retained provider evidence changed before grant issuance.';
  end if;

  v_candidate_state_fingerprint:=
    encode(
      extensions.digest(
        v_current_candidate::text,
        'sha256'
      ),
      'hex'
    );

  v_plan:=jsonb_build_object(
    'operation_key','registry.track.isrc_projection.admit',
    'operation_version',1,
    'track_id',p_track_id::text,
    'provider_link_id',p_provider_link_id::text,
    'normalized_isrc',
      v_current_candidate->>'normalized_isrc',
    'candidate_state',v_current_candidate,
    'candidate_state_fingerprint',v_candidate_state_fingerprint,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'expected_track_state_fingerprint',
      p_expected_track_state_fingerprint,
    'expected_provider_link_fingerprint',
      p_expected_provider_link_fingerprint,
    'policy_ruleset_version','registry-track-isrc-projection-v1'
  );

  v_plan_fingerprint:=
    platform_private.registry_plan_fingerprint(v_plan);

  v_target_set:=jsonb_build_array(
    jsonb_build_object(
      'subject_type','track',
      'subject_id',p_track_id::text,
      'expected_state_fingerprint',
        p_expected_track_state_fingerprint
    )
  );

  v_target_fingerprint:=
    encode(
      extensions.digest(
        v_target_set::text,
        'sha256'
      ),
      'hex'
    );

  v_idempotency_key:=
    'registry-track-isrc-projection:'||
    encode(
      extensions.digest(
        (
          p_track_id::text||':'||
          p_provider_link_id::text||':'||
          (v_current_candidate->>'normalized_isrc')||':'||
          v_evidence.assertion_fingerprint||':'||
          p_expected_track_state_fingerprint||':'||
          p_expected_provider_link_fingerprint
        ),
        'sha256'
      ),
      'hex'
    );

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_provider_link_admin'
    and execution_grant.operation_key='registry.track.isrc_projection.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
    then
      raise exception using errcode='23505',
        message='Track ISRC projection idempotency key is bound to different authority.';
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
    'registry_provider_link_admin',
    'admit_registry_track_isrc_projection',
    null,
    'registry.track.isrc_projection.admit',
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    2,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-track-isrc-projection-v1',
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

  if platform_private.registry_execution_target_set_fingerprint(v_grant_id)
       <>v_target_fingerprint
  then
    raise exception using errcode='23514',
      message='Track ISRC projection exact target-set fingerprint drifted.';
  end if;

  return v_grant_id;
end
$grant$;

create function
platform_private.execute_registry_track_isrc_projection_v1(
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
  v_track public.registry_tracks%rowtype;
  v_provider_link public.registry_track_provider_links%rowtype;
  v_provider_link_fingerprint text;
  v_track_fingerprint text;
  v_isrc text;
  v_assertion public.registry_external_identifier_assertions%rowtype;
  v_track_before jsonb;
  v_track_after jsonb;
  v_after_fingerprint text;
  v_assertion_event_id uuid;
  v_track_event_id uuid;
  v_rows integer;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_provider_link_admin',
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
     or v_grant.actor_key<>'registry_provider_link_admin'
     or v_grant.operation_key<>'registry.track.isrc_projection.admit'
     or v_grant.operation_version<>1
     or v_grant.capability_key<>'admit_registry_track_isrc_projection'
     or v_grant.max_rows<>2
     or v_grant.policy_ruleset_version<>
          'registry-track-isrc-projection-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not Track ISRC Projection V1 authority.';
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
      message='Track ISRC projection requires one exact existing Track target.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_candidate:=v_plan->'candidate_state';
  v_isrc:=v_plan->>'normalized_isrc';

  if (v_plan-array[
       'operation_key',
       'operation_version',
       'track_id',
       'provider_link_id',
       'normalized_isrc',
       'candidate_state',
       'candidate_state_fingerprint',
       'evidence_assertion_id',
       'evidence_assertion_fingerprint',
       'trust_class',
       'expected_track_state_fingerprint',
       'expected_provider_link_fingerprint',
       'policy_ruleset_version'
     ]::text[])<>'{}'::jsonb
     or v_plan->>'operation_key'<>
          'registry.track.isrc_projection.admit'
     or coalesce((v_plan->>'operation_version')::integer,0)<>1
     or v_plan->>'track_id'<>v_target.subject_id::text
     or v_plan->>'expected_track_state_fingerprint'<>
          v_target.expected_state_fingerprint
     or v_plan->>'trust_class'<>'INTERNAL_FACT'
     or v_plan->>'policy_ruleset_version'<>
          'registry-track-isrc-projection-v1'
     or nullif(v_isrc,'') is null
     or v_isrc !~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'
  then
    raise exception using errcode='42501',
      message='Track ISRC projection execution plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>v_target.subject_id
     or v_evidence.claim_key<>'registry.track.isrc_projection.admit'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'retained_registry_provider_link'
     or v_evidence.assertion_fingerprint<>
          v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.claim_payload<>v_candidate
  then
    raise exception using errcode='42501',
      message='Bound Track ISRC evidence no longer satisfies the exact plan.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=v_target.subject_id
    and track.status<>'archived'
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Registry Track is missing or archived.';
  end if;

  select link.*
  into v_provider_link
  from public.registry_track_provider_links link
  where link.id=(v_plan->>'provider_link_id')::uuid
    and link.track_id=v_target.subject_id
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Bound typed provider link is missing.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry-track-isrc:'||v_isrc,
      0
    )
  );

  v_track_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'track',
      v_target.subject_id
    );

  if v_track_fingerprint is distinct from
       v_target.expected_state_fingerprint
  then
    raise exception using errcode='23514',
      message='WK_STALE_TRACK_ISRC_TARGET: Registry Track changed after review.';
  end if;

  v_provider_link_fingerprint:=
    platform_private.registry_provider_link_state_fingerprint_v1(
      v_target.subject_id,
      v_provider_link.provider_key,
      v_provider_link.provider_track_id
    );

  if v_provider_link_fingerprint is distinct from
       v_plan->>'expected_provider_link_fingerprint'
  then
    raise exception using errcode='23514',
      message='WK_STALE_TRACK_ISRC_PROVIDER_LINK: typed provider evidence changed after review.';
  end if;

  v_current_candidate:=
    platform_private.registry_track_isrc_projection_candidate_state_v1(
      v_target.subject_id,
      v_provider_link.id
    );

  v_current_candidate_fingerprint:=
    encode(
      extensions.digest(
        v_current_candidate::text,
        'sha256'
      ),
      'hex'
    );

  if v_current_candidate_fingerprint<>
       v_plan->>'candidate_state_fingerprint'
     or v_current_candidate->>'candidate_state'<>
          'deterministic_projection_candidate'
     or v_current_candidate->>'normalized_isrc'<>v_isrc
  then
    raise exception using errcode='23514',
      message='WK_STALE_TRACK_ISRC_CANDIDATE: deterministic ISRC evidence changed after review.';
  end if;

  select to_jsonb(track)
  into v_track_before
  from public.registry_tracks track
  where track.id=v_target.subject_id;

  if v_track_before->>'isrc' is not null then
    raise exception using errcode='23514',
      message='WK_TRACK_ISRC_ALREADY_BOUND: projection never overwrites an existing Track ISRC.';
  end if;

  update platform_private.registry_mutation_operations
  set
    status='executing',
    started_at=coalesce(started_at,now()),
    updated_at=now()
  where id=v_operation.id;

  insert into public.registry_external_identifier_assertions (
    track_id,
    scheme_key,
    source_value,
    comparison_value,
    assertion_status,
    evidence_assertion_id
  )
  values (
    v_target.subject_id,
    'isrc',
    v_candidate->>'source_isrc',
    v_isrc,
    'candidate',
    v_evidence.id
  )
  returning * into v_assertion;

  update public.registry_tracks track
  set
    isrc=v_isrc,
    updated_at=now()
  where track.id=v_target.subject_id
    and track.status<>'archived'
    and track.isrc is null;

  get diagnostics v_rows=row_count;

  select to_jsonb(track)
  into v_track_after
  from public.registry_tracks track
  where track.id=v_target.subject_id;

  if v_rows<>1
     or (
       v_track_before-array['isrc','updated_at']::text[]
     ) is distinct from (
       v_track_after-array['isrc','updated_at']::text[]
     )
     or v_track_after->>'isrc'<>v_isrc
  then
    raise exception using errcode='23514',
      message='Track ISRC projection exceeded the bounded isrc field.';
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
    'external_identifier.isrc',
    'public.registry_external_identifier_assertions',
    null,
    to_jsonb(v_assertion),
    'admit_external_identifier_assertion',
    'succeeded',
    'system:registry_provider_link_admin'
  )
  returning id into v_assertion_event_id;

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
    'isrc',
    'public.registry_tracks.isrc',
    jsonb_build_object('isrc',v_track_before->'isrc'),
    jsonb_build_object('isrc',v_isrc),
    'admit_isrc_projection',
    'succeeded',
    'system:registry_provider_link_admin'
  )
  returning id into v_track_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,
    canonical_write_event_id
  )
  values
    (v_operation.id,v_assertion_event_id),
    (v_operation.id,v_track_event_id);

  update platform_private.registry_mutation_operations
  set
    affected_rows=2,
    status='succeeded',
    verifier_status='pending',
    result_payload=jsonb_build_object(
      'subject_type','track',
      'subject_id',v_target.subject_id,
      'provider_link_id',v_provider_link.id,
      'normalized_isrc',v_isrc,
      'external_identifier_assertion_id',v_assertion.id,
      'evidence_assertion_id',v_evidence.id,
      'canonical_write_event_ids',
        jsonb_build_array(
          v_assertion_event_id,
          v_track_event_id
        ),
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
$execute$;

create function
platform_private.verify_registry_track_isrc_projection_v1(
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
  v_track public.registry_tracks%rowtype;
  v_provider_link public.registry_track_provider_links%rowtype;
  v_identifier public.registry_external_identifier_assertions%rowtype;
  v_plan jsonb;
  v_candidate jsonb;
  v_current_candidate jsonb;
  v_isrc text;
  v_current_track_fingerprint text;
  v_current_provider_link_fingerprint text;
  v_other_track_count integer:=0;
  v_assertion_count integer:=0;
  v_event_count integer:=0;
  v_assertion_event_count integer:=0;
  v_track_event_count integer:=0;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_provider_link_admin'
     or v_operation.operation_key<>'registry.track.isrc_projection.admit'
     or v_operation.operation_version<>1
     or v_operation.capability_key<>'admit_registry_track_isrc_projection'
  then
    raise exception using errcode='P0002',
      message='Track ISRC Projection V1 operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded'
     or v_operation.affected_rows<>2
  then
    v_failure:='operation_not_succeeded_exactly_twice';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;

  if v_failure is null
     and (
       not found
       or v_grant.actor_key<>'registry_provider_link_admin'
       or v_grant.operation_key<>'registry.track.isrc_projection.admit'
       or v_grant.operation_version<>1
       or v_grant.capability_key<>'admit_registry_track_isrc_projection'
       or v_grant.max_rows<>2
       or v_grant.policy_ruleset_version<>
            'registry-track-isrc-projection-v1'
     )
  then
    v_failure:='execution_grant_mismatch';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_candidate:=v_plan->'candidate_state';
    v_isrc:=v_plan->>'normalized_isrc';

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
      v_failure:='exact_track_target_missing';
    end if;
  end if;

  if v_failure is null then
    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=(v_plan->>'evidence_assertion_id')::uuid
      and assertion.subject_type='track'
      and assertion.subject_id=v_target.subject_id
      and assertion.claim_key='registry.track.isrc_projection.admit'
      and assertion.trust_class='INTERNAL_FACT'
      and assertion.source_kind='retained_registry_provider_link'
      and assertion.assertion_fingerprint=
          v_plan->>'evidence_assertion_fingerprint';

    if not found or v_evidence.claim_payload<>v_candidate then
      v_failure:='bound_evidence_missing';
    end if;
  end if;

  if v_failure is null then
    select link.*
    into v_provider_link
    from public.registry_track_provider_links link
    where link.id=(v_plan->>'provider_link_id')::uuid
      and link.track_id=v_target.subject_id;

    if not found then
      v_failure:='bound_provider_link_missing';
    else
      v_current_provider_link_fingerprint:=
        platform_private.registry_provider_link_state_fingerprint_v1(
          v_target.subject_id,
          v_provider_link.provider_key,
          v_provider_link.provider_track_id
        );

      if v_current_provider_link_fingerprint is distinct from
           v_plan->>'expected_provider_link_fingerprint'
      then
        v_failure:='provider_link_state_mismatch';
      end if;
    end if;
  end if;

  if v_failure is null then
    select track.*
    into v_track
    from public.registry_tracks track
    where track.id=v_target.subject_id;

    if not found
       or v_track.status='archived'
       or v_track.isrc is distinct from v_isrc
    then
      v_failure:='canonical_track_isrc_mismatch';
    end if;
  end if;

  if v_failure is null then
    v_current_track_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        'track',
        v_target.subject_id
      );

    if v_current_track_fingerprint is distinct from
         v_operation.result_payload->>'after_state_fingerprint'
    then
      v_failure:='canonical_track_state_changed_after_isrc_projection';
    end if;
  end if;

  if v_failure is null then
    select assertion.*
    into v_identifier
    from public.registry_external_identifier_assertions assertion
    where assertion.id=
          (v_operation.result_payload->>'external_identifier_assertion_id')::uuid;

    if not found
       or v_identifier.track_id<>v_target.subject_id
       or v_identifier.scheme_key<>'isrc'
       or v_identifier.comparison_value<>v_isrc
       or v_identifier.assertion_status<>'candidate'
       or v_identifier.valid_to is not null
       or v_identifier.evidence_assertion_id<>v_evidence.id
    then
      v_failure:='identifier_assertion_mismatch';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_assertion_count
    from public.registry_external_identifier_assertions assertion
    where assertion.track_id=v_target.subject_id
      and assertion.scheme_key='isrc'
      and assertion.comparison_value=v_isrc
      and assertion.valid_to is null
      and assertion.assertion_status
            not in ('rejected','superseded');

    if v_assertion_count<>1 then
      v_failure:='identifier_assertion_mismatch';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_other_track_count
    from public.registry_tracks other_track
    where other_track.id<>v_target.subject_id
      and other_track.status<>'archived'
      and platform_private.registry_track_isrc_normalize_v1(
            other_track.isrc
          )=v_isrc;

    if v_other_track_count<>0 then
      v_failure:='canonical_track_isrc_collision';
    end if;
  end if;

  if v_failure is null then
    v_current_candidate:=
      platform_private.registry_track_isrc_projection_candidate_state_v1(
        v_target.subject_id,
        v_provider_link.id
      );

    if v_current_candidate->>'candidate_state'<>'already_current'
       or v_current_candidate->>'normalized_isrc'<>v_isrc
    then
      v_failure:='post_projection_candidate_state_mismatch';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    where link.operation_id=v_operation.id;

    select count(*)::integer
    into v_assertion_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type='track'
      and event.registry_entity_id=v_target.subject_id::text
      and event.source_suggestion_id=v_evidence.id::text
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.field_name='external_identifier.isrc'
      and event.target_path='public.registry_external_identifier_assertions'
      and event.action='admit_external_identifier_assertion'
      and event.status='succeeded'
      and event.actor='system:registry_provider_link_admin'
      and event.after_value->>'id'=v_identifier.id::text;

    select count(*)::integer
    into v_track_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type='track'
      and event.registry_entity_id=v_target.subject_id::text
      and event.source_suggestion_id=v_evidence.id::text
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.field_name='isrc'
      and event.target_path='public.registry_tracks.isrc'
      and event.action='admit_isrc_projection'
      and event.status='succeeded'
      and event.actor='system:registry_provider_link_admin'
      and event.after_value->>'isrc'=v_isrc;

    if v_event_count<>2
       or v_assertion_event_count<>1
       or v_track_event_count<>1
    then
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
    error_code='registry_track_isrc_projection_verification_failed',
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

create function
public.admin_admit_registry_track_isrc_projection_v1(
  p_track_id uuid,
  p_provider_link_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $public_rpc$
declare
  v_user_id uuid;
  v_candidate jsonb;
  v_track_fingerprint text;
  v_provider_link_fingerprint text;
  v_evidence_id uuid;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_provider_link public.registry_track_provider_links%rowtype;
  v_identifier public.registry_external_identifier_assertions%rowtype;
  v_operation platform_private.registry_mutation_operations%rowtype;
begin
  v_user_id:=
    platform_private.registry_provider_link_admin_current_user_v1();

  if p_track_id is null or p_provider_link_id is null then
    raise exception using errcode='22023',
      message='Track and provider-link UUIDs are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry-track-isrc-projection:'||
      p_track_id::text||':'||
      p_provider_link_id::text,
      0
    )
  );

  v_candidate:=
    platform_private.registry_track_isrc_projection_candidate_state_v1(
      p_track_id,
      p_provider_link_id
    );

  if v_candidate->>'candidate_state'='already_current' then
    select assertion.*
    into v_identifier
    from public.registry_external_identifier_assertions assertion
    where assertion.track_id=p_track_id
      and assertion.scheme_key='isrc'
      and assertion.comparison_value=
            v_candidate->>'normalized_isrc'
      and assertion.valid_to is null
      and assertion.assertion_status
            not in ('rejected','superseded')
    order by assertion.created_at,assertion.id
    limit 1;

    if not found then
      raise exception using errcode='P0001',
        message='WK_TRACK_ISRC_ALREADY_CURRENT_ASSERTION_MISSING: current Track ISRC lacks its bound identifier assertion.';
    end if;

    return jsonb_build_object(
      'track_id',p_track_id,
      'provider_link_id',p_provider_link_id,
      'isrc',v_candidate->>'normalized_isrc',
      'external_identifier_assertion_id',v_identifier.id,
      '_authority',
        jsonb_build_object(
          'mode','already_current',
          'verified',true,
          'operation_key','registry.track.isrc_projection.admit',
          'operation_version',1
        )
    );
  end if;

  if v_candidate->>'candidate_state'<>
       'deterministic_projection_candidate'
  then
    raise exception using errcode='23514',
      message='WK_TRACK_ISRC_REVIEW_REQUIRED: retained provider evidence is not a collision-free deterministic projection candidate.';
  end if;

  select link.*
  into v_provider_link
  from public.registry_track_provider_links link
  where link.id=p_provider_link_id
    and link.track_id=p_track_id;

  if not found then
    raise exception using errcode='P0002',
      message='Bound typed provider link is missing.';
  end if;

  v_track_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'track',
      p_track_id
    );

  v_provider_link_fingerprint:=
    platform_private.registry_provider_link_state_fingerprint_v1(
      p_track_id,
      v_provider_link.provider_key,
      v_provider_link.provider_track_id
    );

  if v_track_fingerprint is null
     or v_provider_link_fingerprint is null
  then
    raise exception using errcode='23514',
      message='Exact Track/provider-link state fingerprints are required.';
  end if;

  v_evidence_id:=
    platform_private.record_registry_track_isrc_projection_evidence_v1(
      p_track_id,
      p_provider_link_id,
      v_candidate
    );

  v_grant_id:=
    platform_private.issue_registry_track_isrc_projection_grant_v1(
      v_evidence_id,
      p_track_id,
      p_provider_link_id,
      v_track_fingerprint,
      v_provider_link_fingerprint
    );

  select *
  into v_exec
  from platform_private.execute_registry_track_isrc_projection_v1(
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_track_isrc_projection_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='P0001',
      message='WK_TRACK_ISRC_VERIFIER_FAILED: Track ISRC projection verification failed.';
  end if;

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_exec.operation_id;

  select assertion.*
  into v_identifier
  from public.registry_external_identifier_assertions assertion
  where assertion.id=
        (v_operation.result_payload->>'external_identifier_assertion_id')::uuid;

  if not found then
    raise exception using errcode='P0002',
      message='Verified Track ISRC identifier assertion is missing.';
  end if;

  return jsonb_build_object(
    'track_id',p_track_id,
    'provider_link_id',p_provider_link_id,
    'isrc',v_candidate->>'normalized_isrc',
    'external_identifier_assertion_id',v_identifier.id,
    '_authority',
      jsonb_build_object(
        'mode','exact_operation',
        'verified',true,
        'operation_id',v_exec.operation_id,
        'execution_grant_id',v_grant_id,
        'evidence_assertion_id',v_evidence_id,
        'idempotent_replay',v_exec.idempotent_replay,
        'operation_key','registry.track.isrc_projection.admit',
        'operation_version',1
      )
  );
end
$public_rpc$;

revoke all on function
  platform_private.registry_track_isrc_normalize_v1(text),
  platform_private.registry_track_isrc_projection_candidate_state_v1(uuid,uuid),
  platform_private.record_registry_track_isrc_projection_evidence_v1(uuid,uuid,jsonb),
  platform_private.issue_registry_track_isrc_projection_grant_v1(uuid,uuid,uuid,text,text),
  platform_private.execute_registry_track_isrc_projection_v1(uuid),
  platform_private.verify_registry_track_isrc_projection_v1(uuid)
from public, anon, authenticated, service_role;

revoke all on function
  public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)
from public, anon, service_role;

grant execute on function
  public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)
to authenticated;

comment on function
  public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)
is
  'Admits one collision-free retained typed Apple Music ISRC as a candidate identifier assertion and null-only Registry Track ISRC projection through exact human grant and independent verification.';

do $proof$
declare
  v_candidate text;
  v_executor text;
begin
  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.track.isrc_projection.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key='admit_registry_track_isrc_projection'
      and operation_type.enabled
      and operation_type.allowed_subject_types=array['track']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=2
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception
      'Track ISRC projection operation drifted during installation';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_provider_link_admin'
      and actor.status='active'
      and actor.capability_profile->'operation_family'
          @> '["registry.track.isrc_projection.admit/v1"]'::jsonb
  ) then
    raise exception
      'Registry Provider Link Admin actor profile did not gain Track ISRC projection family';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Track ISRC projection public wrapper grant boundary drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_track_isrc_projection_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_track_isrc_projection_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Track ISRC projection private executor leaked role authority';
  end if;

  select pg_get_functiondef(
    'platform_private.registry_track_isrc_projection_candidate_state_v1(uuid,uuid)'::regprocedure
  )
  into v_candidate;

  select pg_get_functiondef(
    'platform_private.execute_registry_track_isrc_projection_v1(uuid)'::regprocedure
  )
  into v_executor;

  if position('exact_title_artist' in v_candidate)=0
     or position('0.93' in v_candidate)=0
     or position('song,attributes,isrc' in v_candidate)=0
     or position('song,id' in v_candidate)=0
     or position('deterministic_projection_candidate' in v_candidate)=0
     or position('insert into public.registry_external_identifier_assertions' in lower(v_executor))=0
     or position('update public.registry_tracks' in lower(v_executor))=0
     or position('update public.registry_track_provider_links' in lower(v_executor))>0
  then
    raise exception
      'Track ISRC projection deterministic write boundary drifted';
  end if;

  if exists (
       select 1
       from platform_private.registry_execution_grants grant_row
       where grant_row.actor_key='registry_provider_link_admin'
         and grant_row.operation_key='registry.track.isrc_projection.admit'
         and grant_row.operation_version=1
     )
     or exists (
       select 1
       from platform_private.registry_mutation_operations operation
       where operation.actor_key='registry_provider_link_admin'
         and operation.operation_key='registry.track.isrc_projection.admit'
         and operation.operation_version=1
     )
  then
    raise exception
      'Track ISRC projection migration activated execution residue';
  end if;
end
$proof$;

commit;

