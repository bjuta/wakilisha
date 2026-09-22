-- MIZIZI Slice 3 Tranche B — Registry Track Duplicate Repair Authority V1
--
-- Internalizes the mature multi-table Track duplicate repair engine behind the
-- accepted human evidence -> shared review -> exact grant -> mutation journal
-- -> independent verifier control plane. The public Admin RPC signature stays
-- stable; the mutation engine moves to platform_private without being rewritten.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-registry-track-duplicate-repair-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)'
     ) is null
     or to_regprocedure(
       'public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])'
     ) is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_release_tracks') is null
     or to_regclass('public.registry_track_provider_links') is null
     or to_regclass('public.wk_chart_entries_v2') is null
     or to_regclass('public.registry_track_resolution_events') is null
     or to_regclass('public.registry_identity_lineage') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('platform_private.registry_review_cases') is null
     or to_regclass('platform_private.registry_review_events') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_execution_target_set_fingerprint(uuid)') is null
     or to_regprocedure('platform_private.registry_execution_grant_has_current_authority(uuid)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
  then
    raise exception 'STOP: accepted Track duplicate repair / Registry governance authority is incomplete';
  end if;

  if not exists (
    select 1
    from public.capability_definitions capability
    where capability.capability_key='manage_registry'
  ) then
    raise exception 'STOP: manage_registry capability authority is missing';
  end if;

  if (
    select encode(extensions.digest(p.prosrc,'sha256'),'hex')
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='admin_apply_registry_track_duplicate_repair'
      and pg_get_function_identity_arguments(p.oid)=
          'p_canonical_track_id uuid, p_duplicate_track_ids uuid[], p_note text, p_allow_medium_confidence boolean'
  )<>'ff7ec6d997671e5f27ed2056149e56e4c913284f911e0eb943532f750e39c0e7'
  then
    raise exception 'STOP: mature Track duplicate repair engine body drifted before internalization';
  end if;

  if exists (
       select 1
       from public.capability_definitions capability
       where capability.capability_key='repair_registry_track_duplicate'
     )
     or exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_track_duplicate_admin'
     )
     or exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key='registry.track.duplicate_repair'
         and operation_type.operation_version=1
     )
     or to_regprocedure(
       'platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_track_duplicate_admin_current_user_v1()'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_track_duplicate_repair_state_fingerprint_v1(uuid,uuid[])'
     ) is not null
     or to_regprocedure(
       'platform_private.record_registry_track_duplicate_repair_evidence_v1(uuid,uuid[],text,boolean)'
     ) is not null
     or to_regprocedure(
       'platform_private.issue_registry_track_duplicate_repair_grant_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_track_duplicate_repair_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_track_duplicate_repair_v1(uuid)'
     ) is not null
  then
    raise exception 'STOP: Registry Track Duplicate Repair Authority V1 already exists or namespace is occupied';
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
  'repair_registry_track_duplicate',
  'Repair Registry Track duplicate',
  'Apply one reviewed exact Track duplicate repair using the mature bounded multi-table repair engine and independent postcondition verification.',
  'registry'
);

insert into platform_private.system_actors (
  actor_key,
  label,
  actor_kind,
  status,
  capability_profile
)
values (
  'registry_track_duplicate_admin',
  'Registry Track Duplicate Repair Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_family',jsonb_build_array('registry.track.duplicate_repair/v1')
  )
);

insert into platform_private.system_actor_executor_bindings (
  actor_key,
  executor_kind,
  executor_key,
  status
)
values (
  'registry_track_duplicate_admin',
  'database_role',
  'authenticator',
  'active'
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
  'registry.track.duplicate_repair',
  1,
  'repair_registry_track_duplicate',
  'critical',
  array['track']::text[],
  true,
  16,
  64,
  300,
  true,
  true,
  true,
  'Apply one exact reviewed Track duplicate repair candidate. The grant freezes the canonical Track, duplicate Tracks, composite related state, and exact row budget.'
);

create function platform_private.registry_track_duplicate_admin_current_user_v1()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_track_duplicate_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry Track duplicate repair broker.';
  end if;

  return v_user_id;
end
$$;

create function platform_private.registry_track_duplicate_repair_state_fingerprint_v1(
  p_canonical_track_id uuid,
  p_duplicate_track_ids uuid[]
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_duplicate_ids uuid[];
  v_target_ids uuid[];
  v_target_slugs text[];
  v_payload jsonb;
begin
  if p_canonical_track_id is null then
    raise exception using errcode='22023',
      message='Canonical Track is required for duplicate-repair state fingerprinting.';
  end if;

  v_duplicate_ids := array(
    select distinct item
    from unnest(coalesce(p_duplicate_track_ids,'{}'::uuid[])) item
    where item is not null
      and item<>p_canonical_track_id
    order by item
  );

  if coalesce(cardinality(v_duplicate_ids),0)=0 then
    raise exception using errcode='22023',
      message='At least one duplicate Track is required for duplicate-repair state fingerprinting.';
  end if;

  v_target_ids := array(
    select item
    from unnest(array[p_canonical_track_id] || v_duplicate_ids) item
    order by item
  );

  select array_agg(track.slug order by track.id)
  into v_target_slugs
  from public.registry_tracks track
  where track.id=any(v_target_ids);

  if coalesce(cardinality(v_target_slugs),0)<>cardinality(v_target_ids) then
    raise exception using errcode='P0002',
      message='One or more exact Track duplicate-repair targets are missing.';
  end if;

  select jsonb_build_object(
    'canonical_track_id',p_canonical_track_id::text,
    'duplicate_track_ids',to_jsonb(v_duplicate_ids),
    'tracks',coalesce((
      select jsonb_agg(to_jsonb(track) order by track.id::text)
      from public.registry_tracks track
      where track.id=any(v_target_ids)
    ),'[]'::jsonb),
    'provider_links',coalesce((
      select jsonb_agg(to_jsonb(link) order by link.id::text)
      from public.registry_track_provider_links link
      where link.track_id=any(v_target_ids)
    ),'[]'::jsonb),
    'track_artist_credits',coalesce((
      select jsonb_agg(to_jsonb(credit) order by credit.id::text)
      from public.registry_track_artists credit
      where credit.track_id=any(v_target_ids)
    ),'[]'::jsonb),
    'release_track_memberships',coalesce((
      select jsonb_agg(to_jsonb(membership) order by membership.id::text)
      from public.registry_release_tracks membership
      where membership.track_id=any(v_target_ids)
    ),'[]'::jsonb),
    'chart_projection_rows',coalesce((
      select jsonb_agg(to_jsonb(chart_row) order by chart_row.id::text)
      from public.wk_chart_entries_v2 chart_row
      where chart_row.canonical_track_id=any(
              array(select target.value::text from unnest(v_target_ids) as target(value))
            )
         or chart_row.track_slug=any(v_target_slugs)
    ),'[]'::jsonb)
  )
  into v_payload;

  return encode(
    extensions.digest(v_payload::text,'sha256'),
    'hex'
  );
end
$$;

create function platform_private.record_registry_track_duplicate_repair_evidence_v1(
  p_canonical_track_id uuid,
  p_duplicate_track_ids uuid[],
  p_note text default null,
  p_allow_medium_confidence boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid;
  v_duplicate_ids uuid[];
  v_preview jsonb;
  v_confidence text;
  v_blocker_count integer;
  v_counts jsonb;
  v_row_budget integer;
  v_state_fingerprint text;
  v_preview_fingerprint text;
  v_claim jsonb;
  v_source_payload_fingerprint text;
  v_source_ref text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  v_user_id:=platform_private.registry_track_duplicate_admin_current_user_v1();

  if octet_length(coalesce(p_note,''))>4000 then
    raise exception using errcode='22023',
      message='Track duplicate repair note exceeds 4000 bytes.';
  end if;

  v_duplicate_ids := array(
    select distinct item
    from unnest(coalesce(p_duplicate_track_ids,'{}'::uuid[])) item
    where item is not null
      and item<>p_canonical_track_id
    order by item
  );

  if p_canonical_track_id is null
     or coalesce(cardinality(v_duplicate_ids),0)=0
  then
    raise exception using errcode='22023',
      message='Canonical Track and at least one duplicate Track are required.';
  end if;

  if cardinality(v_duplicate_ids)+1>16 then
    raise exception using errcode='54000',
      message='Track duplicate repair exceeds the 16-Track exact target ceiling.';
  end if;

  v_preview:=public.admin_preview_registry_track_duplicate_repair(
    p_canonical_track_id,
    v_duplicate_ids
  );

  v_confidence:=coalesce(v_preview->>'confidenceBucket','blocked');
  v_blocker_count:=jsonb_array_length(coalesce(v_preview->'blockers','[]'::jsonb));

  if v_blocker_count>0 or v_confidence='blocked' then
    raise exception 'repair_blocked: %',
      coalesce(v_preview->'blockers','[]'::jsonb)::text;
  end if;

  if v_confidence='medium' and not coalesce(p_allow_medium_confidence,false) then
    raise exception 'medium_confidence_requires_explicit_allow';
  end if;

  if v_confidence not in ('high','medium') then
    raise exception using errcode='23514',
      message='Track duplicate repair preview returned an unsupported confidence bucket.';
  end if;

  v_counts:=coalesce(v_preview->'counts','{}'::jsonb);

  v_row_budget:=
      coalesce((v_counts->>'chartRowsToMove')::integer,0)
    + coalesce((v_counts->>'providerLinksToMove')::integer,0)
    + coalesce((v_counts->>'releaseTrackRowsTouched')::integer,0)
    + coalesce((v_counts->>'trackArtistCreditsToMove')::integer,0)
    + coalesce((v_counts->>'trackArtistCreditsToArchive')::integer,0)
    + coalesce((v_counts->>'duplicateTracks')::integer,0)
    + 1;

  if v_row_budget<1 or v_row_budget>64 then
    raise exception using errcode='54000',
      message='Track duplicate repair exceeds the 64-row exact operation ceiling.';
  end if;

  v_state_fingerprint:=
    platform_private.registry_track_duplicate_repair_state_fingerprint_v1(
      p_canonical_track_id,
      v_duplicate_ids
    );

  v_preview_fingerprint:=
    platform_private.registry_plan_fingerprint(v_preview);

  v_claim:=jsonb_build_object(
    'operation_key','registry.track.duplicate_repair',
    'operation_version',1,
    'canonical_track_id',p_canonical_track_id::text,
    'duplicate_track_ids',to_jsonb(v_duplicate_ids),
    'confidence_bucket',v_confidence,
    'allow_medium_confidence',coalesce(p_allow_medium_confidence,false),
    'note',nullif(p_note,''),
    'preview_counts',v_counts,
    'preview_fingerprint',v_preview_fingerprint,
    'repair_state_fingerprint',v_state_fingerprint,
    'expected_row_budget',v_row_budget,
    'policy_ruleset_version','registry-track-duplicate-repair-v1'
  );

  v_source_payload_fingerprint:=
    platform_private.registry_plan_fingerprint(v_claim);

  v_source_ref:=
    'registry-track-duplicate-repair:'||
    p_canonical_track_id::text||':'||
    substr(v_source_payload_fingerprint,1,32);

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','track',
        'subject_id',p_canonical_track_id::text,
        'claim_key','registry.track.duplicate_repair',
        'claim_payload',v_claim,
        'trust_class','INTERNAL_FACT',
        'source_kind','registry_track_duplicate_admin',
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
    p_canonical_track_id,
    'registry.track.duplicate_repair',
    v_claim,
    'INTERNAL_FACT',
    'registry_track_duplicate_admin',
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
    where assertion.assertion_fingerprint=v_assertion_fingerprint
      and assertion.recorded_by_principal_key='user:'||v_user_id::text;
  end if;

  if v_assertion_id is null then
    raise exception using errcode='23505',
      message='Track duplicate repair evidence identity conflicts with different authority.';
  end if;

  return v_assertion_id;
end
$$;

create function platform_private.issue_registry_track_duplicate_repair_grant_v1(
  p_evidence_assertion_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_claim jsonb;
  v_canonical_track_id uuid;
  v_duplicate_ids uuid[];
  v_target_ids uuid[];
  v_target_id uuid;
  v_target_state text;
  v_preview jsonb;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_idempotency_key text;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_grant_id uuid;
begin
  v_user_id:=platform_private.registry_track_duplicate_admin_current_user_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.track.duplicate_repair'
    and operation_type.operation_version=1
    and operation_type.capability_key='repair_registry_track_duplicate'
    and operation_type.enabled;

  if not found
     or v_operation_type.risk_class<>'critical'
     or v_operation_type.allowed_subject_types<>array['track']::text[]
     or not v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>16
     or v_operation_type.max_rows_ceiling<>64
     or v_operation_type.max_grant_ttl_seconds<>300
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Track duplicate repair typed operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.claim_key<>'registry.track.duplicate_repair'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'registry_track_duplicate_admin'
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Evidence is not caller-bound Registry Track duplicate repair authority.';
  end if;

  v_claim:=v_evidence.claim_payload;

  if v_claim->>'operation_key'<>'registry.track.duplicate_repair'
     or (v_claim->>'operation_version')::integer<>1
     or v_claim->>'policy_ruleset_version'<>'registry-track-duplicate-repair-v1'
     or v_claim->>'canonical_track_id'<>v_evidence.subject_id::text
     or coalesce((v_claim->>'expected_row_budget')::integer,0) not between 1 and 64
     or jsonb_typeof(v_claim->'duplicate_track_ids')<>'array'
  then
    raise exception using errcode='42501',
      message='Track duplicate repair evidence claim is malformed.';
  end if;

  v_canonical_track_id:=(v_claim->>'canonical_track_id')::uuid;

  select array_agg(item.value::uuid order by item.value)
  into v_duplicate_ids
  from jsonb_array_elements_text(v_claim->'duplicate_track_ids') item(value);

  if coalesce(cardinality(v_duplicate_ids),0)=0
     or v_canonical_track_id=any(v_duplicate_ids)
     or cardinality(v_duplicate_ids)+1>16
  then
    raise exception using errcode='42501',
      message='Track duplicate repair exact target set is malformed.';
  end if;

  v_preview:=public.admin_preview_registry_track_duplicate_repair(
    v_canonical_track_id,
    v_duplicate_ids
  );

  if platform_private.registry_plan_fingerprint(v_preview)<>
       v_claim->>'preview_fingerprint'
     or platform_private.registry_track_duplicate_repair_state_fingerprint_v1(
          v_canonical_track_id,
          v_duplicate_ids
        )<>v_claim->>'repair_state_fingerprint'
  then
    raise exception using errcode='40001',
      message='WK_STALE_TRACK_DUPLICATE_REPAIR: repair state changed before exact grant issuance.';
  end if;

  v_target_ids:=array(
    select item
    from unnest(array[v_canonical_track_id] || v_duplicate_ids) item
    order by item
  );

  v_plan:=jsonb_build_object(
    'operation_key','registry.track.duplicate_repair',
    'operation_version',1,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'canonical_track_id',v_canonical_track_id::text,
    'duplicate_track_ids',to_jsonb(v_duplicate_ids),
    'target_track_ids',to_jsonb(v_target_ids),
    'preview_fingerprint',v_claim->>'preview_fingerprint',
    'repair_state_fingerprint',v_claim->>'repair_state_fingerprint',
    'expected_row_budget',(v_claim->>'expected_row_budget')::integer,
    'note',v_claim->'note',
    'allow_medium_confidence',coalesce((v_claim->>'allow_medium_confidence')::boolean,false),
    'policy_ruleset_version','registry-track-duplicate-repair-v1'
  );

  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(v_plan);

  v_idempotency_key:=
    'registry-track-duplicate-repair:'||v_evidence.assertion_fingerprint;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_duplicate_admin'
    and execution_grant.operation_key='registry.track.duplicate_repair'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.required_user_capability_key<>'manage_registry'
    then
      raise exception using errcode='23505',
        message='Track duplicate repair idempotency key is bound to different authority.';
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
    'registry_track_duplicate_admin',
    'repair_registry_track_duplicate',
    null,
    'registry.track.duplicate_repair',
    1,
    v_plan,
    v_plan_fingerprint,
    repeat('0',64),
    (v_claim->>'expected_row_budget')::integer,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-track-duplicate-repair-v1',
    'manage_registry',
    now(),
    now()+interval '5 minutes'
  )
  returning id into v_grant_id;

  foreach v_target_id in array v_target_ids
  loop
    v_target_state:=
      platform_private.registry_subject_state_fingerprint(
        'track',
        v_target_id
      );

    if v_target_state is null then
      raise exception using errcode='P0002',
        message='Exact Track duplicate repair target fingerprint is unavailable.';
    end if;

    insert into platform_private.registry_execution_grant_targets (
      execution_grant_id,
      subject_type,
      subject_id,
      expected_state_fingerprint
    )
    values (
      v_grant_id,
      'track',
      v_target_id,
      v_target_state
    );
  end loop;

  update platform_private.registry_execution_grants
  set target_set_fingerprint=
        platform_private.registry_execution_target_set_fingerprint(v_grant_id),
      updated_at=now()
  where id=v_grant_id;

  return v_grant_id;
end
$$;

-- Preserve the mature multi-table implementation byte-for-byte at the function
-- body level by moving the existing function instead of recreating it.
alter function public.admin_apply_registry_track_duplicate_repair(
  uuid,uuid[],text,boolean
)
set schema platform_private;

alter function platform_private.admin_apply_registry_track_duplicate_repair(
  uuid,uuid[],text,boolean
)
rename to apply_registry_track_duplicate_repair_engine_v1;

revoke all on function
  platform_private.apply_registry_track_duplicate_repair_engine_v1(
    uuid,uuid[],text,boolean
  )
from public, anon, authenticated, service_role;

comment on function
  platform_private.apply_registry_track_duplicate_repair_engine_v1(
    uuid,uuid[],text,boolean
  )
is
  'Owner-internal mature Track duplicate repair mutation engine. Product execution is retired; callers must use the governed public exact-operation wrapper.';

create function platform_private.execute_registry_track_duplicate_repair_v1(
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
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_canonical_track_id uuid;
  v_duplicate_ids uuid[];
  v_target_ids uuid[];
  v_target_slugs text[];
  v_state_fingerprint text;
  v_result jsonb;
  v_rows integer;
  v_event_id uuid;
  v_write_event_id uuid;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_track_duplicate_admin',
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
     or v_grant.actor_key<>'registry_track_duplicate_admin'
     or v_grant.capability_key<>'repair_registry_track_duplicate'
     or v_grant.operation_key<>'registry.track.duplicate_repair'
     or v_grant.operation_version<>1
     or v_grant.max_rows not between 1 and 64
     or v_grant.policy_ruleset_version<>'registry-track-duplicate-repair-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not Registry Track Duplicate Repair V1 authority.';
  end if;

  v_plan:=v_grant.plan_payload;

  if v_plan->>'operation_key'<>'registry.track.duplicate_repair'
     or (v_plan->>'operation_version')::integer<>1
     or v_plan->>'policy_ruleset_version'<>'registry-track-duplicate-repair-v1'
     or coalesce((v_plan->>'expected_row_budget')::integer,0)<>v_grant.max_rows
     or jsonb_typeof(v_plan->'duplicate_track_ids')<>'array'
     or jsonb_typeof(v_plan->'target_track_ids')<>'array'
  then
    raise exception using errcode='42501',
      message='Registry Track Duplicate Repair V1 plan is malformed.';
  end if;

  v_canonical_track_id:=(v_plan->>'canonical_track_id')::uuid;

  select array_agg(item.value::uuid order by item.value)
  into v_duplicate_ids
  from jsonb_array_elements_text(v_plan->'duplicate_track_ids') item(value);

  select array_agg(item.value::uuid order by item.value)
  into v_target_ids
  from jsonb_array_elements_text(v_plan->'target_track_ids') item(value);

  if coalesce(cardinality(v_duplicate_ids),0)=0
     or coalesce(cardinality(v_target_ids),0)<>cardinality(v_duplicate_ids)+1
     or not (v_canonical_track_id=any(v_target_ids))
     or exists (
       select 1
       from unnest(v_duplicate_ids) duplicate_id
       where duplicate_id<>all(v_target_ids)
     )
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target
       where target.execution_grant_id=v_grant.id
     )<>cardinality(v_target_ids)
     or exists (
       select 1
       from unnest(v_target_ids) target_id
       where not exists (
         select 1
         from platform_private.registry_execution_grant_targets target
         where target.execution_grant_id=v_grant.id
           and target.subject_type='track'
           and target.subject_id=target_id
           and target.expected_state_fingerprint is not null
       )
     )
  then
    raise exception using errcode='42501',
      message='Registry Track Duplicate Repair V1 exact target authority drifted.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid
    and assertion.subject_type='track'
    and assertion.subject_id=v_canonical_track_id
    and assertion.claim_key='registry.track.duplicate_repair'
    and assertion.trust_class='INTERNAL_FACT'
    and assertion.source_kind='registry_track_duplicate_admin'
    and assertion.assertion_fingerprint=
        v_plan->>'evidence_assertion_fingerprint';

  if not found
     or v_evidence.recorded_by_principal_key<>
          v_grant.issued_by_principal_key
     or v_evidence.claim_payload->>'repair_state_fingerprint'<>
          v_plan->>'repair_state_fingerprint'
     or v_evidence.claim_payload->>'preview_fingerprint'<>
          v_plan->>'preview_fingerprint'
  then
    raise exception using errcode='42501',
      message='Bound Track duplicate repair evidence no longer satisfies the exact plan.';
  end if;

  -- Lock every row family whose state participates in the frozen repair plan.
  perform 1
  from public.registry_tracks track
  where track.id=any(v_target_ids)
  order by track.id
  for update;

  select array_agg(track.slug order by track.id)
  into v_target_slugs
  from public.registry_tracks track
  where track.id=any(v_target_ids);

  perform 1
  from public.registry_track_provider_links link
  where link.track_id=any(v_target_ids)
  order by link.id
  for update;

  perform 1
  from public.registry_track_artists credit
  where credit.track_id=any(v_target_ids)
  order by credit.id
  for update;

  perform 1
  from public.registry_release_tracks membership
  where membership.track_id=any(v_target_ids)
  order by membership.id
  for update;

  perform 1
  from public.wk_chart_entries_v2 chart_row
  where chart_row.canonical_track_id=any(
          array(select target.value::text from unnest(v_target_ids) as target(value))
        )
     or chart_row.track_slug=any(v_target_slugs)
  order by chart_row.id
  for update;

  v_state_fingerprint:=
    platform_private.registry_track_duplicate_repair_state_fingerprint_v1(
      v_canonical_track_id,
      v_duplicate_ids
    );

  if v_state_fingerprint<>v_plan->>'repair_state_fingerprint' then
    raise exception using errcode='40001',
      message='WK_STALE_TRACK_DUPLICATE_REPAIR: exact repair state changed after grant issuance.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  v_result:=platform_private.apply_registry_track_duplicate_repair_engine_v1(
    v_canonical_track_id,
    v_duplicate_ids,
    nullif(v_plan->>'note',''),
    coalesce((v_plan->>'allow_medium_confidence')::boolean,false)
  );

  v_rows:=
      coalesce((v_result->>'chartRowsMoved')::integer,0)
    + coalesce((v_result->>'providerLinksMoved')::integer,0)
    + coalesce((v_result->>'releaseTrackRowsMoved')::integer,0)
    + coalesce((v_result->>'releaseTrackRowsArchived')::integer,0)
    + coalesce((v_result->>'trackArtistCreditsMoved')::integer,0)
    + coalesce((v_result->>'trackArtistCreditsArchived')::integer,0)
    + coalesce((v_result->>'duplicateTracksArchived')::integer,0)
    + 1;

  if v_rows>v_grant.max_rows then
    raise exception using errcode='54000',
      message='Track duplicate repair exceeded its exact row budget.';
  end if;

  if nullif(v_result->>'eventId','') is null then
    raise exception using errcode='23514',
      message='Mature Track duplicate repair engine did not emit its resolution event.';
  end if;

  v_event_id:=(v_result->>'eventId')::uuid;

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
    v_canonical_track_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'duplicate_repair',
    'public.registry_tracks+registry_track_artists+registry_release_tracks+registry_track_provider_links+wk_chart_entries_v2',
    jsonb_build_object(
      'repair_state_fingerprint',v_plan->>'repair_state_fingerprint',
      'preview_fingerprint',v_plan->>'preview_fingerprint',
      'expected_row_budget',v_grant.max_rows,
      'duplicate_track_ids',to_jsonb(v_duplicate_ids)
    ),
    v_result,
    'track_duplicate_repair',
    'succeeded',
    'system:registry_track_duplicate_admin'
  )
  returning id into v_write_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,
    canonical_write_event_id
  )
  values (
    v_operation.id,
    v_write_event_id
  );

  update platform_private.registry_mutation_operations
  set affected_rows=v_rows,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'evidence_assertion_id',v_evidence.id,
        'resolution_event_id',v_event_id,
        'canonical_write_event_id',v_write_event_id,
        'result',v_result
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

create function platform_private.verify_registry_track_duplicate_repair_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_canonical_track_id uuid;
  v_duplicate_ids uuid[];
  v_duplicate_slugs text[];
  v_event_id uuid;
  v_event public.registry_track_resolution_events%rowtype;
  v_event_count integer;
  v_valid_event_count integer;
  v_primary_credit_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_track_duplicate_admin'
     or v_operation.capability_key<>'repair_registry_track_duplicate'
     or v_operation.operation_key<>'registry.track.duplicate_repair'
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Registry Track Duplicate Repair V1 operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded'
     or v_operation.affected_rows<1
     or v_operation.affected_rows>v_operation.max_rows
  then
    v_failure:='operation_status_or_row_budget_mismatch';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;

  if v_failure is null
     and (
       not found
       or v_grant.actor_key<>'registry_track_duplicate_admin'
       or v_grant.capability_key<>'repair_registry_track_duplicate'
       or v_grant.operation_key<>'registry.track.duplicate_repair'
       or v_grant.operation_version<>1
       or v_grant.policy_ruleset_version<>'registry-track-duplicate-repair-v1'
       or v_grant.required_user_capability_key<>'manage_registry'
     )
  then
    v_failure:='execution_grant_missing_or_wrong_authority';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_canonical_track_id:=(v_plan->>'canonical_track_id')::uuid;

    select array_agg(item.value::uuid order by item.value)
    into v_duplicate_ids
    from jsonb_array_elements_text(v_plan->'duplicate_track_ids') item(value);

    if coalesce(cardinality(v_duplicate_ids),0)=0 then
      v_failure:='duplicate_target_set_missing';
    end if;
  end if;

  if v_failure is null then
    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=(v_plan->>'evidence_assertion_id')::uuid
      and assertion.subject_type='track'
      and assertion.subject_id=v_canonical_track_id
      and assertion.claim_key='registry.track.duplicate_repair'
      and assertion.trust_class='INTERNAL_FACT'
      and assertion.source_kind='registry_track_duplicate_admin'
      and assertion.assertion_fingerprint=
          v_plan->>'evidence_assertion_fingerprint';

    if not found then
      v_failure:='bound_evidence_missing';
    end if;
  end if;

  if v_failure is null then
    v_event_id:=nullif(v_operation.result_payload->>'resolution_event_id','')::uuid;

    select resolution_event.*
    into v_event
    from public.registry_track_resolution_events resolution_event
    where resolution_event.id=v_event_id
      and resolution_event.action='track_duplicate_repair'
      and resolution_event.status='success'
      and resolution_event.canonical_track_id=v_canonical_track_id;

    if not found
       or cardinality(v_event.duplicate_track_ids)<>cardinality(v_duplicate_ids)
       or not (v_event.duplicate_track_ids @> v_duplicate_ids)
       or not (v_duplicate_ids @> v_event.duplicate_track_ids)
    then
      v_failure:='resolution_event_contract_mismatch';
    end if;
  end if;

  if v_failure is null then
    select array_agg(track.slug order by track.id)
    into v_duplicate_slugs
    from public.registry_tracks track
    where track.id=any(v_duplicate_ids);

    if not exists (
         select 1
         from public.registry_tracks canonical
         where canonical.id=v_canonical_track_id
           and canonical.status<>'archived'
       )
       or (
         select count(*)
         from public.registry_tracks duplicate_track
         where duplicate_track.id=any(v_duplicate_ids)
           and duplicate_track.status='archived'
           and duplicate_track.metadata->>'superseded_by_track_id'=
               v_canonical_track_id::text
       )<>cardinality(v_duplicate_ids)
    then
      v_failure:='canonical_or_duplicate_track_lifecycle_mismatch';
    end if;
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_track_provider_links link
       where link.track_id=any(v_duplicate_ids)
     )
  then
    v_failure:='duplicate_provider_link_remains';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_track_artists credit
       where credit.track_id=any(v_duplicate_ids)
         and coalesce(credit.status,'active')<>'archived'
     )
  then
    v_failure:='live_duplicate_track_artist_credit_remains';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_release_tracks membership
       where membership.track_id=any(v_duplicate_ids)
         and coalesce(membership.status,'active')<>'archived'
     )
  then
    v_failure:='live_duplicate_release_track_membership_remains';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.wk_chart_entries_v2 chart_row
       where chart_row.canonical_track_id=any(
               array(select duplicate.value::text from unnest(v_duplicate_ids) as duplicate(value))
             )
          or chart_row.track_slug=any(v_duplicate_slugs)
     )
  then
    v_failure:='chart_projection_still_addresses_duplicate_track';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_primary_credit_count
    from public.registry_track_artists credit
    where credit.track_id=v_canonical_track_id
      and credit.status<>'archived'
      and credit.is_primary is true
      and credit.artist_id is not null;

    if v_primary_credit_count>1 then
      v_failure:='canonical_track_has_ambiguous_current_primary_artist_credit';
    end if;
  end if;

  if v_failure is null
     and exists (
       select 1
       from unnest(v_duplicate_ids) duplicate_id
       where not exists (
         select 1
         from public.registry_identity_lineage lineage
         where lineage.entity_type='track'
           and lineage.source_entity_id=duplicate_id
           and lineage.transition_type='supersede'
           and lineage.successor_entity_ids @> array[v_canonical_track_id]::uuid[]
           and lineage.source_authority='registry_track_resolution_events'
           and lineage.source_record_id like v_event_id::text||':%'
       )
     )
  then
    v_failure:='track_supersession_lineage_missing';
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
      and event.registry_entity_type='track'
      and event.registry_entity_id=v_canonical_track_id::text
      and event.source_suggestion_id=v_evidence.id::text
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.field_name='duplicate_repair'
      and event.action='track_duplicate_repair'
      and event.status='succeeded'
      and event.actor='system:registry_track_duplicate_admin';

    if v_event_count<>1 or v_valid_event_count<>1 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set verifier_status='passed',
        result_payload=result_payload || jsonb_build_object(
          'verification',jsonb_build_object(
            'status','passed',
            'verified_at',now(),
            'resolution_event_id',v_event_id
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
      error_code='registry_track_duplicate_repair_verification_failed',
      error_message=v_failure,
      result_payload=result_payload || jsonb_build_object(
        'verification',jsonb_build_object(
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

create function public.admin_apply_registry_track_duplicate_repair(
  p_canonical_track_id uuid,
  p_duplicate_track_ids uuid[],
  p_note text default null,
  p_allow_medium_confidence boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_evidence_id uuid;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_result jsonb;
begin
  v_user_id:=platform_private.registry_track_duplicate_admin_current_user_v1();

  v_evidence_id:=
    platform_private.record_registry_track_duplicate_repair_evidence_v1(
      p_canonical_track_id,
      p_duplicate_track_ids,
      p_note,
      p_allow_medium_confidence
    );

  v_grant_id:=
    platform_private.issue_registry_track_duplicate_repair_grant_v1(
      v_evidence_id
    );

  select *
  into v_execution
  from platform_private.execute_registry_track_duplicate_repair_v1(
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_track_duplicate_repair_v1(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='P0001',
      message='WK_TRACK_DUPLICATE_REPAIR_VERIFIER_FAILED: independent verification failed.';
  end if;

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_execution.operation_id;

  v_result:=coalesce(v_operation.result_payload->'result','{}'::jsonb);

  return v_result || jsonb_build_object(
    '_authority',jsonb_build_object(
      'mode','reviewed_exact_operation',
      'verified',true,
      'operation_id',v_execution.operation_id,
      'execution_grant_id',v_grant_id,
      'evidence_assertion_id',v_evidence_id,
      'idempotent_replay',v_execution.idempotent_replay,
      'operation_key','registry.track.duplicate_repair',
      'operation_version',1
    )
  );
end
$$;

revoke all on function
  platform_private.registry_track_duplicate_admin_current_user_v1(),
  platform_private.registry_track_duplicate_repair_state_fingerprint_v1(uuid,uuid[]),
  platform_private.record_registry_track_duplicate_repair_evidence_v1(uuid,uuid[],text,boolean),
  platform_private.issue_registry_track_duplicate_repair_grant_v1(uuid),
  platform_private.execute_registry_track_duplicate_repair_v1(uuid),
  platform_private.verify_registry_track_duplicate_repair_v1(uuid),
  platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)
from public, anon, authenticated, service_role;

revoke all on function
  public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)
from public, anon, service_role;

grant execute on function
  public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)
to authenticated;

comment on function
  public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)
is
  'Governed human Track duplicate repair command. Freezes evidence/current state, receives an exact reviewed grant, executes the owner-internal mature repair engine, and requires independent verification.';

do $proof$
declare
  v_wrapper text;
  v_engine text;
begin
  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_track_duplicate_admin'
      and actor.status='active'
      and actor.capability_profile->'operation_family'
          @> '["registry.track.duplicate_repair/v1"]'::jsonb
  ) then
    raise exception 'Registry Track duplicate repair actor drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_track_duplicate_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception 'Registry Track duplicate repair authenticator binding drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.track.duplicate_repair'
      and operation_type.operation_version=1
      and operation_type.capability_key='repair_registry_track_duplicate'
      and operation_type.risk_class='critical'
      and operation_type.allowed_subject_types=array['track']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=16
      and operation_type.max_rows_ceiling=64
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Registry Track duplicate repair operation contract drifted';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)',
       'EXECUTE'
     )
  then
    raise exception 'Registry Track duplicate repair public wrapper grants drifted';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)',
       'EXECUTE'
     )
  then
    raise exception 'Registry Track duplicate repair private engine leaked role authority';
  end if;

  select lower(pg_get_functiondef(
    'public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)'::regprocedure
  )) into v_wrapper;

  if v_wrapper ~
       '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_|wk_chart_entries_v2)'
     or position('record_registry_track_duplicate_repair_evidence_v1' in v_wrapper)=0
     or position('issue_registry_track_duplicate_repair_grant_v1' in v_wrapper)=0
     or position('execute_registry_track_duplicate_repair_v1' in v_wrapper)=0
     or position('verify_registry_track_duplicate_repair_v1' in v_wrapper)=0
  then
    raise exception 'Registry Track duplicate repair public command bypasses exact reviewed authority';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)'::regprocedure
  )) into v_engine;

  if position('registry_track_resolution_events' in v_engine)=0
     or position('registry_track_provider_links' in v_engine)=0
     or position('registry_track_artists' in v_engine)=0
     or position('registry_release_tracks' in v_engine)=0
     or position('wk_chart_entries_v2' in v_engine)=0
  then
    raise exception 'Mature Registry Track duplicate repair engine contract was not preserved';
  end if;

  if (
    select encode(extensions.digest(p.prosrc,'sha256'),'hex')
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='platform_private'
      and p.proname='apply_registry_track_duplicate_repair_engine_v1'
      and pg_get_function_identity_arguments(p.oid)=
          'p_canonical_track_id uuid, p_duplicate_track_ids uuid[], p_note text, p_allow_medium_confidence boolean'
  )<>'ff7ec6d997671e5f27ed2056149e56e4c913284f911e0eb943532f750e39c0e7'
  then
    raise exception 'Mature Registry Track duplicate repair engine body hash changed during internalization';
  end if;

  if exists (
       select 1
       from platform_private.registry_execution_grants grant_row
       where grant_row.actor_key='registry_track_duplicate_admin'
     )
     or exists (
       select 1
       from platform_private.registry_mutation_operations operation_row
       where operation_row.actor_key='registry_track_duplicate_admin'
     )
  then
    raise exception 'Registry Track duplicate repair migration activated durable execution residue';
  end if;
end
$proof$;

commit;
