-- MIZIZI Slice 2 Artist Intake Authority V1
--
-- Converges the reviewed CSV Artist intake workflow onto caller-bound Registry
-- authority. Staging remains operational history. Canonical Artist mutation is
-- restricted to already accepted typed Registry operations and independently
-- verified draft-first Artist creation.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-artist-intake-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.provider_intake_runs') is null
     or to_regclass('public.provider_intake_artist_staging') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regprocedure('platform_private.registry_identity_normalize_text_v1(text)') is null
     or to_regprocedure('platform_private.registry_artist_creation_slug_v1(text)') is null
     or to_regprocedure('platform_private.registry_artist_creation_collision_state_v1(uuid,text)') is null
     or to_regprocedure('platform_private.registry_identity_creation_collision_fingerprint_v1(jsonb)') is null
     or to_regprocedure('platform_private.execute_registry_materialization_v1(text,uuid)') is null
     or to_regprocedure('platform_private.verify_registry_materialization_v1(uuid)') is null
     or to_regprocedure('platform_private.issue_registry_artist_enrichment_user_execution_grant(uuid)') is null
     or to_regprocedure('platform_private.execute_registry_artist_enrichment_admission(uuid)') is null
     or to_regprocedure('platform_private.issue_registry_artist_origin_user_execution_grant(uuid)') is null
     or to_regprocedure('platform_private.execute_registry_artist_origin_admission(text,uuid)') is null
  then
    raise exception 'STOP: accepted Registry Artist authority foundation is missing';
  end if;

  if exists (
       select 1
       from information_schema.columns
       where table_schema='public'
         and table_name='provider_intake_artist_staging'
         and column_name in ('review_fingerprint','applied_registry_artist_id')
     )
     or exists (
       select 1
       from platform_private.system_actors
       where actor_key='registry_artist_intake_admin'
     )
     or to_regprocedure('platform_private.registry_artist_intake_current_admin_v1()') is not null
     or to_regprocedure('platform_private.registry_artist_intake_review_fingerprint_v1(uuid)') is not null
     or to_regprocedure('platform_private.registry_artist_intake_review_snapshot_v1(uuid)') is not null
     or to_regprocedure('public.admin_review_registry_artist_intake_v1(uuid,uuid,text,text,uuid)') is not null
     or to_regprocedure('public.admin_get_registry_artist_intake_review_v1(uuid)') is not null
     or to_regprocedure('public.admin_create_registry_artist_intake_shell_v1(uuid)') is not null
     or to_regprocedure('public.admin_mark_registry_artist_intake_applied_v1(uuid,uuid)') is not null
  then
    raise exception 'STOP: Artist Intake Authority V1 already exists';
  end if;
end
$preflight$;

alter table public.provider_intake_artist_staging
  add column review_fingerprint text null
    check (
      review_fingerprint is null
      or review_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  add column applied_registry_artist_id uuid null
    references public.registry_artists(id);

create index provider_intake_artist_staging_applied_artist_idx
  on public.provider_intake_artist_staging (applied_registry_artist_id)
  where applied_registry_artist_id is not null;

insert into platform_private.system_actors (
  actor_key,
  label,
  actor_kind,
  status,
  capability_profile
)
values (
  'registry_artist_intake_admin',
  'Registry Artist Intake Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'operation_family','registry.artist_intake',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_versions',jsonb_build_object(
      'registry.artist.create',1
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
  'registry_artist_intake_admin',
  'database_role',
  'authenticator',
  'active'
);

create function platform_private.registry_artist_intake_current_admin_v1()
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
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_artist_intake_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry Artist Intake admin broker.';
  end if;

  return v_user_id;
end
$$;

create function platform_private.registry_artist_intake_review_fingerprint_v1(
  p_staging_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_row public.provider_intake_artist_staging%rowtype;
  v_run public.provider_intake_runs%rowtype;
begin
  select staging.*
  into v_row
  from public.provider_intake_artist_staging staging
  where staging.id=p_staging_id;

  if not found then
    raise exception using errcode='P0002', message='Artist intake staging row is missing.';
  end if;

  select intake_run.*
  into v_run
  from public.provider_intake_runs intake_run
  where intake_run.id=v_row.intake_run_id;

  if not found
     or v_run.provider<>'csv_manual_upload'
     or v_run.provider_entity_type<>'artist'
     or v_run.mode<>'artist_intake'
  then
    raise exception using errcode='42501', message='Artist intake run is outside CSV Artist Intake V1.';
  end if;

  return encode(
    extensions.digest(
      jsonb_build_object(
        'staging_id',v_row.id::text,
        'intake_run_id',v_row.intake_run_id::text,
        'provider',v_run.provider,
        'provider_entity_type',v_run.provider_entity_type,
        'mode',v_run.mode,
        'source_artist_name',v_row.source_artist_name,
        'source_normalized_name',v_row.source_normalized_name,
        'source_spotify_id',v_row.source_spotify_id,
        'source_spotify_uri',v_row.source_spotify_uri,
        'source_origin_iso2',v_row.source_origin_iso2,
        'source_popularity',v_row.source_popularity,
        'source_followers',v_row.source_followers,
        'source_genres',coalesce(v_row.source_genres,'[]'::jsonb),
        'source_images',coalesce(v_row.source_images,'{}'::jsonb),
        'source_metadata',coalesce(v_row.source_metadata,'{}'::jsonb),
        'match_status',v_row.match_status,
        'matched_registry_artist_id',v_row.matched_registry_artist_id,
        'matched_registry_artist_name',v_row.matched_registry_artist_name,
        'match_confidence',v_row.match_confidence,
        'match_reason',v_row.match_reason,
        'review_status',v_row.review_status,
        'reviewed_by',v_row.reviewed_by,
        'reviewed_at',v_row.reviewed_at,
        'review_notes',v_row.review_notes,
        'target_registry_artist_id',v_row.target_registry_artist_id
      )::text,
      'sha256'
    ),
    'hex'
  );
end
$$;

create function platform_private.registry_artist_intake_review_snapshot_v1(
  p_staging_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_user_id uuid;
  v_row public.provider_intake_artist_staging%rowtype;
  v_run public.provider_intake_runs%rowtype;
  v_fingerprint text;
begin
  v_user_id:=platform_private.registry_artist_intake_current_admin_v1();

  select staging.*
  into v_row
  from public.provider_intake_artist_staging staging
  where staging.id=p_staging_id;

  if not found then
    raise exception using errcode='P0002', message='Artist intake staging row is missing.';
  end if;

  select intake_run.*
  into v_run
  from public.provider_intake_runs intake_run
  where intake_run.id=v_row.intake_run_id;

  if not found
     or v_run.provider<>'csv_manual_upload'
     or v_run.provider_entity_type<>'artist'
     or v_run.mode<>'artist_intake'
     or v_row.review_status<>'accepted'
     or v_row.action_taken is not null
     or v_row.reviewed_by is null
     or v_row.reviewed_at is null
     or v_row.review_fingerprint is null
     or v_row.review_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode='42501', message='Artist intake row is not an unapplied accepted V1 review.';
  end if;

  if v_row.reviewed_at < now()-interval '30 days'
     or v_row.reviewed_at > now()+interval '5 minutes'
  then
    raise exception using errcode='42501', message='Artist intake review is outside the V1 freshness window.';
  end if;

  v_fingerprint:=platform_private.registry_artist_intake_review_fingerprint_v1(v_row.id);
  if v_fingerprint<>v_row.review_fingerprint then
    raise exception using errcode='40001', message='Artist intake reviewed facts changed after approval.';
  end if;

  if v_row.target_registry_artist_id is not null
     and not exists (
       select 1
       from public.registry_artists artist
       where artist.id=v_row.target_registry_artist_id
         and artist.status in ('active','draft','needs_review')
     )
  then
    raise exception using errcode='42501', message='Reviewed Artist intake target is no longer eligible.';
  end if;

  return jsonb_build_object(
    'staging_id',v_row.id,
    'intake_run_id',v_row.intake_run_id,
    'source_artist_name',v_row.source_artist_name,
    'source_normalized_name',v_row.source_normalized_name,
    'source_spotify_id',v_row.source_spotify_id,
    'source_spotify_uri',v_row.source_spotify_uri,
    'source_origin_iso2',v_row.source_origin_iso2,
    'source_popularity',v_row.source_popularity,
    'source_followers',v_row.source_followers,
    'source_genres',coalesce(v_row.source_genres,'[]'::jsonb),
    'source_images',coalesce(v_row.source_images,'{}'::jsonb),
    'source_metadata',coalesce(v_row.source_metadata,'{}'::jsonb),
    'match_status',v_row.match_status,
    'matched_registry_artist_id',v_row.matched_registry_artist_id,
    'reviewed_by',v_row.reviewed_by,
    'reviewed_at',v_row.reviewed_at,
    'review_fingerprint',v_row.review_fingerprint,
    'target_registry_artist_id',v_row.target_registry_artist_id,
    'applying_user_id',v_user_id
  );
end
$$;

create function public.admin_review_registry_artist_intake_v1(
  p_intake_run_id uuid,
  p_staging_id uuid,
  p_decision text,
  p_notes text default null,
  p_target_registry_artist_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_row public.provider_intake_artist_staging%rowtype;
  v_run public.provider_intake_runs%rowtype;
  v_target_id uuid;
  v_fingerprint text;
begin
  v_user_id:=platform_private.registry_artist_intake_current_admin_v1();

  if p_decision not in ('accepted','rejected') then
    raise exception using errcode='22023', message='Artist intake decision must be accepted or rejected.';
  end if;

  select staging.*
  into v_row
  from public.provider_intake_artist_staging staging
  where staging.id=p_staging_id
    and staging.intake_run_id=p_intake_run_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Artist intake staging row is missing from this run.';
  end if;

  if v_row.action_taken='processed' then
    raise exception using errcode='55000', message='Applied Artist intake reviews are immutable.';
  end if;

  select intake_run.*
  into v_run
  from public.provider_intake_runs intake_run
  where intake_run.id=p_intake_run_id;

  if not found
     or v_run.provider<>'csv_manual_upload'
     or v_run.provider_entity_type<>'artist'
     or v_run.mode<>'artist_intake'
  then
    raise exception using errcode='42501', message='Artist intake run is outside CSV Artist Intake V1.';
  end if;

  if p_decision='accepted' then
    v_target_id:=coalesce(p_target_registry_artist_id,v_row.matched_registry_artist_id);

    if v_row.match_status<>'no_match' and v_target_id is null then
      raise exception using errcode='22023', message='Accepted matched Artist intake rows require an explicit Registry target.';
    end if;

    if v_target_id is not null
       and not exists (
         select 1
         from public.registry_artists artist
         where artist.id=v_target_id
           and artist.status in ('active','draft','needs_review')
       )
    then
      raise exception using errcode='22023', message='Artist intake target is missing or archived.';
    end if;
  else
    v_target_id:=null;
  end if;

  update public.provider_intake_artist_staging
  set
    review_status=p_decision,
    reviewed_by=v_user_id,
    reviewed_at=now(),
    review_notes=nullif(btrim(coalesce(p_notes,'')),''),
    target_registry_artist_id=v_target_id,
    review_fingerprint=null,
    applied_registry_artist_id=null,
    action_taken=case when p_decision='rejected' then 'skipped' else null end,
    updated_at=now()
  where id=v_row.id;

  v_fingerprint:=platform_private.registry_artist_intake_review_fingerprint_v1(v_row.id);

  update public.provider_intake_artist_staging
  set review_fingerprint=v_fingerprint
  where id=v_row.id;

  return jsonb_build_object(
    'staging_id',v_row.id,
    'decision',p_decision,
    'target_registry_artist_id',v_target_id,
    'review_fingerprint',v_fingerprint,
    'reviewed_by',v_user_id
  );
end
$$;

create function public.admin_get_registry_artist_intake_review_v1(
  p_staging_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
  select platform_private.registry_artist_intake_review_snapshot_v1(p_staging_id);
$$;

create function platform_private.registry_artist_intake_deterministic_uuid_v1(
  p_staging_id uuid
)
returns uuid
language plpgsql
immutable
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_hex text;
begin
  if p_staging_id is null then
    raise exception using errcode='22023', message='Artist intake staging ID is required.';
  end if;

  v_hex:=encode(
    extensions.digest(
      'artist.intake:'||p_staging_id::text,
      'sha256'
    ),
    'hex'
  );

  return (
    substr(v_hex,1,8)||'-'||
    substr(v_hex,9,4)||'-'||
    '5'||substr(v_hex,14,3)||'-'||
    '8'||substr(v_hex,18,3)||'-'||
    substr(v_hex,21,12)
  )::uuid;
end
$$;

create function platform_private.record_registry_artist_intake_creation_evidence_v1(
  p_staging_id uuid,
  p_future_artist_id uuid,
  p_display_name text,
  p_normalized_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid;
  v_review jsonb;
  v_claim jsonb;
  v_source_fingerprint text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
  v_observed_at timestamptz;
begin
  v_user_id:=platform_private.registry_artist_intake_current_admin_v1();
  v_review:=platform_private.registry_artist_intake_review_snapshot_v1(p_staging_id);

  if v_review->>'target_registry_artist_id' is not null
     or v_review->>'match_status'<>'no_match'
  then
    raise exception using errcode='42501', message='Only reviewed no-match intake rows may create an Artist shell.';
  end if;

  v_source_fingerprint:=v_review->>'review_fingerprint';
  v_observed_at:=(v_review->>'reviewed_at')::timestamptz;
  v_claim:=jsonb_build_object(
    'staging_id',p_staging_id,
    'future_artist_id',p_future_artist_id,
    'display_name',p_display_name,
    'normalized_name',p_normalized_name,
    'slug',p_slug
  );

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','artist',
        'subject_id',p_future_artist_id::text,
        'claim_key','registry.artist.identity.create',
        'claim_payload',v_claim,
        'trust_class','EXTERNAL_EVIDENCE',
        'source_kind','csv_manual_upload',
        'source_ref','artist-intake-staging:'||p_staging_id::text,
        'source_payload_fingerprint',v_source_fingerprint,
        'observed_at',v_observed_at,
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
  ) values (
    'artist',
    p_future_artist_id,
    'registry.artist.identity.create',
    v_claim,
    'EXTERNAL_EVIDENCE',
    'csv_manual_upload',
    'artist-intake-staging:'||p_staging_id::text,
    v_source_fingerprint,
    v_observed_at,
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

create function platform_private.issue_registry_artist_intake_create_grant_v1(
  p_staging_id uuid,
  p_evidence_assertion_id uuid,
  p_future_artist_id uuid,
  p_plan_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
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
  v_user_id:=platform_private.registry_artist_intake_current_admin_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.artist.create'
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or v_operation_type.capability_key<>'create_registry_artist'
     or not ('artist'=any(v_operation_type.allowed_subject_types))
     or v_operation_type.max_rows_ceiling<1
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501', message='Registry Artist creation operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.subject_id<>p_future_artist_id
     or v_evidence.claim_key<>'registry.artist.identity.create'
     or v_evidence.trust_class<>'EXTERNAL_EVIDENCE'
     or v_evidence.source_kind<>'csv_manual_upload'
     or v_evidence.source_ref<>'artist-intake-staging:'||p_staging_id::text
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501', message='Artist intake creation evidence is not bound to this exact review and caller.';
  end if;

  if p_plan_payload->>'operation_key'<>'registry.artist.create'
     or coalesce((p_plan_payload->>'operation_version')::integer,0)<>1
     or p_plan_payload->>'evidence_assertion_id' is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint' is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'trust_class' is distinct from v_evidence.trust_class
     or p_plan_payload->>'policy_ruleset_version'<>'registry-materialization-v1'
  then
    raise exception using errcode='42501', message='Artist intake creation plan is not bound to current evidence authority.';
  end if;

  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(p_plan_payload);
  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','artist',
          'subject_id',p_future_artist_id::text,
          'expected_state_fingerprint',null
        )
      )::text,
      'sha256'
    ),
    'hex'
  );
  v_idempotency_key:='artist-intake-create:'||p_staging_id::text;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_artist_intake_admin'
    and execution_grant.operation_key='registry.artist.create'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.max_rows<>1
    then
      raise exception using errcode='23505', message='Artist intake idempotency key is bound to different authority.';
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
  ) values (
    'registry_artist_intake_admin',
    'create_registry_artist',
    null,
    'registry.artist.create',
    1,
    p_plan_payload,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-materialization-v1',
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
  ) values (
    v_grant_id,
    'artist',
    p_future_artist_id,
    null
  );

  return v_grant_id;
end
$$;

create function public.admin_create_registry_artist_intake_shell_v1(
  p_staging_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_review jsonb;
  v_display_name text;
  v_normalized_name text;
  v_slug text;
  v_future_id uuid;
  v_collision jsonb;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
  v_artist public.registry_artists%rowtype;
begin
  perform platform_private.registry_artist_intake_current_admin_v1();
  v_review:=platform_private.registry_artist_intake_review_snapshot_v1(p_staging_id);

  if v_review->>'target_registry_artist_id' is not null
     or v_review->>'match_status'<>'no_match'
  then
    raise exception using errcode='42501', message='Reviewed Artist intake row is not eligible for shell creation.';
  end if;

  v_display_name:=btrim(regexp_replace(coalesce(v_review->>'source_artist_name',''),'[[:space:]]+',' ','g'));
  v_normalized_name:=platform_private.registry_identity_normalize_text_v1(v_display_name);
  v_slug:=platform_private.registry_artist_creation_slug_v1(v_display_name);

  if length(v_display_name)<2
     or nullif(v_normalized_name,'') is null
     or nullif(v_slug,'') is null
  then
    raise exception using errcode='22023', message='Valid Artist name is required.';
  end if;

  v_future_id:=platform_private.registry_artist_intake_deterministic_uuid_v1(p_staging_id);
  v_collision:=platform_private.registry_artist_creation_collision_state_v1(v_future_id,v_display_name);

  if v_collision<>'[]'::jsonb then
    raise exception using errcode='40001',
      message='Artist identity changed after review. Re-review and link the canonical Artist explicitly.';
  end if;

  v_evidence_id:=platform_private.record_registry_artist_intake_creation_evidence_v1(
    p_staging_id,
    v_future_id,
    v_display_name,
    v_normalized_name,
    v_slug
  );

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  v_plan:=jsonb_build_object(
    'operation_key','registry.artist.create',
    'operation_version',1,
    'artist_id',v_future_id,
    'display_name',v_display_name,
    'normalized_name',v_normalized_name,
    'slug',v_slug,
    'collision_state_fingerprint',platform_private.registry_identity_creation_collision_fingerprint_v1(v_collision),
    'evidence_assertion_id',v_evidence.id,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-materialization-v1'
  );

  v_grant_id:=platform_private.issue_registry_artist_intake_create_grant_v1(
    p_staging_id,
    v_evidence.id,
    v_future_id,
    v_plan
  );

  select *
  into v_execution
  from platform_private.execute_registry_materialization_v1(
    'registry_artist_intake_admin',
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_materialization_v1(v_execution.operation_id);

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='40001', message='Artist intake shell independent verification failed.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=v_future_id;

  if not found or v_artist.status<>'draft' then
    raise exception using errcode='40001', message='Artist intake shell did not materialize as a draft.';
  end if;

  return jsonb_build_object(
    'created',not v_execution.idempotent_replay,
    'artist',jsonb_build_object(
      'artist_id',v_artist.id,
      'artist_slug',v_artist.slug,
      'artist_name',v_artist.display_name,
      'status',v_artist.status
    ),
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status,
    'idempotent_replay',v_execution.idempotent_replay
  );
end
$$;

-- CSV is a reviewed evidence source, not a provider identity. Admit it explicitly
-- into the existing Artist-enrichment validators rather than mislabeling the
-- evidence as Spotify or Apple Music.
create or replace function platform_private.registry_artist_enrichment_claim_is_valid(
  p_claim_key text,
  p_claim_payload jsonb,
  p_source_kind text
)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog
as $$
declare
  v_value text;
begin
  if p_claim_payload is null
     or jsonb_typeof(p_claim_payload)<>'object'
     or p_claim_payload='{}'::jsonb
     or octet_length(p_claim_payload::text)>16000
  then
    return false;
  end if;

  if p_claim_key='registry.artist.provider_profile' then
    if p_source_kind not in ('spotify','apple_music','spotify_apple_music','csv_manual_upload')
       or (
         p_claim_payload-array[
           'spotify_id',
           'apple_music_id',
           'spotify_followers',
           'spotify_popularity',
           'enriched_genres'
         ]::text[]
       )<>'{}'::jsonb
    then
      return false;
    end if;

    if p_claim_payload?'spotify_id' then
      if jsonb_typeof(p_claim_payload->'spotify_id')<>'string'
         or nullif(btrim(p_claim_payload->>'spotify_id'),'') is null
         or octet_length(p_claim_payload->>'spotify_id')>512
      then return false; end if;
    end if;

    if p_claim_payload?'apple_music_id' then
      if jsonb_typeof(p_claim_payload->'apple_music_id')<>'string'
         or nullif(btrim(p_claim_payload->>'apple_music_id'),'') is null
         or octet_length(p_claim_payload->>'apple_music_id')>512
      then return false; end if;
    end if;

    if p_claim_payload?'spotify_followers' then
      if jsonb_typeof(p_claim_payload->'spotify_followers')<>'number'
         or (p_claim_payload->>'spotify_followers')!~'^[0-9]+$'
         or (p_claim_payload->>'spotify_followers')::numeric>1000000000000
      then return false; end if;
    end if;

    if p_claim_payload?'spotify_popularity' then
      if jsonb_typeof(p_claim_payload->'spotify_popularity')<>'number'
         or (p_claim_payload->>'spotify_popularity')!~'^[0-9]+$'
         or (p_claim_payload->>'spotify_popularity')::integer not between 0 and 100
      then return false; end if;
    end if;

    if p_claim_payload?'enriched_genres' then
      if jsonb_typeof(p_claim_payload->'enriched_genres')<>'array'
         or jsonb_array_length(p_claim_payload->'enriched_genres')>100
         or exists (
           select 1
           from jsonb_array_elements(p_claim_payload->'enriched_genres') item
           where jsonb_typeof(item)<>'string'
              or nullif(btrim(item#>>'{}'),'') is null
              or octet_length(item#>>'{}')>200
         )
      then return false; end if;
    end if;

    if p_source_kind='spotify' and p_claim_payload?'apple_music_id' then
      return false;
    end if;

    if p_source_kind='apple_music'
       and (
         p_claim_payload?'spotify_id'
         or p_claim_payload?'spotify_followers'
         or p_claim_payload?'spotify_popularity'
       )
    then
      return false;
    end if;

    return true;
  end if;

  if p_claim_key='registry.artist.public_image' then
    if p_source_kind not in ('spotify','apple_music','csv_manual_upload')
       or (
         p_claim_payload-array['public_image_url','image_source_provider']::text[]
       )<>'{}'::jsonb
       or not (p_claim_payload?'public_image_url')
       or not (p_claim_payload?'image_source_provider')
       or jsonb_typeof(p_claim_payload->'public_image_url')<>'string'
       or jsonb_typeof(p_claim_payload->'image_source_provider')<>'string'
       or (p_claim_payload->>'public_image_url')!~'^https?://'
       or octet_length(p_claim_payload->>'public_image_url')>4000
       or p_claim_payload->>'image_source_provider'<>p_source_kind
    then
      return false;
    end if;
    return true;
  end if;

  if p_claim_key='registry.artist.bio' then
    if p_source_kind not in ('apple_music','csv_manual_upload')
       or (p_claim_payload-array['bio']::text[])<>'{}'::jsonb
       or not (p_claim_payload?'bio')
       or jsonb_typeof(p_claim_payload->'bio')<>'string'
       or nullif(btrim(p_claim_payload->>'bio'),'') is null
    then
      return false;
    end if;
    return true;
  end if;

  if p_claim_key='registry.artist.type' then
    if p_source_kind not in ('musicbrainz','name_heuristic')
       or (p_claim_payload-array['artist_type']::text[])<>'{}'::jsonb
       or not (p_claim_payload?'artist_type')
       or jsonb_typeof(p_claim_payload->'artist_type')<>'string'
    then
      return false;
    end if;

    v_value:=p_claim_payload->>'artist_type';
    return v_value in ('solo','group','collective','band','duo','unknown');
  end if;

  return false;
end
$$;

-- Preserve the existing Artist-origin authority and add only the reviewed CSV
-- evidence source. Admission still requires the existing >=0.90 confidence gate.
create or replace function platform_private.record_registry_artist_origin_user_evidence(
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
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid:=auth.uid();
  v_claim_payload jsonb;
  v_recorded_by text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_artist_origin_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501', message='Current transport is not the Artist-origin admin broker.';
  end if;

  if p_artist_id is null
     or p_observed_at is null
     or not exists (
       select 1 from public.registry_artists artist where artist.id=p_artist_id
     )
  then
    raise exception using errcode='22023', message='A valid Artist and observation time are required.';
  end if;

  if not platform_private.registry_is_valid_iso2(p_origin_iso2) then
    raise exception using errcode='22023', message='Evidence origin must be a canonical ISO-3166-1 alpha-2 code.';
  end if;

  if p_confidence is null or p_confidence<0 or p_confidence>1 then
    raise exception using errcode='22023', message='Evidence confidence must be between zero and one.';
  end if;

  if p_source_kind is null
     or p_source_kind not in ('metadata_country_normalization','musicbrainz','csv_manual_upload')
  then
    raise exception using errcode='22023', message='Artist Origin V1 does not accept this evidence source kind.';
  end if;

  if nullif(btrim(p_source_ref),'') is null
     or octet_length(p_source_ref)>2000
     or p_source_payload_fingerprint is null
     or p_source_payload_fingerprint!~'^[0-9a-f]{64}$'
  then
    raise exception using errcode='22023', message='Evidence source reference/fingerprint is invalid.';
  end if;

  if p_observed_at>now()+interval '5 minutes'
     or p_observed_at<now()-interval '30 days'
  then
    raise exception using errcode='22023', message='Evidence observation time is outside the V1 freshness window.';
  end if;

  v_claim_payload:=jsonb_build_object(
    'origin_iso2',p_origin_iso2,
    'origin_confidence',p_confidence
  );
  v_recorded_by:='user:'||v_user_id::text;

  select assertion.id
  into v_assertion_id
  from platform_private.registry_evidence_assertions assertion
  where assertion.subject_type='artist'
    and assertion.subject_id=p_artist_id
    and assertion.claim_key='registry.artist.origin'
    and assertion.claim_payload=v_claim_payload
    and assertion.trust_class='EXTERNAL_EVIDENCE'
    and assertion.source_kind=p_source_kind
    and assertion.source_ref=btrim(p_source_ref)
    and assertion.source_payload_fingerprint=p_source_payload_fingerprint
    and assertion.recorded_by_principal_key=v_recorded_by
    and assertion.created_at>=now()-interval '10 minutes'
  order by assertion.created_at desc
  limit 1;

  if found then
    return v_assertion_id;
  end if;

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','artist',
        'subject_id',p_artist_id::text,
        'claim_key','registry.artist.origin',
        'claim_payload',v_claim_payload,
        'trust_class','EXTERNAL_EVIDENCE',
        'source_kind',p_source_kind,
        'source_ref',btrim(p_source_ref),
        'source_payload_fingerprint',p_source_payload_fingerprint,
        'observed_at',p_observed_at,
        'recorded_by_principal_key',v_recorded_by
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
  ) values (
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

create function public.admin_mark_registry_artist_intake_applied_v1(
  p_staging_id uuid,
  p_artist_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_review jsonb;
  v_run_id uuid;
  v_target_id uuid;
begin
  perform platform_private.registry_artist_intake_current_admin_v1();
  v_review:=platform_private.registry_artist_intake_review_snapshot_v1(p_staging_id);
  v_run_id:=(v_review->>'intake_run_id')::uuid;
  v_target_id:=nullif(v_review->>'target_registry_artist_id','')::uuid;

  if p_artist_id is null
     or not exists (
       select 1
       from public.registry_artists artist
       where artist.id=p_artist_id
         and artist.status in ('active','draft','needs_review')
     )
  then
    raise exception using errcode='22023', message='Applied Artist intake result must resolve to a current Registry Artist.';
  end if;

  if v_target_id is not null and v_target_id<>p_artist_id then
    raise exception using errcode='40001', message='Applied Artist does not match the reviewed Registry target.';
  end if;

  update public.provider_intake_artist_staging
  set
    applied_registry_artist_id=p_artist_id,
    action_taken='processed',
    updated_at=now()
  where id=p_staging_id
    and action_taken is null;

  if not found then
    raise exception using errcode='40001', message='Artist intake row was already applied or changed concurrently.';
  end if;

  if not exists (
       select 1
       from public.provider_intake_artist_staging staging
       where staging.intake_run_id=v_run_id
         and (
           staging.review_status='pending'
           or (staging.review_status='accepted' and staging.action_taken is null)
         )
     )
  then
    update public.provider_intake_runs
    set
      status='completed',
      completed_at=coalesce(completed_at,now())
    where id=v_run_id;
  end if;

  return jsonb_build_object(
    'staging_id',p_staging_id,
    'artist_id',p_artist_id,
    'action_taken','processed'
  );
end
$$;

revoke all on function public.admin_review_registry_artist_intake_v1(uuid,uuid,text,text,uuid) from public;
revoke all on function public.admin_get_registry_artist_intake_review_v1(uuid) from public;
revoke all on function public.admin_create_registry_artist_intake_shell_v1(uuid) from public;
revoke all on function public.admin_mark_registry_artist_intake_applied_v1(uuid,uuid) from public;

grant execute on function public.admin_review_registry_artist_intake_v1(uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.admin_get_registry_artist_intake_review_v1(uuid) to authenticated;
grant execute on function public.admin_create_registry_artist_intake_shell_v1(uuid) to authenticated;
grant execute on function public.admin_mark_registry_artist_intake_applied_v1(uuid,uuid) to authenticated;

commit;
