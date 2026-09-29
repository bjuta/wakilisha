-- WAKILISHA Music Provenance — Slice 1 / #1113
-- Governed Work / Recording-to-Work / Recording Contribution / Work
-- Contribution admission using the already-declared v1 Registry operations.
--
-- No corpus backfill. No rights inference. No standing mutation authority.

begin;

set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'music-provenance-slice1-work-contribution-admission-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_works') is null
     or to_regclass('public.registry_track_work_links') is null
     or to_regclass('public.registry_track_contributions') is null
     or to_regclass('public.registry_work_contributions') is null
     or to_regclass('public.registry_rights_claims') is null
     or to_regclass('platform_private.registry_contribution_attestations') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regprocedure(
       'platform_private.begin_registry_mutation_operation(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_execution_grant_has_current_authority(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_execution_target_set_fingerprint(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_plan_fingerprint(jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_contribution_attestation_current_state_v1(uuid)'
     ) is null
  then
    raise exception
      'STOP: accepted Registry governance and provenance attestation authority is incomplete';
  end if;

  if exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_provenance_admin'
  )
     or to_regprocedure(
       'platform_private.registry_provenance_admin_current_user_v1()'
     ) is not null
     or to_regprocedure(
       'platform_private.issue_registry_provenance_admin_grant_v1(text,text,uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_provenance_admin_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_provenance_admin_v1(uuid)'
     ) is not null
  then
    raise exception
      'STOP: provenance Slice 1 Work/Contribution runtime already exists; audit before reapplying';
  end if;

  if (
    select count(*)
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_version=1
      and operation_type.operation_key in (
        'registry.work.create',
        'registry.track_work_link.admit',
        'registry.track_contribution.admit',
        'registry.work_contribution.admit'
      )
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and not operation_type.enabled
  )<>4
  then
    raise exception
      'STOP: the four accepted v1 provenance operation declarations are missing, malformed, or already enabled';
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
  'registry_provenance_admin',
  'Registry Provenance Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_family',
    jsonb_build_array(
      'registry.work.create/v1',
      'registry.track_work_link.admit/v1',
      'registry.track_contribution.admit/v1',
      'registry.work_contribution.admit/v1'
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
  'registry_provenance_admin',
  'database_role',
  'authenticator',
  'active'
);

update platform_private.registry_operation_types
set
  enabled=true,
  description=case operation_key
    when 'registry.work.create'
      then 'Create one exact evidence-bound Musical Work through the reviewed provenance broker.'
    when 'registry.track_work_link.admit'
      then 'Admit one exact evidence-bound Recording-to-Work relation through the reviewed provenance broker.'
    when 'registry.track_contribution.admit'
      then 'Admit one exact corroborated/confirmed Recording contribution through the reviewed provenance broker.'
    when 'registry.work_contribution.admit'
      then 'Admit one exact corroborated/confirmed Work contribution through the reviewed provenance broker.'
  end
where operation_version=1
  and operation_key in (
    'registry.work.create',
    'registry.track_work_link.admit',
    'registry.track_contribution.admit',
    'registry.work_contribution.admit'
  )
  and not enabled;

create function platform_private.registry_provenance_admin_current_user_v1()
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
    where binding.actor_key='registry_provenance_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry provenance admin broker.';
  end if;

  return v_user_id;
end
$$;

create function platform_private.registry_provenance_entity_state_v1(
  p_entity_type text,
  p_entity_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial
as $$
declare
  v_state jsonb;
begin
  if p_entity_id is null then
    return null;
  end if;

  case p_entity_type
    when 'track' then
      select to_jsonb(track)
      into v_state
      from public.registry_tracks track
      where track.id=p_entity_id;

    when 'work' then
      select to_jsonb(work)
      into v_state
      from public.registry_works work
      where work.id=p_entity_id;

    when 'artist' then
      select to_jsonb(artist)
      into v_state
      from public.registry_artists artist
      where artist.id=p_entity_id;

    when 'person' then
      select to_jsonb(person)
      into v_state
      from editorial.people person
      where person.resource_id=p_entity_id;

    when 'organization' then
      select to_jsonb(organization)
      into v_state
      from editorial.organizations organization
      where organization.resource_id=p_entity_id;

    else
      return null;
  end case;

  return v_state;
end
$$;

create function platform_private.registry_provenance_entity_fingerprint_v1(
  p_entity_type text,
  p_entity_id uuid
)
returns text
language sql
stable
security definer
set search_path=pg_catalog,platform_private,extensions
as $$
  select case
    when platform_private.registry_provenance_entity_state_v1(
           p_entity_type,
           p_entity_id
         ) is null
      then null
    else encode(
      extensions.digest(
        platform_private.registry_provenance_entity_state_v1(
          p_entity_type,
          p_entity_id
        )::text,
        'sha256'
      ),
      'hex'
    )
  end
$$;

create function platform_private.issue_registry_provenance_admin_grant_v1(
  p_operation_key text,
  p_subject_type text,
  p_future_subject_id uuid,
  p_plan jsonb
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid;
  v_capability text;
  v_plan_fingerprint text;
  v_target_set jsonb;
  v_target_fingerprint text;
  v_idempotency_key text;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_grant_id uuid;
begin
  v_user_id:=
    platform_private.registry_provenance_admin_current_user_v1();

  v_capability:=case p_operation_key
    when 'registry.work.create'
      then 'create_registry_work'
    when 'registry.track_work_link.admit'
      then 'admit_registry_track_work_link'
    when 'registry.track_contribution.admit'
      then 'admit_registry_track_contribution'
    when 'registry.work_contribution.admit'
      then 'admit_registry_work_contribution'
    else null
  end;

  if v_capability is null
     or p_future_subject_id is null
     or p_plan is null
     or jsonb_typeof(p_plan)<>'object'
     or p_plan->>'operation_key'<>p_operation_key
     or coalesce((p_plan->>'operation_version')::integer,0)<>1
     or p_plan->>'future_subject_id'<>p_future_subject_id::text
     or p_plan->>'policy_ruleset_version'<>
          'music-provenance-slice1-admission-v1'
     or p_subject_type is distinct from case p_operation_key
          when 'registry.work.create' then 'work'
          when 'registry.track_work_link.admit' then 'track_work_link'
          when 'registry.track_contribution.admit' then 'track_contribution'
          when 'registry.work_contribution.admit' then 'work_contribution'
        end
  then
    raise exception using errcode='22023',
      message='Exact typed provenance operation plan is required.';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key=p_operation_key
      and operation_type.operation_version=1
      and operation_type.capability_key=v_capability
      and operation_type.allowed_subject_types=array[p_subject_type]::text[]
      and not operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception using errcode='42501',
      message='Requested provenance operation is disabled or malformed.';
  end if;

  v_plan_fingerprint:=
    platform_private.registry_plan_fingerprint(p_plan);

  v_target_set:=jsonb_build_array(
    jsonb_build_object(
      'subject_type',p_subject_type,
      'subject_id',p_future_subject_id::text,
      'expected_state_fingerprint',null
    )
  );

  v_target_fingerprint:=encode(
    extensions.digest(v_target_set::text,'sha256'),
    'hex'
  );

  v_idempotency_key:=
    'registry-provenance:'||
    replace(p_operation_key,'.','-')||':'||
    v_plan_fingerprint;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_provenance_admin'
    and execution_grant.operation_key=p_operation_key
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
    then
      raise exception using errcode='23505',
        message='Provenance idempotency key is bound to different authority.';
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
    'registry_provenance_admin',
    v_capability,
    null,
    p_operation_key,
    1,
    p_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'music-provenance-slice1-admission-v1',
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
    p_future_subject_id,
    null
  );

  if platform_private.registry_execution_target_set_fingerprint(v_grant_id)
       <>v_target_fingerprint
  then
    raise exception using errcode='23514',
      message='Provenance exact target-set fingerprint drifted.';
  end if;

  return v_grant_id;
end
$$;

create function platform_private.execute_registry_provenance_admin_v1(
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

    if v_person_id is not null
       and platform_private.registry_provenance_entity_fingerprint_v1(
             'person',v_person_id
           ) is distinct from v_plan->>'person_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='WK_STALE_TRACK_CONTRIBUTION_PERSON: Person changed after review.';
    end if;

    if v_organization_id is not null
       and platform_private.registry_provenance_entity_fingerprint_v1(
             'organization',v_organization_id
           ) is distinct from v_plan->>'organization_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='WK_STALE_TRACK_CONTRIBUTION_ORGANIZATION: Organisation changed after review.';
    end if;

    if v_artist_id is not null
       and platform_private.registry_provenance_entity_fingerprint_v1(
             'artist',v_artist_id
           ) is distinct from v_plan->>'artist_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='WK_STALE_TRACK_CONTRIBUTION_ARTIST: Artist changed after review.';
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

    if v_person_id is not null
       and platform_private.registry_provenance_entity_fingerprint_v1(
             'person',v_person_id
           ) is distinct from v_plan->>'person_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='WK_STALE_WORK_CONTRIBUTION_PERSON: Person changed after review.';
    end if;

    if v_organization_id is not null
       and platform_private.registry_provenance_entity_fingerprint_v1(
             'organization',v_organization_id
           ) is distinct from v_plan->>'organization_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='WK_STALE_WORK_CONTRIBUTION_ORGANIZATION: Organisation changed after review.';
    end if;

    if v_artist_id is not null
       and platform_private.registry_provenance_entity_fingerprint_v1(
             'artist',v_artist_id
           ) is distinct from v_plan->>'artist_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='WK_STALE_WORK_CONTRIBUTION_ARTIST: Artist changed after review.';
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

create function platform_private.verify_registry_provenance_admin_v1(
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
  v_plan jsonb;
  v_event_count integer;
  v_valid_event_count integer;
  v_row_count integer;
  v_failure text;
  v_expected_path text;
  v_expected_action text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_provenance_admin'
     or v_operation.operation_version<>1
     or v_operation.operation_key not in (
       'registry.work.create',
       'registry.track_work_link.admit',
       'registry.track_contribution.admit',
       'registry.work_contribution.admit'
     )
  then
    raise exception using errcode='P0002',
      message='Registry Provenance Admin V1 operation not found.';
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
       or v_grant.actor_key<>'registry_provenance_admin'
       or v_grant.policy_ruleset_version<>
            'music-provenance-slice1-admission-v1'
       or v_grant.system_actor_capability_grant_id is not null
       or v_grant.required_user_capability_key<>'manage_registry'
     )
  then
    v_failure:='execution_grant_missing_or_wrong_authority';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;

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
      v_failure:='exact_future_target_missing';
    end if;
  end if;

  if v_failure is null then
    if v_operation.operation_key='registry.work.create' then
      select count(*)::integer
      into v_row_count
      from public.registry_works work
      where work.id=v_target.subject_id
        and work.title=v_plan#>>'{candidate,title}'
        and work.normalized_title=v_plan#>>'{candidate,normalized_title}'
        and work.status='draft'
        and work.metadata=coalesce(
          v_plan#>'{candidate,metadata}',
          '{}'::jsonb
        );

      v_expected_path:='public.registry_works';
      v_expected_action:='create_identity';

    elsif v_operation.operation_key='registry.track_work_link.admit' then
      select count(*)::integer
      into v_row_count
      from public.registry_track_work_links link
      where link.id=v_target.subject_id
        and link.track_id=(v_plan#>>'{candidate,track_id}')::uuid
        and link.work_id=(v_plan#>>'{candidate,work_id}')::uuid
        and link.relationship_kind=v_plan#>>'{candidate,relationship_kind}'
        and link.status='verified'
        and link.evidence_assertion_id=
            (v_plan->>'evidence_assertion_id')::uuid;

      v_expected_path:='public.registry_track_work_links';
      v_expected_action:='admit_track_work_link';

    elsif v_operation.operation_key='registry.track_contribution.admit' then
      select count(*)::integer
      into v_row_count
      from public.registry_track_contributions contribution
      where contribution.id=v_target.subject_id
        and contribution.track_id=(v_plan->>'subject_id')::uuid
        and contribution.status='verified'
        and contribution.evidence_assertion_id=
            (v_plan->>'evidence_assertion_id')::uuid;

      v_expected_path:='public.registry_track_contributions';
      v_expected_action:='admit_track_contribution';

    else
      select count(*)::integer
      into v_row_count
      from public.registry_work_contributions contribution
      where contribution.id=v_target.subject_id
        and contribution.work_id=(v_plan->>'subject_id')::uuid
        and contribution.status='verified'
        and contribution.evidence_assertion_id=
            (v_plan->>'evidence_assertion_id')::uuid;

      v_expected_path:='public.registry_work_contributions';
      v_expected_action:='admit_work_contribution';
    end if;

    if v_row_count<>1 then
      v_failure:='canonical_row_state_mismatch';
    end if;
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
      and event.registry_entity_id=v_target.subject_id::text
      and event.source_suggestion_id=
          v_operation.result_payload->>'evidence_assertion_id'
      and event.source_table=
          'platform_private.registry_evidence_assertions'
      and event.target_path=v_expected_path
      and event.action=v_expected_action
      and event.status='succeeded'
      and event.actor='system:registry_provenance_admin'
      and event.before_value is null
      and event.after_value->>'id'=v_target.subject_id::text;

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
    error_code='registry_provenance_admin_verification_failed',
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

create function public.admin_create_registry_work_v1(
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

create function public.admin_admit_registry_track_work_link_v1(
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

create function public.admin_admit_registry_track_contribution_v1(
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

create function public.admin_admit_registry_work_contribution_v1(
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
  platform_private.registry_provenance_admin_current_user_v1(),
  platform_private.registry_provenance_entity_state_v1(text,uuid),
  platform_private.registry_provenance_entity_fingerprint_v1(text,uuid),
  platform_private.issue_registry_provenance_admin_grant_v1(text,text,uuid,jsonb),
  platform_private.execute_registry_provenance_admin_v1(uuid),
  platform_private.verify_registry_provenance_admin_v1(uuid)
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

do $authority_proof$
begin
  if (
    select count(*)
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_version=1
      and operation_type.operation_key in (
        'registry.work.create',
        'registry.track_work_link.admit',
        'registry.track_contribution.admit',
        'registry.work_contribution.admit'
      )
      and operation_type.enabled
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  )<>4
  then
    raise exception
      'Provenance Slice 1 v1 operation enablement drifted.';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key in (
      'registry.rights_claim.admit',
      'registry.rights_claim.reviewed_reconcile'
    )
      and enabled
  ) then
    raise exception
      'Provenance Slice 1 incorrectly enabled rights mutation authority.';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants standing_grant
    where standing_grant.actor_key='registry_provenance_admin'
  ) then
    raise exception
      'Registry provenance admin gained standing autonomous authority.';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.execute_registry_provenance_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_provenance_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_provenance_admin_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Registry provenance private executor leaked execution authority.';
  end if;

  if has_table_privilege(
       'anon',
       'public.registry_works',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'public.registry_works',
       'INSERT'
     )
     or has_table_privilege(
       'service_role',
       'public.registry_works',
       'INSERT'
     )
     or has_table_privilege(
       'anon',
       'public.registry_track_work_links',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'public.registry_track_contributions',
       'INSERT'
     )
     or has_table_privilege(
       'service_role',
       'public.registry_work_contributions',
       'INSERT'
     )
  then
    raise exception
      'Provenance canonical tables leaked direct insert authority.';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.actor_key='registry_provenance_admin'
      and execution_grant.status='active'
  ) then
    raise exception
      'Provenance migration left exact execution authority active at rest.';
  end if;
end
$authority_proof$;

commit;
