-- WAKILISHA — Music Provenance Slice 1 review-binding integrity.
-- Forward-only Preview correction discovered by rollback-only acceptance.
-- No corpus backfill. No Rights Claim inference. No standing authority.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'music-provenance-slice1-review-binding-integrity-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure('platform_private.execute_registry_provenance_admin_v1(uuid)') is null
     or to_regprocedure('public.admin_create_registry_work_v1(uuid)') is null
     or to_regprocedure('public.admin_admit_registry_track_work_link_v1(uuid)') is null
     or to_regprocedure('public.admin_admit_registry_track_contribution_v1(uuid)') is null
     or to_regprocedure('public.admin_admit_registry_work_contribution_v1(uuid)') is null
     or to_regprocedure('platform_private.seal_registry_execution_grant_review_v1()') is null
  then
    raise exception 'Music Provenance Slice 1 admission authority is incomplete.';
  end if;
end
$preflight$;

create or replace function platform_private.execute_registry_provenance_admin_v1(
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
set search_path=pg_catalog,public,editorial,platform_private,extensions
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_plan jsonb;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_attestation platform_private.registry_contribution_attestations%rowtype;
  v_current_state text;
  v_event_id uuid;
  v_after jsonb;
  v_track_id uuid;
  v_work_id uuid;
  v_person_id uuid;
  v_organization_id uuid;
  v_artist_id uuid;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_provenance_admin',
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
     or v_grant.actor_key<>'registry_provenance_admin'
     or v_grant.operation_version<>1
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>
          'music-provenance-slice1-admission-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
     or v_grant.operation_key not in (
       'registry.work.create',
       'registry.track_work_link.admit',
       'registry.track_contribution.admit',
       'registry.work_contribution.admit'
     )
  then
    raise exception using errcode='42501',
      message='Execution grant is not a provenance Slice 1 admission grant.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or v_target.expected_state_fingerprint is not null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     )<>1
  then
    raise exception using errcode='42501',
      message='Provenance admission requires one exact future-row target.';
  end if;

  v_plan:=v_grant.plan_payload;

  if v_plan->>'operation_key'<>v_grant.operation_key
     or coalesce((v_plan->>'operation_version')::integer,0)<>1
     or v_plan->>'future_subject_id'<>v_target.subject_id::text
     or v_plan->>'policy_ruleset_version'<>
          'music-provenance-slice1-admission-v1'
  then
    raise exception using errcode='42501',
      message='Provenance execution plan is malformed.';
  end if;

  if v_grant.operation_key in (
    'registry.work.create',
    'registry.track_work_link.admit'
  ) then
    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

    if not found
       or v_evidence.assertion_fingerprint<>
            v_plan->>'evidence_assertion_fingerprint'
       or v_evidence.trust_class is distinct from
            v_plan->>'trust_class'
    then
      raise exception using errcode='42501',
        message='Bound provenance evidence no longer matches the reviewed plan.';
    end if;
  else
    select attestation.*
    into v_attestation
    from platform_private.registry_contribution_attestations attestation
    where attestation.id=(v_plan->>'attestation_id')::uuid;

    if not found then
      raise exception using errcode='P0002',
        message='Bound contribution attestation is missing.';
    end if;

    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=v_attestation.evidence_assertion_id;

    v_current_state:=
      platform_private.registry_contribution_attestation_current_state_v1(
        v_attestation.id
      );

    if not found
       or v_evidence.assertion_fingerprint<>
            v_plan->>'evidence_assertion_fingerprint'
       or v_evidence.trust_class is distinct from
            v_plan->>'trust_class'
       or v_current_state<>v_plan->>'attestation_state'
       or v_current_state not in ('corroborated','confirmed')
       or (
         v_attestation.elicitation_method='self_claim'
         and v_current_state<>'confirmed'
       )
    then
      raise exception using errcode='42501',
        message='Contribution attestation is no longer admissible under reviewed authority.';
    end if;
  end if;

  if v_grant.operation_key='registry.work.create' then
    if v_target.subject_type<>'work'
       or v_evidence.subject_type<>'work'
       or v_evidence.subject_id<>v_target.subject_id
       or v_evidence.claim_key<>'registry.work.create'
       or v_plan->'candidate'<>v_evidence.claim_payload
       or exists (
         select 1
         from public.registry_works work
         where work.id=v_target.subject_id
       )
    then
      raise exception using errcode='23514',
        message='Work creation evidence/target is stale or malformed.';
    end if;

    insert into public.registry_works (
      id,
      title,
      normalized_title,
      status,
      metadata
    )
    values (
      v_target.subject_id,
      v_plan#>>'{candidate,title}',
      v_plan#>>'{candidate,normalized_title}',
      'draft',
      coalesce(v_plan#>'{candidate,metadata}','{}'::jsonb)
    );

    select to_jsonb(work)
    into v_after
    from public.registry_works work
    where work.id=v_target.subject_id;

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
      v_target.subject_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'identity',
      'public.registry_works',
      null,
      v_after,
      'create_identity',
      'succeeded',
      'system:registry_provenance_admin'
    )
    returning id into v_event_id;

  elsif v_grant.operation_key='registry.track_work_link.admit' then
    if v_target.subject_type<>'track_work_link'
       or v_evidence.subject_type<>'track_work_link'
       or v_evidence.subject_id<>v_target.subject_id
       or v_evidence.claim_key<>'registry.track_work_link.admit'
       or v_plan->'candidate'<>v_evidence.claim_payload
    then
      raise exception using errcode='23514',
        message='Track-to-Work evidence/target is stale or malformed.';
    end if;

    v_track_id:=(v_plan#>>'{candidate,track_id}')::uuid;
    v_work_id:=(v_plan#>>'{candidate,work_id}')::uuid;

    perform 1
    from public.registry_tracks track
    where track.id=v_track_id
      and track.status<>'archived'
    for update;

    if not found then
      raise exception using errcode='P0002',
        message='Track-to-Work Track is missing or archived.';
    end if;

    perform 1
    from public.registry_works work
    where work.id=v_work_id
      and work.status<>'archived'
    for update;

    if not found then
      raise exception using errcode='P0002',
        message='Track-to-Work Work is missing or archived.';
    end if;

    if platform_private.registry_provenance_entity_fingerprint_v1(
         'track',v_track_id
       )<>v_plan->>'track_state_fingerprint'
       or platform_private.registry_provenance_entity_fingerprint_v1(
         'work',v_work_id
       )<>v_plan->>'work_state_fingerprint'
       or exists (
         select 1
         from public.registry_track_work_links link
         where link.id=v_target.subject_id
       )
    then
      raise exception using errcode='40001',
        message='WK_STALE_TRACK_WORK_LINK_CANDIDATE: component state changed after review.';
    end if;

    insert into public.registry_track_work_links (
      id,
      track_id,
      work_id,
      relationship_kind,
      status,
      evidence_assertion_id,
      valid_from,
      valid_to,
      created_by
    )
    values (
      v_target.subject_id,
      v_track_id,
      v_work_id,
      v_plan#>>'{candidate,relationship_kind}',
      'verified',
      v_evidence.id,
      nullif(v_plan#>>'{candidate,valid_from}','')::timestamptz,
      nullif(v_plan#>>'{candidate,valid_to}','')::timestamptz,
      v_grant.issued_by_user_id
    );

    select to_jsonb(link)
    into v_after
    from public.registry_track_work_links link
    where link.id=v_target.subject_id;

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
      'track_work_link',
      v_target.subject_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'relationship',
      'public.registry_track_work_links',
      null,
      v_after,
      'admit_track_work_link',
      'succeeded',
      'system:registry_provenance_admin'
    )
    returning id into v_event_id;

  elsif v_grant.operation_key='registry.track_contribution.admit' then
    if v_target.subject_type<>'track_contribution'
       or v_attestation.track_id is null
       or v_attestation.work_id is not null
       or v_plan->>'attestation_id'<>v_attestation.id::text
    then
      raise exception using errcode='23514',
        message='Recording contribution attestation/target is malformed.';
    end if;

    v_track_id:=v_attestation.track_id;
    v_person_id:=v_attestation.proposed_person_resource_id;
    v_organization_id:=v_attestation.proposed_organization_resource_id;
    v_artist_id:=v_attestation.proposed_artist_id;

    perform 1
    from public.registry_tracks track
    where track.id=v_track_id
      and track.status<>'archived'
    for update;

    if not found
       or platform_private.registry_provenance_entity_fingerprint_v1(
            'track',v_track_id
          )<>v_plan->>'subject_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='WK_STALE_TRACK_CONTRIBUTION_SUBJECT: Track changed after review.';
    end if;

    if v_person_id is not null then
      perform 1
      from editorial.people person
      where person.resource_id=v_person_id
        and person.person_state='active'
      for update;

      if not found
         or platform_private.registry_provenance_entity_fingerprint_v1(
              'person',v_person_id
            ) is distinct from v_plan->>'person_state_fingerprint'
      then
        raise exception using errcode='40001',
          message='WK_STALE_TRACK_CONTRIBUTION_PERSON: Person changed after review.';
      end if;
    end if;

    if v_organization_id is not null then
      perform 1
      from editorial.organizations organization
      where organization.resource_id=v_organization_id
        and organization.organization_state='active'
      for update;

      if not found
         or platform_private.registry_provenance_entity_fingerprint_v1(
              'organization',v_organization_id
            ) is distinct from v_plan->>'organization_state_fingerprint'
      then
        raise exception using errcode='40001',
          message='WK_STALE_TRACK_CONTRIBUTION_ORGANIZATION: Organisation changed after review.';
      end if;
    end if;

    if v_artist_id is not null then
      perform 1
      from public.registry_artists artist
      where artist.id=v_artist_id
        and artist.status<>'archived'
      for update;

      if not found
         or platform_private.registry_provenance_entity_fingerprint_v1(
              'artist',v_artist_id
            ) is distinct from v_plan->>'artist_state_fingerprint'
      then
        raise exception using errcode='40001',
          message='WK_STALE_TRACK_CONTRIBUTION_ARTIST: Artist changed after review.';
      end if;
    end if;

    insert into public.registry_track_contributions (
      id,
      track_id,
      person_resource_id,
      organization_resource_id,
      artist_id,
      credited_as,
      role_key,
      instrument_key,
      detail_text,
      status,
      evidence_assertion_id
    )
    values (
      v_target.subject_id,
      v_track_id,
      v_person_id,
      v_organization_id,
      v_artist_id,
      v_attestation.credited_as,
      v_attestation.role_key,
      v_attestation.instrument_key,
      v_attestation.detail_text,
      'verified',
      v_evidence.id
    );

    select to_jsonb(contribution)
    into v_after
    from public.registry_track_contributions contribution
    where contribution.id=v_target.subject_id;

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
      'track_contribution',
      v_target.subject_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'contribution',
      'public.registry_track_contributions',
      null,
      v_after,
      'admit_track_contribution',
      'succeeded',
      'system:registry_provenance_admin'
    )
    returning id into v_event_id;

  elsif v_grant.operation_key='registry.work_contribution.admit' then
    if v_target.subject_type<>'work_contribution'
       or v_attestation.work_id is null
       or v_attestation.track_id is not null
       or v_plan->>'attestation_id'<>v_attestation.id::text
    then
      raise exception using errcode='23514',
        message='Work contribution attestation/target is malformed.';
    end if;

    v_work_id:=v_attestation.work_id;
    v_person_id:=v_attestation.proposed_person_resource_id;
    v_organization_id:=v_attestation.proposed_organization_resource_id;
    v_artist_id:=v_attestation.proposed_artist_id;

    perform 1
    from public.registry_works work
    where work.id=v_work_id
      and work.status<>'archived'
    for update;

    if not found
       or platform_private.registry_provenance_entity_fingerprint_v1(
            'work',v_work_id
          )<>v_plan->>'subject_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='WK_STALE_WORK_CONTRIBUTION_SUBJECT: Work changed after review.';
    end if;

    if v_person_id is not null then
      perform 1
      from editorial.people person
      where person.resource_id=v_person_id
        and person.person_state='active'
      for update;

      if not found
         or platform_private.registry_provenance_entity_fingerprint_v1(
              'person',v_person_id
            ) is distinct from v_plan->>'person_state_fingerprint'
      then
        raise exception using errcode='40001',
          message='WK_STALE_WORK_CONTRIBUTION_PERSON: Person changed after review.';
      end if;
    end if;

    if v_organization_id is not null then
      perform 1
      from editorial.organizations organization
      where organization.resource_id=v_organization_id
        and organization.organization_state='active'
      for update;

      if not found
         or platform_private.registry_provenance_entity_fingerprint_v1(
              'organization',v_organization_id
            ) is distinct from v_plan->>'organization_state_fingerprint'
      then
        raise exception using errcode='40001',
          message='WK_STALE_WORK_CONTRIBUTION_ORGANIZATION: Organisation changed after review.';
      end if;
    end if;

    if v_artist_id is not null then
      perform 1
      from public.registry_artists artist
      where artist.id=v_artist_id
        and artist.status<>'archived'
      for update;

      if not found
         or platform_private.registry_provenance_entity_fingerprint_v1(
              'artist',v_artist_id
            ) is distinct from v_plan->>'artist_state_fingerprint'
      then
        raise exception using errcode='40001',
          message='WK_STALE_WORK_CONTRIBUTION_ARTIST: Artist changed after review.';
      end if;
    end if;

    insert into public.registry_work_contributions (
      id,
      work_id,
      person_resource_id,
      organization_resource_id,
      artist_id,
      credited_as,
      role_key,
      credit_order,
      status,
      evidence_assertion_id
    )
    values (
      v_target.subject_id,
      v_work_id,
      v_person_id,
      v_organization_id,
      v_artist_id,
      v_attestation.credited_as,
      v_attestation.role_key,
      null,
      'verified',
      v_evidence.id
    );

    select to_jsonb(contribution)
    into v_after
    from public.registry_work_contributions contribution
    where contribution.id=v_target.subject_id;

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
      'work_contribution',
      v_target.subject_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'contribution',
      'public.registry_work_contributions',
      null,
      v_after,
      'admit_work_contribution',
      'succeeded',
      'system:registry_provenance_admin'
    )
    returning id into v_event_id;
  end if;

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
      'subject_type',v_target.subject_type,
      'subject_id',v_target.subject_id,
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

create or replace function public.admin_create_registry_work_v1(
  p_evidence_assertion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_row public.registry_works%rowtype;
begin
  v_user_id:=
    platform_private.registry_provenance_admin_current_user_v1();

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'work'
     or v_evidence.claim_key<>'registry.work.create'
     or v_evidence.trust_class='WEB_UNTRUSTED'
     or (v_evidence.claim_payload-array[
       'title','normalized_title','metadata'
     ]::text[])<>'{}'::jsonb
     or nullif(btrim(v_evidence.claim_payload->>'title'),'') is null
     or nullif(
          btrim(v_evidence.claim_payload->>'normalized_title'),
          ''
        ) is null
     or jsonb_typeof(
          coalesce(v_evidence.claim_payload->'metadata','{}'::jsonb)
        )<>'object'
  then
    raise exception using errcode='42501',
      message='Evidence is not an admissible exact Work-creation candidate.';
  end if;

  select work.*
  into v_row
  from public.registry_works work
  where work.id=v_evidence.subject_id;

  if found then
    if v_row.title<>v_evidence.claim_payload->>'title'
       or v_row.normalized_title<>
            v_evidence.claim_payload->>'normalized_title'
       or v_row.metadata<>coalesce(
            v_evidence.claim_payload->'metadata',
            '{}'::jsonb
          )
    then
      raise exception using errcode='23505',
        message='Work UUID already exists with different canonical state.';
    end if;

    return to_jsonb(v_row)||
      jsonb_build_object(
        '_authority',
        jsonb_build_object(
          'mode','already_current',
          'verified',true,
          'evidence_assertion_id',v_evidence.id,
          'operation_key','registry.work.create',
          'operation_version',1
        )
      );
  end if;

  v_plan:=jsonb_build_object(
    'operation_key','registry.work.create',
    'operation_version',1,
    'future_subject_id',v_evidence.subject_id::text,
    'candidate',v_evidence.claim_payload,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','music-provenance-slice1-admission-v1'
  );

  v_grant_id:=
    platform_private.issue_registry_provenance_admin_grant_v1(
      'registry.work.create',
      'work',
      v_evidence.subject_id,
      v_plan
    );

  select *
  into v_exec
  from platform_private.execute_registry_provenance_admin_v1(v_grant_id);

  select *
  into v_verify
  from platform_private.verify_registry_provenance_admin_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='WK_PROVENANCE_WORK_VERIFIER_FAILED: Work admission verification failed.';
  end if;

  select work.*
  into v_row
  from public.registry_works work
  where work.id=v_evidence.subject_id;

  return to_jsonb(v_row)||
    jsonb_build_object(
      '_authority',
      jsonb_build_object(
        'verified',true,
        'operation_id',v_exec.operation_id,
        'execution_grant_id',v_grant_id,
        'evidence_assertion_id',v_evidence.id,
        'operation_key','registry.work.create',
        'operation_version',1
      )
    );
end
$$;

create or replace function public.admin_admit_registry_track_work_link_v1(
  p_evidence_assertion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_track_id uuid;
  v_work_id uuid;
  v_plan jsonb;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_row public.registry_track_work_links%rowtype;
begin
  v_user_id:=
    platform_private.registry_provenance_admin_current_user_v1();

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track_work_link'
     or v_evidence.claim_key<>'registry.track_work_link.admit'
     or v_evidence.trust_class='WEB_UNTRUSTED'
     or (v_evidence.claim_payload-array[
       'track_id',
       'work_id',
       'relationship_kind',
       'valid_from',
       'valid_to'
     ]::text[])<>'{}'::jsonb
  then
    raise exception using errcode='42501',
      message='Evidence is not an admissible exact Track-to-Work candidate.';
  end if;

  begin
    v_track_id:=(v_evidence.claim_payload->>'track_id')::uuid;
    v_work_id:=(v_evidence.claim_payload->>'work_id')::uuid;
  exception when others then
    raise exception using errcode='22023',
      message='Track-to-Work evidence identifiers are malformed.';
  end;

  if v_evidence.claim_payload->>'relationship_kind' not in (
       'embodies',
       'adaptation_of',
       'medley_component',
       'sampled_work',
       'other_reviewed'
     )
     or not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_track_id
         and track.status<>'archived'
     )
     or not exists (
       select 1
       from public.registry_works work
       where work.id=v_work_id
         and work.status<>'archived'
     )
  then
    raise exception using errcode='23514',
      message='Track-to-Work candidate is invalid or stale.';
  end if;

  select link.*
  into v_row
  from public.registry_track_work_links link
  where link.id=v_evidence.subject_id;

  if found then
    if v_row.track_id<>v_track_id
       or v_row.work_id<>v_work_id
       or v_row.relationship_kind<>
            v_evidence.claim_payload->>'relationship_kind'
    then
      raise exception using errcode='23505',
        message='Track-to-Work UUID already exists with different canonical state.';
    end if;

    return to_jsonb(v_row)||
      jsonb_build_object(
        '_authority',
        jsonb_build_object(
          'mode','already_current',
          'verified',v_row.status='verified',
          'evidence_assertion_id',v_row.evidence_assertion_id,
          'operation_key','registry.track_work_link.admit',
          'operation_version',1
        )
      );
  end if;

  select link.*
  into v_row
  from public.registry_track_work_links link
  where link.track_id=v_track_id
    and link.work_id=v_work_id
    and link.relationship_kind=
        v_evidence.claim_payload->>'relationship_kind'
    and link.status not in ('superseded','rejected')
  order by link.created_at
  limit 1;

  if found then
    if v_row.status='disputed' then
      raise exception using errcode='23514',
        message='WK_PROVENANCE_TRACK_WORK_REVIEW_REQUIRED: equivalent relation is disputed.';
    end if;

    return to_jsonb(v_row)||
      jsonb_build_object(
        '_authority',
        jsonb_build_object(
          'mode','already_current',
          'verified',v_row.status='verified',
          'evidence_assertion_id',v_row.evidence_assertion_id,
          'operation_key','registry.track_work_link.admit',
          'operation_version',1
        )
      );
  end if;

  v_plan:=jsonb_build_object(
    'operation_key','registry.track_work_link.admit',
    'operation_version',1,
    'future_subject_id',v_evidence.subject_id::text,
    'candidate',v_evidence.claim_payload,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'track_state_fingerprint',
      platform_private.registry_provenance_entity_fingerprint_v1(
        'track',v_track_id
      ),
    'work_state_fingerprint',
      platform_private.registry_provenance_entity_fingerprint_v1(
        'work',v_work_id
      ),
    'policy_ruleset_version','music-provenance-slice1-admission-v1'
  );

  v_grant_id:=
    platform_private.issue_registry_provenance_admin_grant_v1(
      'registry.track_work_link.admit',
      'track_work_link',
      v_evidence.subject_id,
      v_plan
    );

  select *
  into v_exec
  from platform_private.execute_registry_provenance_admin_v1(v_grant_id);

  select *
  into v_verify
  from platform_private.verify_registry_provenance_admin_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='WK_PROVENANCE_TRACK_WORK_VERIFIER_FAILED: Track-to-Work admission verification failed.';
  end if;

  select link.*
  into v_row
  from public.registry_track_work_links link
  where link.id=v_evidence.subject_id;

  return to_jsonb(v_row)||
    jsonb_build_object(
      '_authority',
      jsonb_build_object(
        'verified',true,
        'operation_id',v_exec.operation_id,
        'execution_grant_id',v_grant_id,
        'evidence_assertion_id',v_evidence.id,
        'operation_key','registry.track_work_link.admit',
        'operation_version',1
      )
    );
end
$$;

create or replace function public.admin_admit_registry_track_contribution_v1(
  p_attestation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,platform_private,auth
as $$
declare
  v_user_id uuid;
  v_attestation platform_private.registry_contribution_attestations%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_state text;
  v_future_id uuid:=gen_random_uuid();
  v_plan jsonb;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_row public.registry_track_contributions%rowtype;
begin
  v_user_id:=
    platform_private.registry_provenance_admin_current_user_v1();

  select attestation.*
  into v_attestation
  from platform_private.registry_contribution_attestations attestation
  where attestation.id=p_attestation_id;

  if not found
     or v_attestation.track_id is null
     or v_attestation.work_id is not null
  then
    raise exception using errcode='P0002',
      message='Recording contribution attestation is missing or wrong-domain.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_attestation.evidence_assertion_id;

  v_state:=
    platform_private.registry_contribution_attestation_current_state_v1(
      v_attestation.id
    );

  if not found
     or v_state not in ('corroborated','confirmed')
     or (
       v_attestation.elicitation_method='self_claim'
       and v_state<>'confirmed'
     )
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>v_attestation.track_id
     or v_evidence.claim_key<>'registry.contribution.attestation'
  then
    raise exception using errcode='42501',
      message='WK_PROVENANCE_ATTESTATION_REVIEW_REQUIRED: Recording contribution requires corroborated/confirmed reviewed attestation.';
  end if;

  select contribution.*
  into v_row
  from public.registry_track_contributions contribution
  where contribution.evidence_assertion_id=v_evidence.id
  order by contribution.created_at desc
  limit 1;

  if found then
    if v_row.status='verified' then
      return to_jsonb(v_row)||
        jsonb_build_object(
          '_authority',
          jsonb_build_object(
            'mode','already_current',
            'verified',true,
            'attestation_id',v_attestation.id,
            'evidence_assertion_id',v_evidence.id,
            'operation_key','registry.track_contribution.admit',
            'operation_version',1
          )
        );
    end if;

    raise exception using errcode='23514',
      message='WK_PROVENANCE_TRACK_CONTRIBUTION_REVIEW_REQUIRED: attestation already has non-current canonical history; create a new reviewed attestation.';
  end if;

  v_plan:=jsonb_build_object(
    'operation_key','registry.track_contribution.admit',
    'operation_version',1,
    'future_subject_id',v_future_id::text,
    'subject_id',v_attestation.track_id::text,
    'attestation_id',v_attestation.id::text,
    'attestation_state',v_state,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'subject_state_fingerprint',
      platform_private.registry_provenance_entity_fingerprint_v1(
        'track',v_attestation.track_id
      ),
    'person_state_fingerprint',
      platform_private.registry_provenance_entity_fingerprint_v1(
        'person',v_attestation.proposed_person_resource_id
      ),
    'organization_state_fingerprint',
      platform_private.registry_provenance_entity_fingerprint_v1(
        'organization',v_attestation.proposed_organization_resource_id
      ),
    'artist_state_fingerprint',
      platform_private.registry_provenance_entity_fingerprint_v1(
        'artist',v_attestation.proposed_artist_id
      ),
    'policy_ruleset_version','music-provenance-slice1-admission-v1'
  );

  v_grant_id:=
    platform_private.issue_registry_provenance_admin_grant_v1(
      'registry.track_contribution.admit',
      'track_contribution',
      v_future_id,
      v_plan
    );

  select *
  into v_exec
  from platform_private.execute_registry_provenance_admin_v1(v_grant_id);

  select *
  into v_verify
  from platform_private.verify_registry_provenance_admin_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='WK_PROVENANCE_TRACK_CONTRIBUTION_VERIFIER_FAILED: Recording contribution verification failed.';
  end if;

  select contribution.*
  into v_row
  from public.registry_track_contributions contribution
  where contribution.id=v_future_id;

  return to_jsonb(v_row)||
    jsonb_build_object(
      '_authority',
      jsonb_build_object(
        'verified',true,
        'operation_id',v_exec.operation_id,
        'execution_grant_id',v_grant_id,
        'attestation_id',v_attestation.id,
        'evidence_assertion_id',v_evidence.id,
        'operation_key','registry.track_contribution.admit',
        'operation_version',1
      )
    );
end
$$;

create or replace function public.admin_admit_registry_work_contribution_v1(
  p_attestation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,platform_private,auth
as $$
declare
  v_user_id uuid;
  v_attestation platform_private.registry_contribution_attestations%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_state text;
  v_future_id uuid:=gen_random_uuid();
  v_plan jsonb;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_row public.registry_work_contributions%rowtype;
begin
  v_user_id:=
    platform_private.registry_provenance_admin_current_user_v1();

  select attestation.*
  into v_attestation
  from platform_private.registry_contribution_attestations attestation
  where attestation.id=p_attestation_id;

  if not found
     or v_attestation.work_id is null
     or v_attestation.track_id is not null
  then
    raise exception using errcode='P0002',
      message='Work contribution attestation is missing or wrong-domain.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_attestation.evidence_assertion_id;

  v_state:=
    platform_private.registry_contribution_attestation_current_state_v1(
      v_attestation.id
    );

  if not found
     or v_state not in ('corroborated','confirmed')
     or (
       v_attestation.elicitation_method='self_claim'
       and v_state<>'confirmed'
     )
     or v_evidence.subject_type<>'work'
     or v_evidence.subject_id<>v_attestation.work_id
     or v_evidence.claim_key<>'registry.contribution.attestation'
  then
    raise exception using errcode='42501',
      message='WK_PROVENANCE_ATTESTATION_REVIEW_REQUIRED: Work contribution requires corroborated/confirmed reviewed attestation.';
  end if;

  select contribution.*
  into v_row
  from public.registry_work_contributions contribution
  where contribution.evidence_assertion_id=v_evidence.id
  order by contribution.created_at desc
  limit 1;

  if found then
    if v_row.status='verified' then
      return to_jsonb(v_row)||
        jsonb_build_object(
          '_authority',
          jsonb_build_object(
            'mode','already_current',
            'verified',true,
            'attestation_id',v_attestation.id,
            'evidence_assertion_id',v_evidence.id,
            'operation_key','registry.work_contribution.admit',
            'operation_version',1
          )
        );
    end if;

    raise exception using errcode='23514',
      message='WK_PROVENANCE_WORK_CONTRIBUTION_REVIEW_REQUIRED: attestation already has non-current canonical history; create a new reviewed attestation.';
  end if;

  v_plan:=jsonb_build_object(
    'operation_key','registry.work_contribution.admit',
    'operation_version',1,
    'future_subject_id',v_future_id::text,
    'subject_id',v_attestation.work_id::text,
    'attestation_id',v_attestation.id::text,
    'attestation_state',v_state,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'subject_state_fingerprint',
      platform_private.registry_provenance_entity_fingerprint_v1(
        'work',v_attestation.work_id
      ),
    'person_state_fingerprint',
      platform_private.registry_provenance_entity_fingerprint_v1(
        'person',v_attestation.proposed_person_resource_id
      ),
    'organization_state_fingerprint',
      platform_private.registry_provenance_entity_fingerprint_v1(
        'organization',v_attestation.proposed_organization_resource_id
      ),
    'artist_state_fingerprint',
      platform_private.registry_provenance_entity_fingerprint_v1(
        'artist',v_attestation.proposed_artist_id
      ),
    'policy_ruleset_version','music-provenance-slice1-admission-v1'
  );

  v_grant_id:=
    platform_private.issue_registry_provenance_admin_grant_v1(
      'registry.work_contribution.admit',
      'work_contribution',
      v_future_id,
      v_plan
    );

  select *
  into v_exec
  from platform_private.execute_registry_provenance_admin_v1(v_grant_id);

  select *
  into v_verify
  from platform_private.verify_registry_provenance_admin_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='WK_PROVENANCE_WORK_CONTRIBUTION_VERIFIER_FAILED: Work contribution verification failed.';
  end if;

  select contribution.*
  into v_row
  from public.registry_work_contributions contribution
  where contribution.id=v_future_id;

  return to_jsonb(v_row)||
    jsonb_build_object(
      '_authority',
      jsonb_build_object(
        'verified',true,
        'operation_id',v_exec.operation_id,
        'execution_grant_id',v_grant_id,
        'attestation_id',v_attestation.id,
        'evidence_assertion_id',v_evidence.id,
        'operation_key','registry.work_contribution.admit',
        'operation_version',1
      )
    );
end
$$;

revoke all on function
  platform_private.execute_registry_provenance_admin_v1(uuid)
from public,anon,authenticated,service_role;

revoke all on function
  public.admin_create_registry_work_v1(uuid),
  public.admin_admit_registry_track_work_link_v1(uuid),
  public.admin_admit_registry_track_contribution_v1(uuid),
  public.admin_admit_registry_work_contribution_v1(uuid)
from public,anon,service_role;

grant execute on function
  public.admin_create_registry_work_v1(uuid),
  public.admin_admit_registry_track_work_link_v1(uuid),
  public.admin_admit_registry_track_contribution_v1(uuid),
  public.admin_admit_registry_work_contribution_v1(uuid)
to authenticated;

do $integrity$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'platform_private.execute_registry_provenance_admin_v1(uuid)'::regprocedure
  ) into v_definition;
  if position('trust_class' in v_definition)=0
     or position('v_evidence.trust_class is distinct from' in v_definition)=0
  then
    raise exception 'Provenance executor is not sealed to evidence trust class.';
  end if;

  select pg_get_functiondef(
    'public.admin_create_registry_work_v1(uuid)'::regprocedure
  ) into v_definition;
  if position('trust_class' in v_definition)=0
  then
    raise exception 'Provenance reviewed grant plan lacks immutable trust-class binding.';
  end if;
end
$integrity$;

commit;
