-- MIZIZI Slice 2 Discography Exact-Set Authority V1
--
-- Installs the human exact-grant authority used by the Admin Artist
-- Discography workflow. Provider acquisition remains evidence production.
-- Canonical mutation occurs only through typed Registry operations.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-discography-exact-set-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.capability_definitions') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_release_artists') is null
     or to_regclass('public.registry_release_tracks') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('platform_private.system_actors') is null
     or to_regclass('platform_private.system_actor_executor_bindings') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
     or to_regprocedure('platform_private.registry_execution_grant_has_current_authority(uuid)') is null
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('platform_private.registry_identity_creation_collision_fingerprint_v1(jsonb)') is null
     or to_regprocedure('platform_private.registry_release_creation_collision_state_v1(uuid,text,uuid,text)') is null
     or to_regprocedure('platform_private.execute_registry_materialization_v1(text,uuid)') is null
     or to_regprocedure('platform_private.verify_registry_materialization_v1(uuid)') is null
  then
    raise exception 'STOP: accepted Slice-2 Registry governance foundation is missing';
  end if;

  if exists (
       select 1
       from public.capability_definitions
       where capability_key in (
         'apply_registry_discography_plan',
         'admit_registry_release_provider_profile',
         'admit_registry_track_provider_profile',
         'admit_registry_artist_discography_summary',
         'replace_registry_release_artist_set',
         'replace_registry_release_track_set',
         'replace_registry_track_artist_credit_set'
       )
     )
     or exists (
       select 1
       from platform_private.system_actors
       where actor_key = 'registry_discography_admin'
     )
     or exists (
       select 1
       from platform_private.registry_operation_types
       where operation_key in (
         'registry.discography.apply',
         'registry.release.provider_profile.admit',
         'registry.track.provider_profile.admit',
         'registry.artist.discography_summary.admit',
         'registry.release_artist_set.replace',
         'registry.release_track_set.replace',
         'registry.track_artist_credit_set.replace'
       )
     )
     or to_regprocedure('platform_private.registry_release_artist_set_v1(uuid)') is not null
     or to_regprocedure('platform_private.registry_release_track_set_v1(uuid)') is not null
     or to_regprocedure('platform_private.registry_track_artist_credit_set_v1(uuid)') is not null
     or to_regprocedure('platform_private.registry_discography_set_fingerprint_v1(jsonb)') is not null
     or to_regprocedure('platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)') is not null
     or to_regprocedure('platform_private.execute_registry_discography_operation_v1(uuid)') is not null
     or to_regprocedure('platform_private.verify_registry_discography_operation_v1(uuid)') is not null
  then
    raise exception 'STOP: Discography Exact-Set Authority V1 already exists';
  end if;

  if to_regprocedure('platform_private.execute_registry_materialization_core_v1(text,uuid)') is not null
     or to_regprocedure('platform_private.verify_registry_materialization_core_v1(uuid)') is not null
  then
    raise exception 'STOP: materialization core wrapper names are already occupied';
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
    'apply_registry_discography_plan',
    'Apply Registry discography plan',
    'Record one reviewed Artist discography orchestration whose child Registry operations are independently governed and verified.',
    'registry'
  ),
  (
    'admit_registry_release_provider_profile',
    'Admit Registry Release provider profile',
    'Admit the bounded Apple Music provider fact family for one existing Release.',
    'registry'
  ),
  (
    'admit_registry_track_provider_profile',
    'Admit Registry Track provider profile',
    'Admit the bounded Apple Music provider fact family for one existing Track.',
    'registry'
  ),
  (
    'admit_registry_artist_discography_summary',
    'Admit Registry Artist discography summary',
    'Admit the bounded Apple Music discography summary metadata for one existing Artist.',
    'registry'
  ),
  (
    'replace_registry_release_artist_set',
    'Replace Registry Release Artist set',
    'Replace one exact Release-to-Artist credit set from immutable reviewed evidence.',
    'registry'
  ),
  (
    'replace_registry_release_track_set',
    'Replace Registry Release Track set',
    'Replace one exact Release-to-Track membership set from immutable reviewed evidence.',
    'registry'
  ),
  (
    'replace_registry_track_artist_credit_set',
    'Replace Registry Track Artist credit set',
    'Replace one exact Track-to-Artist credit set from immutable reviewed evidence.',
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
  'registry_discography_admin',
  'Registry Discography Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain', 'registry',
    'operation_family', 'registry.discography',
    'authority_mode', 'human_exact_grant',
    'required_user_capability', 'manage_registry',
    'operation_versions', jsonb_build_object(
      'registry.discography.apply', 1,
      'registry.release.provider_profile.admit', 1,
      'registry.track.provider_profile.admit', 1,
      'registry.artist.discography_summary.admit', 1,
      'registry.release_artist_set.replace', 1,
      'registry.release_track_set.replace', 1,
      'registry.track_artist_credit_set.replace', 1,
      'registry.artist.create', 1,
      'registry.track.create', 1,
      'registry.release.create', 1
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
  'registry_discography_admin',
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
values
  (
    'registry.discography.apply',
    1,
    'apply_registry_discography_plan',
    'high',
    array['artist']::text[],
    true,
    1,
    1000,
    300,
    true,
    true,
    true,
    'Record one reviewed Artist discography orchestration after all child Registry operations are independently verified.'
  ),
  (
    'registry.release.provider_profile.admit',
    1,
    'admit_registry_release_provider_profile',
    'medium',
    array['release']::text[],
    true,
    1,
    1,
    300,
    true,
    true,
    true,
    'Admit bounded Apple Music provider facts for one existing Release.'
  ),
  (
    'registry.track.provider_profile.admit',
    1,
    'admit_registry_track_provider_profile',
    'medium',
    array['track']::text[],
    true,
    1,
    1,
    300,
    true,
    true,
    true,
    'Admit bounded Apple Music provider facts for one existing Track.'
  ),
  (
    'registry.artist.discography_summary.admit',
    1,
    'admit_registry_artist_discography_summary',
    'medium',
    array['artist']::text[],
    true,
    1,
    1,
    300,
    true,
    true,
    true,
    'Admit bounded Apple Music discography summary metadata for one existing Artist.'
  ),
  (
    'registry.release_artist_set.replace',
    1,
    'replace_registry_release_artist_set',
    'high',
    array['release']::text[],
    true,
    1,
    64,
    300,
    true,
    true,
    true,
    'Replace the exact complete Release-to-Artist credit set for one Release.'
  ),
  (
    'registry.release_track_set.replace',
    1,
    'replace_registry_release_track_set',
    'high',
    array['release']::text[],
    true,
    1,
    400,
    300,
    true,
    true,
    true,
    'Replace the exact complete Release-to-Track membership set for one Release.'
  ),
  (
    'registry.track_artist_credit_set.replace',
    1,
    'replace_registry_track_artist_credit_set',
    'high',
    array['track']::text[],
    true,
    1,
    64,
    300,
    true,
    true,
    true,
    'Replace the exact complete Track-to-Artist credit set for one Track.'
  );

update platform_private.registry_operation_types
set enabled = true,
    updated_at = now()
where operation_key = 'registry.release.create'
  and operation_version = 1
  and capability_key = 'create_registry_release'
  and allowed_subject_types = array['release']::text[]
  and not requires_existing_target
  and max_targets = 1
  and max_rows_ceiling = 1
  and max_grant_ttl_seconds = 300
  and requires_human_approval
  and requires_verifier;

do $release_create_contract$
begin
  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key = 'registry.release.create'
      and operation_type.operation_version = 1
      and operation_type.capability_key = 'create_registry_release'
      and operation_type.allowed_subject_types = array['release']::text[]
      and not operation_type.requires_existing_target
      and operation_type.max_targets = 1
      and operation_type.max_rows_ceiling = 1
      and operation_type.max_grant_ttl_seconds = 300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'STOP: Release Create V1 accepted operation contract is missing';
  end if;
end
$release_create_contract$;

alter function platform_private.execute_registry_materialization_v1(text,uuid)
  rename to execute_registry_materialization_core_v1;

alter function platform_private.verify_registry_materialization_v1(uuid)
  rename to verify_registry_materialization_core_v1;

create function platform_private.execute_registry_materialization_v1(
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
  v_grant platform_private.registry_execution_grants%rowtype;
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_collision_state jsonb;
  v_collision_fingerprint text;
  v_event_id uuid;
  v_rows integer;
begin
  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = p_execution_grant_id;

  if not found or v_grant.operation_key <> 'registry.release.create' then
    return query
    select *
    from platform_private.execute_registry_materialization_core_v1(
      p_actor_key,
      p_execution_grant_id
    );
    return;
  end if;

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

  if v_begin.idempotent_replay and v_operation.status = 'succeeded' then
    operation_id := v_operation.id;
    operation_status := v_operation.status;
    verifier_status := v_operation.verifier_status;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_operation.status <> 'authorized'
     or v_grant.actor_key <> p_actor_key
     or v_grant.operation_version <> 1
     or v_grant.capability_key <> 'create_registry_release'
     or v_grant.max_rows <> 1
     or v_grant.policy_ruleset_version <> 'registry-materialization-v1'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Release Create V1 materialization grant.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id = v_grant.id;

  if not found
     or v_target.subject_type <> 'release'
     or v_target.expected_state_fingerprint is not null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets t
       where t.execution_grant_id = v_grant.id
     ) <> 1
  then
    raise exception using errcode='42501',
      message='Release Create V1 requires one exact future Release target.';
  end if;

  v_plan := v_grant.plan_payload;

  if (v_plan - array[
       'operation_key','operation_version','release_id',
       'title','normalized_title','slug','upc','identity_artist_id',
       'collision_state_fingerprint','evidence_assertion_id',
       'evidence_assertion_fingerprint','trust_class',
       'policy_ruleset_version'
     ]::text[]) <> '{}'::jsonb
     or v_plan->>'operation_key' <> 'registry.release.create'
     or coalesce((v_plan->>'operation_version')::integer,0) <> 1
     or (v_plan->>'release_id')::uuid <> v_target.subject_id
     or nullif(btrim(v_plan->>'title'),'') is null
     or nullif(btrim(v_plan->>'normalized_title'),'') is null
     or nullif(btrim(v_plan->>'slug'),'') is null
     or (v_plan->>'identity_artist_id') is null
     or not exists (
       select 1
       from public.registry_artists artist
       where artist.id = (v_plan->>'identity_artist_id')::uuid
         and artist.status <> 'archived'
     )
  then
    raise exception using errcode='42501',
      message='Release Create V1 plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id = (v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type <> 'release'
     or v_evidence.subject_id <> v_target.subject_id
     or v_evidence.assertion_fingerprint is distinct from
        v_plan->>'evidence_assertion_fingerprint'
  then
    raise exception using errcode='42501',
      message='Release Create V1 evidence no longer satisfies the exact grant.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry.release.create:' ||
      coalesce(
        nullif(v_plan->>'upc',''),
        (v_plan->>'normalized_title') || ':' ||
        (v_plan->>'identity_artist_id')
      ),
      0
    )
  );

  v_collision_state :=
    platform_private.registry_release_creation_collision_state_v1(
      v_target.subject_id,
      v_plan->>'title',
      (v_plan->>'identity_artist_id')::uuid,
      nullif(v_plan->>'upc','')
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
      message='Release identity collision state changed before execution.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  insert into public.registry_releases (
    id,slug,title,normalized_title,upc,status,metadata
  )
  values (
    v_target.subject_id,
    v_plan->>'slug',
    v_plan->>'title',
    v_plan->>'normalized_title',
    nullif(v_plan->>'upc',''),
    'draft',
    '{}'::jsonb
  );

  get diagnostics v_rows = row_count;

  insert into public.registry_canonical_write_events (
    registry_entity_type,registry_entity_id,
    source_suggestion_id,source_table,
    field_name,target_path,before_value,after_value,
    action,status,actor
  )
  values (
    'release',v_target.subject_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'identity','public.registry_releases',
    null,
    jsonb_build_object(
      'id',v_target.subject_id,
      'slug',v_plan->>'slug',
      'title',v_plan->>'title',
      'normalized_title',v_plan->>'normalized_title',
      'upc',nullif(v_plan->>'upc',''),
      'status','draft'
    ),
    'create_identity','succeeded',
    'system:'||p_actor_key
  )
  returning id into v_event_id;

  if v_rows <> 1 or v_event_id is null then
    raise exception using errcode='40001',
      message='Release Create V1 lost its exact one-row boundary.';
  end if;

  insert into platform_private.registry_operation_write_events (
    operation_id,canonical_write_event_id
  ) values (v_operation.id,v_event_id);

  update platform_private.registry_mutation_operations
  set affected_rows=1,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'subject_type','release',
        'subject_id',v_target.subject_id,
        'evidence_assertion_id',v_evidence.id,
        'canonical_write_event_id',v_event_id
      ),
      completed_at=now(),
      updated_at=now()
  where id=v_operation.id;

  operation_id := v_operation.id;
  operation_status := 'succeeded';
  verifier_status := 'pending';
  idempotent_replay := v_begin.idempotent_replay;
  return next;
end
$$;

create function platform_private.verify_registry_materialization_v1(
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
  where operation.id = p_operation_id;

  if not found or v_operation.operation_key <> 'registry.release.create' then
    return query
    select *
    from platform_private.verify_registry_materialization_core_v1(
      p_operation_id
    );
    return;
  end if;

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id = p_operation_id
  for update;

  if v_operation.verifier_status = 'passed' then
    operation_id := v_operation.id;
    verifier_status := 'passed';
    return next;
    return;
  end if;

  if v_operation.operation_version <> 1
     or v_operation.status <> 'succeeded'
     or v_operation.affected_rows <> 1
  then
    v_failure := 'operation_not_succeeded_exactly_once';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = v_operation.execution_grant_id;

  if v_failure is null and not found then
    v_failure := 'execution_grant_missing';
  end if;

  if v_failure is null then
    v_plan := v_grant.plan_payload;
    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_grant.id;
    if not found then
      v_failure := 'exact_target_missing';
    end if;
  end if;

  if v_failure is null and not exists (
    select 1
    from public.registry_releases release
    where release.id = v_target.subject_id
      and release.slug = v_plan->>'slug'
      and release.title = v_plan->>'title'
      and release.normalized_title = v_plan->>'normalized_title'
      and release.upc is not distinct from nullif(v_plan->>'upc','')
      and release.status = 'draft'
  ) then
    v_failure := 'canonical_release_identity_mismatch';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id = link.canonical_write_event_id
    where link.operation_id = v_operation.id
      and event.registry_entity_type = 'release'
      and event.registry_entity_id = v_target.subject_id::text
      and event.source_table = 'platform_private.registry_evidence_assertions'
      and event.status = 'succeeded'
      and event.actor = 'system:'||v_operation.actor_key;

    if v_event_count <> 1 then
      v_failure := 'canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set verifier_status='passed',
        result_payload=result_payload || jsonb_build_object(
          'verification',jsonb_build_object(
            'status','passed','verified_at',now()
          )
        ),
        updated_at=now()
    where id=v_operation.id;

    operation_id := v_operation.id;
    verifier_status := 'passed';
    return next;
    return;
  end if;

  update platform_private.registry_mutation_operations
  set verifier_status='failed',
      error_code='registry_materialization_verification_failed',
      error_message=v_failure,
      result_payload=result_payload || jsonb_build_object(
        'verification',jsonb_build_object(
          'status','failed','reason',v_failure,'verified_at',now()
        )
      ),
      updated_at=now()
  where id=v_operation.id;

  operation_id := v_operation.id;
  verifier_status := 'failed';
  return next;
end
$$;

create function platform_private.registry_release_artist_set_v1(
  p_release_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', credit.id,
        'release_id', credit.release_id,
        'artist_id', credit.artist_id,
        'artist_slug', credit.artist_slug,
        'artist_name_text', credit.artist_name_text,
        'role', credit.role,
        'is_primary', credit.is_primary,
        'is_featured', credit.is_featured,
        'credit_order', credit.credit_order,
        'display_credit', credit.display_credit,
        'source', credit.source,
        'confidence', credit.confidence,
        'status', credit.status,
        'metadata', credit.metadata
      )
      order by credit.id::text
    ),
    '[]'::jsonb
  )
  from public.registry_release_artists credit
  where credit.release_id = p_release_id;
$$;

create function platform_private.registry_release_track_set_v1(
  p_release_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', membership.id,
        'release_id', membership.release_id,
        'track_id', membership.track_id,
        'disc_number', membership.disc_number,
        'track_number', membership.track_number,
        'source', membership.source,
        'confidence', membership.confidence,
        'status', membership.status,
        'metadata', membership.metadata
      )
      order by membership.id::text
    ),
    '[]'::jsonb
  )
  from public.registry_release_tracks membership
  where membership.release_id = p_release_id;
$$;

create function platform_private.registry_track_artist_credit_set_v1(
  p_track_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', credit.id,
        'track_id', credit.track_id,
        'artist_id', credit.artist_id,
        'artist_slug', credit.artist_slug,
        'artist_name_text', credit.artist_name_text,
        'role', credit.role,
        'is_primary', credit.is_primary,
        'is_featured', credit.is_featured,
        'credit_order', credit.credit_order,
        'display_credit', credit.display_credit,
        'source', credit.source,
        'confidence', credit.confidence,
        'status', credit.status,
        'metadata', credit.metadata
      )
      order by credit.id::text
    ),
    '[]'::jsonb
  )
  from public.registry_track_artists credit
  where credit.track_id = p_track_id;
$$;

create function platform_private.registry_discography_set_fingerprint_v1(
  p_set jsonb
)
returns text
language sql
immutable
security definer
set search_path = pg_catalog, extensions
as $$
  select encode(
    extensions.digest(
      case
        when p_set is null then '[]'::jsonb::text
        when jsonb_typeof(p_set) = 'array' then
          coalesce(
            (
              select jsonb_agg(item order by coalesce(item->>'id',''), item::text)::text
              from jsonb_array_elements(p_set) item
            ),
            '[]'::jsonb::text
          )
        else p_set::text
      end,
      'sha256'
    ),
    'hex'
  );
$$;

create function platform_private.issue_registry_discography_user_execution_grant_v1(
  p_evidence_assertion_id uuid,
  p_operation_key text,
  p_subject_type text,
  p_subject_id uuid,
  p_plan_payload jsonb,
  p_idempotency_key text,
  p_max_rows integer
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
  v_expected_state_fingerprint text;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_ruleset text;
  v_grant_id uuid;
begin
  if v_user_id is null
     or p_evidence_assertion_id is null
     or p_subject_id is null
     or p_plan_payload is null
     or jsonb_typeof(p_plan_payload) <> 'object'
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     or p_max_rows is null
     or p_max_rows < 1
  then
    raise exception using errcode='22023',
      message='Valid user, evidence, plan, subject, idempotency key, and row budget are required.';
  end if;

  if not coalesce(public.current_user_has_capability('manage_registry'),false) then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_discography_admin'
         and actor.status='active'
     )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key='registry_discography_admin'
         and binding.executor_kind='database_role'
         and binding.executor_key=session_user
         and binding.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Registry discography admin broker is not active.';
  end if;

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key=p_operation_key
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or not (p_subject_type = any(v_operation_type.allowed_subject_types))
     or p_max_rows > v_operation_type.max_rows_ceiling
  then
    raise exception using errcode='42501',
      message='Typed Discography Registry operation is disabled, malformed, or exceeds its row ceiling.';
  end if;

  if p_operation_key not in (
       'registry.discography.apply',
       'registry.release.provider_profile.admit',
       'registry.track.provider_profile.admit',
       'registry.artist.discography_summary.admit',
       'registry.release_artist_set.replace',
       'registry.release_track_set.replace',
       'registry.track_artist_credit_set.replace',
       'registry.artist.create',
       'registry.track.create',
       'registry.release.create'
     )
  then
    raise exception using errcode='42501',
      message='Operation is outside Discography V1.';
  end if;

  if p_operation_key = 'registry.artist.create'
     and (v_operation_type.capability_key <> 'create_registry_artist' or p_subject_type <> 'artist' or p_max_rows <> 1)
     or p_operation_key = 'registry.track.create'
     and (v_operation_type.capability_key <> 'create_registry_track' or p_subject_type <> 'track' or p_max_rows <> 1)
     or p_operation_key = 'registry.release.create'
     and (v_operation_type.capability_key <> 'create_registry_release' or p_subject_type <> 'release' or p_max_rows <> 1)
  then
    raise exception using errcode='42501',
      message='Discography materialization operation/capability pair is invalid.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.recorded_by_principal_key <> 'user:'||v_user_id::text
     or v_evidence.trust_class not in ('EXTERNAL_EVIDENCE','INTERNAL_FACT')
  then
    raise exception using errcode='42501',
      message='Evidence is not bound to the current discography user.';
  end if;

  if p_operation_key in ('registry.artist.create','registry.track.create','registry.release.create') then
    if v_evidence.subject_type <> p_subject_type
       or v_evidence.subject_id <> p_subject_id
    then
      raise exception using errcode='42501',
        message='Materialization evidence is not bound to the exact future subject.';
    end if;
    v_expected_state_fingerprint := null;
    v_ruleset := 'registry-materialization-v1';
  else
    if not platform_private.registry_subject_exists(p_subject_type,p_subject_id) then
      raise exception using errcode='42501',
        message='Discography exact operation target does not exist.';
    end if;
    v_expected_state_fingerprint :=
      platform_private.registry_subject_state_fingerprint(
        p_subject_type,
        p_subject_id
      );
    v_ruleset := 'registry-discography-exact-set-v1';
  end if;

  if p_plan_payload->>'operation_key' is distinct from p_operation_key
     or coalesce((p_plan_payload->>'operation_version')::integer,0) <> 1
     or p_plan_payload->>'evidence_assertion_id' is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint' is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'trust_class' is distinct from v_evidence.trust_class
     or p_plan_payload->>'policy_ruleset_version' is distinct from v_ruleset
     or (
       v_expected_state_fingerprint is not null
       and p_plan_payload->>'expected_state_fingerprint' is distinct from v_expected_state_fingerprint
     )
  then
    raise exception using errcode='42501',
      message='Exact Discography execution plan is not bound to current evidence/state authority.';
  end if;

  v_plan_fingerprint :=
    platform_private.registry_plan_fingerprint(p_plan_payload);
  v_target_fingerprint := encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type',p_subject_type,
          'subject_id',p_subject_id::text,
          'expected_state_fingerprint',v_expected_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_discography_admin'
    and execution_grant.operation_key=p_operation_key
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=p_idempotency_key;

  if found then
    if v_existing.issued_by_user_id <> v_user_id
       or v_existing.plan_fingerprint <> v_plan_fingerprint
       or v_existing.target_set_fingerprint <> v_target_fingerprint
       or v_existing.max_rows <> p_max_rows
    then
      raise exception using errcode='23505',
        message='Discography Registry idempotency key is bound to different authority.';
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
    'registry_discography_admin',v_operation_type.capability_key,null,
    p_operation_key,1,p_plan_payload,v_plan_fingerprint,
    v_target_fingerprint,p_max_rows,p_idempotency_key,'active',
    v_user_id,'user:'||v_user_id::text,v_ruleset,
    'manage_registry',now(),now()+interval '5 minutes'
  )
  returning id into v_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,subject_type,subject_id,expected_state_fingerprint
  ) values (
    v_grant_id,p_subject_type,p_subject_id,v_expected_state_fingerprint
  );

  return v_grant_id;
end
$$;

-- The exact-set/provider-fact executor and verifier are installed by the
-- paired review-authority migration after immutable provider evidence storage
-- exists.

revoke all on function platform_private.execute_registry_materialization_core_v1(text,uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.verify_registry_materialization_core_v1(uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.execute_registry_materialization_v1(text,uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.verify_registry_materialization_v1(uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.registry_release_artist_set_v1(uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.registry_release_track_set_v1(uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.registry_track_artist_credit_set_v1(uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.registry_discography_set_fingerprint_v1(jsonb) from public, anon, authenticated, service_role;
revoke all on function platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer) from public, anon, authenticated, service_role;

commit;
