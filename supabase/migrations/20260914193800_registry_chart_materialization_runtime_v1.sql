-- WAKILISHA / MIZIZI Slice 2 / #939
-- Boundary B1: executable Registry materialization broker for Charts.
--
-- Enables only:
--   registry.artist.create/v1
--   registry.track.create/v1
--   registry.track_artist_credit.admit/v1
--
-- Release materialization remains inert until a live consumer supplies
-- canonical Release identity evidence.
--
-- Chart-origin admission reuses registry.artist_origin.admit/v1.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'wk939-registry-chart-materialization-runtime-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.begin_registry_mutation_operation(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_execution_grant_has_current_authority(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_artist_origin_admission(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_artist_origin_admission(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_artist_creation_collision_state_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_creation_collision_state_v1(uuid,text,uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_artist_credit_collision_state_v1(uuid,uuid,uuid)'
     ) is null
  then
    raise exception
      'STOP: accepted Registry primitive/control-plane authority is missing';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key = 'registry_chart_admission'
         and actor.status = 'active'
     )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = 'registry_chart_admission'
         and binding.executor_kind = 'database_role'
         and binding.executor_key = 'authenticator'
         and binding.status = 'active'
     )
  then
    raise exception
      'STOP: registry_chart_admission transport actor is not accepted';
  end if;

  if to_regprocedure(
       'public.chart_materialize_candidate_registry_v1(uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'public.chart_admit_artist_origin_v1(uuid,text,uuid,uuid,text)'
     ) is not null
     or to_regprocedure(
       'public.chart_create_artist_origin_shell_v1(text,text,uuid,uuid)'
     ) is not null
  then
    raise exception
      'STOP: chart materialization runtime already exists';
  end if;
end
$preflight$;

alter table platform_private.registry_evidence_assertions
  drop constraint registry_evidence_assertions_subject_type_check;

alter table platform_private.registry_evidence_assertions
  add constraint registry_evidence_assertions_subject_type_check
  check (
    subject_type = any(
      array[
        'artist',
        'track',
        'release',
        'registry_relationship',
        'track_artist_credit',
        'release_track_membership',
        'release_artist_credit'
      ]::text[]
    )
  );

-- Archived/history rows still occupy uniqueness authority.  V1 therefore
-- treats any existing canonical pair as a collision rather than manufacturing
-- a second relationship whose uniqueness would fail later.
create or replace function
platform_private.registry_track_artist_credit_collision_state_v1(
  p_future_credit_id uuid,
  p_track_id uuid,
  p_artist_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with collisions as (
    select
      credit.id::text as registry_relation_id,
      'future_id'::text as reason
    from public.registry_track_artists credit
    where credit.id = p_future_credit_id

    union all

    select
      credit.id::text,
      'track_artist_pair'
    from public.registry_track_artists credit
    where credit.track_id = p_track_id
      and credit.artist_id = p_artist_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'registry_relation_id', collision.registry_relation_id,
        'reason', collision.reason
      )
      order by collision.registry_relation_id, collision.reason
    ),
    '[]'::jsonb
  )
  from collisions collision;
$$;

create or replace function
platform_private.registry_release_track_collision_state_v1(
  p_future_membership_id uuid,
  p_release_id uuid,
  p_track_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with collisions as (
    select
      membership.id::text as registry_relation_id,
      'future_id'::text as reason
    from public.registry_release_tracks membership
    where membership.id = p_future_membership_id

    union all

    select
      membership.id::text,
      'release_track_pair'
    from public.registry_release_tracks membership
    where membership.release_id = p_release_id
      and membership.track_id = p_track_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'registry_relation_id', collision.registry_relation_id,
        'reason', collision.reason
      )
      order by collision.registry_relation_id, collision.reason
    ),
    '[]'::jsonb
  )
  from collisions collision;
$$;

create or replace function
platform_private.registry_release_artist_credit_collision_state_v1(
  p_future_credit_id uuid,
  p_release_id uuid,
  p_artist_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with collisions as (
    select
      credit.id::text as registry_relation_id,
      'future_id'::text as reason
    from public.registry_release_artists credit
    where credit.id = p_future_credit_id

    union all

    select
      credit.id::text,
      'release_artist_pair'
    from public.registry_release_artists credit
    where credit.release_id = p_release_id
      and credit.artist_id = p_artist_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'registry_relation_id', collision.registry_relation_id,
        'reason', collision.reason
      )
      order by collision.registry_relation_id, collision.reason
    ),
    '[]'::jsonb
  )
  from collisions collision;
$$;

create function
platform_private.registry_chart_artist_names_v1(
  p_artist_display text
)
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  with raw as (
    select btrim(part) as artist_name, ord
    from regexp_split_to_table(
      coalesce(p_artist_display, ''),
      '\s*(?:,|&|\sx\s|\s+(?:feat\.?|ft\.?|featuring)\s+)\s*',
      'i'
    ) with ordinality as split(part, ord)
  ),
  clean as (
    select artist_name, min(ord) as ord
    from raw
    where artist_name <> ''
    group by artist_name
  )
  select coalesce(
    array_agg(artist_name order by ord),
    array[]::text[]
  )
  from clean;
$$;

create function
platform_private.record_registry_chart_user_evidence_v1(
  p_subject_type text,
  p_subject_id uuid,
  p_claim_key text,
  p_claim_payload jsonb,
  p_trust_class text,
  p_source_kind text,
  p_source_ref text,
  p_source_payload jsonb,
  p_required_user_capability_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_payload_fingerprint text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  if v_user_id is null
     or p_subject_id is null
     or p_claim_payload is null
     or jsonb_typeof(p_claim_payload) <> 'object'
     or nullif(btrim(p_claim_key), '') is null
     or nullif(btrim(p_source_ref), '') is null
  then
    raise exception using errcode='22023',
      message='Valid chart evidence subject, claim, and source are required.';
  end if;

  if p_required_user_capability_key not in (
       'publish_charts',
       'manage_registry'
     )
     or not coalesce(
       public.current_user_has_capability(
         p_required_user_capability_key
       ),
       false
     )
  then
    raise exception using errcode='42501',
      message='Current user does not hold the required chart/Registry capability.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_chart_admission'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry chart admission broker.';
  end if;

  if p_subject_type not in (
       'artist',
       'track',
       'track_artist_credit'
     )
     or p_claim_key not in (
       'registry.artist.identity.create',
       'registry.track.identity.create',
       'registry.track_artist_credit',
       'registry.artist.origin'
     )
     or p_trust_class not in (
       'EXTERNAL_EVIDENCE',
       'INTERNAL_FACT'
     )
     or p_source_kind not in (
       'chart_ingest_candidate',
       'chart_origin_review'
     )
  then
    raise exception using errcode='22023',
      message='Evidence is outside the chart materialization V1 contract.';
  end if;

  if octet_length(p_claim_payload::text) > 16384
     or octet_length(p_source_ref) > 2000
  then
    raise exception using errcode='22023',
      message='Chart evidence exceeds the V1 payload boundary.';
  end if;

  v_source_payload_fingerprint := encode(
    extensions.digest(
      coalesce(p_source_payload, '{}'::jsonb)::text,
      'sha256'
    ),
    'hex'
  );

  v_assertion_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type', p_subject_type,
        'subject_id', p_subject_id::text,
        'claim_key', p_claim_key,
        'claim_payload', p_claim_payload,
        'trust_class', p_trust_class,
        'source_kind', p_source_kind,
        'source_ref', btrim(p_source_ref),
        'source_payload_fingerprint',
          v_source_payload_fingerprint,
        'recorded_by_principal_key',
          'user:' || v_user_id::text
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
    p_claim_key,
    p_claim_payload,
    p_trust_class,
    p_source_kind,
    btrim(p_source_ref),
    v_source_payload_fingerprint,
    now(),
    'user:' || v_user_id::text,
    v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint)
  do nothing
  returning id into v_assertion_id;

  if v_assertion_id is null then
    select assertion.id
    into v_assertion_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint =
          v_assertion_fingerprint;
  end if;

  return v_assertion_id;
end
$$;

create function
platform_private.issue_registry_chart_user_execution_grant_v1(
  p_evidence_assertion_id uuid,
  p_operation_key text,
  p_subject_type text,
  p_subject_id uuid,
  p_plan_payload jsonb,
  p_required_user_capability_key text,
  p_idempotency_key text,
  p_expected_state_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_grant_id uuid;
  v_policy_ruleset_version text;
begin
  if v_user_id is null
     or p_evidence_assertion_id is null
     or p_subject_id is null
     or p_plan_payload is null
     or jsonb_typeof(p_plan_payload) <> 'object'
     or p_idempotency_key is null
     or p_idempotency_key !~
        '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception using errcode='22023',
      message='Valid user, evidence, plan, subject, and idempotency key are required.';
  end if;

  if p_required_user_capability_key not in (
       'publish_charts',
       'manage_registry'
     )
     or not coalesce(
       public.current_user_has_capability(
         p_required_user_capability_key
       ),
       false
     )
  then
    raise exception using errcode='42501',
      message='Current user cannot issue this chart Registry grant.';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_chart_admission'
         and actor.status='active'
     )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key='registry_chart_admission'
         and binding.executor_kind='database_role'
         and binding.executor_key=session_user
         and binding.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Registry chart admission broker is not active.';
  end if;

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key=p_operation_key
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or not (
       p_subject_type =
         any(v_operation_type.allowed_subject_types)
     )
  then
    raise exception using errcode='42501',
      message='Typed Registry operation is disabled or subject is forbidden.';
  end if;

  if (
       p_operation_key='registry.artist.create'
       and (
         v_operation_type.capability_key <>
           'create_registry_artist'
         or p_subject_type <> 'artist'
         or p_required_user_capability_key not in (
           'publish_charts',
           'manage_registry'
         )
       )
     )
     or (
       p_operation_key='registry.track.create'
       and (
         v_operation_type.capability_key <>
           'create_registry_track'
         or p_subject_type <> 'track'
         or p_required_user_capability_key <>
           'publish_charts'
       )
     )
     or (
       p_operation_key='registry.track_artist_credit.admit'
       and (
         v_operation_type.capability_key <>
           'admit_registry_track_artist_credit'
         or p_subject_type <> 'track_artist_credit'
         or p_required_user_capability_key <>
           'publish_charts'
       )
     )
     or (
       p_operation_key='registry.artist_origin.admit'
       and (
         v_operation_type.capability_key <>
           'admit_registry_artist_origin'
         or p_subject_type <> 'artist'
         or p_required_user_capability_key <>
           'manage_registry'
         or p_expected_state_fingerprint is null
       )
     )
     or p_operation_key not in (
       'registry.artist.create',
       'registry.track.create',
       'registry.track_artist_credit.admit',
       'registry.artist_origin.admit'
     )
  then
    raise exception using errcode='42501',
      message='Operation/capability pair is outside chart materialization V1.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type <> p_subject_type
     or v_evidence.subject_id <> p_subject_id
     or v_evidence.recorded_by_principal_key <>
        'user:' || v_user_id::text
     or v_evidence.trust_class not in (
       'EXTERNAL_EVIDENCE',
       'INTERNAL_FACT'
     )
  then
    raise exception using errcode='42501',
      message='Evidence is not bound to the current chart user and exact subject.';
  end if;

  v_policy_ruleset_version :=
    case
      when p_operation_key='registry.artist_origin.admit'
        then 'registry-artist-origin-admission-v1'
      else 'registry-materialization-v1'
    end;

  if p_plan_payload->>'operation_key'
       is distinct from p_operation_key
     or coalesce(
          (p_plan_payload->>'operation_version')::integer,
          0
        ) <> 1
     or p_plan_payload->>'evidence_assertion_id'
       is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint'
       is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'trust_class'
       is distinct from v_evidence.trust_class
     or p_plan_payload->>'policy_ruleset_version'
       is distinct from v_policy_ruleset_version
  then
    raise exception using errcode='42501',
      message='Exact execution plan is not bound to its chart evidence.';
  end if;

  v_plan_fingerprint :=
    platform_private.registry_plan_fingerprint(
      p_plan_payload
    );

  v_target_fingerprint := encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type', p_subject_type,
          'subject_id', p_subject_id::text,
          'expected_state_fingerprint',
            p_expected_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_chart_admission'
    and execution_grant.operation_key=p_operation_key
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=p_idempotency_key;

  if found then
    if v_existing.issued_by_user_id <> v_user_id
       or v_existing.plan_fingerprint <>
          v_plan_fingerprint
       or v_existing.target_set_fingerprint <>
          v_target_fingerprint
    then
      raise exception using errcode='23505',
        message='Chart Registry idempotency key is bound to different authority.';
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
    'registry_chart_admission',
    v_operation_type.capability_key,
    null,
    p_operation_key,
    1,
    p_plan_payload,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    p_idempotency_key,
    'active',
    v_user_id,
    'user:' || v_user_id::text,
    v_policy_ruleset_version,
    p_required_user_capability_key,
    now(),
    now() + interval '5 minutes'
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
    p_expected_state_fingerprint
  );

  return v_grant_id;
end
$$;

create function
platform_private.execute_registry_materialization_v1(
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
  v_plan jsonb;
  v_event_id uuid;
  v_collision_state jsonb;
  v_collision_fingerprint text;
  v_rows integer;
  v_artist public.registry_artists%rowtype;
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

  if v_operation.status <> 'authorized' then
    raise exception using errcode='42501',
      message='Registry materialization operation is not executable.';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=p_execution_grant_id;

  if not found
     or v_grant.actor_key <> p_actor_key
     or v_grant.operation_version <> 1
     or v_grant.max_rows <> 1
     or v_grant.policy_ruleset_version <>
        'registry-materialization-v1'
     or v_grant.operation_key not in (
       'registry.artist.create',
       'registry.track.create',
       'registry.track_artist_credit.admit'
     )
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Registry materialization V1 grant.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     ) <> 1
     or v_target.expected_state_fingerprint is not null
  then
    raise exception using errcode='42501',
      message='Materialization V1 requires one exact future target.';
  end if;

  v_plan:=v_grant.plan_payload;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.id::text is distinct from
        v_plan->>'evidence_assertion_id'
     or v_evidence.assertion_fingerprint is distinct from
        v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.subject_type <> v_target.subject_type
     or v_evidence.subject_id <> v_target.subject_id
  then
    raise exception using errcode='42501',
      message='Materialization evidence no longer satisfies the exact grant.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  if v_grant.operation_key='registry.artist.create' then
    if v_target.subject_type <> 'artist'
       or (v_plan - array[
         'operation_key','operation_version','artist_id',
         'display_name','normalized_name','slug',
         'collision_state_fingerprint',
         'evidence_assertion_id',
         'evidence_assertion_fingerprint',
         'trust_class','policy_ruleset_version'
       ]::text[]) <> '{}'::jsonb
       or (v_plan->>'artist_id')::uuid <> v_target.subject_id
       or nullif(btrim(v_plan->>'display_name'),'') is null
       or nullif(btrim(v_plan->>'normalized_name'),'') is null
       or nullif(btrim(v_plan->>'slug'),'') is null
    then
      raise exception using errcode='42501',
        message='Artist Create V1 plan is malformed.';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'registry.artist.create:' ||
        (v_plan->>'normalized_name'),
        0
      )
    );

    v_collision_state :=
      platform_private.registry_artist_creation_collision_state_v1(
        v_target.subject_id,
        v_plan->>'display_name'
      );
    v_collision_fingerprint :=
      platform_private.registry_identity_creation_collision_fingerprint_v1(
        v_collision_state
      );

    if v_collision_state <> '[]'::jsonb
       or v_collision_fingerprint is distinct from
          v_plan->>'collision_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='Artist identity collision state changed before execution.';
    end if;

    insert into public.registry_artists (
      id,slug,display_name,normalized_name,sort_name,
      status,metadata
    )
    values (
      v_target.subject_id,
      v_plan->>'slug',
      v_plan->>'display_name',
      v_plan->>'normalized_name',
      v_plan->>'display_name',
      'draft',
      '{}'::jsonb
    );

    get diagnostics v_rows=row_count;

    insert into public.registry_canonical_write_events (
      registry_entity_type,registry_entity_id,
      source_suggestion_id,source_table,
      field_name,target_path,before_value,after_value,
      action,status,actor
    )
    values (
      'artist',v_target.subject_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'identity','public.registry_artists',
      null,
      jsonb_build_object(
        'id',v_target.subject_id,
        'slug',v_plan->>'slug',
        'display_name',v_plan->>'display_name',
        'normalized_name',v_plan->>'normalized_name',
        'status','draft'
      ),
      'create_identity','succeeded',
      'system:'||p_actor_key
    )
    returning id into v_event_id;

  elsif v_grant.operation_key='registry.track.create' then
    if v_target.subject_type <> 'track'
       or (v_plan - array[
         'operation_key','operation_version','track_id',
         'title','normalized_title','slug','isrc',
         'identity_artist_id','collision_state_fingerprint',
         'evidence_assertion_id',
         'evidence_assertion_fingerprint',
         'trust_class','policy_ruleset_version'
       ]::text[]) <> '{}'::jsonb
       or (v_plan->>'track_id')::uuid <> v_target.subject_id
       or nullif(btrim(v_plan->>'title'),'') is null
       or nullif(btrim(v_plan->>'normalized_title'),'') is null
       or nullif(btrim(v_plan->>'slug'),'') is null
       or not exists (
         select 1 from public.registry_artists artist
         where artist.id=(v_plan->>'identity_artist_id')::uuid
           and artist.status <> 'archived'
       )
    then
      raise exception using errcode='42501',
        message='Track Create V1 plan is malformed.';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'registry.track.create:' ||
        coalesce(
          nullif(v_plan->>'isrc',''),
          (v_plan->>'normalized_title') || ':' ||
          (v_plan->>'identity_artist_id')
        ),
        0
      )
    );

    v_collision_state :=
      platform_private.registry_track_creation_collision_state_v1(
        v_target.subject_id,
        v_plan->>'title',
        (v_plan->>'identity_artist_id')::uuid,
        nullif(v_plan->>'isrc','')
      );
    v_collision_fingerprint :=
      platform_private.registry_identity_creation_collision_fingerprint_v1(
        v_collision_state
      );

    if v_collision_state <> '[]'::jsonb
       or v_collision_fingerprint is distinct from
          v_plan->>'collision_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='Track identity collision state changed before execution.';
    end if;

    insert into public.registry_tracks (
      id,slug,title,normalized_title,isrc,status,metadata
    )
    values (
      v_target.subject_id,
      v_plan->>'slug',
      v_plan->>'title',
      v_plan->>'normalized_title',
      nullif(v_plan->>'isrc',''),
      'draft',
      '{}'::jsonb
    );

    get diagnostics v_rows=row_count;

    insert into public.registry_canonical_write_events (
      registry_entity_type,registry_entity_id,
      source_suggestion_id,source_table,
      field_name,target_path,before_value,after_value,
      action,status,actor
    )
    values (
      'track',v_target.subject_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'identity','public.registry_tracks',
      null,
      jsonb_build_object(
        'id',v_target.subject_id,
        'slug',v_plan->>'slug',
        'title',v_plan->>'title',
        'normalized_title',v_plan->>'normalized_title',
        'isrc',nullif(v_plan->>'isrc',''),
        'status','draft'
      ),
      'create_identity','succeeded',
      'system:'||p_actor_key
    )
    returning id into v_event_id;

  elsif v_grant.operation_key=
        'registry.track_artist_credit.admit'
  then
    if v_target.subject_type <> 'track_artist_credit'
       or (v_plan - array[
         'operation_key','operation_version','credit_id',
         'track_id','artist_id','role','credit_order',
         'display_credit','confidence',
         'collision_state_fingerprint',
         'evidence_assertion_id',
         'evidence_assertion_fingerprint',
         'trust_class','policy_ruleset_version'
       ]::text[]) <> '{}'::jsonb
       or (v_plan->>'credit_id')::uuid <> v_target.subject_id
       or platform_private.registry_credit_role_v1(
            v_plan->>'role'
          ) is distinct from v_plan->>'role'
       or platform_private.registry_credit_order_v1(
            (v_plan->>'credit_order')::integer
          ) is distinct from
          (v_plan->>'credit_order')::integer
       or platform_private.registry_relation_confidence_v1(
            (v_plan->>'confidence')::integer
          ) is distinct from
          (v_plan->>'confidence')::integer
    then
      raise exception using errcode='42501',
        message='Track Artist Credit V1 plan is malformed.';
    end if;

    select artist.*
    into v_artist
    from public.registry_artists artist
    where artist.id=(v_plan->>'artist_id')::uuid
      and artist.status <> 'archived';

    if not found
       or not exists (
         select 1 from public.registry_tracks track
         where track.id=(v_plan->>'track_id')::uuid
           and track.status <> 'archived'
       )
    then
      raise exception using errcode='42501',
        message='Track Artist Credit V1 canonical endpoints are missing.';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'registry.track_artist_credit.admit:' ||
        (v_plan->>'track_id') || ':' ||
        (v_plan->>'artist_id'),
        0
      )
    );

    v_collision_state :=
      platform_private.registry_track_artist_credit_collision_state_v1(
        v_target.subject_id,
        (v_plan->>'track_id')::uuid,
        (v_plan->>'artist_id')::uuid
      );
    v_collision_fingerprint :=
      platform_private.registry_relation_collision_fingerprint_v1(
        v_collision_state
      );

    if v_collision_state <> '[]'::jsonb
       or v_collision_fingerprint is distinct from
          v_plan->>'collision_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='Track Artist credit collision state changed before execution.';
    end if;

    insert into public.registry_track_artists (
      id,track_id,artist_id,artist_slug,
      artist_name_text,role,is_primary,is_featured,
      credit_order,display_credit,source,confidence,
      status,metadata
    )
    values (
      v_target.subject_id,
      (v_plan->>'track_id')::uuid,
      (v_plan->>'artist_id')::uuid,
      v_artist.slug,
      v_artist.display_name,
      v_plan->>'role',
      (v_plan->>'role')='primary_artist',
      (v_plan->>'role')='featured_artist',
      (v_plan->>'credit_order')::integer,
      v_plan->>'display_credit',
      'chart_admission',
      (v_plan->>'confidence')::integer,
      'active',
      '{}'::jsonb
    );

    get diagnostics v_rows=row_count;

    insert into public.registry_canonical_write_events (
      registry_entity_type,registry_entity_id,
      source_suggestion_id,source_table,
      field_name,target_path,before_value,after_value,
      action,status,actor
    )
    values (
      'track_artist_credit',v_target.subject_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'relationship','public.registry_track_artists',
      null,
      jsonb_build_object(
        'id',v_target.subject_id,
        'track_id',(v_plan->>'track_id')::uuid,
        'artist_id',(v_plan->>'artist_id')::uuid,
        'role',v_plan->>'role',
        'credit_order',(v_plan->>'credit_order')::integer,
        'display_credit',v_plan->>'display_credit',
        'confidence',(v_plan->>'confidence')::integer,
        'status','active'
      ),
      'admit_relationship','succeeded',
      'system:'||p_actor_key
    )
    returning id into v_event_id;
  end if;

  if v_rows <> 1 or v_event_id is null then
    raise exception using errcode='40001',
      message='Registry materialization lost its exact one-row boundary.';
  end if;

  insert into platform_private.registry_operation_write_events (
    operation_id,canonical_write_event_id
  )
  values (v_operation.id,v_event_id);

  update platform_private.registry_mutation_operations
  set affected_rows=1,
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

create function
platform_private.verify_registry_materialization_v1(
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
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_plan jsonb;
  v_event_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.operation_key not in (
       'registry.artist.create',
       'registry.track.create',
       'registry.track_artist_credit.admit'
     )
     or v_operation.operation_version <> 1
  then
    raise exception using errcode='P0002',
      message='Registry materialization V1 operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status <> 'succeeded'
     or v_operation.affected_rows <> 1
  then
    v_failure:='operation_not_succeeded_exactly_once';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;

  if v_failure is null and not found then
    v_failure:='execution_grant_missing';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id=v_grant.id;

    if not found then
      v_failure:='exact_target_missing';
    end if;
  end if;

  if v_failure is null
     and v_operation.operation_key='registry.artist.create'
     and not exists (
       select 1
       from public.registry_artists artist
       where artist.id=v_target.subject_id
         and artist.slug=v_plan->>'slug'
         and artist.display_name=v_plan->>'display_name'
         and artist.normalized_name=v_plan->>'normalized_name'
         and artist.status='draft'
     )
  then
    v_failure:='canonical_artist_identity_mismatch';
  end if;

  if v_failure is null
     and v_operation.operation_key='registry.track.create'
     and not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_target.subject_id
         and track.slug=v_plan->>'slug'
         and track.title=v_plan->>'title'
         and track.normalized_title=v_plan->>'normalized_title'
         and track.isrc is not distinct from
             nullif(v_plan->>'isrc','')
         and track.status='draft'
     )
  then
    v_failure:='canonical_track_identity_mismatch';
  end if;

  if v_failure is null
     and v_operation.operation_key=
         'registry.track_artist_credit.admit'
     and not exists (
       select 1
       from public.registry_track_artists credit
       where credit.id=v_target.subject_id
         and credit.track_id=(v_plan->>'track_id')::uuid
         and credit.artist_id=(v_plan->>'artist_id')::uuid
         and credit.role=v_plan->>'role'
         and credit.credit_order=
             (v_plan->>'credit_order')::integer
         and credit.status='active'
     )
  then
    v_failure:='canonical_track_artist_credit_mismatch';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_id=v_target.subject_id::text
      and event.source_table=
          'platform_private.registry_evidence_assertions'
      and event.status='succeeded'
      and event.actor='system:'||v_operation.actor_key;

    if v_event_count <> 1 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set verifier_status='passed',
        result_payload=
          result_payload ||
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
  set verifier_status='failed',
      error_code='registry_materialization_verification_failed',
      error_message=v_failure,
      result_payload=
        result_payload ||
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
platform_private.ensure_registry_chart_artist_v1(
  p_run_id uuid,
  p_candidate_id uuid,
  p_artist_name text,
  p_source_payload jsonb,
  p_required_user_capability_key text
)
returns table (
  artist_id uuid,
  artist_slug text,
  created boolean,
  operation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_normalized text;
  v_slug text;
  v_existing_ids uuid[];
  v_future_id uuid;
  v_collision jsonb;
  v_collision_fp text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_source_ref text;
begin
  if p_run_id is null
     or p_candidate_id is null
     or nullif(btrim(p_artist_name),'') is null
  then
    raise exception using errcode='22023',
      message='Chart Artist materialization requires run, candidate, and name.';
  end if;

  v_normalized :=
    platform_private.registry_identity_normalize_text_v1(
      p_artist_name
    );
  v_slug :=
    platform_private.registry_artist_creation_slug_v1(
      p_artist_name
    );

  select array_agg(distinct artist.id)
  into v_existing_ids
  from public.registry_artists artist
  where artist.slug=v_slug
     or artist.normalized_name=v_normalized
     or platform_private.registry_identity_comparison_key_v1(
          artist.display_name
        ) =
        platform_private.registry_identity_comparison_key_v1(
          p_artist_name
        );

  if coalesce(cardinality(v_existing_ids),0) > 1 then
    raise exception using errcode='23505',
      message='Chart Artist identity is ambiguous in the Registry.';
  end if;

  if cardinality(v_existing_ids)=1 then
    select artist.id,artist.slug
    into artist_id,artist_slug
    from public.registry_artists artist
    where artist.id=v_existing_ids[1];

    created:=false;
    operation_id:=null;
    return next;
    return;
  end if;

  v_future_id:=gen_random_uuid();
  v_collision :=
    platform_private.registry_artist_creation_collision_state_v1(
      v_future_id,
      p_artist_name
    );
  if v_collision <> '[]'::jsonb then
    raise exception using errcode='23505',
      message='Chart Artist identity collided during resolution.';
  end if;

  v_collision_fp :=
    platform_private.registry_identity_creation_collision_fingerprint_v1(
      v_collision
    );
  v_source_ref :=
    'chart-run:'||p_run_id::text||
    ':candidate:'||p_candidate_id::text;

  v_evidence_id :=
    platform_private.record_registry_chart_user_evidence_v1(
      'artist',
      v_future_id,
      'registry.artist.identity.create',
      jsonb_build_object(
        'display_name',btrim(p_artist_name),
        'normalized_name',v_normalized,
        'slug',v_slug
      ),
      'EXTERNAL_EVIDENCE',
      'chart_ingest_candidate',
      v_source_ref,
      p_source_payload,
      p_required_user_capability_key
    );

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  v_plan:=jsonb_build_object(
    'operation_key','registry.artist.create',
    'operation_version',1,
    'artist_id',v_future_id::text,
    'display_name',btrim(p_artist_name),
    'normalized_name',v_normalized,
    'slug',v_slug,
    'collision_state_fingerprint',v_collision_fp,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',
      v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-materialization-v1'
  );

  v_grant_id :=
    platform_private.issue_registry_chart_user_execution_grant_v1(
      v_evidence.id,
      'registry.artist.create',
      'artist',
      v_future_id,
      v_plan,
      p_required_user_capability_key,
      'chart-artist:'||
        substr(v_evidence.assertion_fingerprint,1,40),
      null
    );

  select *
  into v_exec
  from platform_private.execute_registry_materialization_v1(
    'registry_chart_admission',
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_materialization_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status <> 'passed' then
    raise exception using errcode='40001',
      message='Chart Artist materialization verifier failed.';
  end if;

  artist_id:=v_future_id;
  artist_slug:=v_slug;
  created:=true;
  operation_id:=v_exec.operation_id;
  return next;
end
$$;

create function
platform_private.ensure_registry_chart_track_v1(
  p_run_id uuid,
  p_candidate_id uuid,
  p_title text,
  p_identity_artist_id uuid,
  p_isrc text,
  p_source_payload jsonb
)
returns table (
  track_id uuid,
  track_slug text,
  created boolean,
  operation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_normalized text;
  v_slug text;
  v_canonical_isrc text;
  v_existing_ids uuid[];
  v_future_id uuid;
  v_collision jsonb;
  v_collision_fp text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_source_ref text;
begin
  if p_run_id is null
     or p_candidate_id is null
     or p_identity_artist_id is null
     or nullif(btrim(p_title),'') is null
  then
    raise exception using errcode='22023',
      message='Chart Track materialization requires run, candidate, title, and primary Artist.';
  end if;

  if not exists (
    select 1 from public.registry_artists artist
    where artist.id=p_identity_artist_id
      and artist.status <> 'archived'
  ) then
    raise exception using errcode='P0002',
      message='Primary Artist does not exist for Track materialization.';
  end if;

  v_normalized :=
    platform_private.registry_identity_normalize_text_v1(
      p_title
    );

  begin
    v_canonical_isrc :=
      platform_private.registry_identity_canonical_isrc_v1(
        p_isrc
      );
  exception
    when sqlstate '22023' then
      v_canonical_isrc:=null;
  end;

  if v_canonical_isrc is not null then
    select array_agg(track.id)
    into v_existing_ids
    from public.registry_tracks track
    where track.isrc=v_canonical_isrc;
  else
    select array_agg(distinct track.id)
    into v_existing_ids
    from public.registry_tracks track
    join public.registry_track_artists credit
      on credit.track_id=track.id
    where platform_private.registry_identity_comparison_key_v1(
            track.title
          ) =
          platform_private.registry_identity_comparison_key_v1(
            p_title
          )
      and credit.artist_id=p_identity_artist_id
      and credit.is_primary;
  end if;

  if coalesce(cardinality(v_existing_ids),0) > 1 then
    raise exception using errcode='23505',
      message='Chart Track identity is ambiguous in the Registry.';
  end if;

  if cardinality(v_existing_ids)=1 then
    select track.id,track.slug
    into track_id,track_slug
    from public.registry_tracks track
    where track.id=v_existing_ids[1];

    created:=false;
    operation_id:=null;
    return next;
    return;
  end if;

  v_slug :=
    platform_private.registry_track_creation_slug_v1(
      p_title,
      p_identity_artist_id
    );

  if v_slug is null then
    raise exception using errcode='42501',
      message='Track identity slug cannot be derived from primary Artist.';
  end if;

  v_future_id:=gen_random_uuid();
  v_collision :=
    platform_private.registry_track_creation_collision_state_v1(
      v_future_id,
      p_title,
      p_identity_artist_id,
      v_canonical_isrc
    );
  if v_collision <> '[]'::jsonb then
    raise exception using errcode='23505',
      message='Chart Track identity collided during resolution.';
  end if;

  v_collision_fp :=
    platform_private.registry_identity_creation_collision_fingerprint_v1(
      v_collision
    );
  v_source_ref :=
    'chart-run:'||p_run_id::text||
    ':candidate:'||p_candidate_id::text;

  v_evidence_id :=
    platform_private.record_registry_chart_user_evidence_v1(
      'track',
      v_future_id,
      'registry.track.identity.create',
      jsonb_build_object(
        'title',btrim(p_title),
        'normalized_title',v_normalized,
        'slug',v_slug,
        'isrc',v_canonical_isrc,
        'identity_artist_id',p_identity_artist_id
      ),
      'EXTERNAL_EVIDENCE',
      'chart_ingest_candidate',
      v_source_ref,
      p_source_payload,
      'publish_charts'
    );

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  v_plan:=jsonb_build_object(
    'operation_key','registry.track.create',
    'operation_version',1,
    'track_id',v_future_id::text,
    'title',btrim(p_title),
    'normalized_title',v_normalized,
    'slug',v_slug,
    'isrc',coalesce(v_canonical_isrc,''),
    'identity_artist_id',p_identity_artist_id::text,
    'collision_state_fingerprint',v_collision_fp,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',
      v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-materialization-v1'
  );

  v_grant_id :=
    platform_private.issue_registry_chart_user_execution_grant_v1(
      v_evidence.id,
      'registry.track.create',
      'track',
      v_future_id,
      v_plan,
      'publish_charts',
      'chart-track:'||
        substr(v_evidence.assertion_fingerprint,1,40),
      null
    );

  select *
  into v_exec
  from platform_private.execute_registry_materialization_v1(
    'registry_chart_admission',
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_materialization_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status <> 'passed' then
    raise exception using errcode='40001',
      message='Chart Track materialization verifier failed.';
  end if;

  track_id:=v_future_id;
  track_slug:=v_slug;
  created:=true;
  operation_id:=v_exec.operation_id;
  return next;
end
$$;

create function
platform_private.ensure_registry_chart_track_credit_v1(
  p_run_id uuid,
  p_candidate_id uuid,
  p_track_id uuid,
  p_artist_id uuid,
  p_display_credit text,
  p_role text,
  p_credit_order integer,
  p_confidence integer,
  p_source_payload jsonb
)
returns table (
  credit_id uuid,
  created boolean,
  operation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_existing_ids uuid[];
  v_future_id uuid;
  v_role text;
  v_order integer;
  v_confidence integer;
  v_collision jsonb;
  v_collision_fp text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_source_ref text;
begin
  v_role :=
    platform_private.registry_credit_role_v1(p_role);
  v_order :=
    platform_private.registry_credit_order_v1(p_credit_order);
  v_confidence :=
    platform_private.registry_relation_confidence_v1(p_confidence);

  select array_agg(credit.id order by credit.created_at)
  into v_existing_ids
  from public.registry_track_artists credit
  where credit.track_id=p_track_id
    and credit.artist_id=p_artist_id;

  if coalesce(cardinality(v_existing_ids),0) > 1 then
    raise exception using errcode='23505',
      message='Track Artist relation is historically ambiguous.';
  end if;

  if cardinality(v_existing_ids)=1 then
    credit_id:=v_existing_ids[1];
    created:=false;
    operation_id:=null;
    return next;
    return;
  end if;

  v_future_id:=gen_random_uuid();
  v_collision :=
    platform_private.registry_track_artist_credit_collision_state_v1(
      v_future_id,
      p_track_id,
      p_artist_id
    );
  if v_collision <> '[]'::jsonb then
    raise exception using errcode='23505',
      message='Track Artist relation collided during resolution.';
  end if;

  v_collision_fp :=
    platform_private.registry_relation_collision_fingerprint_v1(
      v_collision
    );
  v_source_ref :=
    'chart-run:'||p_run_id::text||
    ':candidate:'||p_candidate_id::text;

  v_evidence_id :=
    platform_private.record_registry_chart_user_evidence_v1(
      'track_artist_credit',
      v_future_id,
      'registry.track_artist_credit',
      jsonb_build_object(
        'track_id',p_track_id,
        'artist_id',p_artist_id,
        'role',v_role,
        'credit_order',v_order,
        'display_credit',btrim(p_display_credit),
        'confidence',v_confidence
      ),
      'EXTERNAL_EVIDENCE',
      'chart_ingest_candidate',
      v_source_ref,
      p_source_payload,
      'publish_charts'
    );

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  v_plan:=jsonb_build_object(
    'operation_key','registry.track_artist_credit.admit',
    'operation_version',1,
    'credit_id',v_future_id::text,
    'track_id',p_track_id::text,
    'artist_id',p_artist_id::text,
    'role',v_role,
    'credit_order',v_order,
    'display_credit',btrim(p_display_credit),
    'confidence',v_confidence,
    'collision_state_fingerprint',v_collision_fp,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',
      v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-materialization-v1'
  );

  v_grant_id :=
    platform_private.issue_registry_chart_user_execution_grant_v1(
      v_evidence.id,
      'registry.track_artist_credit.admit',
      'track_artist_credit',
      v_future_id,
      v_plan,
      'publish_charts',
      'chart-credit:'||
        substr(v_evidence.assertion_fingerprint,1,40),
      null
    );

  select *
  into v_exec
  from platform_private.execute_registry_materialization_v1(
    'registry_chart_admission',
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_materialization_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status <> 'passed' then
    raise exception using errcode='40001',
      message='Chart Track Artist credit verifier failed.';
  end if;

  credit_id:=v_future_id;
  created:=true;
  operation_id:=v_exec.operation_id;
  return next;
end
$$;

create function
public.chart_materialize_candidate_registry_v1(
  p_run_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid:=auth.uid();
  v_candidate public.chart_ingest_candidates%rowtype;
  v_artist_names text[];
  v_artist_name text;
  v_artist record;
  v_track record;
  v_credit record;
  v_artist_ids uuid[]:=array[]::uuid[];
  v_artist_slugs text[]:=array[]::text[];
  v_artist_results jsonb:='[]'::jsonb;
  v_credit_results jsonb:='[]'::jsonb;
  v_source_payload jsonb;
  v_i integer;
begin
  if v_user_id is null
     or not coalesce(
       public.current_user_has_capability('publish_charts'),
       false
     )
  then
    raise exception using errcode='42501',
      message='publish_charts is required.';
  end if;

  select candidate.*
  into v_candidate
  from public.chart_ingest_candidates candidate
  where candidate.id=p_candidate_id
    and candidate.run_id=p_run_id
  for share;

  if not found
     or v_candidate.status <> 'eligible'
     or nullif(btrim(v_candidate.title),'') is null
     or nullif(btrim(v_candidate.artist_display),'') is null
  then
    raise exception using errcode='42501',
      message='Exact eligible chart candidate is required.';
  end if;

  v_artist_names :=
    platform_private.registry_chart_artist_names_v1(
      v_candidate.artist_display
    );

  if coalesce(cardinality(v_artist_names),0)=0 then
    raise exception using errcode='22023',
      message='Chart candidate has no materializable Artist identity.';
  end if;

  v_source_payload:=to_jsonb(v_candidate);

  for v_i in 1..cardinality(v_artist_names) loop
    v_artist_name:=v_artist_names[v_i];

    select *
    into v_artist
    from platform_private.ensure_registry_chart_artist_v1(
      p_run_id,
      p_candidate_id,
      v_artist_name,
      v_source_payload,
      'publish_charts'
    );

    v_artist_ids:=array_append(
      v_artist_ids,
      v_artist.artist_id
    );
    v_artist_slugs:=array_append(
      v_artist_slugs,
      v_artist.artist_slug
    );
    v_artist_results:=
      v_artist_results ||
      jsonb_build_array(
        jsonb_build_object(
          'artist_id',v_artist.artist_id,
          'artist_slug',v_artist.artist_slug,
          'artist_name',v_artist_name,
          'created',v_artist.created,
          'operation_id',v_artist.operation_id
        )
      );
  end loop;

  select *
  into v_track
  from platform_private.ensure_registry_chart_track_v1(
    p_run_id,
    p_candidate_id,
    v_candidate.title,
    v_artist_ids[1],
    v_candidate.isrc,
    v_source_payload
  );

  for v_i in 1..cardinality(v_artist_ids) loop
    select *
    into v_credit
    from platform_private.ensure_registry_chart_track_credit_v1(
      p_run_id,
      p_candidate_id,
      v_track.track_id,
      v_artist_ids[v_i],
      v_artist_names[v_i],
      case
        when v_i=1 then 'primary_artist'
        else 'featured_artist'
      end,
      v_i,
      case
        when v_i=1 then 100
        else 80
      end,
      v_source_payload
    );

    v_credit_results:=
      v_credit_results ||
      jsonb_build_array(
        jsonb_build_object(
          'credit_id',v_credit.credit_id,
          'artist_id',v_artist_ids[v_i],
          'created',v_credit.created,
          'operation_id',v_credit.operation_id
        )
      );
  end loop;

  return jsonb_build_object(
    'run_id',p_run_id,
    'candidate_id',p_candidate_id,
    'track_id',v_track.track_id,
    'track_slug',v_track.track_slug,
    'track_created',v_track.created,
    'track_operation_id',v_track.operation_id,
    'primary_artist_id',v_artist_ids[1],
    'primary_artist_slug',v_artist_slugs[1],
    'artists',v_artist_results,
    'credits',v_credit_results
  );
end
$$;

create function
public.chart_admit_artist_origin_v1(
  p_artist_id uuid,
  p_origin_iso2 text,
  p_run_id uuid,
  p_candidate_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_candidate public.chart_ingest_candidates%rowtype;
  v_artist public.registry_artists%rowtype;
  v_iso2 text;
  v_state_fp text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
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

  select candidate.*
  into v_candidate
  from public.chart_ingest_candidates candidate
  where candidate.id=p_candidate_id
    and candidate.run_id=p_run_id
  for share;

  if not found then
    raise exception using errcode='P0002',
      message='Chart origin evidence candidate was not found.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_artist_id;

  if not found
     or v_artist.status not in ('active','draft')
     or nullif(btrim(v_artist.origin_iso2),'') is not null
     or v_artist.origin_confidence is not null
  then
    raise exception using errcode='42501',
      message='Artist is not eligible for missing-origin admission.';
  end if;

  v_iso2:=upper(btrim(p_origin_iso2));
  if not platform_private.registry_is_valid_iso2(v_iso2) then
    raise exception using errcode='22023',
      message='Canonical ISO-3166-1 alpha-2 origin is required.';
  end if;

  v_evidence_id :=
    platform_private.record_registry_chart_user_evidence_v1(
      'artist',
      p_artist_id,
      'registry.artist.origin',
      jsonb_build_object(
        'origin_iso2',v_iso2,
        'origin_confidence',1.0
      ),
      'INTERNAL_FACT',
      'chart_origin_review',
      'chart-run:'||p_run_id::text||
        ':candidate:'||p_candidate_id::text,
      jsonb_build_object(
        'candidate',to_jsonb(v_candidate),
        'origin_iso2',v_iso2,
        'note',coalesce(p_note,'')
      ),
      'manage_registry'
    );

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  v_state_fp :=
    platform_private.registry_subject_state_fingerprint(
      'artist',
      p_artist_id
    );

  v_plan:=jsonb_build_object(
    'operation_key','registry.artist_origin.admit',
    'operation_version',1,
    'artist_id',p_artist_id::text,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',
      v_evidence.assertion_fingerprint,
    'proposed_origin_iso2',v_iso2,
    'proposed_origin_confidence',1.0,
    'expected_state_fingerprint',v_state_fp,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version',
      'registry-artist-origin-admission-v1'
  );

  v_grant_id :=
    platform_private.issue_registry_chart_user_execution_grant_v1(
      v_evidence.id,
      'registry.artist_origin.admit',
      'artist',
      p_artist_id,
      v_plan,
      'manage_registry',
      'chart-origin:'||
        substr(v_evidence.assertion_fingerprint,1,40),
      v_state_fp
    );

  select *
  into v_exec
  from platform_private.execute_registry_artist_origin_admission(
    'registry_chart_admission',
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_artist_origin_admission(
    v_exec.operation_id
  );

  if v_verify.verifier_status <> 'passed' then
    raise exception using errcode='40001',
      message='Chart Artist-origin verifier failed.';
  end if;

  return jsonb_build_object(
    'artist_id',p_artist_id,
    'origin_iso2',v_iso2,
    'origin_confidence',1.0,
    'operation_id',v_exec.operation_id,
    'verifier_status',v_verify.verifier_status
  );
end
$$;

create function
public.chart_create_artist_origin_shell_v1(
  p_artist_name text,
  p_origin_iso2 text,
  p_run_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_candidate public.chart_ingest_candidates%rowtype;
  v_names text[];
  v_name text;
  v_match boolean:=false;
  v_artist record;
  v_origin jsonb;
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

  select candidate.*
  into v_candidate
  from public.chart_ingest_candidates candidate
  where candidate.id=p_candidate_id
    and candidate.run_id=p_run_id
  for share;

  if not found then
    raise exception using errcode='P0002',
      message='Chart origin evidence candidate was not found.';
  end if;

  v_names :=
    platform_private.registry_chart_artist_names_v1(
      v_candidate.artist_display
    );

  foreach v_name in array v_names loop
    if platform_private.registry_identity_comparison_key_v1(v_name) =
       platform_private.registry_identity_comparison_key_v1(p_artist_name)
    then
      v_match:=true;
      exit;
    end if;
  end loop;

  if not v_match then
    raise exception using errcode='42501',
      message='Requested Artist is not an exact identity from the chart candidate.';
  end if;

  select *
  into v_artist
  from platform_private.ensure_registry_chart_artist_v1(
    p_run_id,
    p_candidate_id,
    p_artist_name,
    to_jsonb(v_candidate),
    'manage_registry'
  );

  v_origin :=
    public.chart_admit_artist_origin_v1(
      v_artist.artist_id,
      p_origin_iso2,
      p_run_id,
      p_candidate_id,
      'Created as draft identity from chart origin review.'
    );

  return jsonb_build_object(
    'artist_id',v_artist.artist_id,
    'artist_slug',v_artist.artist_slug,
    'artist_created',v_artist.created,
    'artist_operation_id',v_artist.operation_id,
    'origin',v_origin
  );
end
$$;

update platform_private.registry_operation_types
set enabled=true,
    updated_at=now()
where operation_key in (
  'registry.artist.create',
  'registry.track.create',
  'registry.track_artist_credit.admit'
)
  and operation_version=1;

-- Release family intentionally remains inert.
update platform_private.registry_operation_types
set enabled=false,
    updated_at=now()
where operation_key in (
  'registry.release.create',
  'registry.release_track.admit',
  'registry.release_artist_credit.admit'
)
  and operation_version=1;

revoke all on function
  platform_private.registry_chart_artist_names_v1(text)
from public,anon,authenticated,service_role;
revoke all on function
  platform_private.record_registry_chart_user_evidence_v1(
    text,uuid,text,jsonb,text,text,text,jsonb,text
  )
from public,anon,authenticated,service_role;
revoke all on function
  platform_private.issue_registry_chart_user_execution_grant_v1(
    uuid,text,text,uuid,jsonb,text,text,text
  )
from public,anon,authenticated,service_role;
revoke all on function
  platform_private.execute_registry_materialization_v1(text,uuid)
from public,anon,authenticated,service_role;
revoke all on function
  platform_private.verify_registry_materialization_v1(uuid)
from public,anon,authenticated,service_role;
revoke all on function
  platform_private.ensure_registry_chart_artist_v1(
    uuid,uuid,text,jsonb,text
  )
from public,anon,authenticated,service_role;
revoke all on function
  platform_private.ensure_registry_chart_track_v1(
    uuid,uuid,text,uuid,text,jsonb
  )
from public,anon,authenticated,service_role;
revoke all on function
  platform_private.ensure_registry_chart_track_credit_v1(
    uuid,uuid,uuid,uuid,text,text,integer,integer,jsonb
  )
from public,anon,authenticated,service_role;

revoke all on function
  public.chart_materialize_candidate_registry_v1(uuid,uuid)
from public,anon,authenticated,service_role;
grant execute on function
  public.chart_materialize_candidate_registry_v1(uuid,uuid)
to authenticated;

revoke all on function
  public.chart_admit_artist_origin_v1(
    uuid,text,uuid,uuid,text
  )
from public,anon,authenticated,service_role;
grant execute on function
  public.chart_admit_artist_origin_v1(
    uuid,text,uuid,uuid,text
  )
to authenticated;

revoke all on function
  public.chart_create_artist_origin_shell_v1(
    text,text,uuid,uuid
  )
from public,anon,authenticated,service_role;
grant execute on function
  public.chart_create_artist_origin_shell_v1(
    text,text,uuid,uuid
  )
to authenticated;

commit;
