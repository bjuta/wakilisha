-- WAKILISHA Music Identity & Rights Foundation
-- Slice 3: governed exact Release-to-Label historical admission.
--
-- This migration creates mutation authority only. It performs no historical
-- backfill and creates no Organisation-to-Label relationship.

begin;

set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'music-identity-rights-slice3-release-label-admission-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.capability_definitions') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_labels') is null
     or to_regclass('editorial.organizations') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('platform_private.registry_execution_target_set_fingerprint(uuid)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception
      'STOP: accepted Registry Release/Label governance foundation is incomplete';
  end if;

  if exists (
       select 1 from public.capability_definitions
       where capability_key='admit_registry_release_label_link'
     )
     or exists (
       select 1
       from platform_private.registry_operation_types
       where operation_key='registry.release.label_link.admit'
         and operation_version=1
     )
     or exists (
       select 1
       from platform_private.system_actors
       where actor_key='registry_release_label_admin'
     )
     or to_regprocedure(
       'platform_private.registry_release_label_admin_current_user_v1()'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_release_label_normalize_v1(text)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_release_label_candidate_state_v1(uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.record_registry_release_label_admin_evidence_v1(uuid,uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'platform_private.issue_registry_release_label_admin_grant_v1(uuid,uuid,jsonb,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_release_label_admin_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_release_label_admin_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)'
     ) is not null
  then
    raise exception
      'STOP: Slice 3 Release Label admission authority already exists; audit before reapplying';
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
  'admit_registry_release_label_link',
  'Admit Registry Release Label link',
  'Admit one exact retained-evidence Release-to-Registry-Label link through a typed Registry operation.',
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
  'registry.release.label_link.admit',
  1,
  'admit_registry_release_label_link',
  'medium',
  array['release']::text[],
  true,
  1,
  1,
  300,
  true,
  true,
  true,
  'Admit one exact retained record_label match onto an existing Registry Release whose label_id is currently null.'
);

insert into platform_private.system_actors (
  actor_key,
  label,
  actor_kind,
  status,
  capability_profile
)
values (
  'registry_release_label_admin',
  'Registry Release Label Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_family',
      jsonb_build_array('registry.release.label_link.admit/v1')
  )
);

insert into platform_private.system_actor_executor_bindings (
  actor_key,
  executor_kind,
  executor_key,
  status
)
values (
  'registry_release_label_admin',
  'database_role',
  'authenticator',
  'active'
);

create function
platform_private.registry_release_label_admin_current_user_v1()
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
    where binding.actor_key='registry_release_label_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry Release Label admin broker.';
  end if;

  return v_user_id;
end
$current_user$;

create function
platform_private.registry_release_label_normalize_v1(
  p_value text
)
returns text
language sql
immutable
security definer
set search_path=pg_catalog
as $normalize$
  select lower(
    regexp_replace(
      btrim(coalesce(p_value,'')),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$normalize$;

create function
platform_private.registry_release_label_candidate_state_v1(
  p_release_id uuid,
  p_label_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $candidate$
declare
  v_release public.registry_releases%rowtype;
  v_label public.registry_labels%rowtype;
  v_source_text text;
  v_normalized_source text;
  v_label_match_count integer:=0;
  v_organization_match_count integer:=0;
begin
  if p_release_id is null or p_label_id is null then
    raise exception using errcode='22023',
      message='Release and Label UUIDs are required.';
  end if;

  select release.*
  into v_release
  from public.registry_releases release
  where release.id=p_release_id;

  if not found or v_release.status='archived' then
    raise exception using errcode='P0002',
      message='Registry Release is missing or archived.';
  end if;

  select label.*
  into v_label
  from public.registry_labels label
  where label.id=p_label_id;

  if not found or v_label.status not in ('active','draft') then
    raise exception using errcode='P0002',
      message='Registry Label is missing or unavailable for exact admission.';
  end if;

  v_source_text:=nullif(btrim(v_release.metadata->>'record_label'),'');
  if v_source_text is null then
    raise exception using errcode='23514',
      message='WK_STALE_RELEASE_LABEL_SOURCE: retained record_label evidence is missing.';
  end if;

  v_normalized_source:=
    platform_private.registry_release_label_normalize_v1(v_source_text);

  select count(*)::integer
  into v_label_match_count
  from public.registry_labels label
  where label.status<>'archived'
    and platform_private.registry_release_label_normalize_v1(label.name)
        =v_normalized_source;

  select count(*)::integer
  into v_organization_match_count
  from editorial.organizations organization
  where platform_private.registry_release_label_normalize_v1(
          organization.display_name
        )=v_normalized_source;

  return jsonb_build_object(
    'release_id',v_release.id::text,
    'release_status',v_release.status,
    'current_label_id',
      case
        when v_release.label_id is null then null
        else v_release.label_id::text
      end,
    'source_label_text',v_source_text,
    'normalized_source_label',v_normalized_source,
    'target_label_id',v_label.id::text,
    'target_label_name',v_label.name,
    'target_label_status',v_label.status,
    'normalized_target_label',
      platform_private.registry_release_label_normalize_v1(v_label.name),
    'exact_label_match_count',v_label_match_count,
    'exact_organization_match_count',v_organization_match_count,
    'candidate_state',
      case
        when v_release.label_id is null
         and v_label_match_count=1
         and v_organization_match_count=0
         and platform_private.registry_release_label_normalize_v1(v_label.name)
             =v_normalized_source
          then 'exact_label_candidate'
        when v_release.label_id=p_label_id
         and v_label_match_count=1
         and v_organization_match_count=0
         and platform_private.registry_release_label_normalize_v1(v_label.name)
             =v_normalized_source
          then 'already_current'
        else 'review_only'
      end
  );
end
$candidate$;

create function
platform_private.record_registry_release_label_admin_evidence_v1(
  p_release_id uuid,
  p_label_id uuid,
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
begin
  v_user_id:=platform_private.registry_release_label_admin_current_user_v1();

  if p_release_id is null
     or p_label_id is null
     or p_candidate_state is null
     or jsonb_typeof(p_candidate_state)<>'object'
     or p_candidate_state->>'candidate_state'<>'exact_label_candidate'
     or (p_candidate_state->>'release_id')::uuid<>p_release_id
     or (p_candidate_state->>'target_label_id')::uuid<>p_label_id
     or coalesce(
          (p_candidate_state->>'exact_label_match_count')::integer,
          0
        )<>1
     or coalesce(
          (p_candidate_state->>'exact_organization_match_count')::integer,
          0
        )<>0
  then
    raise exception using errcode='22023',
      message='Exact Release Label candidate state is required.';
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
          'subject_type','release',
          'subject_id',p_release_id::text,
          'claim_key','registry.release.label_link.admit',
          'claim_payload',p_candidate_state,
          'trust_class','INTERNAL_FACT',
          'source_kind','retained_registry_metadata',
          'source_ref',
            'retained-release-label:'||
            p_release_id::text||':'||
            p_label_id::text,
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
    'release',
    p_release_id,
    'registry.release.label_link.admit',
    p_candidate_state,
    'INTERNAL_FACT',
    'retained_registry_metadata',
    'retained-release-label:'||
      p_release_id::text||':'||
      p_label_id::text,
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
platform_private.issue_registry_release_label_admin_grant_v1(
  p_evidence_assertion_id uuid,
  p_release_id uuid,
  p_candidate_state jsonb,
  p_expected_state_fingerprint text
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
  v_plan jsonb;
  v_plan_fingerprint text;
  v_target_set jsonb;
  v_target_fingerprint text;
  v_idempotency_key text;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_grant_id uuid;
begin
  v_user_id:=platform_private.registry_release_label_admin_current_user_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.release.label_link.admit'
    and operation_type.operation_version=1
    and operation_type.capability_key='admit_registry_release_label_link'
    and operation_type.enabled;

  if not found
     or v_operation_type.allowed_subject_types<>array['release']::text[]
     or not v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<>1
     or v_operation_type.max_grant_ttl_seconds<>300
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Release Label admission operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'release'
     or v_evidence.subject_id<>p_release_id
     or v_evidence.claim_key<>'registry.release.label_link.admit'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'retained_registry_metadata'
     or v_evidence.recorded_by_principal_key<>
          'user:'||v_user_id::text
     or v_evidence.claim_payload<>p_candidate_state
  then
    raise exception using errcode='42501',
      message='Evidence is not caller-bound exact Release Label authority.';
  end if;

  v_plan:=jsonb_build_object(
    'operation_key','registry.release.label_link.admit',
    'operation_version',1,
    'release_id',p_release_id::text,
    'target_label_id',p_candidate_state->>'target_label_id',
    'candidate_state',p_candidate_state,
    'candidate_state_fingerprint',
      encode(
        extensions.digest(p_candidate_state::text,'sha256'),
        'hex'
      ),
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'policy_ruleset_version','registry-release-label-admission-v1'
  );

  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(v_plan);

  v_target_set:=jsonb_build_array(
    jsonb_build_object(
      'subject_type','release',
      'subject_id',p_release_id::text,
      'expected_state_fingerprint',p_expected_state_fingerprint
    )
  );

  v_target_fingerprint:=
    encode(
      extensions.digest(v_target_set::text,'sha256'),
      'hex'
    );

  v_idempotency_key:=
    'registry-release-label-admit:'||
    encode(
      extensions.digest(
        (
          p_release_id::text||':'||
          (p_candidate_state->>'target_label_id')||':'||
          v_evidence.assertion_fingerprint
        ),
        'sha256'
      ),
      'hex'
    );

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_release_label_admin'
    and execution_grant.operation_key='registry.release.label_link.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
    then
      raise exception using errcode='23505',
        message='Release Label idempotency key is bound to different authority.';
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
    'registry_release_label_admin',
    'admit_registry_release_label_link',
    null,
    'registry.release.label_link.admit',
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-release-label-admission-v1',
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
    'release',
    p_release_id,
    p_expected_state_fingerprint
  );

  if platform_private.registry_execution_target_set_fingerprint(v_grant_id)
       <>v_target_fingerprint
  then
    raise exception using errcode='23514',
      message='Release Label exact target-set fingerprint drifted.';
  end if;

  return v_grant_id;
end
$grant$;

create function
platform_private.execute_registry_release_label_admin_v1(
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
  v_current_fingerprint text;
  v_release_before jsonb;
  v_release_after jsonb;
  v_release_id uuid;
  v_label_id uuid;
  v_rows integer;
  v_after_fingerprint text;
  v_event_id uuid;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_release_label_admin',
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
     or v_grant.actor_key<>'registry_release_label_admin'
     or v_grant.operation_key<>'registry.release.label_link.admit'
     or v_grant.operation_version<>1
     or v_grant.capability_key<>'admit_registry_release_label_link'
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>
          'registry-release-label-admission-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Slice 3 Release Label admission grant.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or v_target.subject_type<>'release'
     or v_target.expected_state_fingerprint is null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     )<>1
  then
    raise exception using errcode='42501',
      message='Release Label admission requires one exact existing Release target.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_candidate:=v_plan->'candidate_state';
  v_release_id:=v_target.subject_id;
  v_label_id:=(v_plan->>'target_label_id')::uuid;

  if (v_plan-array[
       'operation_key',
       'operation_version',
       'release_id',
       'target_label_id',
       'candidate_state',
       'candidate_state_fingerprint',
       'evidence_assertion_id',
       'evidence_assertion_fingerprint',
       'policy_ruleset_version'
     ]::text[])<>'{}'::jsonb
     or v_plan->>'operation_key'<>'registry.release.label_link.admit'
     or coalesce((v_plan->>'operation_version')::integer,0)<>1
     or v_plan->>'release_id'<>v_release_id::text
     or v_plan->>'policy_ruleset_version'<>
          'registry-release-label-admission-v1'
  then
    raise exception using errcode='42501',
      message='Release Label execution plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>'release'
     or v_evidence.subject_id<>v_release_id
     or v_evidence.claim_key<>'registry.release.label_link.admit'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'retained_registry_metadata'
     or v_evidence.assertion_fingerprint<>
          v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.claim_payload<>v_candidate
  then
    raise exception using errcode='42501',
      message='Bound Release Label evidence no longer satisfies the exact plan.';
  end if;

  perform 1
  from public.registry_releases release
  where release.id=v_release_id
    and release.status<>'archived'
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Registry Release is missing or archived.';
  end if;

  perform 1
  from public.registry_labels label
  where label.id=v_label_id
    and label.status in ('active','draft')
  for share;

  if not found then
    raise exception using errcode='P0002',
      message='Registry Label is missing or unavailable.';
  end if;

  v_current_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'release',
      v_release_id
    );

  if v_current_fingerprint is distinct from
       v_target.expected_state_fingerprint
  then
    raise exception using errcode='23514',
      message='WK_STALE_RELEASE_LABEL_TARGET: Registry Release changed after review.';
  end if;

  v_current_candidate:=
    platform_private.registry_release_label_candidate_state_v1(
      v_release_id,
      v_label_id
    );

  v_current_candidate_fingerprint:=
    encode(
      extensions.digest(v_current_candidate::text,'sha256'),
      'hex'
    );

  if v_current_candidate_fingerprint<>
       v_plan->>'candidate_state_fingerprint'
     or v_current_candidate->>'candidate_state'<>'exact_label_candidate'
  then
    raise exception using errcode='23514',
      message='WK_STALE_RELEASE_LABEL_CANDIDATE: exact Release Label match changed after review.';
  end if;

  select to_jsonb(release)
  into v_release_before
  from public.registry_releases release
  where release.id=v_release_id;

  if v_release_before->>'label_id' is not null then
    raise exception using errcode='23514',
      message='WK_RELEASE_LABEL_ALREADY_BOUND: historical admission never overwrites an existing label_id.';
  end if;

  update platform_private.registry_mutation_operations
  set
    status='executing',
    started_at=coalesce(started_at,now()),
    updated_at=now()
  where id=v_operation.id;

  update public.registry_releases release
  set
    label_id=v_label_id,
    updated_at=now()
  where release.id=v_release_id
    and release.status<>'archived'
    and release.label_id is null;

  get diagnostics v_rows=row_count;

  select to_jsonb(release)
  into v_release_after
  from public.registry_releases release
  where release.id=v_release_id;

  if v_rows<>1
     or (
       v_release_before
       - array['label_id','updated_at']::text[]
     ) is distinct from (
       v_release_after
       - array['label_id','updated_at']::text[]
     )
     or (v_release_after->>'label_id')::uuid<>v_label_id
  then
    raise exception using errcode='23514',
      message='Release Label execution exceeded the bounded label_id field.';
  end if;

  v_after_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'release',
      v_release_id
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
    'release',
    v_release_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'label_id',
    'public.registry_releases.label_id',
    jsonb_build_object('label_id',v_release_before->'label_id'),
    jsonb_build_object('label_id',v_release_after->'label_id'),
    'admit_release_label_link',
    'succeeded',
    'system:registry_release_label_admin'
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
      'subject_type','release',
      'subject_id',v_release_id,
      'label_id',v_label_id,
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
$execute$;

create function
platform_private.verify_registry_release_label_admin_v1(
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
  v_release public.registry_releases%rowtype;
  v_plan jsonb;
  v_candidate jsonb;
  v_label_id uuid;
  v_current_fingerprint text;
  v_event_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_release_label_admin'
     or v_operation.operation_key<>'registry.release.label_link.admit'
     or v_operation.operation_version<>1
     or v_operation.capability_key<>'admit_registry_release_label_link'
  then
    raise exception using errcode='P0002',
      message='Registry Release Label V1 operation not found.';
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
       or v_grant.actor_key<>'registry_release_label_admin'
       or v_grant.operation_key<>'registry.release.label_link.admit'
       or v_grant.operation_version<>1
       or v_grant.policy_ruleset_version<>
            'registry-release-label-admission-v1'
     )
  then
    v_failure:='execution_grant_mismatch';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_candidate:=v_plan->'candidate_state';
    v_label_id:=(v_plan->>'target_label_id')::uuid;

    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id=v_grant.id;

    if not found
       or v_target.subject_type<>'release'
       or v_target.expected_state_fingerprint is null
       or (
         select count(*)
         from platform_private.registry_execution_grant_targets target_count
         where target_count.execution_grant_id=v_grant.id
       )<>1
    then
      v_failure:='exact_release_target_missing';
    end if;
  end if;

  if v_failure is null then
    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=(v_plan->>'evidence_assertion_id')::uuid
      and assertion.subject_type='release'
      and assertion.subject_id=v_target.subject_id
      and assertion.claim_key='registry.release.label_link.admit'
      and assertion.trust_class='INTERNAL_FACT'
      and assertion.source_kind='retained_registry_metadata'
      and assertion.assertion_fingerprint=
          v_plan->>'evidence_assertion_fingerprint';

    if not found or v_evidence.claim_payload<>v_candidate then
      v_failure:='bound_evidence_missing';
    end if;
  end if;

  if v_failure is null then
    select release.*
    into v_release
    from public.registry_releases release
    where release.id=v_target.subject_id;

    if not found
       or v_release.status='archived'
       or v_release.label_id is distinct from v_label_id
    then
      v_failure:='canonical_release_label_state_mismatch';
    end if;
  end if;

  if v_failure is null then
    v_current_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        'release',
        v_target.subject_id
      );

    if v_current_fingerprint is distinct from
       v_operation.result_payload->>'after_state_fingerprint'
    then
      v_failure:='canonical_release_state_changed_after_label_admission';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type='release'
      and event.registry_entity_id=v_target.subject_id::text
      and event.source_suggestion_id=v_evidence.id::text
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.field_name='label_id'
      and event.target_path='public.registry_releases.label_id'
      and event.action='admit_release_label_link'
      and event.status='succeeded'
      and event.actor='system:registry_release_label_admin'
      and event.after_value->>'label_id'=v_label_id::text;

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
    error_code='registry_release_label_verification_failed',
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
public.admin_admit_registry_release_label_candidate_v1(
  p_release_id uuid,
  p_label_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $public_rpc$
declare
  v_user_id uuid;
  v_candidate jsonb;
  v_expected_state_fingerprint text;
  v_evidence_id uuid;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_release public.registry_releases%rowtype;
begin
  v_user_id:=platform_private.registry_release_label_admin_current_user_v1();

  if p_release_id is null or p_label_id is null then
    raise exception using errcode='22023',
      message='Release and Label UUIDs are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry-release-label:'||
      p_release_id::text||':'||
      p_label_id::text,
      0
    )
  );

  select release.*
  into v_release
  from public.registry_releases release
  where release.id=p_release_id
    and release.status<>'archived'
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Registry Release is missing or archived.';
  end if;

  v_candidate:=
    platform_private.registry_release_label_candidate_state_v1(
      p_release_id,
      p_label_id
    );

  if v_candidate->>'candidate_state'='already_current' then
    return to_jsonb(v_release)||
      jsonb_build_object(
        '_authority',
        jsonb_build_object(
          'mode','already_current',
          'verified',true,
          'operation_key','registry.release.label_link.admit',
          'operation_version',1
        )
      );
  end if;

  if v_candidate->>'candidate_state'<>'exact_label_candidate' then
    raise exception using errcode='23514',
      message='WK_RELEASE_LABEL_REVIEW_REQUIRED: retained Release label evidence is not one exact unambiguous Registry Label candidate.';
  end if;

  v_expected_state_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'release',
      p_release_id
    );

  v_evidence_id:=
    platform_private.record_registry_release_label_admin_evidence_v1(
      p_release_id,
      p_label_id,
      v_candidate
    );

  v_grant_id:=
    platform_private.issue_registry_release_label_admin_grant_v1(
      v_evidence_id,
      p_release_id,
      v_candidate,
      v_expected_state_fingerprint
    );

  select *
  into v_exec
  from platform_private.execute_registry_release_label_admin_v1(
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_release_label_admin_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='WK_RELEASE_LABEL_VERIFIER_FAILED: Release Label admission verification failed.';
  end if;

  select release.*
  into v_release
  from public.registry_releases release
  where release.id=p_release_id;

  return to_jsonb(v_release)||
    jsonb_build_object(
      '_authority',
      jsonb_build_object(
        'mode','exact_operation',
        'verified',true,
        'operation_id',v_exec.operation_id,
        'execution_grant_id',v_grant_id,
        'evidence_assertion_id',v_evidence_id,
        'idempotent_replay',v_exec.idempotent_replay,
        'operation_key','registry.release.label_link.admit',
        'operation_version',1
      )
    );
end
$public_rpc$;

revoke all on function
  platform_private.registry_release_label_admin_current_user_v1(),
  platform_private.registry_release_label_normalize_v1(text),
  platform_private.registry_release_label_candidate_state_v1(uuid,uuid),
  platform_private.record_registry_release_label_admin_evidence_v1(uuid,uuid,jsonb),
  platform_private.issue_registry_release_label_admin_grant_v1(uuid,uuid,jsonb,text),
  platform_private.execute_registry_release_label_admin_v1(uuid),
  platform_private.verify_registry_release_label_admin_v1(uuid)
from public,anon,authenticated,service_role;

revoke all on function
  public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)
from public,anon,service_role;

grant execute on function
  public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)
to authenticated;

do $proof$
declare
  v_definition text;
begin
  if not exists (
    select 1
    from public.capability_definitions capability
    where capability.capability_key='admit_registry_release_label_link'
      and capability.domain='registry'
  ) then
    raise exception 'Release Label typed capability is missing';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.release.label_link.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key='admit_registry_release_label_link'
      and operation_type.risk_class='medium'
      and operation_type.allowed_subject_types=array['release']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Release Label admission operation drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_release_label_admin'
      and actor.status='active'
      and actor.capability_profile->'operation_family'
          @> '["registry.release.label_link.admit/v1"]'::jsonb
  ) then
    raise exception 'Release Label admin actor drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_release_label_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception 'Release Label admin authenticator binding drifted';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants standing_grant
    where standing_grant.actor_key='registry_release_label_admin'
      and standing_grant.status='active'
      and standing_grant.valid_from<=now()
      and standing_grant.expires_at>now()
  ) then
    raise exception 'Release Label admin gained standing autonomous authority';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Release Label public wrapper ACL drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_release_label_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_release_label_admin_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Release Label private executor leaked execution authority';
  end if;

  select pg_get_functiondef(
    'platform_private.registry_release_label_normalize_v1(text)'::regprocedure
  )
  into v_definition;

  if position('[[:space:]]+' in v_definition)=0
     or position('regexp_replace' in v_definition)=0
  then
    raise exception 'Release Label exact normalization contract drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.registry_release_label_candidate_state_v1(uuid,uuid)'::regprocedure
  )
  into v_definition;

  if position('record_label' in v_definition)=0
     or position('exact_label_match_count' in v_definition)=0
     or position('exact_organization_match_count' in v_definition)=0
  then
    raise exception 'Release Label exact candidate contract drifted';
  end if;

  select pg_get_functiondef(
    'public.admin_admit_registry_release_label_candidate_v1(uuid,uuid)'::regprocedure
  )
  into v_definition;

  if position('WK_RELEASE_LABEL_REVIEW_REQUIRED' in v_definition)=0
     or position('registry.release.label_link.admit' in v_definition)=0
     or position('verify_registry_release_label_admin_v1' in v_definition)=0
  then
    raise exception 'Release Label public composition drifted';
  end if;

  if exists (
       select 1
       from platform_private.registry_execution_grants execution_grant
       where execution_grant.actor_key='registry_release_label_admin'
     )
     or exists (
       select 1
       from platform_private.registry_mutation_operations operation
       where operation.actor_key='registry_release_label_admin'
     )
  then
    raise exception
      'Release Label migration activated durable execution residue';
  end if;
end
$proof$;

commit;
