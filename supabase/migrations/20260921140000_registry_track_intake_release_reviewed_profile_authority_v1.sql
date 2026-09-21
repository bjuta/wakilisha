-- MIZIZI Slice 3 Track Intake provider-neutral Release reviewed-profile authority.
--
-- Owns only the reviewed Release field family formerly written directly by
-- admin_resolve_registry_track_intake_enriched(). It never creates Releases or Labels.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-track-intake-release-reviewed-profile-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.capability_definitions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regprocedure('platform_private.registry_track_intake_current_admin_v1()') is null
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
  then
    raise exception
      'STOP: accepted Track Intake/Registry Release profile dependency is missing';
  end if;

  if exists (
       select 1 from public.capability_definitions
       where capability_key='admit_registry_release_reviewed_profile'
     )
     or exists (
       select 1 from platform_private.registry_operation_types
       where operation_key='registry.release.reviewed_profile.admit'
         and operation_version=1
     )
     or to_regprocedure('platform_private.registry_track_intake_release_profile_snapshot_v1(uuid,uuid)') is not null
     or to_regprocedure('platform_private.registry_track_intake_release_label_match_state_v1(text)') is not null
     or to_regprocedure('platform_private.record_registry_track_intake_release_profile_evidence_v1(uuid,uuid,jsonb,boolean,text)') is not null
     or to_regprocedure('platform_private.issue_registry_track_intake_release_profile_grant_v1(uuid,uuid,jsonb,text)') is not null
     or to_regprocedure('platform_private.execute_registry_track_intake_release_profile_v1(uuid)') is not null
     or to_regprocedure('platform_private.verify_registry_track_intake_release_profile_v1(uuid)') is not null
     or to_regprocedure('public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)') is not null
  then
    raise exception
      'STOP: Track Intake Release reviewed-profile authority already exists; audit before reapplying';
  end if;
end
$preflight$;

insert into public.capability_definitions (
  capability_key,label,description,domain
)
values (
  'admit_registry_release_reviewed_profile',
  'Admit Registry Release reviewed profile',
  'Admit the bounded provider-neutral reviewed Track Intake Release field family for one existing Registry Release.',
  'registry'
);

insert into platform_private.registry_operation_types (
  operation_key,operation_version,capability_key,risk_class,
  allowed_subject_types,requires_existing_target,max_targets,
  max_rows_ceiling,max_grant_ttl_seconds,requires_human_approval,
  requires_verifier,enabled,description
)
values (
  'registry.release.reviewed_profile.admit',
  1,
  'admit_registry_release_reviewed_profile',
  'medium',
  array['release']::text[],
  true,
  1,
  1,
  300,
  true,
  true,
  true,
  'Admit the exact reviewed provider-neutral Track Intake Release profile fields for one existing Registry Release.'
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
          || jsonb_build_array('registry.release.reviewed_profile.admit/v1')
        )
      ) operation(value)
    ),
    true
  )
where actor_key='registry_track_intake_admin';

create function platform_private.registry_track_intake_release_label_match_state_v1(
  p_label_name text
)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',label.id,
        'name',label.name,
        'normalized_name',label.normalized_name,
        'status',label.status
      )
      order by
        case when label.status='active' then 0 else 1 end,
        label.created_at,
        label.id
    ),
    '[]'::jsonb
  )
  from public.registry_labels label
  where nullif(btrim(p_label_name),'') is not null
    and label.status in ('active','draft')
    and (
      lower(btrim(label.name))=lower(btrim(p_label_name))
      or lower(btrim(label.normalized_name))=lower(btrim(p_label_name))
    );
$$;

create function platform_private.registry_track_intake_release_profile_snapshot_v1(
  p_suggestion_id uuid,
  p_track_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid;
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_track public.registry_tracks%rowtype;
  v_release public.registry_releases%rowtype;
  v_fields jsonb;
  v_payload jsonb;
  v_fingerprint text;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id=p_suggestion_id;

  if not found then
    raise exception using errcode='P0002',
      message='Track Intake item does not exist.';
  end if;

  if v_suggestion.status<>'needs_review'
     or (
       v_suggestion.canonical_track_id is not null
       and v_suggestion.canonical_track_id<>p_track_id
     )
     or (
       v_suggestion.canonicalized_track_id is not null
       and v_suggestion.canonicalized_track_id<>p_track_id
     )
  then
    raise exception using errcode='42501',
      message='Track Intake item is not eligible for this Registry Release profile target.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_track_id
    and track.status in ('draft','active');

  if not found or v_track.release_id is null then
    raise exception using errcode='42501',
      message='Track Intake Release profile requires a Registry Track linked to an existing Release.';
  end if;

  select release.*
  into v_release
  from public.registry_releases release
  where release.id=v_track.release_id
    and release.status<>'archived';

  if not found then
    raise exception using errcode='42501',
      message='Track Intake Release profile target is unavailable.';
  end if;

  select coalesce(
    jsonb_object_agg(
      enrichment.field_name,
      enrichment.suggested_value
      order by enrichment.field_name
    ),
    '{}'::jsonb
  )
  into v_fields
  from public.registry_enrichment_suggestions enrichment
  where enrichment.registry_entity_type='track'
    and enrichment.registry_entity_id=p_suggestion_id::text
    and enrichment.decision_status='approved'
    and enrichment.field_name in (
      'release_title','release_date','release_date_precision',
      'release_artwork_url','upc','label_name',
      'imprint_name','copyright_text','genre'
    );

  v_payload:=jsonb_build_object(
    'suggestion_id',p_suggestion_id,
    'track_id',p_track_id,
    'release_id',v_release.id,
    'canonical_track_id',v_suggestion.canonical_track_id,
    'canonicalized_track_id',v_suggestion.canonicalized_track_id,
    'approved_release_fields',v_fields
  );

  v_fingerprint:=encode(
    extensions.digest(v_payload::text,'sha256'),
    'hex'
  );

  return v_payload||jsonb_build_object(
    'review_fingerprint',v_fingerprint,
    'applying_user_id',v_user_id
  );
end
$$;

create function platform_private.record_registry_track_intake_release_profile_evidence_v1(
  p_suggestion_id uuid,
  p_release_id uuid,
  p_proposed jsonb,
  p_allow_overwrite boolean,
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

  v_claim:=jsonb_build_object(
    'suggestion_id',p_suggestion_id,
    'release_id',p_release_id,
    'proposed',p_proposed,
    'allow_overwrite',p_allow_overwrite,
    'review_fingerprint',p_review_fingerprint
  );

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','release',
        'subject_id',p_release_id::text,
        'claim_key','registry.release.reviewed_profile',
        'claim_payload',v_claim,
        'trust_class','INTERNAL_FACT',
        'source_kind','track_intake_review',
        'source_ref','track-intake-release-profile:'||p_suggestion_id::text||':'||p_release_id::text,
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
    'release',
    p_release_id,
    'registry.release.reviewed_profile',
    v_claim,
    'INTERNAL_FACT',
    'track_intake_review',
    'track-intake-release-profile:'||p_suggestion_id::text||':'||p_release_id::text,
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

create function platform_private.issue_registry_track_intake_release_profile_grant_v1(
  p_evidence_assertion_id uuid,
  p_release_id uuid,
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
  v_grant_id uuid;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.release.reviewed_profile.admit'
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or v_operation_type.capability_key<>'admit_registry_release_reviewed_profile'
     or not ('release'=any(v_operation_type.allowed_subject_types))
     or not v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<1
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Release reviewed-profile operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'release'
     or v_evidence.subject_id<>p_release_id
     or v_evidence.claim_key<>'registry.release.reviewed_profile'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Track Intake Release reviewed-profile evidence is not bound to this exact caller and Release.';
  end if;

  if p_plan_payload->>'operation_key'<>'registry.release.reviewed_profile.admit'
     or coalesce((p_plan_payload->>'operation_version')::integer,0)<>1
     or p_plan_payload->>'release_id' is distinct from p_release_id::text
     or p_plan_payload->>'expected_state_fingerprint' is distinct from p_expected_state_fingerprint
     or p_plan_payload->>'evidence_assertion_id' is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint' is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'trust_class' is distinct from v_evidence.trust_class
     or p_plan_payload->>'policy_ruleset_version'<>'registry-release-reviewed-profile-v1'
  then
    raise exception using errcode='42501',
      message='Track Intake Release reviewed-profile plan is not bound to current evidence authority.';
  end if;

  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(p_plan_payload);
  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','release',
          'subject_id',p_release_id::text,
          'expected_state_fingerprint',p_expected_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );
  v_idempotency_key:=
    'release-profile-v1:'||
    p_release_id::text||':'||
    (p_plan_payload->>'review_fingerprint')||':'||
    case when (p_plan_payload->>'allow_overwrite')::boolean then '1' else '0' end;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_intake_admin'
    and execution_grant.operation_key='registry.release.reviewed_profile.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.max_rows<>1
    then
      raise exception using errcode='23505',
        message='Track Intake Release profile idempotency key is bound to different authority.';
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
    'admit_registry_release_reviewed_profile',
    null,
    'registry.release.reviewed_profile.admit',
    1,
    p_plan_payload,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-release-reviewed-profile-v1',
    'manage_registry',
    now(),
    now()+interval '5 minutes'
  )
  returning id into v_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,subject_type,subject_id,expected_state_fingerprint
  )
  values (
    v_grant_id,'release',p_release_id,p_expected_state_fingerprint
  );

  return v_grant_id;
end
$$;

create function platform_private.execute_registry_track_intake_release_profile_v1(
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
  v_proposed jsonb;
  v_review jsonb;
  v_before jsonb;
  v_after jsonb;
  v_current_fingerprint text;
  v_after_fingerprint text;
  v_label_state jsonb;
  v_label_state_fingerprint text;
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

  if v_begin.idempotent_replay and v_operation.status='succeeded' then
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
     or v_grant.operation_key<>'registry.release.reviewed_profile.admit'
     or v_grant.operation_version<>1
     or v_grant.capability_key<>'admit_registry_release_reviewed_profile'
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>'registry-release-reviewed-profile-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Track Intake Release reviewed-profile grant.';
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
      message='Release reviewed-profile operation requires one exact existing Release target.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_proposed:=v_plan->'proposed';

  if (v_plan-array[
       'operation_key','operation_version','suggestion_id','track_id','release_id',
       'proposed','allow_overwrite','review_fingerprint',
       'label_match_fingerprint','expected_state_fingerprint',
       'evidence_assertion_id','evidence_assertion_fingerprint',
       'trust_class','policy_ruleset_version'
     ]::text[])<>'{}'::jsonb
     or v_plan->>'operation_key'<>'registry.release.reviewed_profile.admit'
     or coalesce((v_plan->>'operation_version')::integer,0)<>1
     or (v_plan->>'release_id')::uuid<>v_target.subject_id
     or v_plan->>'expected_state_fingerprint'
          is distinct from v_target.expected_state_fingerprint
     or (v_proposed-array[
          'title','normalized_title','release_date','release_date_precision',
          'artwork_url','upc','label_name','label_id',
          'label_name_observation','imprint_name',
          'copyright_text','provider_genre'
        ]::text[])<>'{}'::jsonb
  then
    raise exception using errcode='42501',
      message='Track Intake Release reviewed-profile plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>'release'
     or v_evidence.subject_id<>v_target.subject_id
     or v_evidence.claim_key<>'registry.release.reviewed_profile'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.assertion_fingerprint is distinct from
        v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.recorded_by_principal_key is distinct from
        v_grant.issued_by_principal_key
  then
    raise exception using errcode='42501',
      message='Release reviewed-profile evidence no longer satisfies the exact grant.';
  end if;

  v_review:=
    platform_private.registry_track_intake_release_profile_snapshot_v1(
      (v_plan->>'suggestion_id')::uuid,
      (v_plan->>'track_id')::uuid
    );

  if v_review->>'review_fingerprint'
       is distinct from v_plan->>'review_fingerprint'
     or v_review->>'release_id'
       is distinct from v_target.subject_id::text
     or v_evidence.source_payload_fingerprint
       is distinct from v_review->>'review_fingerprint'
  then
    raise exception using errcode='23514',
      message='Track Intake reviewed Release profile changed before execution.';
  end if;

  v_label_state:=
    platform_private.registry_track_intake_release_label_match_state_v1(
      v_proposed->>'label_name'
    );
  v_label_state_fingerprint:=encode(
    extensions.digest(v_label_state::text,'sha256'),
    'hex'
  );

  if v_label_state_fingerprint
       is distinct from v_plan->>'label_match_fingerprint'
  then
    raise exception using errcode='23514',
      message='Registry Label match state changed after Release profile grant issuance.';
  end if;

  v_current_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'release',v_target.subject_id
    );

  if v_current_fingerprint is distinct from v_target.expected_state_fingerprint then
    raise exception using errcode='23514',
      message='Registry Release changed after Track Intake profile grant issuance.';
  end if;

  select to_jsonb(release)
  into v_before
  from public.registry_releases release
  where release.id=v_target.subject_id
    and release.status<>'archived'
  for update;

  if v_before is null then
    raise exception using errcode='42501',
      message='Track Intake Release reviewed-profile target is unavailable.';
  end if;

  if not (v_plan->>'allow_overwrite')::boolean then
    if v_proposed ? 'release_date'
       and v_before->>'release_date' is not null
       and (v_before->>'release_date')::date
            is distinct from (v_proposed->>'release_date')::date
    then
      raise exception using errcode='23514',
        message='Accepted release date conflicts with the canonical Release.';
    end if;

    if v_proposed ? 'title'
       and nullif(btrim(v_before->>'title'),'') is not null
       and v_before->>'title' is distinct from v_proposed->>'title'
    then
      raise exception using errcode='23514',
        message='Accepted release title conflicts with the canonical Release.';
    end if;
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  update public.registry_releases release
  set
    title=case
      when v_proposed ? 'title' then v_proposed->>'title'
      else release.title
    end,
    normalized_title=case
      when v_proposed ? 'normalized_title' then v_proposed->>'normalized_title'
      else release.normalized_title
    end,
    release_date=case
      when v_proposed ? 'release_date'
        then nullif(v_proposed->>'release_date','')::date
      else release.release_date
    end,
    release_date_precision=case
      when v_proposed ? 'release_date_precision'
        then nullif(v_proposed->>'release_date_precision','')
      else release.release_date_precision
    end,
    artwork_url=case
      when v_proposed ? 'artwork_url' then v_proposed->>'artwork_url'
      else release.artwork_url
    end,
    upc=case
      when v_proposed ? 'upc' then v_proposed->>'upc'
      else release.upc
    end,
    label_id=case
      when v_proposed ? 'label_id'
        and v_proposed->>'label_id' is not null
        then (v_proposed->>'label_id')::uuid
      else release.label_id
    end,
    metadata=
      coalesce(release.metadata,'{}'::jsonb)
      || jsonb_strip_nulls(
        jsonb_build_object(
          'label_name_observation',v_proposed->>'label_name_observation',
          'imprint_name',v_proposed->>'imprint_name',
          'copyright_text',v_proposed->>'copyright_text',
          'provider_genre',v_proposed->>'provider_genre'
        )
      ),
    updated_at=now()
  where release.id=v_target.subject_id
    and release.status<>'archived';

  get diagnostics v_rows=row_count;

  select to_jsonb(release)
  into v_after
  from public.registry_releases release
  where release.id=v_target.subject_id;

  if v_rows<>1
     or (
       v_before
       - array[
           'title','normalized_title','release_date','release_date_precision',
           'artwork_url','upc','label_id','metadata','updated_at'
         ]::text[]
     ) is distinct from (
       v_after
       - array[
           'title','normalized_title','release_date','release_date_precision',
           'artwork_url','upc','label_id','metadata','updated_at'
         ]::text[]
     )
     or (
       coalesce(v_before->'metadata','{}'::jsonb)
       - array[
           'label_name_observation','imprint_name',
           'copyright_text','provider_genre'
         ]::text[]
     ) is distinct from (
       coalesce(v_after->'metadata','{}'::jsonb)
       - array[
           'label_name_observation','imprint_name',
           'copyright_text','provider_genre'
         ]::text[]
     )
  then
    raise exception using errcode='23514',
      message='Release reviewed-profile execution exceeded the bounded field family.';
  end if;

  v_after_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'release',v_target.subject_id
    );

  insert into public.registry_canonical_write_events (
    registry_entity_type,registry_entity_id,source_suggestion_id,
    source_table,field_name,target_path,before_value,after_value,
    action,status,actor
  )
  values (
    'release',
    v_target.subject_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'reviewed_profile',
    'public.registry_releases',
    jsonb_build_object(
      'title',v_before->'title',
      'normalized_title',v_before->'normalized_title',
      'release_date',v_before->'release_date',
      'release_date_precision',v_before->'release_date_precision',
      'artwork_url',v_before->'artwork_url',
      'upc',v_before->'upc',
      'label_id',v_before->'label_id',
      'label_name_observation',v_before->'metadata'->'label_name_observation',
      'imprint_name',v_before->'metadata'->'imprint_name',
      'copyright_text',v_before->'metadata'->'copyright_text',
      'provider_genre',v_before->'metadata'->'provider_genre'
    ),
    jsonb_build_object(
      'title',v_after->'title',
      'normalized_title',v_after->'normalized_title',
      'release_date',v_after->'release_date',
      'release_date_precision',v_after->'release_date_precision',
      'artwork_url',v_after->'artwork_url',
      'upc',v_after->'upc',
      'label_id',v_after->'label_id',
      'label_name_observation',v_after->'metadata'->'label_name_observation',
      'imprint_name',v_after->'metadata'->'imprint_name',
      'copyright_text',v_after->'metadata'->'copyright_text',
      'provider_genre',v_after->'metadata'->'provider_genre'
    ),
    'admit_reviewed_profile',
    'succeeded',
    'system:registry_track_intake_admin'
  )
  returning id into v_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,canonical_write_event_id
  )
  values (v_operation.id,v_event_id);

  update platform_private.registry_mutation_operations
  set affected_rows=1,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'subject_type','release',
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

create function platform_private.verify_registry_track_intake_release_profile_v1(
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
     or v_operation.operation_key<>'registry.release.reviewed_profile.admit'
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Track Intake Release reviewed-profile operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded' or v_operation.affected_rows<>1 then
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
       or v_grant.operation_key<>'registry.release.reviewed_profile.admit'
       or v_grant.operation_version<>1
       or v_grant.policy_ruleset_version<>'registry-release-reviewed-profile-v1'
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
       or v_target.subject_type<>'release'
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

  if v_failure is null then
    v_current_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        'release',v_target.subject_id
      );

    if v_current_fingerprint is distinct from
       v_operation.result_payload->>'after_state_fingerprint'
    then
      v_failure:='canonical_release_state_changed_after_profile_admission';
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
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.field_name='reviewed_profile'
      and event.target_path='public.registry_releases'
      and event.action='admit_reviewed_profile'
      and event.status='succeeded'
      and event.actor='system:registry_track_intake_admin';

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
      error_code='registry_release_reviewed_profile_verification_failed',
      error_message=v_failure,
      result_payload=
        result_payload||
        jsonb_build_object(
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

create function public.admin_admit_registry_track_intake_release_profile_v1(
  p_suggestion_id uuid,
  p_registry_track_id uuid,
  p_allow_overwrite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid;
  v_review jsonb;
  v_fields jsonb;
  v_proposed jsonb:='{}'::jsonb;
  v_release_id uuid;
  v_release public.registry_releases%rowtype;
  v_label_state jsonb;
  v_label_match_fingerprint text;
  v_label_id uuid;
  v_label_name text;
  v_expected_state_fingerprint text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_existing_grant platform_private.registry_execution_grants%rowtype;
  v_idempotency_key text;
  v_execution record;
  v_verification record;
  v_is_current boolean;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();
  v_review:=
    platform_private.registry_track_intake_release_profile_snapshot_v1(
      p_suggestion_id,p_registry_track_id
    );
  v_fields:=v_review->'approved_release_fields';
  v_release_id:=(v_review->>'release_id')::uuid;

  if v_fields ? 'release_title' then
    v_proposed:=v_proposed||jsonb_build_object(
      'title',nullif(btrim(v_fields->>'release_title'),''),
      'normalized_title',
        trim(
          regexp_replace(
            lower(nullif(btrim(v_fields->>'release_title'),'')),
            '[^[:alnum:]]+',
            ' ',
            'g'
          )
        )
    );
  end if;
  if v_fields ? 'release_date' then
    v_proposed:=v_proposed||jsonb_build_object(
      'release_date',nullif(v_fields->>'release_date','')::date
    );
  end if;
  if v_fields ? 'release_date_precision' then
    v_proposed:=v_proposed||jsonb_build_object(
      'release_date_precision',nullif(btrim(v_fields->>'release_date_precision'),'')
    );
  end if;
  if v_fields ? 'release_artwork_url' then
    v_proposed:=v_proposed||jsonb_build_object(
      'artwork_url',nullif(btrim(v_fields->>'release_artwork_url'),'')
    );
  end if;
  if v_fields ? 'upc' then
    v_proposed:=v_proposed||jsonb_build_object(
      'upc',nullif(btrim(v_fields->>'upc'),'')
    );
  end if;
  if v_fields ? 'imprint_name' then
    v_proposed:=v_proposed||jsonb_build_object(
      'imprint_name',nullif(btrim(v_fields->>'imprint_name'),'')
    );
  end if;
  if v_fields ? 'copyright_text' then
    v_proposed:=v_proposed||jsonb_build_object(
      'copyright_text',nullif(btrim(v_fields->>'copyright_text'),'')
    );
  end if;
  if v_fields ? 'genre' then
    v_proposed:=v_proposed||jsonb_build_object(
      'provider_genre',nullif(btrim(v_fields->>'genre'),'')
    );
  end if;

  select release.*
  into v_release
  from public.registry_releases release
  where release.id=v_release_id
    and release.status<>'archived';

  if not found then
    raise exception using errcode='42501',
      message='Track Intake Release reviewed-profile target is unavailable.';
  end if;

  v_label_name:=case
    when v_fields ? 'label_name'
      then nullif(btrim(v_fields->>'label_name'),'')
    else null
  end;
  v_label_state:=
    platform_private.registry_track_intake_release_label_match_state_v1(
      v_label_name
    );
  v_label_match_fingerprint:=encode(
    extensions.digest(v_label_state::text,'sha256'),
    'hex'
  );

  if v_label_name is not null
     and v_release.label_id is null
     and jsonb_array_length(v_label_state)=1
  then
    v_label_id:=(v_label_state->0->>'id')::uuid;
  end if;

  if v_label_name is not null then
    v_proposed:=v_proposed||jsonb_build_object(
      'label_name',v_label_name,
      'label_id',v_label_id,
      'label_name_observation',
        case when v_label_id is null then v_label_name else null end
    );
  end if;

  if v_proposed='{}'::jsonb then
    return jsonb_build_object(
      'mode','no_reviewed_fields',
      'applied',false,
      'release_id',v_release_id
    );
  end if;

  v_idempotency_key:=
    'release-profile-v1:'||
    v_release_id::text||':'||
    (v_review->>'review_fingerprint')||':'||
    case when p_allow_overwrite then '1' else '0' end;

  select execution_grant.*
  into v_existing_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_intake_admin'
    and execution_grant.operation_key='registry.release.reviewed_profile.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    v_grant_id:=v_existing_grant.id;
  else
    if not p_allow_overwrite then
      if v_proposed ? 'release_date'
         and v_release.release_date is not null
         and v_release.release_date is distinct from
             (v_proposed->>'release_date')::date
      then
        raise exception using errcode='23514',
          message='Accepted release date conflicts with the canonical Release.';
      end if;
      if v_proposed ? 'title'
         and nullif(btrim(v_release.title),'') is not null
         and v_release.title is distinct from v_proposed->>'title'
      then
        raise exception using errcode='23514',
          message='Accepted release title conflicts with the canonical Release.';
      end if;
    end if;

    v_is_current:=
      (not (v_proposed ? 'title')
       or v_release.title is not distinct from v_proposed->>'title')
      and
      (not (v_proposed ? 'normalized_title')
       or v_release.normalized_title is not distinct from v_proposed->>'normalized_title')
      and
      (not (v_proposed ? 'release_date')
       or v_release.release_date is not distinct from
          (v_proposed->>'release_date')::date)
      and
      (not (v_proposed ? 'release_date_precision')
       or v_release.release_date_precision is not distinct from
          v_proposed->>'release_date_precision')
      and
      (not (v_proposed ? 'artwork_url')
       or v_release.artwork_url is not distinct from v_proposed->>'artwork_url')
      and
      (not (v_proposed ? 'upc')
       or v_release.upc is not distinct from v_proposed->>'upc')
      and
      (
        v_label_id is null
        or v_release.label_id is not distinct from v_label_id
      )
      and
      (
        not (v_proposed ? 'label_name_observation')
        or v_proposed->>'label_name_observation' is null
        or v_release.metadata->>'label_name_observation'
             is not distinct from v_proposed->>'label_name_observation'
      )
      and
      (
        not (v_proposed ? 'imprint_name')
        or v_proposed->>'imprint_name' is null
        or v_release.metadata->>'imprint_name'
             is not distinct from v_proposed->>'imprint_name'
      )
      and
      (
        not (v_proposed ? 'copyright_text')
        or v_proposed->>'copyright_text' is null
        or v_release.metadata->>'copyright_text'
             is not distinct from v_proposed->>'copyright_text'
      )
      and
      (
        not (v_proposed ? 'provider_genre')
        or v_proposed->>'provider_genre' is null
        or v_release.metadata->>'provider_genre'
             is not distinct from v_proposed->>'provider_genre'
      );

    if v_is_current then
      return jsonb_build_object(
        'mode','already_current',
        'applied',false,
        'release_id',v_release_id
      );
    end if;

    v_expected_state_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        'release',v_release_id
      );

    v_evidence_id:=
      platform_private.record_registry_track_intake_release_profile_evidence_v1(
        p_suggestion_id,
        v_release_id,
        v_proposed,
        p_allow_overwrite,
        v_review->>'review_fingerprint'
      );

    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=v_evidence_id;

    v_plan:=jsonb_build_object(
      'operation_key','registry.release.reviewed_profile.admit',
      'operation_version',1,
      'suggestion_id',p_suggestion_id,
      'track_id',p_registry_track_id,
      'release_id',v_release_id,
      'proposed',v_proposed,
      'allow_overwrite',p_allow_overwrite,
      'review_fingerprint',v_review->>'review_fingerprint',
      'label_match_fingerprint',v_label_match_fingerprint,
      'expected_state_fingerprint',v_expected_state_fingerprint,
      'evidence_assertion_id',v_evidence.id,
      'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
      'trust_class',v_evidence.trust_class,
      'policy_ruleset_version','registry-release-reviewed-profile-v1'
    );

    v_grant_id:=
      platform_private.issue_registry_track_intake_release_profile_grant_v1(
        v_evidence.id,
        v_release_id,
        v_plan,
        v_expected_state_fingerprint
      );
  end if;

  select *
  into v_execution
  from platform_private.execute_registry_track_intake_release_profile_v1(
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_track_intake_release_profile_v1(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='Track Intake Release reviewed-profile independent verification failed.';
  end if;

  return jsonb_build_object(
    'mode',case
      when v_execution.idempotent_replay then 'idempotent_replay'
      else 'executed'
    end,
    'applied',not v_execution.idempotent_replay,
    'release_id',v_release_id,
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status,
    'idempotent_replay',v_execution.idempotent_replay
  );
end
$$;

revoke all on function
  public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)
  from public,anon,service_role;
grant execute on function
  public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)
  to authenticated;

revoke all on function
  platform_private.registry_track_intake_release_label_match_state_v1(text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.registry_track_intake_release_profile_snapshot_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.record_registry_track_intake_release_profile_evidence_v1(uuid,uuid,jsonb,boolean,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.issue_registry_track_intake_release_profile_grant_v1(uuid,uuid,jsonb,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.execute_registry_track_intake_release_profile_v1(uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.verify_registry_track_intake_release_profile_v1(uuid)
  from public,anon,authenticated,service_role;

do $postflight$
begin
  if exists (
       select 1
       from public.role_capabilities
       where capability_key='admit_registry_release_reviewed_profile'
     )
  then
    raise exception
      'STOP: Release reviewed-profile operation capability leaked into product roles';
  end if;
end
$postflight$;

commit;
