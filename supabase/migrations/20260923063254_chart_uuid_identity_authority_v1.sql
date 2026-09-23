-- Chart UUID identity authority V1.
--
-- This migration removes title/Artist normalized text as a canonical Chart
-- identity primitive. Chart observations may share normalized presentation
-- text; one accepted Registry Track UUID is the canonical run-level identity.
--
-- It also separates publication from Registry mutation:
--   * publish_charts projects already-governed Registry identity;
--   * manage_registry is required for Chart-originated Artist/Track/credit
--     admission;
--   * origin, playback and commit validation resolve through accepted Track
--     UUIDs and Registry credits, never candidate display text.
--
-- Runtime companion: supabase/functions/chart-ingest-api/index.ts

begin;

do $preflight$
begin
  if to_regclass('public.chart_ingest_candidates') is null
     or to_regclass('public.chart_ingest_matches') is null
     or to_regclass('public.chart_ingest_exclusions') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_artists') is null
  then
    raise exception
      'STOP: Chart UUID identity authority dependencies are missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.chart_ingest_candidates'::regclass
      and conname='chart_ingest_candidates_run_id_normalized_key_key'
  ) then
    raise exception
      'STOP: expected normalized-key uniqueness authority is already absent';
  end if;

  if to_regprocedure(
       'public.resolve_registry_identity_lineage_v1(text,uuid,integer)'
     ) is null
     or to_regprocedure(
       'public.chart_get_run_integrity_report(text)'
     ) is null
     or to_regprocedure(
       'public.chart_get_run_candidate_origin_report(text)'
     ) is null
     or to_regprocedure(
       'public.chart_get_run_origin_review_queue(text)'
     ) is null
     or to_regprocedure(
       'public.chart_get_run_playback_readiness(text,text)'
     ) is null
     or to_regprocedure(
       'public.chart_materialize_candidate_registry_v1(uuid,uuid)'
     ) is null
  then
    raise exception
      'STOP: expected Chart identity function family is incomplete';
  end if;

  if exists (
    select 1
    from public.chart_ingest_matches m
    where m.entity_type='track'
      and m.status='accepted'
      and (
        m.canonical_entity_id is null
        or m.canonical_entity_id !~*
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
  ) then
    raise exception
      'STOP: accepted Chart Track matches contain non-UUID canonical identity';
  end if;

  if exists (
    select 1
    from public.chart_ingest_matches m
    where m.entity_type='track'
      and m.status='accepted'
      and m.canonical_entity_id is not null
    group by m.run_id,m.canonical_entity_id
    having count(*)>1
  ) then
    raise exception
      'STOP: accepted Chart Track UUID is duplicated inside a run';
  end if;
end
$preflight$;

alter table public.chart_ingest_candidates
  drop constraint chart_ingest_candidates_run_id_normalized_key_key;

create index if not exists idx_cicd_run_normalized_key
  on public.chart_ingest_candidates(run_id,normalized_key);

alter table public.chart_ingest_matches
  drop constraint chart_ingest_matches_match_method_check;

alter table public.chart_ingest_matches
  add constraint chart_ingest_matches_match_method_check
  check (
    match_method = any (
      array[
        'isrc'::text,
        'provider_id'::text,
        'title_artist'::text,
        'fuzzy'::text,
        'manual'::text,
        'shell'::text,
        'canonical_history'::text,
        'no_match'::text
      ]
    )
  );

alter table public.chart_ingest_matches
  add constraint chart_ingest_matches_accepted_track_uuid_check
  check (
    entity_type <> 'track'
    or status <> 'accepted'
    or (
      canonical_entity_id is not null
      and canonical_entity_id ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  ) not valid;

alter table public.chart_ingest_matches
  validate constraint chart_ingest_matches_accepted_track_uuid_check;

create unique index
  chart_ingest_matches_run_accepted_track_uuid_uidx
on public.chart_ingest_matches(run_id,canonical_entity_id)
where entity_type='track'
  and status='accepted'
  and canonical_entity_id is not null;

alter table public.chart_ingest_exclusions
  drop constraint chart_ingest_exclusions_reason_code_check;

alter table public.chart_ingest_exclusions
  add constraint chart_ingest_exclusions_reason_code_check
  check (
    reason_code = any (
      array[
        'missing_release_date'::text,
        'release_window_mismatch'::text,
        'future_release_date'::text,
        'explicit_track_not_allowed'::text,
        'missing_isrc'::text,
        'missing_preview'::text,
        'release_type_not_allowed'::text,
        'country_mismatch'::text,
        'gender_mismatch'::text,
        'artist_type_mismatch'::text,
        'missing_artist_country'::text,
        'filter_eliminated_all_candidates'::text,
        'streaming_min_sources'::text,
        'airplay_min_stations'::text,
        'airplay_min_detections'::text,
        'stale_carry_forward'::text,
        'continuity_locked'::text,
        'duplicate_track'::text,
        'manual_exclude'::text,
        'invalid_normalized_key'::text,
        'missing_title'::text,
        'missing_artist'::text,
        'missing_artist_credits'::text,
        'no_streaming_sources'::text,
        'nonpositive_score'::text,
        'below_chart_cutoff'::text
      ]
    )
  );

CREATE OR REPLACE FUNCTION platform_private.record_registry_chart_user_evidence_v1(p_subject_type text, p_subject_id uuid, p_claim_key text, p_claim_payload jsonb, p_trust_class text, p_source_kind text, p_source_ref text, p_source_payload jsonb, p_required_user_capability_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private', 'auth', 'extensions'
AS $function$
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

  if p_required_user_capability_key <> 'manage_registry'
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
       'chart_origin_review',
       'chart_artist_resolution_review'
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
$function$

CREATE OR REPLACE FUNCTION platform_private.issue_registry_chart_user_execution_grant_v1(p_evidence_assertion_id uuid, p_operation_key text, p_subject_type text, p_subject_id uuid, p_plan_payload jsonb, p_required_user_capability_key text, p_idempotency_key text, p_expected_state_fingerprint text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private', 'auth', 'extensions'
AS $function$
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

  if p_required_user_capability_key <> 'manage_registry'
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
         or p_required_user_capability_key <> 'manage_registry'
       )
     )
     or (
       p_operation_key='registry.track.create'
       and (
         v_operation_type.capability_key <>
           'create_registry_track'
         or p_subject_type <> 'track'
         or p_required_user_capability_key <> 'manage_registry'
       )
     )
     or (
       p_operation_key='registry.track_artist_credit.admit'
       and (
         v_operation_type.capability_key <>
           'admit_registry_track_artist_credit'
         or p_subject_type <> 'track_artist_credit'
         or p_required_user_capability_key <> 'manage_registry'
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
$function$

CREATE OR REPLACE FUNCTION platform_private.ensure_registry_chart_track_v1(p_run_id uuid, p_candidate_id uuid, p_title text, p_identity_artist_id uuid, p_isrc text, p_source_payload jsonb)
 RETURNS TABLE(track_id uuid, track_slug text, created boolean, operation_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private'
AS $function$
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
      'manage_registry'
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
      'manage_registry',
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
$function$

CREATE OR REPLACE FUNCTION platform_private.ensure_registry_chart_track_credit_v1(p_run_id uuid, p_candidate_id uuid, p_track_id uuid, p_artist_id uuid, p_display_credit text, p_role text, p_credit_order integer, p_confidence integer, p_source_payload jsonb)
 RETURNS TABLE(credit_id uuid, created boolean, operation_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private'
AS $function$
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
      'manage_registry'
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
      'manage_registry',
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
$function$

CREATE OR REPLACE FUNCTION public.chart_materialize_candidate_registry_v1(p_run_id uuid, p_candidate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private', 'auth', 'extensions'
AS $function$
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
  where candidate.id=p_candidate_id::text
    and candidate.run_id=p_run_id::text
  for share;

  if not found
     or v_candidate.status not in ('pending','needs_review','eligible')
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
      'manage_registry'
    );

    v_artist_ids:=array_append(v_artist_ids,v_artist.artist_id);
    v_artist_slugs:=array_append(v_artist_slugs,v_artist.artist_slug);
    v_artist_results:=v_artist_results || jsonb_build_array(
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
      case when v_i=1 then 'primary_artist' else 'featured_artist' end,
      v_i,
      case when v_i=1 then 100 else 80 end,
      v_source_payload
    );

    v_credit_results:=v_credit_results || jsonb_build_array(
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
$function$

CREATE OR REPLACE FUNCTION public.admin_apply_chart_artist_resolution_decision(p_decision_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private', 'auth', 'extensions'
AS $function$
declare
  v_user_id uuid:=auth.uid();
  v_decision public.chart_artist_resolution_decisions%rowtype;
  v_entry public.wk_chart_entries_v2%rowtype;
  v_required_capability text;
  v_selected_count integer:=0;
  v_primary_selected_count integer:=0;
  v_existing_primary_count integer:=0;
  v_existing_primary_artist_id uuid;
  v_track_inserted integer:=0;
  v_track_existing integer:=0;
  v_selected record;
  v_artist public.registry_artists%rowtype;
  v_existing_credit public.registry_track_artists%rowtype;
  v_existing_pair_count integer;
  v_future_id uuid;
  v_future_hex text;
  v_collision jsonb;
  v_collision_fp text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
  v_operation_ids jsonb:='[]'::jsonb;
  v_primary_artist public.registry_artists%rowtype;
  v_result jsonb;
begin
  if v_user_id is null
     or not (
       coalesce(public.current_user_has_capability('manage_charts'),false)
       or coalesce(public.current_user_has_capability('manage_registry'),false)
       or coalesce(public.current_user_is_administrator(),false)
     )
  then
    raise exception using errcode='42501', message='insufficient_privilege';
  end if;

  v_required_capability:=case
    when coalesce(public.current_user_has_capability('manage_registry'),false)
      then 'manage_registry'
    when coalesce(public.current_user_has_capability('manage_registry'),false)
      then 'manage_registry'
    else null
  end;

  if v_required_capability is null then
    raise exception using errcode='42501',
      message='Current Chart resolver lacks an exact Registry grant capability.';
  end if;

  select decision.*
  into v_decision
  from public.chart_artist_resolution_decisions decision
  where decision.id=p_decision_id
  for update;

  if not found then raise exception 'decision_not_found'; end if;

  select entry.*
  into v_entry
  from public.wk_chart_entries_v2 entry
  where entry.id::text=v_decision.chart_entry_id
  for update;

  if not found then raise exception 'chart_entry_not_found'; end if;

  if v_decision.decision_status='resolved' then
    return coalesce(
      v_decision.apply_result_json,
      jsonb_build_object(
        'decisionId',v_decision.id,
        'alreadyResolved',true
      )
    );
  end if;

  if v_decision.decision_type='accepted_as_group' then
    v_result:=jsonb_build_object(
      'decisionId',v_decision.id,
      'chartEntryId',v_decision.chart_entry_id,
      'decisionType',v_decision.decision_type,
      'trackCreditsInserted',0,
      'trackCreditsExisting',0,
      'operationIds','[]'::jsonb,
      'message','Accepted as group/collab. No Registry credits were changed.'
    );

    update public.chart_artist_resolution_decisions
    set decision_status='resolved',
        applied_at=now(),
        apply_result_json=v_result,
        updated_at=now()
    where id=v_decision.id;

    return v_result;
  end if;

  if v_decision.decision_type not in ('split_plan','alias_plan') then
    raise exception 'decision_type_not_applyable';
  end if;

  if jsonb_typeof(coalesce(v_decision.selected_artists,'null'::jsonb))<>'array'
     or jsonb_array_length(v_decision.selected_artists)=0
  then
    raise exception 'selected_artists_required';
  end if;

  if v_entry.canonical_track_id is null
     or btrim(v_entry.canonical_track_id::text)=''
     or not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_entry.canonical_track_id::uuid
         and track.status<>'archived'
     )
  then
    raise exception 'canonical_track_required';
  end if;

  create temporary table if not exists
    pg_temp.chart_artist_resolution_selected_artists_v2 (
      artist_id uuid primary key,
      role text not null,
      credit_order integer not null,
      display_credit text
    ) on commit drop;

  truncate table pg_temp.chart_artist_resolution_selected_artists_v2;

  insert into pg_temp.chart_artist_resolution_selected_artists_v2 (
    artist_id,role,credit_order,display_credit
  )
  select distinct on ((item.value->>'artist_id')::uuid)
    (item.value->>'artist_id')::uuid,
    coalesce(
      nullif(item.value->>'role',''),
      case when item.ordinality=1
        then 'primary_artist'
        else 'featured_artist'
      end
    ),
    coalesce(
      nullif(item.value->>'credit_order','')::integer,
      item.ordinality::integer
    ),
    nullif(item.value->>'display_name','')
  from jsonb_array_elements(v_decision.selected_artists)
       with ordinality as item(value,ordinality)
  where nullif(item.value->>'artist_id','') is not null
  order by (item.value->>'artist_id')::uuid,item.ordinality;

  select count(*) into v_selected_count
  from pg_temp.chart_artist_resolution_selected_artists_v2;

  select count(*) into v_primary_selected_count
  from pg_temp.chart_artist_resolution_selected_artists_v2
  where role='primary_artist';

  if v_selected_count=0 or v_primary_selected_count<>1 then
    raise exception 'exactly_one_primary_selected_artist_required';
  end if;

  if exists (
       select 1
       from pg_temp.chart_artist_resolution_selected_artists_v2 selected
       left join public.registry_artists artist
         on artist.id=selected.artist_id
        and artist.status<>'archived'
       where artist.id is null
          or selected.role not in ('primary_artist','featured_artist')
          or selected.credit_order<1
     )
  then
    raise exception 'selected_artist_or_credit_semantics_invalid';
  end if;

  select count(*)::integer
  into v_existing_primary_count
  from public.registry_track_artists credit
  where credit.track_id=v_entry.canonical_track_id::uuid
    and credit.status<>'archived'
    and credit.is_primary is true;

  if v_existing_primary_count=1 then
    select credit.artist_id
    into v_existing_primary_artist_id
    from public.registry_track_artists credit
    where credit.track_id=v_entry.canonical_track_id::uuid
      and credit.status<>'archived'
      and credit.is_primary is true
    limit 1;
  end if;

  if v_existing_primary_count>1 then
    raise exception using errcode='23514',
      message='Chart Track has multiple live primary credits and requires reviewed credit reconciliation.';
  end if;

  if v_existing_primary_count=1
     and v_existing_primary_artist_id is distinct from (
       select artist_id
       from pg_temp.chart_artist_resolution_selected_artists_v2
       where role='primary_artist'
     )
  then
    raise exception using errcode='23514',
      message='Chart Artist Resolution cannot replace a different live primary credit through admission authority.';
  end if;

  for v_selected in
    select *
    from pg_temp.chart_artist_resolution_selected_artists_v2
    order by credit_order,artist_id
  loop
    select artist.*
    into v_artist
    from public.registry_artists artist
    where artist.id=v_selected.artist_id
      and artist.status<>'archived';

    select count(*)::integer
    into v_existing_pair_count
    from public.registry_track_artists credit
    where credit.track_id=v_entry.canonical_track_id::uuid
      and credit.artist_id=v_selected.artist_id
      and credit.status<>'archived';

    if v_existing_pair_count>1 then
      raise exception using errcode='23514',
        message='Chart Track has ambiguous live Artist-credit rows.';
    end if;

    if v_existing_pair_count=1 then
      select credit.*
      into v_existing_credit
      from public.registry_track_artists credit
      where credit.track_id=v_entry.canonical_track_id::uuid
        and credit.artist_id=v_selected.artist_id
        and credit.status<>'archived'
      limit 1;

      if v_existing_credit.role is distinct from v_selected.role
         or v_existing_credit.is_primary is distinct from
            (v_selected.role='primary_artist')
         or v_existing_credit.is_featured is distinct from
            (v_selected.role='featured_artist')
         or v_existing_credit.credit_order is distinct from
            v_selected.credit_order
      then
        raise exception using errcode='23514',
          message='Existing Chart Track credit conflicts with the reviewed resolution and requires reconciliation.';
      end if;

      v_track_existing:=v_track_existing+1;
      continue;
    end if;

    v_future_hex:=encode(
      extensions.digest(
        v_decision.id::text||':'||
        v_entry.canonical_track_id::text||':'||
        v_selected.artist_id::text||':'||
        v_selected.role||':'||
        v_selected.credit_order::text,
        'sha256'
      ),
      'hex'
    );
    v_future_id:=(
      substr(v_future_hex,1,8)||'-'||
      substr(v_future_hex,9,4)||'-'||
      '5'||substr(v_future_hex,14,3)||'-'||
      '8'||substr(v_future_hex,18,3)||'-'||
      substr(v_future_hex,21,12)
    )::uuid;

    v_collision:=
      platform_private.registry_track_artist_credit_collision_state_v1(
        v_future_id,
        v_entry.canonical_track_id::uuid,
        v_selected.artist_id
      );

    if v_collision<>'[]'::jsonb then
      raise exception using errcode='23505',
        message='Reviewed Chart Artist credit collided before exact admission.';
    end if;

    v_collision_fp:=
      platform_private.registry_relation_collision_fingerprint_v1(v_collision);

    v_evidence_id:=
      platform_private.record_registry_chart_user_evidence_v1(
        'track_artist_credit',
        v_future_id,
        'registry.track_artist_credit',
        jsonb_build_object(
          'track_id',v_entry.canonical_track_id::uuid,
          'artist_id',v_selected.artist_id,
          'role',v_selected.role,
          'credit_order',v_selected.credit_order,
          'display_credit',
            coalesce(v_selected.display_credit,v_artist.display_name),
          'confidence',100
        ),
        'INTERNAL_FACT',
        'chart_artist_resolution_review',
        'chart-artist-resolution:'||
          v_decision.id::text||':'||v_selected.artist_id::text,
        jsonb_build_object(
          'decision_id',v_decision.id,
          'chart_entry_id',v_decision.chart_entry_id,
          'edition_id',v_decision.edition_id,
          'raw_artist_name',v_decision.raw_artist_name,
          'decision_type',v_decision.decision_type,
          'selected_artists',v_decision.selected_artists,
          'note',v_decision.note
        ),
        v_required_capability
      );

    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=v_evidence_id;

    v_plan:=jsonb_build_object(
      'operation_key','registry.track_artist_credit.admit',
      'operation_version',1,
      'credit_id',v_future_id::text,
      'track_id',v_entry.canonical_track_id::text,
      'artist_id',v_selected.artist_id::text,
      'role',v_selected.role,
      'credit_order',v_selected.credit_order,
      'display_credit',
        coalesce(v_selected.display_credit,v_artist.display_name),
      'confidence',100,
      'collision_state_fingerprint',v_collision_fp,
      'evidence_assertion_id',v_evidence.id::text,
      'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
      'trust_class',v_evidence.trust_class,
      'policy_ruleset_version','registry-materialization-v1'
    );

    v_grant_id:=
      platform_private.issue_registry_chart_user_execution_grant_v1(
        v_evidence.id,
        'registry.track_artist_credit.admit',
        'track_artist_credit',
        v_future_id,
        v_plan,
        v_required_capability,
        'chart-resolution-credit:'||
          substr(v_evidence.assertion_fingerprint,1,40),
        null
      );

    select *
    into v_execution
    from platform_private.execute_registry_materialization_v1(
      'registry_chart_admission',
      v_grant_id
    );

    select *
    into v_verification
    from platform_private.verify_registry_materialization_v1(
      v_execution.operation_id
    );

    if v_verification.verifier_status<>'passed' then
      raise exception using errcode='23514',
        message='Reviewed Chart Artist credit independent verification failed.';
    end if;

    v_track_inserted:=v_track_inserted+1;
    v_operation_ids:=v_operation_ids||
      jsonb_build_array(v_execution.operation_id);
  end loop;

  select artist.*
  into v_primary_artist
  from pg_temp.chart_artist_resolution_selected_artists_v2 selected
  join public.registry_artists artist on artist.id=selected.artist_id
  where selected.role='primary_artist';

  if (
       select count(*)
       from public.registry_track_artists credit
       where credit.track_id=v_entry.canonical_track_id::uuid
         and credit.status<>'archived'
         and credit.is_primary is true
     )<>1
     or not exists (
       select 1
       from public.registry_track_artists credit
       where credit.track_id=v_entry.canonical_track_id::uuid
         and credit.status<>'archived'
         and credit.is_primary is true
         and credit.artist_id=v_primary_artist.id
     )
  then
    raise exception using errcode='23514',
      message='Reviewed Chart Artist Resolution did not produce one exact current primary credit.';
  end if;

  update public.wk_chart_entries_v2
  set canonical_artist_id=v_primary_artist.id::text,
      artist_slug=v_primary_artist.slug,
      updated_at=now()
  where id=v_entry.id;

  v_result:=jsonb_build_object(
    'decisionId',v_decision.id,
    'chartEntryId',v_decision.chart_entry_id,
    'trackId',v_entry.canonical_track_id,
    'primaryArtistId',v_primary_artist.id,
    'primaryArtistSlug',v_primary_artist.slug,
    'selectedArtistCount',v_selected_count,
    'trackCreditsInserted',v_track_inserted,
    'trackCreditsExisting',v_track_existing,
    'operationIds',v_operation_ids,
    'decisionType',v_decision.decision_type,
    'message','Resolution decision applied through governed Registry credit admission.'
  );

  update public.chart_artist_resolution_decisions
  set decision_status='resolved',
      applied_at=now(),
      apply_result_json=v_result,
      updated_at=now()
  where id=v_decision.id;

  return v_result;
end
$function$


create or replace function public.chart_get_run_candidate_origin_report(
  p_run_id text
)
returns table(
  candidate_id text,
  normalized_key text,
  title text,
  artist_display text,
  final_score numeric,
  resolved_artist_count integer,
  unresolved_artist_count integer,
  matching_origin_count integer,
  is_country_eligible boolean,
  reason_code text,
  reason_label text,
  artists jsonb
)
language sql
stable
security definer
set search_path = public
as $function$
  with run_row as (
    select
      r.id,
      case
        when jsonb_array_length(
          coalesce(
            r.market_scope_snapshot_json->'artistOriginCountries',
            '[]'::jsonb
          )
        ) > 0
        then array(
          select upper(value)
          from jsonb_array_elements_text(
            r.market_scope_snapshot_json->'artistOriginCountries'
          ) as value
          where nullif(value,'') is not null
        )
        when jsonb_array_length(
          coalesce(
            r.market_scope_snapshot_json->'includedMarkets',
            '[]'::jsonb
          )
        ) > 0
        then array(
          select upper(market->>'countryCode')
          from jsonb_array_elements(
            r.market_scope_snapshot_json->'includedMarkets'
          ) as market
          where nullif(market->>'countryCode','') is not null
        )
        when nullif(r.market_slug,'') is not null
          then array[upper(r.market_slug)]
        else array['KE']
      end as target_iso2s
    from public.chart_ingest_runs r
    where r.id::text=p_run_id
    limit 1
  ),
  candidate_scope as (
    select
      c.id,
      c.run_id,
      c.normalized_key,
      c.title,
      c.artist_display,
      coalesce(cs.final_score,0)::numeric as final_score,
      m.canonical_entity_id as canonical_track_id
    from public.chart_ingest_candidates c
    join run_row rr
      on rr.id::text=c.run_id::text
    left join public.chart_ingest_candidate_scores cs
      on cs.run_id::text=c.run_id::text
     and cs.candidate_id::text=c.id::text
    left join public.chart_ingest_matches m
      on m.run_id::text=c.run_id::text
     and m.candidate_id::text=c.id::text
     and m.entity_type='track'
     and m.status='accepted'
    where c.status='eligible'
  ),
  credit_rows as (
    select
      s.id as candidate_id,
      rta.id as credit_id,
      ra.id as resolved_artist_id,
      coalesce(ra.slug,rta.artist_slug) as canonical_slug,
      coalesce(
        nullif(rta.display_credit,''),
        nullif(ra.display_name,''),
        nullif(rta.artist_name_text,'')
      ) as canonical_name,
      ra.origin_iso2,
      rta.role,
      rta.is_primary,
      rta.credit_order
    from candidate_scope s
    left join public.registry_track_artists rta
      on rta.track_id::text=s.canonical_track_id
     and rta.status='active'
    left join public.registry_artists ra
      on ra.id=rta.artist_id
     and ra.status='active'
  ),
  row_state as (
    select
      s.id,
      s.normalized_key,
      s.title,
      s.artist_display,
      s.final_score,
      s.canonical_track_id,
      count(cr.resolved_artist_id)::integer as resolved_artist_count,
      (
        case
          when count(cr.credit_id)=0 then 1
          else count(*) filter (
            where cr.credit_id is not null
              and cr.resolved_artist_id is null
          )
        end
      )::integer as unresolved_artist_count,
      count(*) filter (
        where upper(coalesce(cr.origin_iso2,''))
          = any(rr.target_iso2s)
      )::integer as matching_origin_count,
      coalesce(
        jsonb_agg(
          distinct jsonb_build_object(
            'artistId',cr.resolved_artist_id,
            'canonicalSlug',cr.canonical_slug,
            'canonicalName',cr.canonical_name,
            'originIso2',cr.origin_iso2,
            'role',cr.role,
            'isPrimary',cr.is_primary,
            'creditOrder',cr.credit_order,
            'resolvedVia',
              case
                when cr.resolved_artist_id is not null
                  then 'canonical_track_credit'
                else 'unresolved_track_credit'
              end
          )
        ) filter (where cr.credit_id is not null),
        '[]'::jsonb
      ) as artists
    from candidate_scope s
    cross join run_row rr
    left join credit_rows cr
      on cr.candidate_id=s.id
    group by
      s.id,
      s.normalized_key,
      s.title,
      s.artist_display,
      s.final_score,
      s.canonical_track_id
  )
  select
    rs.id,
    rs.normalized_key,
    rs.title,
    rs.artist_display,
    rs.final_score,
    rs.resolved_artist_count,
    rs.unresolved_artist_count,
    rs.matching_origin_count,
    rs.matching_origin_count>0,
    case
      when rs.matching_origin_count>0 then null
      when rs.resolved_artist_count=0 then 'missing_artist_country'
      else 'country_mismatch'
    end,
    case
      when rs.matching_origin_count>0 then null
      when rs.resolved_artist_count=0
        then 'Canonical Track credits do not resolve to an Artist with known origin.'
      else 'Canonical Track Artist origins do not match the Chart market.'
    end,
    rs.artists
  from row_state rs
  order by
    rs.final_score desc,
    coalesce(rs.canonical_track_id,''),
    rs.id;
$function$;


create or replace function public.chart_get_run_origin_review_queue(
  p_run_id text
)
returns table(
  review_key text,
  issue_type text,
  source_slug text,
  source_name text,
  canonical_artist_id uuid,
  canonical_slug text,
  canonical_name text,
  current_origin_iso2 text,
  target_iso2 text,
  impacted_candidate_count integer,
  top_score numeric,
  examples jsonb
)
language sql
stable
security definer
set search_path = public
as $function$
  with run_row as (
    select
      r.id,
      upper(
        coalesce(
          nullif(
            r.market_scope_snapshot_json->'artistOriginCountries'->>0,
            ''
          ),
          nullif(
            r.market_scope_snapshot_json->'includedMarkets'->0->>'countryCode',
            ''
          ),
          nullif(r.market_slug,''),
          'KE'
        )
      ) as target_iso2
    from public.chart_ingest_runs r
    where r.id::text=p_run_id
    limit 1
  ),
  candidate_scope as (
    select
      c.id,
      c.run_id,
      c.title,
      c.artist_display,
      c.status,
      coalesce(cs.final_score,0)::numeric as final_score,
      e.reason_code,
      e.reason_label,
      m.canonical_entity_id as canonical_track_id
    from public.chart_ingest_candidates c
    join run_row rr
      on rr.id::text=c.run_id::text
    left join public.chart_ingest_candidate_scores cs
      on cs.run_id::text=c.run_id::text
     and cs.candidate_id::text=c.id::text
    left join public.chart_ingest_exclusions e
      on e.candidate_id::text=c.id::text
     and e.run_id::text=c.run_id::text
     and e.reason_code in ('country_mismatch','missing_artist_country')
    left join public.chart_ingest_matches m
      on m.run_id::text=c.run_id::text
     and m.candidate_id::text=c.id::text
     and m.entity_type='track'
     and m.status='accepted'
    where c.run_id::text=p_run_id
      and (
        c.status in ('eligible','excluded','needs_review')
        or e.id is not null
      )
  ),
  credit_scope as (
    select
      c.*,
      rta.id as credit_id,
      rta.artist_slug as source_credit_slug,
      rta.artist_name_text,
      rta.display_credit,
      rta.role,
      rta.credit_order,
      ra.id as artist_id,
      ra.slug as canonical_slug,
      ra.display_name as canonical_name,
      ra.origin_iso2,
      case
        when rta.id is null then null
        when ra.id is null then 'unresolved_artist'
        when nullif(ra.origin_iso2,'') is null then 'missing_origin'
        else null
      end as origin_issue_type
    from candidate_scope c
    left join public.registry_track_artists rta
      on rta.track_id::text=c.canonical_track_id
     and rta.status='active'
    left join public.registry_artists ra
      on ra.id=rta.artist_id
     and ra.status='active'
  ),
  actionable as (
    select
      cs.*,
      rr.target_iso2
    from credit_scope cs
    cross join run_row rr
    where cs.origin_issue_type in ('unresolved_artist','missing_origin')
  ),
  grouped as (
    select
      case
        when artist_id is not null then 'artist:'||artist_id::text
        else 'credit:'||credit_id::text
      end as review_key,
      origin_issue_type as issue_type,
      coalesce(canonical_slug,source_credit_slug,'') as source_slug,
      coalesce(
        nullif(display_credit,''),
        nullif(canonical_name,''),
        nullif(artist_name_text,''),
        artist_display
      ) as source_name,
      artist_id as canonical_artist_id,
      canonical_slug,
      canonical_name,
      origin_iso2 as current_origin_iso2,
      target_iso2,
      count(distinct id)::integer as impacted_candidate_count,
      max(final_score) as top_score,
      jsonb_agg(
        distinct jsonb_build_object(
          'candidateId',id,
          'canonicalTrackId',canonical_track_id,
          'title',title,
          'artistDisplay',artist_display,
          'finalScore',final_score,
          'candidateStatus',status,
          'reasonCode',reason_code,
          'reasonLabel',reason_label,
          'role',role,
          'creditOrder',credit_order,
          'resolvedVia','canonical_track_credit'
        )
      ) as examples
    from actionable
    group by
      review_key,
      origin_issue_type,
      source_slug,
      source_name,
      artist_id,
      canonical_slug,
      canonical_name,
      origin_iso2,
      target_iso2
  )
  select *
  from grouped
  order by
    case issue_type
      when 'missing_origin' then 1
      when 'unresolved_artist' then 2
      else 9
    end,
    top_score desc nulls last,
    impacted_candidate_count desc;
$function$;


create or replace function public.chart_get_run_playback_readiness(
  p_run_id text,
  p_provider_key text default 'apple_music'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  with eligible as (
    select
      c.id,
      coalesce(cs.final_score,0)::numeric as final_score,
      c.title,
      c.artist_display,
      c.normalized_key,
      m.canonical_entity_id,
      row_number() over (
        order by
          coalesce(cs.final_score,0) desc,
          coalesce(m.canonical_entity_id,'') asc,
          c.id asc
      ) as rank
    from public.chart_ingest_candidates c
    left join public.chart_ingest_candidate_scores cs
      on cs.run_id::text=c.run_id::text
     and cs.candidate_id::text=c.id::text
    left join public.chart_ingest_matches m
      on m.run_id::text=c.run_id::text
     and m.candidate_id::text=c.id::text
     and m.entity_type='track'
     and m.status='accepted'
    where c.run_id::text=p_run_id
      and c.status='eligible'
  ),
  resolved as (
    select
      e.*,
      rt.id as track_id,
      rt.slug as registry_track_slug,
      primary_credit.artist_slug as registry_artist_slug,
      link.provider_track_id,
      link.match_method,
      link.match_confidence,
      link.match_status,
      ex.id as exception_id,
      ex.exception_type,
      ex.note as exception_note
    from eligible e
    left join public.registry_tracks rt
      on rt.id::text=e.canonical_entity_id
     and rt.status='active'
    left join lateral (
      select coalesce(ra.slug,rta.artist_slug) as artist_slug
      from public.registry_track_artists rta
      left join public.registry_artists ra
        on ra.id=rta.artist_id
       and ra.status='active'
      where rta.track_id=rt.id
        and rta.status='active'
        and rta.is_primary is true
      order by
        rta.credit_order asc nulls last,
        rta.created_at asc,
        rta.id asc
      limit 1
    ) primary_credit on true
    left join lateral (
      select
        provider_link.provider_track_id,
        provider_link.match_method,
        provider_link.match_confidence,
        provider_link.match_status
      from public.registry_track_provider_links provider_link
      where provider_link.track_id=rt.id
        and provider_link.provider_key=
          lower(
            coalesce(
              nullif(trim(p_provider_key),''),
              'apple_music'
            )
          )
        and provider_link.match_status='matched'
      order by
        provider_link.match_confidence desc,
        provider_link.last_checked_at desc
      limit 1
    ) link on true
    left join lateral (
      select
        exception.id,
        exception.exception_type,
        exception.note
      from public.chart_playback_provider_exceptions exception
      where exception.run_id::text=p_run_id
        and exception.candidate_id::text=e.id::text
        and exception.provider_key=
          lower(
            coalesce(
              nullif(trim(p_provider_key),''),
              'apple_music'
            )
          )
      order by exception.created_at desc
      limit 1
    ) ex on true
  ),
  summary as (
    select
      count(*)::integer as total_entries,
      count(*) filter (where rank<=10)::integer as top10_entries,
      count(*) filter (
        where provider_track_id is not null
           or exception_id is not null
      )::integer as playable_entries,
      count(*) filter (
        where rank<=10
          and (
            provider_track_id is not null
            or exception_id is not null
          )
      )::integer as top10_playable,
      count(*) filter (where exception_id is not null)::integer
        as exception_entries,
      count(*) filter (
        where rank<=10 and exception_id is not null
      )::integer as top10_exception_entries,
      count(*) filter (where track_id is null)::integer
        as missing_registry_tracks,
      count(*) filter (
        where track_id is not null
          and provider_track_id is null
          and exception_id is null
      )::integer as missing_provider_links
    from resolved
  ),
  missing as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'rank',rank,
          'finalScore',final_score,
          'title',title,
          'artist',artist_display,
          'artistSlug',registry_artist_slug,
          'trackSlug',registry_track_slug,
          'registryTrackId',track_id,
          'reason',
            case
              when canonical_entity_id is null
                then 'missing_accepted_track_identity'
              when track_id is null
                then 'missing_current_registry_track'
              when provider_track_id is null
                then 'missing_provider_link'
              else 'ready'
            end
        )
        order by rank
      ),
      '[]'::jsonb
    ) as rows
    from resolved
    where provider_track_id is null
      and exception_id is null
  )
  select jsonb_build_object(
    'runId',p_run_id,
    'providerKey',
      lower(
        coalesce(
          nullif(trim(p_provider_key),''),
          'apple_music'
        )
      ),
    'totalEntries',coalesce(summary.total_entries,0),
    'top10Entries',coalesce(summary.top10_entries,0),
    'playableEntries',coalesce(summary.playable_entries,0),
    'top10Playable',coalesce(summary.top10_playable,0),
    'exceptionEntries',coalesce(summary.exception_entries,0),
    'top10ExceptionEntries',coalesce(summary.top10_exception_entries,0),
    'missingRegistryTracks',coalesce(summary.missing_registry_tracks,0),
    'missingProviderLinks',coalesce(summary.missing_provider_links,0),
    'playbackRate',
      case
        when coalesce(summary.total_entries,0)=0 then 0
        else round(
          (
            summary.playable_entries::numeric
            / summary.total_entries::numeric
          )*100,
          2
        )
      end,
    'top10PlaybackRate',
      case
        when coalesce(summary.top10_entries,0)=0 then 0
        else round(
          (
            summary.top10_playable::numeric
            / summary.top10_entries::numeric
          )*100,
          2
        )
      end,
    'canPublish',
      coalesce(summary.top10_entries,0)>0
      and coalesce(summary.top10_playable,0)
          = coalesce(summary.top10_entries,0),
    'missingRows',missing.rows
  )
  from summary,missing;
$function$;


create or replace function public.chart_get_run_integrity_report(
  p_run_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  with run_row as (
    select
      r.id,
      r.status,
      r.chart_size,
      lower(
        coalesce(
          nullif(r.market_scope_snapshot_json->>'artistOriginUnknownMode',''),
          'exclude'
        )
      ) as origin_unknown_mode,
      case
        when jsonb_array_length(
          coalesce(
            r.market_scope_snapshot_json->'artistOriginCountries',
            '[]'::jsonb
          )
        )>0
        then array(
          select upper(value)
          from jsonb_array_elements_text(
            r.market_scope_snapshot_json->'artistOriginCountries'
          ) as value
          where nullif(value,'') is not null
        )
        when jsonb_array_length(
          coalesce(
            r.market_scope_snapshot_json->'includedMarkets',
            '[]'::jsonb
          )
        )>0
        then array(
          select upper(market->>'countryCode')
          from jsonb_array_elements(
            r.market_scope_snapshot_json->'includedMarkets'
          ) as market
          where nullif(market->>'countryCode','') is not null
        )
        when nullif(r.market_slug,'') is not null
          then array[upper(r.market_slug)]
        else array['KE']
      end as target_iso2s
    from public.chart_ingest_runs r
    where r.id::text=p_run_id
    limit 1
  ),
  stage_state as (
    select
      rr.id,
      coalesce(bool_or(se.stage='canonical_match' and se.status='done'),false)
        as canonical_match_done,
      coalesce(bool_or(se.stage='entity_resolution' and se.status='done'),false)
        as entity_resolution_done,
      coalesce(bool_or(se.stage='eligibility_execution' and se.status='done'),false)
        as eligibility_done,
      coalesce(bool_or(se.stage='methodology_scoring' and se.status='done'),false)
        as scoring_done,
      coalesce(bool_or(se.stage='shortlist' and se.status='done'),false)
        as shortlist_done
    from run_row rr
    left join public.chart_ingest_stage_events se
      on se.run_id::text=rr.id::text
    group by rr.id
  ),
  candidates as (
    select c.*
    from public.chart_ingest_candidates c
    join run_row rr
      on rr.id::text=c.run_id::text
  ),
  shortlisted as (
    select *
    from candidates
    where status='eligible'
  ),
  row_state as (
    select
      s.id,
      s.normalized_key,
      s.title,
      s.artist_display,
      m.canonical_entity_id as canonical_track_id,
      rt.id as registry_track_id,
      coalesce(cs.final_score,0)::numeric as final_score,
      coalesce(credit.active_credit_count,0)::integer as active_credit_count,
      coalesce(credit.primary_credit_count,0)::integer as primary_credit_count,
      coalesce(credit.resolved_artist_count,0)::integer as resolved_artist_count,
      coalesce(credit.known_origin_count,0)::integer as known_origin_count,
      coalesce(credit.matching_origin_count,0)::integer as matching_origin_count,
      coalesce(credit.route_slug_available,false) as route_slug_available,
      coalesce(credit.display_available,false) as display_available,
      coalesce(credit.artists,'[]'::jsonb) as artists
    from shortlisted s
    cross join run_row rr
    left join public.chart_ingest_matches m
      on m.run_id::text=s.run_id::text
     and m.candidate_id::text=s.id::text
     and m.entity_type='track'
     and m.status='accepted'
    left join public.registry_tracks rt
      on rt.id::text=m.canonical_entity_id
     and rt.status='active'
    left join public.chart_ingest_candidate_scores cs
      on cs.run_id::text=s.run_id::text
     and cs.candidate_id::text=s.id::text
    left join lateral (
      select
        count(rta.id)::integer as active_credit_count,
        count(*) filter (where rta.is_primary is true)::integer
          as primary_credit_count,
        count(ra.id)::integer as resolved_artist_count,
        count(*) filter (where nullif(ra.origin_iso2,'') is not null)::integer
          as known_origin_count,
        count(*) filter (
          where upper(coalesce(ra.origin_iso2,''))
            = any(rr.target_iso2s)
        )::integer as matching_origin_count,
        coalesce(
          bool_or(
            coalesce(nullif(ra.slug,''),nullif(rta.artist_slug,'')) is not null
          ) filter (where rta.is_primary is true),
          false
        ) as route_slug_available,
        coalesce(
          bool_or(
            coalesce(
              nullif(rta.display_credit,''),
              nullif(ra.display_name,''),
              nullif(rta.artist_name_text,'')
            ) is not null
          ),
          false
        ) as display_available,
        coalesce(
          jsonb_agg(
            distinct jsonb_build_object(
              'artistId',ra.id,
              'canonicalSlug',coalesce(ra.slug,rta.artist_slug),
              'canonicalName',
                coalesce(
                  nullif(rta.display_credit,''),
                  nullif(ra.display_name,''),
                  nullif(rta.artist_name_text,'')
                ),
              'originIso2',ra.origin_iso2,
              'role',rta.role,
              'isPrimary',rta.is_primary,
              'creditOrder',rta.credit_order
            )
          ) filter (where rta.id is not null),
          '[]'::jsonb
        ) as artists
      from public.registry_track_artists rta
      left join public.registry_artists ra
        on ra.id=rta.artist_id
       and ra.status='active'
      where rta.track_id=rt.id
        and rta.status='active'
    ) credit on true
  ),
  duplicate_identity as (
    select m.canonical_entity_id,count(*)::integer as candidate_count
    from shortlisted s
    join public.chart_ingest_matches m
      on m.run_id::text=s.run_id::text
     and m.candidate_id::text=s.id::text
     and m.entity_type='track'
     and m.status='accepted'
    where m.canonical_entity_id is not null
    group by m.canonical_entity_id
    having count(*)>1
  ),
  summary as (
    select
      rr.id,
      rr.status,
      rr.chart_size,
      rr.target_iso2s,
      rr.origin_unknown_mode,
      ss.canonical_match_done,
      ss.entity_resolution_done,
      ss.eligibility_done,
      ss.scoring_done,
      ss.shortlist_done,
      (select count(*) from candidates)::integer as total_candidates,
      (select count(*) from shortlisted)::integer as shortlisted_count,
      (select count(*) from row_state where final_score>0)::integer
        as nonzero_score_count,
      coalesce((select max(final_score) from row_state),0)::numeric
        as max_score,
      (
        select count(*)
        from row_state
        where canonical_track_id is null or registry_track_id is null
      )::integer as missing_identity_count,
      (select count(*) from duplicate_identity)::integer
        as duplicate_identity_count,
      (
        select count(*)
        from row_state
        where registry_track_id is not null
          and (
            active_credit_count=0
            or primary_credit_count<>1
            or not route_slug_available
            or not display_available
          )
      )::integer as presentation_incomplete_count,
      (
        select count(*)
        from row_state
        where known_origin_count=0
          and rr.origin_unknown_mode<>'include'
      )::integer as unresolved_origin_count,
      (
        select count(*)
        from row_state
        where known_origin_count>0 and matching_origin_count=0
      )::integer as country_ineligible_count,
      (
        select count(*)
        from public.chart_ingest_review_issues issue
        where issue.run_id::text=rr.id::text
          and issue.status='open'
          and issue.blocking
      )::integer as blocking_review_issue_count
    from run_row rr
    join stage_state ss on ss.id=rr.id
  ),
  blockers as (
    select
      s.*,
      array_remove(
        array[
          case when not s.canonical_match_done then 'canonical_match_not_done' end,
          case when not s.entity_resolution_done then 'entity_resolution_not_done' end,
          case when not s.eligibility_done then 'eligibility_not_done' end,
          case when not s.scoring_done then 'scoring_not_done' end,
          case when not s.shortlist_done then 'shortlist_not_done' end,
          case when s.total_candidates=0 then 'no_candidates' end,
          case when s.shortlisted_count<>coalesce(s.chart_size,0)
            then 'shortlist_incomplete' end,
          case when s.missing_identity_count>0
            then 'missing_canonical_track_identity' end,
          case when s.duplicate_identity_count>0
            then 'duplicate_canonical_track_identity' end,
          case when s.nonzero_score_count<s.shortlisted_count
            then 'missing_or_zero_scores' end,
          case when s.max_score<=0 then 'zero_score_shortlist' end,
          case when s.presentation_incomplete_count>0
            then 'registry_presentation_incomplete' end,
          case when s.unresolved_origin_count>0
            then 'unresolved_artist_origins' end,
          case when s.country_ineligible_count>0
            then 'country_ineligible_candidates' end,
          case when s.blocking_review_issue_count>0
            then 'blocking_review_issues' end
        ],
        null
      ) as blocker_codes
    from summary s
  ),
  invalid_rows as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'candidateId',rs.id,
          'canonicalTrackId',rs.canonical_track_id,
          'normalizedKey',rs.normalized_key,
          'title',rs.title,
          'artistDisplay',rs.artist_display,
          'finalScore',rs.final_score,
          'activeCreditCount',rs.active_credit_count,
          'primaryCreditCount',rs.primary_credit_count,
          'resolvedArtistCount',rs.resolved_artist_count,
          'knownOriginCount',rs.known_origin_count,
          'matchingOriginCount',rs.matching_origin_count,
          'artists',rs.artists,
          'reason',
            case
              when rs.canonical_track_id is null or rs.registry_track_id is null
                then 'missing_canonical_track_identity'
              when rs.final_score<=0
                then 'missing_or_zero_score'
              when rs.active_credit_count=0
                or rs.primary_credit_count<>1
                or not rs.route_slug_available
                or not rs.display_available
                then 'registry_presentation_incomplete'
              when rs.known_origin_count=0
                then 'unresolved_artist_origin'
              when rs.matching_origin_count=0
                then 'no_artist_matches_target_country'
              else 'ok'
            end
        )
        order by
          rs.final_score desc,
          coalesce(rs.canonical_track_id,''),
          rs.id
      ) filter (
        where rs.canonical_track_id is null
           or rs.registry_track_id is null
           or rs.final_score<=0
           or rs.active_credit_count=0
           or rs.primary_credit_count<>1
           or not rs.route_slug_available
           or not rs.display_available
           or (
             rs.known_origin_count=0
             and (select origin_unknown_mode from run_row)<>'include'
           )
           or (rs.known_origin_count>0 and rs.matching_origin_count=0)
      ),
      '[]'::jsonb
    ) as rows
    from row_state rs
  )
  select jsonb_build_object(
    'runId',b.id,
    'status',b.status,
    'chartSize',b.chart_size,
    'targetIso2',
      case
        when cardinality(b.target_iso2s)>0 then b.target_iso2s[1]
        else null
      end,
    'targetIso2s',to_jsonb(b.target_iso2s),
    'originUnknownMode',b.origin_unknown_mode,
    'totalCandidates',b.total_candidates,
    'shortlistedCount',b.shortlisted_count,
    'nonzeroScoreCount',b.nonzero_score_count,
    'maxScore',b.max_score,
    'canonicalMatchDone',b.canonical_match_done,
    'entityResolutionDone',b.entity_resolution_done,
    'eligibilityDone',b.eligibility_done,
    'scoringDone',b.scoring_done,
    'shortlistDone',b.shortlist_done,
    'missingIdentityCount',b.missing_identity_count,
    'duplicateIdentityCount',b.duplicate_identity_count,
    'presentationIncompleteCount',b.presentation_incomplete_count,
    'countryIneligibleCount',b.country_ineligible_count,
    'unresolvedOriginCount',b.unresolved_origin_count,
    'blockingReviewIssueCount',b.blocking_review_issue_count,
    'blockers',to_jsonb(coalesce(b.blocker_codes,array[]::text[])),
    'committable',coalesce(array_length(b.blocker_codes,1),0)=0,
    'invalidRows',invalid_rows.rows
  )
  from blockers b,invalid_rows;
$function$;


do $postflight$
declare
  v_definition text;
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid='public.chart_ingest_candidates'::regclass
      and conname='chart_ingest_candidates_run_id_normalized_key_key'
  ) then
    raise exception
      'Chart normalized-key uniqueness authority was not retired';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='chart_ingest_matches'
      and indexname='chart_ingest_matches_run_accepted_track_uuid_uidx'
  ) then
    raise exception
      'Accepted Track UUID uniqueness invariant is missing';
  end if;

  select pg_get_functiondef(
    'public.chart_get_run_playback_readiness(text,text)'::regprocedure
  )
  into v_definition;

  if position('chart_ingest_matches' in v_definition)=0
     or position('canonical_entity_id' in v_definition)=0
     or position('candidate_track_slug' in v_definition)>0
  then
    raise exception
      'Chart playback readiness still resolves Track identity from text';
  end if;

  select pg_get_functiondef(
    'public.chart_materialize_candidate_registry_v1(uuid,uuid)'::regprocedure
  )
  into v_definition;

  if position('manage_registry' in v_definition)=0
     or position('publish_charts' in v_definition)>0
  then
    raise exception
      'Chart Registry admission capability boundary drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.issue_registry_chart_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,text,text)'::regprocedure
  )
  into v_definition;

  if position('publish_charts' in v_definition)>0
     or position('manage_registry' in v_definition)=0
  then
    raise exception
      'Chart exact Registry grant issuer still grants publication mutation authority';
  end if;

  if exists (
    select 1
    from public.chart_ingest_matches m
    where m.entity_type='track'
      and m.status='accepted'
      and m.canonical_entity_id is not null
    group by m.run_id,m.canonical_entity_id
    having count(*)>1
  ) then
    raise exception
      'Accepted Track UUID run uniqueness failed after migration';
  end if;

  raise notice
    'CHART_UUID_IDENTITY_AUTHORITY_V1_PASS';
end
$postflight$;

commit;
