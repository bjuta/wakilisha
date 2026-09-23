-- WAKILISHA Music Identity & Rights Foundation
-- Slice 3: governed exact Track/Artist Media-asset binding admission.
--
-- This migration creates mutation authority only. It performs no historical
-- backfill, creates no Media asset, and never rewrites public/artwork URLs.

begin;

set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'music-identity-rights-slice3-media-asset-binding-admission-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.capability_definitions') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_media_assets') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('public.registry_canonical_write_events') is null
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
      'STOP: accepted Registry Media governance foundation is incomplete';
  end if;

  if exists (
       select 1
       from public.capability_definitions
       where capability_key in (
         'admit_registry_track_media_asset_binding',
         'admit_registry_artist_media_asset_binding'
       )
     )
     or exists (
       select 1
       from platform_private.registry_operation_types
       where (
         operation_key='registry.track.media_asset_binding.admit'
         or operation_key='registry.artist.media_asset_binding.admit'
       )
       and operation_version=1
     )
     or exists (
       select 1
       from platform_private.system_actors
       where actor_key='registry_media_asset_binding_admin'
     )
     or to_regprocedure(
       'platform_private.registry_media_asset_binding_admin_current_user_v1()'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_media_asset_state_fingerprint_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_media_asset_binding_candidate_state_v1(text,uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.record_registry_media_asset_binding_evidence_v1(text,uuid,uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'platform_private.issue_registry_media_asset_binding_admin_grant_v1(uuid,text,uuid,jsonb,text,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_media_asset_binding_admin_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_media_asset_binding_admin_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_admit_registry_track_media_asset_candidate_v1(uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_admit_registry_artist_media_asset_candidate_v1(uuid,uuid)'
     ) is not null
  then
    raise exception
      'STOP: Slice 3 Media-asset binding authority already exists; audit before reapplying';
  end if;
end
$preflight$;

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values
(
  'admit_registry_track_media_asset_binding',
  'Admit Registry Track Media asset binding',
  'Admit one exact retained-URL Track-to-Media-asset binding through a typed Registry operation.',
  'registry'
),
(
  'admit_registry_artist_media_asset_binding',
  'Admit Registry Artist Media asset binding',
  'Admit one exact retained-URL Artist-to-Media-asset binding through a typed Registry operation.',
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
values
(
  'registry.track.media_asset_binding.admit',
  1,
  'admit_registry_track_media_asset_binding',
  'medium',
  array['track']::text[],
  true,
  1,
  1,
  300,
  true,
  true,
  true,
  'Admit one exact retained artwork_url match onto an existing Registry Track whose artwork_image_id is null.'
),
(
  'registry.artist.media_asset_binding.admit',
  1,
  'admit_registry_artist_media_asset_binding',
  'medium',
  array['artist']::text[],
  true,
  1,
  1,
  300,
  true,
  true,
  true,
  'Admit one exact retained public_image_url match onto an existing Registry Artist whose public_image_id is null.'
);

insert into platform_private.system_actors (
  actor_key,
  label,
  actor_kind,
  status,
  capability_profile
)
values (
  'registry_media_asset_binding_admin',
  'Registry Media Asset Binding Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_family',
      jsonb_build_array(
        'registry.track.media_asset_binding.admit/v1',
        'registry.artist.media_asset_binding.admit/v1'
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
  'registry_media_asset_binding_admin',
  'database_role',
  'authenticator',
  'active'
);

create function
platform_private.registry_media_asset_binding_admin_current_user_v1()
returns uuid
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private,auth
as $current_user$
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
    where binding.actor_key='registry_media_asset_binding_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry Media Asset Binding admin broker.';
  end if;

  return v_user_id;
end
$current_user$;

create function
platform_private.registry_media_asset_state_fingerprint_v1(
  p_media_asset_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path=pg_catalog,public,extensions
as $asset_fingerprint$
declare
  v_state jsonb;
begin
  if p_media_asset_id is null then
    return null;
  end if;

  select to_jsonb(asset)
  into v_state
  from public.registry_media_assets asset
  where asset.id=p_media_asset_id;

  if v_state is null then
    return null;
  end if;

  return encode(
    extensions.digest(v_state::text,'sha256'),
    'hex'
  );
end
$asset_fingerprint$;

create function
platform_private.registry_media_asset_binding_candidate_state_v1(
  p_subject_type text,
  p_subject_id uuid,
  p_media_asset_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $candidate$
declare
  v_subject_status text;
  v_source_url text;
  v_current_asset_id uuid;
  v_asset public.registry_media_assets%rowtype;
  v_exact_match_count integer:=0;
  v_asset_fingerprint text;
begin
  if p_subject_type not in ('track','artist')
     or p_subject_id is null
     or p_media_asset_id is null
  then
    raise exception using errcode='22023',
      message='Track or Artist subject UUID and Media asset UUID are required.';
  end if;

  if p_subject_type='track' then
    select
      track.status,
      track.artwork_url,
      track.artwork_image_id
    into
      v_subject_status,
      v_source_url,
      v_current_asset_id
    from public.registry_tracks track
    where track.id=p_subject_id;
  else
    select
      artist.status,
      artist.public_image_url,
      artist.public_image_id
    into
      v_subject_status,
      v_source_url,
      v_current_asset_id
    from public.registry_artists artist
    where artist.id=p_subject_id;
  end if;

  if not found or v_subject_status='archived' then
    raise exception using errcode='P0002',
      message='Registry Media binding subject is missing or archived.';
  end if;

  if nullif(btrim(v_source_url),'') is null then
    raise exception using errcode='23514',
      message='WK_STALE_MEDIA_SOURCE: retained public Media URL is missing.';
  end if;

  select asset.*
  into v_asset
  from public.registry_media_assets asset
  where asset.id=p_media_asset_id;

  if not found or v_asset.status<>'active' then
    raise exception using errcode='P0002',
      message='Registry Media asset is missing or inactive.';
  end if;

  select count(*)::integer
  into v_exact_match_count
  from public.registry_media_assets asset
  where asset.status='active'
    and asset.url=v_source_url;

  v_asset_fingerprint:=
    platform_private.registry_media_asset_state_fingerprint_v1(
      p_media_asset_id
    );

  return jsonb_build_object(
    'subject_type',p_subject_type,
    'subject_id',p_subject_id::text,
    'subject_status',v_subject_status,
    'source_url',v_source_url,
    'current_media_asset_id',
      case
        when v_current_asset_id is null then null
        else v_current_asset_id::text
      end,
    'target_media_asset_id',v_asset.id::text,
    'target_media_asset_url',v_asset.url,
    'target_media_asset_status',v_asset.status,
    'target_asset_state_fingerprint',v_asset_fingerprint,
    'exact_active_asset_match_count',v_exact_match_count,
    'candidate_state',
      case
        when v_current_asset_id is null
         and v_exact_match_count=1
         and v_asset.url=v_source_url
          then 'exact_url_reuse_candidate'
        when v_current_asset_id=p_media_asset_id
         and v_exact_match_count=1
         and v_asset.url=v_source_url
          then 'already_current'
        else 'review_only'
      end
  );
end
$candidate$;

create function
platform_private.record_registry_media_asset_binding_evidence_v1(
  p_subject_type text,
  p_subject_id uuid,
  p_media_asset_id uuid,
  p_candidate_state jsonb
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $evidence$
declare
  v_user_id uuid;
  v_claim_key text;
  v_source_payload_fingerprint text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  v_user_id:=
    platform_private.registry_media_asset_binding_admin_current_user_v1();

  if p_subject_type='track' then
    v_claim_key:='registry.track.media_asset_binding.admit';
  elsif p_subject_type='artist' then
    v_claim_key:='registry.artist.media_asset_binding.admit';
  else
    raise exception using errcode='22023',
      message='Media binding evidence subject type must be Track or Artist.';
  end if;

  if p_subject_id is null
     or p_media_asset_id is null
     or p_candidate_state is null
     or jsonb_typeof(p_candidate_state)<>'object'
     or p_candidate_state->>'candidate_state'<>'exact_url_reuse_candidate'
     or p_candidate_state->>'subject_type'<>p_subject_type
     or (p_candidate_state->>'subject_id')::uuid<>p_subject_id
     or (p_candidate_state->>'target_media_asset_id')::uuid<>p_media_asset_id
     or coalesce(
          (p_candidate_state->>'exact_active_asset_match_count')::integer,
          0
        )<>1
     or p_candidate_state->>'source_url'
          <>p_candidate_state->>'target_media_asset_url'
     or p_candidate_state->>'target_media_asset_status'<>'active'
  then
    raise exception using errcode='22023',
      message='Exact Media asset binding candidate state is required.';
  end if;

  v_source_payload_fingerprint:=
    encode(
      extensions.digest(p_candidate_state::text,'sha256'),
      'hex'
    );

  v_assertion_fingerprint:=
    encode(
      extensions.digest(
        jsonb_build_object(
          'subject_type',p_subject_type,
          'subject_id',p_subject_id::text,
          'claim_key',v_claim_key,
          'claim_payload',p_candidate_state,
          'trust_class','INTERNAL_FACT',
          'source_kind','retained_registry_metadata',
          'source_ref',
            'retained-media-url:'||
            p_subject_type||':'||
            p_subject_id::text||':'||
            p_media_asset_id::text,
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
    p_subject_type,
    p_subject_id,
    v_claim_key,
    p_candidate_state,
    'INTERNAL_FACT',
    'retained_registry_metadata',
    'retained-media-url:'||
      p_subject_type||':'||
      p_subject_id::text||':'||
      p_media_asset_id::text,
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
platform_private.issue_registry_media_asset_binding_admin_grant_v1(
  p_evidence_assertion_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_candidate_state jsonb,
  p_expected_subject_state_fingerprint text,
  p_expected_asset_state_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $grant$
declare
  v_user_id uuid;
  v_operation_key text;
  v_capability_key text;
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
    platform_private.registry_media_asset_binding_admin_current_user_v1();

  if p_subject_type='track' then
    v_operation_key:='registry.track.media_asset_binding.admit';
    v_capability_key:='admit_registry_track_media_asset_binding';
  elsif p_subject_type='artist' then
    v_operation_key:='registry.artist.media_asset_binding.admit';
    v_capability_key:='admit_registry_artist_media_asset_binding';
  else
    raise exception using errcode='22023',
      message='Media binding grant subject type must be Track or Artist.';
  end if;

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key=v_operation_key
    and operation_type.operation_version=1
    and operation_type.capability_key=v_capability_key
    and operation_type.enabled;

  if not found
     or v_operation_type.allowed_subject_types<>array[p_subject_type]::text[]
     or not v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<>1
     or v_operation_type.max_grant_ttl_seconds<>300
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Media asset binding operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>p_subject_type
     or v_evidence.subject_id<>p_subject_id
     or v_evidence.claim_key<>v_operation_key
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'retained_registry_metadata'
     or v_evidence.recorded_by_principal_key<>
          'user:'||v_user_id::text
     or v_evidence.claim_payload<>p_candidate_state
     or p_candidate_state->>'target_asset_state_fingerprint'
          <>p_expected_asset_state_fingerprint
  then
    raise exception using errcode='42501',
      message='Evidence is not caller-bound exact Media asset authority.';
  end if;

  v_plan:=jsonb_build_object(
    'operation_key',v_operation_key,
    'operation_version',1,
    'subject_type',p_subject_type,
    'subject_id',p_subject_id::text,
    'target_media_asset_id',
      p_candidate_state->>'target_media_asset_id',
    'candidate_state',p_candidate_state,
    'candidate_state_fingerprint',
      encode(
        extensions.digest(p_candidate_state::text,'sha256'),
        'hex'
      ),
    'target_asset_state_fingerprint',
      p_expected_asset_state_fingerprint,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version',
      'registry-media-asset-binding-admission-v1'
  );

  v_plan_fingerprint:=
    platform_private.registry_plan_fingerprint(v_plan);

  v_target_set:=jsonb_build_array(
    jsonb_build_object(
      'subject_type',p_subject_type,
      'subject_id',p_subject_id::text,
      'expected_state_fingerprint',
        p_expected_subject_state_fingerprint
    )
  );

  v_target_fingerprint:=
    encode(
      extensions.digest(v_target_set::text,'sha256'),
      'hex'
    );

  v_idempotency_key:=
    'registry-media-asset-binding-admit:'||
    encode(
      extensions.digest(
        (
          p_subject_type||':'||
          p_subject_id::text||':'||
          (p_candidate_state->>'target_media_asset_id')||':'||
          v_evidence.assertion_fingerprint
        ),
        'sha256'
      ),
      'hex'
    );

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_media_asset_binding_admin'
    and execution_grant.operation_key=v_operation_key
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
    then
      raise exception using errcode='23505',
        message='Media binding idempotency key is bound to different authority.';
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
    'registry_media_asset_binding_admin',
    v_capability_key,
    null,
    v_operation_key,
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-media-asset-binding-admission-v1',
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
    p_subject_type,
    p_subject_id,
    p_expected_subject_state_fingerprint
  );

  if platform_private.registry_execution_target_set_fingerprint(v_grant_id)
       <>v_target_fingerprint
  then
    raise exception using errcode='23514',
      message='Media binding exact target-set fingerprint drifted.';
  end if;

  return v_grant_id;
end
$grant$;

create function
platform_private.execute_registry_media_asset_binding_admin_v1(
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
  v_asset public.registry_media_assets%rowtype;
  v_plan jsonb;
  v_candidate jsonb;
  v_current_candidate jsonb;
  v_current_candidate_fingerprint text;
  v_current_subject_fingerprint text;
  v_current_asset_fingerprint text;
  v_before jsonb;
  v_after jsonb;
  v_subject_type text;
  v_subject_id uuid;
  v_asset_id uuid;
  v_expected_operation_key text;
  v_expected_capability_key text;
  v_field_name text;
  v_target_path text;
  v_action text;
  v_rows integer;
  v_after_fingerprint text;
  v_event_id uuid;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_media_asset_binding_admin',
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
     or v_grant.actor_key<>'registry_media_asset_binding_admin'
     or v_grant.operation_version<>1
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>
          'registry-media-asset-binding-admission-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Slice 3 Media asset binding grant.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or v_target.subject_type not in ('track','artist')
     or v_target.expected_state_fingerprint is null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     )<>1
  then
    raise exception using errcode='42501',
      message='Media binding admission requires one exact Track or Artist target.';
  end if;

  v_subject_type:=v_target.subject_type;
  v_subject_id:=v_target.subject_id;
  v_plan:=v_grant.plan_payload;
  v_candidate:=v_plan->'candidate_state';
  v_asset_id:=(v_plan->>'target_media_asset_id')::uuid;

  if v_subject_type='track' then
    v_expected_operation_key:='registry.track.media_asset_binding.admit';
    v_expected_capability_key:='admit_registry_track_media_asset_binding';
    v_field_name:='artwork_image_id';
    v_target_path:='public.registry_tracks.artwork_image_id';
    v_action:='admit_track_media_asset_binding';
  else
    v_expected_operation_key:='registry.artist.media_asset_binding.admit';
    v_expected_capability_key:='admit_registry_artist_media_asset_binding';
    v_field_name:='public_image_id';
    v_target_path:='public.registry_artists.public_image_id';
    v_action:='admit_artist_media_asset_binding';
  end if;

  if v_grant.operation_key<>v_expected_operation_key
     or v_grant.capability_key<>v_expected_capability_key
     or v_operation.operation_key<>v_expected_operation_key
     or v_operation.capability_key<>v_expected_capability_key
  then
    raise exception using errcode='42501',
      message='Media binding grant and typed operation disagree.';
  end if;

  if (
       v_plan-array[
         'operation_key',
         'operation_version',
         'subject_type',
         'subject_id',
         'target_media_asset_id',
         'candidate_state',
         'candidate_state_fingerprint',
         'target_asset_state_fingerprint',
         'evidence_assertion_id',
         'evidence_assertion_fingerprint',
         'trust_class',
         'policy_ruleset_version'
       ]::text[]
     )<>'{}'::jsonb
     or v_plan->>'operation_key'<>v_expected_operation_key
     or coalesce((v_plan->>'operation_version')::integer,0)<>1
     or v_plan->>'subject_type'<>v_subject_type
     or v_plan->>'subject_id'<>v_subject_id::text
     or v_plan->>'trust_class'<>'INTERNAL_FACT'
     or v_plan->>'policy_ruleset_version'<>
          'registry-media-asset-binding-admission-v1'
  then
    raise exception using errcode='42501',
      message='Media binding execution plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>v_subject_type
     or v_evidence.subject_id<>v_subject_id
     or v_evidence.claim_key<>v_expected_operation_key
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'retained_registry_metadata'
     or v_evidence.assertion_fingerprint<>
          v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.claim_payload<>v_candidate
  then
    raise exception using errcode='42501',
      message='Bound Media asset evidence no longer satisfies the exact plan.';
  end if;

  if v_subject_type='track' then
    perform 1
    from public.registry_tracks track
    where track.id=v_subject_id
      and track.status<>'archived'
    for update;
  else
    perform 1
    from public.registry_artists artist
    where artist.id=v_subject_id
      and artist.status<>'archived'
    for update;
  end if;

  if not found then
    raise exception using errcode='P0002',
      message='Registry Media binding subject is missing or archived.';
  end if;

  select asset.*
  into v_asset
  from public.registry_media_assets asset
  where asset.id=v_asset_id
    and asset.status='active'
  for share;

  if not found then
    raise exception using errcode='P0002',
      message='Registry Media asset is missing or inactive.';
  end if;

  v_current_subject_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      v_subject_type,
      v_subject_id
    );

  if v_current_subject_fingerprint is distinct from
       v_target.expected_state_fingerprint
  then
    raise exception using errcode='23514',
      message='WK_STALE_MEDIA_BINDING_TARGET: Registry subject changed after review.';
  end if;

  v_current_asset_fingerprint:=
    platform_private.registry_media_asset_state_fingerprint_v1(
      v_asset_id
    );

  if v_current_asset_fingerprint is distinct from
       v_plan->>'target_asset_state_fingerprint'
  then
    raise exception using errcode='23514',
      message='WK_STALE_MEDIA_ASSET_TARGET: Registry Media asset changed after review.';
  end if;

  v_current_candidate:=
    platform_private.registry_media_asset_binding_candidate_state_v1(
      v_subject_type,
      v_subject_id,
      v_asset_id
    );

  v_current_candidate_fingerprint:=
    encode(
      extensions.digest(v_current_candidate::text,'sha256'),
      'hex'
    );

  if v_current_candidate_fingerprint<>
       v_plan->>'candidate_state_fingerprint'
     or v_current_candidate->>'candidate_state'<>
          'exact_url_reuse_candidate'
  then
    raise exception using errcode='23514',
      message='WK_STALE_MEDIA_BINDING_CANDIDATE: exact Media URL match changed after review.';
  end if;

  if v_subject_type='track' then
    select to_jsonb(track)
    into v_before
    from public.registry_tracks track
    where track.id=v_subject_id;

    if v_before->>'artwork_image_id' is not null then
      raise exception using errcode='23514',
        message='WK_TRACK_MEDIA_ALREADY_BOUND: deterministic admission never overwrites artwork_image_id.';
    end if;
  else
    select to_jsonb(artist)
    into v_before
    from public.registry_artists artist
    where artist.id=v_subject_id;

    if v_before->>'public_image_id' is not null then
      raise exception using errcode='23514',
        message='WK_ARTIST_MEDIA_ALREADY_BOUND: deterministic admission never overwrites public_image_id.';
    end if;
  end if;

  update platform_private.registry_mutation_operations
  set
    status='executing',
    started_at=coalesce(started_at,now()),
    updated_at=now()
  where id=v_operation.id;

  if v_subject_type='track' then
    update public.registry_tracks track
    set
      artwork_image_id=v_asset_id,
      updated_at=now()
    where track.id=v_subject_id
      and track.status<>'archived'
      and track.artwork_image_id is null;

    get diagnostics v_rows=row_count;

    select to_jsonb(track)
    into v_after
    from public.registry_tracks track
    where track.id=v_subject_id;

    if v_rows<>1
       or (
         v_before-array['artwork_image_id','updated_at']::text[]
       ) is distinct from (
         v_after-array['artwork_image_id','updated_at']::text[]
       )
       or (v_after->>'artwork_image_id')::uuid<>v_asset_id
    then
      raise exception using errcode='23514',
        message='Track Media binding execution exceeded artwork_image_id.';
    end if;
  else
    update public.registry_artists artist
    set
      public_image_id=v_asset_id,
      updated_at=now()
    where artist.id=v_subject_id
      and artist.status<>'archived'
      and artist.public_image_id is null;

    get diagnostics v_rows=row_count;

    select to_jsonb(artist)
    into v_after
    from public.registry_artists artist
    where artist.id=v_subject_id;

    if v_rows<>1
       or (
         v_before-array['public_image_id','updated_at']::text[]
       ) is distinct from (
         v_after-array['public_image_id','updated_at']::text[]
       )
       or (v_after->>'public_image_id')::uuid<>v_asset_id
    then
      raise exception using errcode='23514',
        message='Artist Media binding execution exceeded public_image_id.';
    end if;
  end if;

  v_after_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      v_subject_type,
      v_subject_id
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
    v_subject_type,
    v_subject_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    v_field_name,
    v_target_path,
    jsonb_build_object(v_field_name,null),
    jsonb_build_object(v_field_name,v_asset_id::text),
    v_action,
    'succeeded',
    'system:registry_media_asset_binding_admin'
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
      'subject_type',v_subject_type,
      'subject_id',v_subject_id::text,
      'target_media_asset_id',v_asset_id::text,
      'after_state_fingerprint',v_after_fingerprint,
      'target_asset_state_fingerprint',v_current_asset_fingerprint
    ),
    completed_at=now(),
    updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  operation_status:='succeeded';
  verifier_status:='pending';
  idempotent_replay:=false;
  return next;
end
$execute$;

create function
platform_private.verify_registry_media_asset_binding_admin_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private
as $verify$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_asset public.registry_media_assets%rowtype;
  v_plan jsonb;
  v_subject_type text;
  v_subject_id uuid;
  v_asset_id uuid;
  v_expected_operation_key text;
  v_expected_capability_key text;
  v_field_name text;
  v_target_path text;
  v_action text;
  v_subject_status text;
  v_source_url text;
  v_current_asset_id uuid;
  v_current_subject_fingerprint text;
  v_current_asset_fingerprint text;
  v_event_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_media_asset_binding_admin'
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Registry Media Asset Binding V1 operation not found.';
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
       or v_grant.actor_key<>'registry_media_asset_binding_admin'
       or v_grant.operation_version<>1
       or v_grant.policy_ruleset_version<>
            'registry-media-asset-binding-admission-v1'
     )
  then
    v_failure:='execution_grant_mismatch';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_subject_type:=v_plan->>'subject_type';
    v_subject_id:=(v_plan->>'subject_id')::uuid;
    v_asset_id:=(v_plan->>'target_media_asset_id')::uuid;

    if v_subject_type='track' then
      v_expected_operation_key:='registry.track.media_asset_binding.admit';
      v_expected_capability_key:='admit_registry_track_media_asset_binding';
      v_field_name:='artwork_image_id';
      v_target_path:='public.registry_tracks.artwork_image_id';
      v_action:='admit_track_media_asset_binding';
    elsif v_subject_type='artist' then
      v_expected_operation_key:='registry.artist.media_asset_binding.admit';
      v_expected_capability_key:='admit_registry_artist_media_asset_binding';
      v_field_name:='public_image_id';
      v_target_path:='public.registry_artists.public_image_id';
      v_action:='admit_artist_media_asset_binding';
    else
      v_failure:='unsupported_subject_type';
    end if;
  end if;

  if v_failure is null
     and (
       v_grant.operation_key<>v_expected_operation_key
       or v_grant.capability_key<>v_expected_capability_key
       or v_operation.operation_key<>v_expected_operation_key
       or v_operation.capability_key<>v_expected_capability_key
     )
  then
    v_failure:='typed_operation_mismatch';
  end if;

  if v_failure is null then
    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id=v_grant.id;

    if not found
       or v_target.subject_type<>v_subject_type
       or v_target.subject_id<>v_subject_id
       or v_target.expected_state_fingerprint is null
       or (
         select count(*)
         from platform_private.registry_execution_grant_targets target_count
         where target_count.execution_grant_id=v_grant.id
       )<>1
    then
      v_failure:='exact_subject_target_missing';
    end if;
  end if;

  if v_failure is null then
    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=(v_plan->>'evidence_assertion_id')::uuid
      and assertion.subject_type=v_subject_type
      and assertion.subject_id=v_subject_id
      and assertion.claim_key=v_expected_operation_key
      and assertion.trust_class='INTERNAL_FACT'
      and assertion.source_kind='retained_registry_metadata'
      and assertion.assertion_fingerprint=
          v_plan->>'evidence_assertion_fingerprint';

    if not found
       or v_evidence.claim_payload<>v_plan->'candidate_state'
    then
      v_failure:='bound_evidence_missing';
    end if;
  end if;

  if v_failure is null then
    select asset.*
    into v_asset
    from public.registry_media_assets asset
    where asset.id=v_asset_id;

    if not found or v_asset.status<>'active' then
      v_failure:='canonical_media_asset_unavailable';
    end if;
  end if;

  if v_failure is null then
    v_current_asset_fingerprint:=
      platform_private.registry_media_asset_state_fingerprint_v1(
        v_asset_id
      );

    if v_current_asset_fingerprint is distinct from
         v_plan->>'target_asset_state_fingerprint'
       or v_current_asset_fingerprint is distinct from
         v_operation.result_payload->>'target_asset_state_fingerprint'
    then
      v_failure:='canonical_media_asset_state_mismatch';
    end if;
  end if;

  if v_failure is null then
    if v_subject_type='track' then
      select
        track.status,
        track.artwork_url,
        track.artwork_image_id
      into
        v_subject_status,
        v_source_url,
        v_current_asset_id
      from public.registry_tracks track
      where track.id=v_subject_id;
    else
      select
        artist.status,
        artist.public_image_url,
        artist.public_image_id
      into
        v_subject_status,
        v_source_url,
        v_current_asset_id
      from public.registry_artists artist
      where artist.id=v_subject_id;
    end if;

    if not found
       or v_subject_status='archived'
       or v_current_asset_id is distinct from v_asset_id
       or v_source_url is distinct from v_asset.url
    then
      v_failure:='canonical_subject_media_binding_mismatch';
    end if;
  end if;

  if v_failure is null then
    v_current_subject_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        v_subject_type,
        v_subject_id
      );

    if v_current_subject_fingerprint is distinct from
         v_operation.result_payload->>'after_state_fingerprint'
    then
      v_failure:='canonical_subject_changed_after_media_binding';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type=v_subject_type
      and event.registry_entity_id=v_subject_id::text
      and event.source_suggestion_id=v_evidence.id::text
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.field_name=v_field_name
      and event.target_path=v_target_path
      and event.action=v_action
      and event.status='succeeded'
      and event.actor='system:registry_media_asset_binding_admin'
      and event.after_value->>v_field_name=v_asset_id::text;

    if v_event_count<>1 then
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
    error_code='registry_media_asset_binding_verification_failed',
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
public.admin_admit_registry_track_media_asset_candidate_v1(
  p_track_id uuid,
  p_media_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $public_track$
declare
  v_user_id uuid;
  v_candidate jsonb;
  v_expected_subject_state_fingerprint text;
  v_expected_asset_state_fingerprint text;
  v_evidence_id uuid;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_track public.registry_tracks%rowtype;
begin
  v_user_id:=
    platform_private.registry_media_asset_binding_admin_current_user_v1();

  if p_track_id is null or p_media_asset_id is null then
    raise exception using errcode='22023',
      message='Track and Media asset UUIDs are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry-track-media-binding:'||
      p_track_id::text||':'||
      p_media_asset_id::text,
      0
    )
  );

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_track_id
    and track.status<>'archived'
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Registry Track is missing or archived.';
  end if;

  v_candidate:=
    platform_private.registry_media_asset_binding_candidate_state_v1(
      'track',
      p_track_id,
      p_media_asset_id
    );

  if v_candidate->>'candidate_state'='already_current' then
    return to_jsonb(v_track)||
      jsonb_build_object(
        '_authority',
        jsonb_build_object(
          'mode','already_current',
          'verified',true,
          'operation_key',
            'registry.track.media_asset_binding.admit',
          'operation_version',1
        )
      );
  end if;

  if v_candidate->>'candidate_state'<>'exact_url_reuse_candidate' then
    raise exception using errcode='23514',
      message='WK_TRACK_MEDIA_REVIEW_REQUIRED: retained Track artwork URL is not one exact active Media asset candidate.';
  end if;

  v_expected_subject_state_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'track',
      p_track_id
    );

  v_expected_asset_state_fingerprint:=
    platform_private.registry_media_asset_state_fingerprint_v1(
      p_media_asset_id
    );

  v_evidence_id:=
    platform_private.record_registry_media_asset_binding_evidence_v1(
      'track',
      p_track_id,
      p_media_asset_id,
      v_candidate
    );

  v_grant_id:=
    platform_private.issue_registry_media_asset_binding_admin_grant_v1(
      v_evidence_id,
      'track',
      p_track_id,
      v_candidate,
      v_expected_subject_state_fingerprint,
      v_expected_asset_state_fingerprint
    );

  select *
  into v_exec
  from platform_private.execute_registry_media_asset_binding_admin_v1(
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_media_asset_binding_admin_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='WK_TRACK_MEDIA_VERIFIER_FAILED: Track Media binding verification failed.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_track_id;

  return to_jsonb(v_track)||
    jsonb_build_object(
      '_authority',
      jsonb_build_object(
        'mode','exact_operation',
        'verified',true,
        'operation_id',v_exec.operation_id,
        'execution_grant_id',v_grant_id,
        'evidence_assertion_id',v_evidence_id,
        'idempotent_replay',v_exec.idempotent_replay,
        'operation_key','registry.track.media_asset_binding.admit',
        'operation_version',1
      )
    );
end
$public_track$;

create function
public.admin_admit_registry_artist_media_asset_candidate_v1(
  p_artist_id uuid,
  p_media_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $public_artist$
declare
  v_user_id uuid;
  v_candidate jsonb;
  v_expected_subject_state_fingerprint text;
  v_expected_asset_state_fingerprint text;
  v_evidence_id uuid;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_artist public.registry_artists%rowtype;
begin
  v_user_id:=
    platform_private.registry_media_asset_binding_admin_current_user_v1();

  if p_artist_id is null or p_media_asset_id is null then
    raise exception using errcode='22023',
      message='Artist and Media asset UUIDs are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry-artist-media-binding:'||
      p_artist_id::text||':'||
      p_media_asset_id::text,
      0
    )
  );

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status<>'archived'
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Registry Artist is missing or archived.';
  end if;

  v_candidate:=
    platform_private.registry_media_asset_binding_candidate_state_v1(
      'artist',
      p_artist_id,
      p_media_asset_id
    );

  if v_candidate->>'candidate_state'='already_current' then
    return to_jsonb(v_artist)||
      jsonb_build_object(
        '_authority',
        jsonb_build_object(
          'mode','already_current',
          'verified',true,
          'operation_key',
            'registry.artist.media_asset_binding.admit',
          'operation_version',1
        )
      );
  end if;

  if v_candidate->>'candidate_state'<>'exact_url_reuse_candidate' then
    raise exception using errcode='23514',
      message='WK_ARTIST_MEDIA_REVIEW_REQUIRED: retained Artist image URL is not one exact active Media asset candidate.';
  end if;

  v_expected_subject_state_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'artist',
      p_artist_id
    );

  v_expected_asset_state_fingerprint:=
    platform_private.registry_media_asset_state_fingerprint_v1(
      p_media_asset_id
    );

  v_evidence_id:=
    platform_private.record_registry_media_asset_binding_evidence_v1(
      'artist',
      p_artist_id,
      p_media_asset_id,
      v_candidate
    );

  v_grant_id:=
    platform_private.issue_registry_media_asset_binding_admin_grant_v1(
      v_evidence_id,
      'artist',
      p_artist_id,
      v_candidate,
      v_expected_subject_state_fingerprint,
      v_expected_asset_state_fingerprint
    );

  select *
  into v_exec
  from platform_private.execute_registry_media_asset_binding_admin_v1(
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_media_asset_binding_admin_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='WK_ARTIST_MEDIA_VERIFIER_FAILED: Artist Media binding verification failed.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_artist_id;

  return to_jsonb(v_artist)||
    jsonb_build_object(
      '_authority',
      jsonb_build_object(
        'mode','exact_operation',
        'verified',true,
        'operation_id',v_exec.operation_id,
        'execution_grant_id',v_grant_id,
        'evidence_assertion_id',v_evidence_id,
        'idempotent_replay',v_exec.idempotent_replay,
        'operation_key','registry.artist.media_asset_binding.admit',
        'operation_version',1
      )
    );
end
$public_artist$;

revoke all on function
  platform_private.registry_media_asset_binding_admin_current_user_v1(),
  platform_private.registry_media_asset_state_fingerprint_v1(uuid),
  platform_private.registry_media_asset_binding_candidate_state_v1(text,uuid,uuid),
  platform_private.record_registry_media_asset_binding_evidence_v1(text,uuid,uuid,jsonb),
  platform_private.issue_registry_media_asset_binding_admin_grant_v1(uuid,text,uuid,jsonb,text,text),
  platform_private.execute_registry_media_asset_binding_admin_v1(uuid),
  platform_private.verify_registry_media_asset_binding_admin_v1(uuid)
from public,anon,authenticated,service_role;

revoke all on function
  public.admin_admit_registry_track_media_asset_candidate_v1(uuid,uuid),
  public.admin_admit_registry_artist_media_asset_candidate_v1(uuid,uuid)
from public,anon,service_role;

grant execute on function
  public.admin_admit_registry_track_media_asset_candidate_v1(uuid,uuid),
  public.admin_admit_registry_artist_media_asset_candidate_v1(uuid,uuid)
to authenticated;

do $proof$
declare
  v_candidate_definition text;
  v_executor_definition text;
begin
  if (
       select count(*)
       from public.capability_definitions capability
       where capability.capability_key in (
         'admit_registry_track_media_asset_binding',
         'admit_registry_artist_media_asset_binding'
       )
         and capability.domain='registry'
     )<>2
  then
    raise exception 'Media binding typed capabilities are missing';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key=
            'registry.track.media_asset_binding.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key=
            'admit_registry_track_media_asset_binding'
      and operation_type.risk_class='medium'
      and operation_type.allowed_subject_types=array['track']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Track Media binding operation drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key=
            'registry.artist.media_asset_binding.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key=
            'admit_registry_artist_media_asset_binding'
      and operation_type.risk_class='medium'
      and operation_type.allowed_subject_types=array['artist']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Artist Media binding operation drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_media_asset_binding_admin'
      and actor.status='active'
      and actor.capability_profile->'operation_family'
          @> '[
            "registry.track.media_asset_binding.admit/v1",
            "registry.artist.media_asset_binding.admit/v1"
          ]'::jsonb
  ) then
    raise exception 'Media binding admin actor drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_media_asset_binding_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception 'Media binding authenticator binding drifted';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants standing_grant
    where standing_grant.actor_key='registry_media_asset_binding_admin'
      and standing_grant.status='active'
      and standing_grant.valid_from<=now()
      and standing_grant.expires_at>now()
  ) then
    raise exception 'Media binding admin gained standing autonomous authority';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_track_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_track_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_track_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_admit_registry_artist_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_artist_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_artist_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Media binding public wrapper ACL drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_media_asset_binding_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_media_asset_binding_admin_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Media binding private executor leaked execution authority';
  end if;

  select pg_get_functiondef(
    'platform_private.registry_media_asset_binding_candidate_state_v1(text,uuid,uuid)'::regprocedure
  )
  into v_candidate_definition;

  if position('asset.url=v_source_url' in v_candidate_definition)=0
     or position('exact_active_asset_match_count' in v_candidate_definition)=0
     or position('exact_url_reuse_candidate' in v_candidate_definition)=0
     or position('artwork_url' in v_candidate_definition)=0
     or position('public_image_url' in v_candidate_definition)=0
     or position('similarity' in lower(v_candidate_definition))>0
     or position('levenshtein' in lower(v_candidate_definition))>0
     or position('trigram' in lower(v_candidate_definition))>0
  then
    raise exception 'Media binding exact candidate contract drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.execute_registry_media_asset_binding_admin_v1(uuid)'::regprocedure
  )
  into v_executor_definition;

  if position('artwork_image_id=v_asset_id' in v_executor_definition)=0
     or position('public_image_id=v_asset_id' in v_executor_definition)=0
     or position('admit_track_media_asset_binding' in v_executor_definition)=0
     or position('admit_artist_media_asset_binding' in v_executor_definition)=0
     or position('format(' in lower(v_executor_definition))>0
  then
    raise exception 'Media binding typed executor contract drifted';
  end if;

  if exists (
       select 1
       from platform_private.registry_execution_grants execution_grant
       where execution_grant.actor_key='registry_media_asset_binding_admin'
     )
     or exists (
       select 1
       from platform_private.registry_mutation_operations operation
       where operation.actor_key='registry_media_asset_binding_admin'
     )
  then
    raise exception
      'Media binding migration activated durable execution residue';
  end if;
end
$proof$;

commit;
