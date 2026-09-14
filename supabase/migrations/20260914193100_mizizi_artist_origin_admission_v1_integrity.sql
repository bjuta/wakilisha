-- MIZIZI Artist Origin Admission V1 integrity hardening.
--
-- This migration tightens two pre-Preview properties discovered by static
-- adversarial review:
--   * malformed/null evidence values must be rejected before grant/execution;
--   * repeated observation of the same source payload on the same UTC day must
--     resolve to the same immutable evidence assertion for safe retry/resume.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-artist-origin-admission-v1-integrity',
    0
  )
);

create or replace function platform_private.record_registry_artist_origin_evidence(
  p_actor_key text,
  p_artist_id uuid,
  p_origin_iso2 text,
  p_confidence numeric,
  p_source_kind text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_assertion_id uuid;
  v_assertion_fingerprint text;
  v_claim_payload jsonb;
  v_recorded_by text;
  v_observation_day timestamp;
begin
  if p_actor_key is null
     or p_artist_id is null
     or p_observed_at is null
  then
    raise exception
      using errcode = '22023',
            message = 'Actor, Artist, and observation time are required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key = p_actor_key
      and actor.status = 'active'
  )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = p_actor_key
         and binding.executor_kind = 'database_role'
         and binding.executor_key = session_user
         and binding.status = 'active'
     )
  then
    raise exception
      using errcode = '42501',
            message = 'Current executor is not bound to the active System Actor.';
  end if;

  if not exists (
    select 1
    from public.registry_artists artist
    where artist.id = p_artist_id
  ) then
    raise exception
      using errcode = 'P0002',
            message = 'Artist not found.';
  end if;

  if not platform_private.registry_is_valid_iso2(p_origin_iso2) then
    raise exception
      using errcode = '22023',
            message = 'Evidence origin must be a canonical ISO-3166-1 alpha-2 code.';
  end if;

  if p_confidence is null
     or p_confidence < 0
     or p_confidence > 1
  then
    raise exception
      using errcode = '22023',
            message = 'Evidence confidence must be between zero and one.';
  end if;

  if p_source_kind is null
     or p_source_kind not in (
       'metadata_country_normalization',
       'musicbrainz'
     )
  then
    raise exception
      using errcode = '22023',
            message = 'Artist Origin V1 does not accept this evidence source kind.';
  end if;

  if nullif(btrim(p_source_ref), '') is null
     or octet_length(p_source_ref) > 2000
     or p_source_payload_fingerprint is null
     or p_source_payload_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception
      using errcode = '22023',
            message = 'Evidence source reference/fingerprint is invalid.';
  end if;

  if p_observed_at > now() + interval '5 minutes'
     or p_observed_at < now() - interval '30 days'
  then
    raise exception
      using errcode = '22023',
            message = 'Evidence observation time is outside the V1 freshness window.';
  end if;

  v_claim_payload := jsonb_build_object(
    'origin_iso2', p_origin_iso2,
    'origin_confidence', p_confidence
  );
  v_recorded_by := 'system:' || p_actor_key;
  v_observation_day :=
    date_trunc(
      'day',
      p_observed_at at time zone 'UTC'
    );

  v_assertion_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type', 'artist',
        'subject_id', p_artist_id::text,
        'claim_key', 'registry.artist.origin',
        'claim_payload', v_claim_payload,
        'trust_class', 'EXTERNAL_EVIDENCE',
        'source_kind', p_source_kind,
        'source_ref', btrim(p_source_ref),
        'source_payload_fingerprint', p_source_payload_fingerprint,
        'observation_day_utc', v_observation_day,
        'recorded_by_principal_key', v_recorded_by
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
    'artist',
    p_artist_id,
    'registry.artist.origin',
    v_claim_payload,
    'EXTERNAL_EVIDENCE',
    p_source_kind,
    btrim(p_source_ref),
    p_source_payload_fingerprint,
    p_observed_at,
    v_recorded_by,
    v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint)
  do nothing
  returning id into v_assertion_id;

  if v_assertion_id is null then
    select assertion.id
    into v_assertion_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint = v_assertion_fingerprint;
  end if;

  return v_assertion_id;
end
$$;

create or replace function platform_private.issue_registry_artist_origin_execution_grant(
  p_actor_key text,
  p_evidence_assertion_id uuid,
  p_idempotency_key text
)
returns table (
  execution_grant_id uuid,
  plan_fingerprint text,
  target_set_fingerprint text,
  expected_state_fingerprint text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_artist public.registry_artists%rowtype;
  v_standing_grant platform_private.system_actor_capability_grants%rowtype;
  v_standing_count integer;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_state_fingerprint text;
  v_target_fingerprint text;
  v_execution_grant_id uuid;
  v_expires_at timestamptz;
  v_origin_iso2 text;
  v_confidence numeric;
begin
  if p_actor_key is null
     or p_evidence_assertion_id is null
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using errcode = '22023',
            message = 'Valid actor, evidence assertion, and idempotency key are required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key = p_actor_key
      and actor.status = 'active'
  )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = p_actor_key
         and binding.executor_kind = 'database_role'
         and binding.executor_key = session_user
         and binding.status = 'active'
     )
  then
    raise exception
      using errcode = '42501',
            message = 'Current executor is not bound to the active System Actor.';
  end if;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key = p_actor_key
    and execution_grant.operation_key = 'registry.artist_origin.admit'
    and execution_grant.operation_version = 1
    and execution_grant.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.plan_payload ->> 'evidence_assertion_id'
       is distinct from p_evidence_assertion_id::text
    then
      raise exception
        using errcode = '23505',
              message = 'Idempotency key is already bound to different Artist-origin evidence.';
    end if;

    execution_grant_id := v_existing.id;
    plan_fingerprint := v_existing.plan_fingerprint;
    target_set_fingerprint := v_existing.target_set_fingerprint;
    select target.expected_state_fingerprint
    into expected_state_fingerprint
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_existing.id
      and target.subject_type = 'artist'
    limit 1;
    expires_at := v_existing.expires_at;
    return next;
    return;
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key = 'registry.artist_origin.admit'
      and operation_type.operation_version = 1
      and operation_type.capability_key = 'admit_registry_artist_origin'
      and operation_type.enabled
  ) then
    raise exception
      using errcode = '42501',
            message = 'Artist-origin admission is disabled.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id = p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type <> 'artist'
     or v_evidence.claim_key <> 'registry.artist.origin'
     or v_evidence.trust_class not in (
       'EXTERNAL_EVIDENCE',
       'INTERNAL_FACT'
     )
  then
    raise exception
      using errcode = '42501',
            message = 'Evidence assertion is not admissible for Artist Origin V1.';
  end if;

  if v_evidence.observed_at < now() - interval '30 days'
     or v_evidence.observed_at > now() + interval '5 minutes'
  then
    raise exception
      using errcode = '42501',
            message = 'Evidence assertion is outside the V1 freshness window.';
  end if;

  v_origin_iso2 := v_evidence.claim_payload ->> 'origin_iso2';
  begin
    v_confidence :=
      (v_evidence.claim_payload ->> 'origin_confidence')::numeric;
  exception
    when others then
      raise exception
        using errcode = '22023',
              message = 'Evidence confidence is malformed.';
  end;

  if v_origin_iso2 is null
     or v_confidence is null
     or not platform_private.registry_is_valid_iso2(v_origin_iso2)
     or v_confidence < 0.90
     or v_confidence > 1
  then
    raise exception
      using errcode = '42501',
            message = 'Evidence does not meet Artist Origin V1 admission policy.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id = v_evidence.subject_id;

  if not found
     or v_artist.status not in ('active', 'draft')
     or nullif(btrim(v_artist.origin_iso2), '') is not null
     or v_artist.origin_confidence is not null
  then
    raise exception
      using errcode = '42501',
            message = 'Artist is not eligible for missing-origin admission.';
  end if;

  select count(*)::integer
  into v_standing_count
  from platform_private.system_actor_capability_grants standing_grant
  where standing_grant.actor_key = p_actor_key
    and standing_grant.capability_key = 'admit_registry_artist_origin'
    and standing_grant.status = 'active'
    and standing_grant.valid_from <= now()
    and standing_grant.expires_at > now();

  if v_standing_count <> 1 then
    raise exception
      using errcode = '42501',
            message = 'Exactly one active Artist-origin standing capability grant is required.';
  end if;

  select standing_grant.*
  into v_standing_grant
  from platform_private.system_actor_capability_grants standing_grant
  where standing_grant.actor_key = p_actor_key
    and standing_grant.capability_key = 'admit_registry_artist_origin'
    and standing_grant.status = 'active'
    and standing_grant.valid_from <= now()
    and standing_grant.expires_at > now()
  limit 1;

  if not (
    v_standing_grant.scope @>
      jsonb_build_object(
        'operation_key', 'registry.artist_origin.admit',
        'operation_version', 1,
        'subject_type', 'artist',
        'max_rows', 1
      )
  ) then
    raise exception
      using errcode = '42501',
            message = 'Standing capability scope does not authorize Artist Origin V1.';
  end if;

  v_state_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'artist',
      v_artist.id
    );

  v_plan := jsonb_build_object(
    'operation_key', 'registry.artist_origin.admit',
    'operation_version', 1,
    'artist_id', v_artist.id::text,
    'evidence_assertion_id', v_evidence.id::text,
    'evidence_assertion_fingerprint', v_evidence.assertion_fingerprint,
    'proposed_origin_iso2', v_origin_iso2,
    'proposed_origin_confidence', v_confidence,
    'expected_state_fingerprint', v_state_fingerprint,
    'trust_class', v_evidence.trust_class,
    'policy_ruleset_version', 'registry-artist-origin-admission-v1'
  );

  v_plan_fingerprint :=
    platform_private.registry_plan_fingerprint(v_plan);

  v_target_fingerprint := encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type', 'artist',
          'subject_id', v_artist.id::text,
          'expected_state_fingerprint', v_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );

  v_expires_at := least(
    now() + interval '5 minutes',
    v_standing_grant.expires_at
  );

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
    issued_at,
    expires_at
  )
  values (
    p_actor_key,
    'admit_registry_artist_origin',
    v_standing_grant.id,
    'registry.artist_origin.admit',
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    p_idempotency_key,
    'active',
    null,
    'policy:registry-artist-origin-admission-v1',
    'registry-artist-origin-admission-v1',
    now(),
    v_expires_at
  )
  returning id into v_execution_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,
    subject_type,
    subject_id,
    expected_state_fingerprint
  )
  values (
    v_execution_grant_id,
    'artist',
    v_artist.id,
    v_state_fingerprint
  );

  execution_grant_id := v_execution_grant_id;
  plan_fingerprint := v_plan_fingerprint;
  target_set_fingerprint := v_target_fingerprint;
  expected_state_fingerprint := v_state_fingerprint;
  expires_at := v_expires_at;
  return next;
end
$$;

create or replace function platform_private.execute_registry_artist_origin_admission(
  p_actor_key text,
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
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_artist public.registry_artists%rowtype;
  v_plan jsonb;
  v_artist_id uuid;
  v_evidence_id uuid;
  v_origin_iso2 text;
  v_confidence numeric;
  v_current_fingerprint text;
  v_origin_event_id uuid;
  v_confidence_event_id uuid;
  v_rows integer;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    p_actor_key,
    p_execution_grant_id
  );

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id = v_begin.operation_id
  for update;

  if v_begin.idempotent_replay
     and v_operation.status = 'succeeded'
  then
    operation_id := v_operation.id;
    operation_status := v_operation.status;
    verifier_status := v_operation.verifier_status;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_operation.status <> 'authorized' then
    raise exception
      using errcode = '42501',
            message = 'Artist-origin operation is not in an executable state.';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = p_execution_grant_id;

  if not found
     or v_grant.actor_key <> p_actor_key
     or v_grant.capability_key <> 'admit_registry_artist_origin'
     or v_grant.operation_key <> 'registry.artist_origin.admit'
     or v_grant.operation_version <> 1
     or v_grant.max_rows <> 1
     or v_grant.policy_ruleset_version <>
       'registry-artist-origin-admission-v1'
  then
    raise exception
      using errcode = '42501',
            message = 'Execution grant is not an Artist Origin V1 grant.';
  end if;

  v_plan := v_grant.plan_payload;

  if (
    v_plan - array[
      'operation_key',
      'operation_version',
      'artist_id',
      'evidence_assertion_id',
      'evidence_assertion_fingerprint',
      'proposed_origin_iso2',
      'proposed_origin_confidence',
      'expected_state_fingerprint',
      'trust_class',
      'policy_ruleset_version'
    ]::text[]
  ) <> '{}'::jsonb
  then
    raise exception
      using errcode = '42501',
            message = 'Execution plan contains fields outside Artist Origin V1.';
  end if;

  begin
    v_artist_id := (v_plan ->> 'artist_id')::uuid;
    v_evidence_id := (v_plan ->> 'evidence_assertion_id')::uuid;
    v_confidence := (v_plan ->> 'proposed_origin_confidence')::numeric;
  exception
    when others then
      raise exception
        using errcode = '22023',
              message = 'Execution plan contains malformed typed values.';
  end;

  v_origin_iso2 := v_plan ->> 'proposed_origin_iso2';

  if v_origin_iso2 is null
     or v_confidence is null
     or v_plan ->> 'operation_key' <> 'registry.artist_origin.admit'
     or (v_plan ->> 'operation_version')::integer <> 1
     or v_plan ->> 'policy_ruleset_version' <>
       'registry-artist-origin-admission-v1'
     or not platform_private.registry_is_valid_iso2(v_origin_iso2)
     or v_confidence < 0.90
     or v_confidence > 1
  then
    raise exception
      using errcode = '42501',
            message = 'Execution plan violates Artist Origin V1 policy.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id = v_grant.id;

  if not found
     or v_target.subject_type <> 'artist'
     or v_target.subject_id <> v_artist_id
     or v_target.expected_state_fingerprint is null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id = v_grant.id
     ) <> 1
  then
    raise exception
      using errcode = '42501',
            message = 'Execution target is not the exact one-Artist V1 target.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id = v_evidence_id;

  if not found
     or v_evidence.subject_type <> 'artist'
     or v_evidence.subject_id <> v_artist_id
     or v_evidence.claim_key <> 'registry.artist.origin'
     or v_evidence.assertion_fingerprint is distinct from
       v_plan ->> 'evidence_assertion_fingerprint'
     or v_evidence.trust_class is distinct from
       v_plan ->> 'trust_class'
     or v_evidence.trust_class not in (
       'EXTERNAL_EVIDENCE',
       'INTERNAL_FACT'
     )
     or v_evidence.claim_payload ->> 'origin_iso2'
       is distinct from v_origin_iso2
     or (v_evidence.claim_payload ->> 'origin_confidence')::numeric
       is distinct from v_confidence
  then
    raise exception
      using errcode = '42501',
            message = 'Bound evidence no longer satisfies the execution plan.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id = v_artist_id
  for update;

  if not found
     or v_artist.status not in ('active', 'draft')
     or nullif(btrim(v_artist.origin_iso2), '') is not null
     or v_artist.origin_confidence is not null
  then
    raise exception
      using errcode = '42501',
            message = 'Artist is no longer eligible for missing-origin admission.';
  end if;

  v_current_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'artist',
      v_artist.id
    );

  if v_current_fingerprint <> v_target.expected_state_fingerprint
     or v_current_fingerprint <>
       v_plan ->> 'expected_state_fingerprint'
  then
    raise exception
      using errcode = '42501',
            message = 'Artist changed after the exact grant was issued.';
  end if;

  update platform_private.registry_mutation_operations
  set
    status = 'executing',
    started_at = coalesce(started_at, now()),
    updated_at = now()
  where id = v_operation.id;

  update public.registry_artists
  set
    origin_iso2 = v_origin_iso2,
    origin_confidence = v_confidence
  where id = v_artist.id
    and nullif(btrim(origin_iso2), '') is null
    and origin_confidence is null;

  get diagnostics v_rows = row_count;

  if v_rows <> 1 then
    raise exception
      using errcode = '40001',
            message = 'Artist-origin admission lost its one-row compare-and-set boundary.';
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
    'artist',
    v_artist.id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'origin_iso2',
    'public.registry_artists.origin_iso2',
    jsonb_build_object('value', v_artist.origin_iso2),
    jsonb_build_object(
      'value', v_origin_iso2,
      'evidence_assertion_id', v_evidence.id,
      'policy_ruleset_version', 'registry-artist-origin-admission-v1'
    ),
    'admit_origin',
    'succeeded',
    'system:' || p_actor_key
  )
  returning id into v_origin_event_id;

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
    'artist',
    v_artist.id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'origin_confidence',
    'public.registry_artists.origin_confidence',
    jsonb_build_object('value', v_artist.origin_confidence),
    jsonb_build_object(
      'value', v_confidence,
      'evidence_assertion_id', v_evidence.id,
      'policy_ruleset_version', 'registry-artist-origin-admission-v1'
    ),
    'admit_origin',
    'succeeded',
    'system:' || p_actor_key
  )
  returning id into v_confidence_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,
    canonical_write_event_id
  )
  values
    (v_operation.id, v_origin_event_id),
    (v_operation.id, v_confidence_event_id);

  update platform_private.registry_mutation_operations
  set
    affected_rows = 1,
    status = 'succeeded',
    verifier_status = 'pending',
    result_payload = jsonb_build_object(
      'artist_id', v_artist.id,
      'origin_iso2', v_origin_iso2,
      'origin_confidence', v_confidence,
      'evidence_assertion_id', v_evidence.id,
      'canonical_write_event_ids',
        jsonb_build_array(
          v_origin_event_id,
          v_confidence_event_id
        )
    ),
    completed_at = now(),
    updated_at = now()
  where id = v_operation.id;

  operation_id := v_operation.id;
  operation_status := 'succeeded';
  verifier_status := 'pending';
  idempotent_replay := v_begin.idempotent_replay;
  return next;
end
$$;

revoke all on function
  platform_private.record_registry_artist_origin_evidence(text,uuid,text,numeric,text,text,text,timestamptz),
  platform_private.issue_registry_artist_origin_execution_grant(text,uuid,text),
  platform_private.execute_registry_artist_origin_admission(text,uuid)
from public, anon, authenticated, service_role;

commit;
