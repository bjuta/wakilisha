-- MIZIZI Slice 3 Track Intake Track Create V2 foundation
--
-- Installs an inert Track Intake-specific human broker over a V2 of the existing
-- Track-create operation family. The current product caller is not cut over by
-- this migration. V1 remains frozen for accepted Chart/Discography semantics.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-track-intake-track-create-v2-foundation',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_provider_track_suggestions') is null
     or to_regclass('public.registry_provider_track_suggestion_artists') is null
     or to_regclass('public.registry_enrichment_suggestions') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regprocedure('public.wk_slugify_text(text)') is null
     or to_regprocedure('platform_private.registry_identity_canonical_isrc_v1(text)') is null
     or to_regprocedure('platform_private.registry_identity_comparison_key_v1(text)') is null
     or to_regprocedure('platform_private.registry_identity_creation_collision_fingerprint_v1(jsonb)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
  then
    raise exception
      'STOP: accepted Registry materialization authority required by Track Intake V2 is missing';
  end if;

  if not exists (
       select 1
       from pg_roles
       where rolname='authenticator'
         and rolcanlogin
         and not rolsuper
     )
  then
    raise exception
      'STOP: expected PostgREST authenticator role is missing';
  end if;

  if not exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key='registry.track.create'
         and operation_type.operation_version=1
         and operation_type.capability_key='create_registry_track'
         and operation_type.enabled
     )
  then
    raise exception
      'STOP: accepted Registry Track Create V1 authority is missing';
  end if;

  if exists (
       select 1
       from platform_private.system_actors
       where actor_key='registry_track_intake_admin'
     )
     or exists (
       select 1
       from platform_private.registry_operation_types
       where operation_key='registry.track.create'
         and operation_version=2
     )
     or to_regprocedure('platform_private.registry_track_intake_current_admin_v1()') is not null
     or to_regprocedure('platform_private.registry_track_intake_identity_review_snapshot_v1(uuid)') is not null
     or to_regprocedure('platform_private.registry_track_intake_credit_review_snapshot_v1(uuid)') is not null
     or to_regprocedure('platform_private.registry_track_intake_deterministic_track_uuid_v1(uuid)') is not null
     or to_regprocedure('platform_private.registry_track_intake_reviewed_slug_v1(uuid,text)') is not null
     or to_regprocedure('platform_private.registry_track_creation_collision_state_v2(uuid,text,uuid,text,text)') is not null
     or to_regprocedure('platform_private.record_registry_track_intake_identity_evidence_v1(uuid,uuid,text,text,text,text,uuid)') is not null
     or to_regprocedure('platform_private.issue_registry_track_intake_create_v2_grant(uuid,uuid,uuid,jsonb)') is not null
     or to_regprocedure('platform_private.execute_registry_track_create_v2(text,uuid)') is not null
     or to_regprocedure('platform_private.verify_registry_track_create_v2(uuid)') is not null
     or to_regprocedure('public.admin_create_registry_track_intake_identity_v1(uuid,text)') is not null
  then
    raise exception
      'STOP: Track Intake Track Create V2 foundation already exists; audit before reapplying';
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
  'registry_track_intake_admin',
  'Registry Track Intake Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'product_surface','track_intake',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_family',jsonb_build_array(
      'registry.track.create/v2'
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
  'registry_track_intake_admin',
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
  'registry.track.create',
  2,
  'create_registry_track',
  'medium',
  array['track']::text[],
  false,
  1,
  1,
  300,
  true,
  true,
  true,
  'Create exactly one draft Registry Track identity with an evidence-bound reviewed Track Intake route slug.'
);

create function platform_private.registry_track_intake_current_admin_v1()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, auth
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
       where binding.actor_key='registry_track_intake_admin'
         and binding.executor_kind='database_role'
         and binding.executor_key=session_user
         and binding.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Current transport is not the Registry Track Intake admin broker.';
  end if;

  return v_user_id;
end
$$;

create function platform_private.registry_track_intake_identity_review_snapshot_v1(
  p_suggestion_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid;
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_identity_fields jsonb;
  v_credits jsonb;
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
     or v_suggestion.canonical_track_id is not null
     or v_suggestion.canonicalized_track_id is not null
  then
    raise exception using errcode='42501',
      message='Track Intake item is not eligible for new Registry identity creation.';
  end if;

  select coalesce(
    jsonb_object_agg(
      enrichment.field_name,
      enrichment.suggested_value
      order by enrichment.field_name
    ),
    '{}'::jsonb
  )
  into v_identity_fields
  from public.registry_enrichment_suggestions enrichment
  where enrichment.registry_entity_type='track'
    and enrichment.registry_entity_id=p_suggestion_id::text
    and enrichment.decision_status='approved'
    and enrichment.field_name='isrc';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'credit_id',credit.id,
        'credit_order',credit.credit_order,
        'credit_role',credit.credit_role,
        'resolution_mode',credit.resolution_mode,
        'registry_artist_id',credit.registry_artist_id,
        'observed_name',credit.observed_name
      )
      order by credit.credit_order,credit.id
    ),
    '[]'::jsonb
  )
  into v_credits
  from public.registry_provider_track_suggestion_artists credit
  where credit.suggestion_id=p_suggestion_id;

  if jsonb_array_length(v_credits)=0
     or exists (
       select 1
       from public.registry_provider_track_suggestion_artists credit
       left join public.registry_artists artist
         on artist.id=credit.registry_artist_id
       where credit.suggestion_id=p_suggestion_id
         and (
           credit.resolution_mode<>'existing_artist'
           or credit.registry_artist_id is null
           or artist.id is null
           or artist.status<>'active'
           or credit.credit_role not in ('primary','featured')
         )
     )
     or not exists (
       select 1
       from public.registry_provider_track_suggestion_artists credit
       join public.registry_artists artist
         on artist.id=credit.registry_artist_id
       where credit.suggestion_id=p_suggestion_id
         and credit.credit_role='primary'
         and credit.resolution_mode='existing_artist'
         and artist.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Resolve every Track Intake Artist credit to an active existing Registry Artist before identity creation.';
  end if;

  v_payload:=jsonb_build_object(
    'suggestion_id',v_suggestion.id,
    'intake_origin',v_suggestion.intake_origin,
    'provider_key',v_suggestion.provider_key,
    'provider_object_id',v_suggestion.provider_object_id,
    'provider_url',v_suggestion.provider_url,
    'provider_title',v_suggestion.provider_title,
    'provider_artist_names',v_suggestion.provider_artist_names,
    'provider_release_title',v_suggestion.provider_release_title,
    'playback_kind',v_suggestion.playback_kind,
    'validation_snapshot',coalesce(v_suggestion.validation_snapshot,'{}'::jsonb),
    'submitted_track_title',v_suggestion.submitted_track_title,
    'approved_identity_fields',v_identity_fields,
    'reviewed_credits',v_credits
  );

  v_fingerprint:=encode(
    extensions.digest(v_payload::text,'sha256'),
    'hex'
  );

  return v_payload || jsonb_build_object(
    'review_fingerprint',v_fingerprint,
    'applying_user_id',v_user_id
  );
end
$$;

create function platform_private.registry_track_intake_credit_review_snapshot_v1(
  p_suggestion_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid;
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_credits jsonb;
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

  if v_suggestion.status<>'needs_review' then
    raise exception using errcode='42501',
      message='Track Intake Artist credits are not currently reviewable.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'credit_id',credit.id,
        'credit_order',credit.credit_order,
        'credit_role',credit.credit_role,
        'resolution_mode',credit.resolution_mode,
        'registry_artist_id',credit.registry_artist_id,
        'observed_name',credit.observed_name
      )
      order by credit.credit_order,credit.id
    ),
    '[]'::jsonb
  )
  into v_credits
  from public.registry_provider_track_suggestion_artists credit
  where credit.suggestion_id=p_suggestion_id;

  if jsonb_array_length(v_credits)=0
     or exists (
       select 1
       from public.registry_provider_track_suggestion_artists credit
       left join public.registry_artists artist
         on artist.id=credit.registry_artist_id
       where credit.suggestion_id=p_suggestion_id
         and (
           credit.resolution_mode<>'existing_artist'
           or credit.registry_artist_id is null
           or artist.id is null
           or artist.status<>'active'
           or credit.credit_role not in ('primary','featured')
         )
     )
     or not exists (
       select 1
       from public.registry_provider_track_suggestion_artists credit
       join public.registry_artists artist
         on artist.id=credit.registry_artist_id
       where credit.suggestion_id=p_suggestion_id
         and credit.credit_role='primary'
         and credit.resolution_mode='existing_artist'
         and artist.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Resolve every Track Intake Artist credit to an active existing Registry Artist before credit authority.';
  end if;

  v_payload:=jsonb_build_object(
    'suggestion_id',v_suggestion.id,
    'reviewed_credits',v_credits
  );

  v_fingerprint:=encode(
    extensions.digest(v_payload::text,'sha256'),
    'hex'
  );

  return v_payload || jsonb_build_object(
    'review_fingerprint',v_fingerprint,
    'applying_user_id',v_user_id
  );
end
$$;

create function platform_private.registry_track_intake_deterministic_track_uuid_v1(
  p_suggestion_id uuid
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
  if p_suggestion_id is null then
    raise exception using errcode='22023',
      message='Track Intake suggestion ID is required.';
  end if;

  v_hex:=encode(
    extensions.digest(
      'track.intake:'||p_suggestion_id::text,
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

create function platform_private.registry_track_intake_reviewed_slug_v1(
  p_suggestion_id uuid,
  p_title text
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_slug_title text:=coalesce(p_title,'');
  v_feature_fragment text;
  v_feature_suffix text;
  v_feature_suffix_match text[];
  v_featured_artist_names text[]:=array[]::text[];
begin
  select coalesce(
    array_agg(
      coalesce(
        nullif(btrim(credit.observed_name),''),
        artist.display_name
      )
      order by credit.credit_order,credit.id
    ) filter (where credit.credit_role='featured'),
    array[]::text[]
  )
  into v_featured_artist_names
  from public.registry_provider_track_suggestion_artists credit
  join public.registry_artists artist
    on artist.id=credit.registry_artist_id
  where credit.suggestion_id=p_suggestion_id
    and credit.resolution_mode='existing_artist'
    and artist.status='active';

  if cardinality(v_featured_artist_names)>0 then
    for v_feature_fragment in
      select fragment_match[1]
      from regexp_matches(
        v_slug_title,
        '([(][^)]*(feat[.]?|featuring|ft[.]?)[[:space:]]+[^)]*[)]|[[][^]]*(feat[.]?|featuring|ft[.]?)[[:space:]]+[^]]*[]]|[{][^}]*(feat[.]?|featuring|ft[.]?)[[:space:]]+[^}]*[}])',
        'gi'
      ) as fragment_match
    loop
      if exists (
           select 1
           from unnest(v_featured_artist_names) featured_name
           where position(lower(featured_name) in lower(v_feature_fragment))>0
         )
      then
        v_slug_title:=replace(v_slug_title,v_feature_fragment,' ');
      end if;
    end loop;

    v_feature_suffix_match:=regexp_match(
      v_slug_title,
      '([[:space:]]+(-|:)?[[:space:]]*(feat[.]?|featuring|ft[.]?)[[:space:]]+.+)$',
      'i'
    );

    if v_feature_suffix_match is not null then
      v_feature_suffix:=v_feature_suffix_match[1];

      if position('(' in v_feature_suffix)=0
         and position('[' in v_feature_suffix)=0
         and position('{' in v_feature_suffix)=0
         and exists (
           select 1
           from unnest(v_featured_artist_names) featured_name
           where nullif(public.wk_slugify_text(featured_name),'') is not null
             and (
               '-'||public.wk_slugify_text(v_feature_suffix)||'-'
             ) like (
               '%-'||public.wk_slugify_text(featured_name)||'-%'
             )
         )
      then
        v_slug_title:=left(
          v_slug_title,
          greatest(length(v_slug_title)-length(v_feature_suffix),0)
        );
      end if;
    end if;
  end if;

  return public.wk_slugify_text(v_slug_title);
end
$$;

create function platform_private.registry_track_creation_collision_state_v2(
  p_future_track_id uuid,
  p_title text,
  p_identity_artist_id uuid,
  p_isrc text,
  p_slug text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
  with proposed as (
    select
      platform_private.registry_identity_comparison_key_v1(p_title) as comparison_key,
      platform_private.registry_identity_canonical_isrc_v1(p_isrc) as isrc,
      nullif(btrim(p_slug),'') as slug
  ),
  collisions as (
    select track.id::text as registry_entity_id,'future_id'::text as reason
    from public.registry_tracks track
    where track.id=p_future_track_id

    union all

    select track.id::text,'isrc'
    from public.registry_tracks track
    cross join proposed
    where proposed.isrc is not null
      and track.isrc=proposed.isrc

    union all

    select track.id::text,'title_artist'
    from public.registry_tracks track
    cross join proposed
    where track.status<>'archived'
      and platform_private.registry_identity_comparison_key_v1(track.title)=proposed.comparison_key
      and exists (
        select 1
        from public.registry_track_artists credit
        where credit.track_id=track.id
          and credit.artist_id=p_identity_artist_id
          and credit.status='active'
      )

    union all

    select track.id::text,'reviewed_slug_primary_artist'
    from public.registry_tracks track
    cross join proposed
    where track.status<>'archived'
      and proposed.slug is not null
      and track.slug=proposed.slug
      and exists (
        select 1
        from public.registry_track_artists credit
        where credit.track_id=track.id
          and credit.artist_id=p_identity_artist_id
          and credit.is_primary is true
          and credit.status='active'
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'registry_entity_id',collision.registry_entity_id,
        'reason',collision.reason
      )
      order by collision.registry_entity_id,collision.reason
    ),
    '[]'::jsonb
  )
  from collisions collision;
$$;

create function platform_private.record_registry_track_intake_identity_evidence_v1(
  p_suggestion_id uuid,
  p_future_track_id uuid,
  p_title text,
  p_normalized_title text,
  p_slug text,
  p_isrc text,
  p_identity_artist_id uuid
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
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();
  v_review:=platform_private.registry_track_intake_identity_review_snapshot_v1(p_suggestion_id);

  v_claim:=jsonb_build_object(
    'suggestion_id',p_suggestion_id,
    'future_track_id',p_future_track_id,
    'title',p_title,
    'normalized_title',p_normalized_title,
    'slug',p_slug,
    'isrc',p_isrc,
    'identity_artist_id',p_identity_artist_id,
    'review_fingerprint',v_review->>'review_fingerprint'
  );

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','track',
        'subject_id',p_future_track_id::text,
        'claim_key','registry.track.identity.create',
        'claim_payload',v_claim,
        'trust_class','EXTERNAL_EVIDENCE',
        'source_kind','track_intake_review',
        'source_ref','track-intake-suggestion:'||p_suggestion_id::text,
        'source_payload_fingerprint',v_review->>'review_fingerprint',
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
    p_future_track_id,
    'registry.track.identity.create',
    v_claim,
    'EXTERNAL_EVIDENCE',
    'track_intake_review',
    'track-intake-suggestion:'||p_suggestion_id::text,
    v_review->>'review_fingerprint',
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

create function platform_private.issue_registry_track_intake_create_v2_grant(
  p_suggestion_id uuid,
  p_evidence_assertion_id uuid,
  p_future_track_id uuid,
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
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.track.create'
    and operation_type.operation_version=2
    and operation_type.enabled;

  if not found
     or v_operation_type.capability_key<>'create_registry_track'
     or not ('track'=any(v_operation_type.allowed_subject_types))
     or v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<1
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Track Create V2 operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>p_future_track_id
     or v_evidence.claim_key<>'registry.track.identity.create'
     or v_evidence.trust_class<>'EXTERNAL_EVIDENCE'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.source_ref<>'track-intake-suggestion:'||p_suggestion_id::text
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Track Intake creation evidence is not bound to this exact review and caller.';
  end if;

  if p_plan_payload->>'operation_key'<>'registry.track.create'
     or coalesce((p_plan_payload->>'operation_version')::integer,0)<>2
     or p_plan_payload->>'track_id' is distinct from p_future_track_id::text
     or p_plan_payload->>'evidence_assertion_id' is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint' is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'trust_class' is distinct from v_evidence.trust_class
     or p_plan_payload->>'policy_ruleset_version'<>'registry-track-create-v2'
  then
    raise exception using errcode='42501',
      message='Track Intake creation plan is not bound to current evidence authority.';
  end if;

  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(p_plan_payload);
  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','track',
          'subject_id',p_future_track_id::text,
          'expected_state_fingerprint',null
        )
      )::text,
      'sha256'
    ),
    'hex'
  );
  v_idempotency_key:='track-intake-create-v2:'||p_suggestion_id::text;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_intake_admin'
    and execution_grant.operation_key='registry.track.create'
    and execution_grant.operation_version=2
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.max_rows<>1
    then
      raise exception using errcode='23505',
        message='Track Intake idempotency key is bound to different authority.';
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
    'registry_track_intake_admin',
    'create_registry_track',
    null,
    'registry.track.create',
    2,
    p_plan_payload,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-track-create-v2',
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
    'track',
    p_future_track_id,
    null
  );

  return v_grant_id;
end
$$;

create function platform_private.execute_registry_track_create_v2(
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
  v_collision_state jsonb;
  v_collision_fingerprint text;
  v_event_id uuid;
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
     or v_grant.actor_key<>p_actor_key
     or v_grant.actor_key<>'registry_track_intake_admin'
     or v_grant.operation_key<>'registry.track.create'
     or v_grant.operation_version<>2
     or v_grant.capability_key<>'create_registry_track'
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>'registry-track-create-v2'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Track Intake Track Create V2 grant.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or v_target.subject_type<>'track'
     or v_target.expected_state_fingerprint is not null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     )<>1
  then
    raise exception using errcode='42501',
      message='Track Create V2 requires one exact future Track target.';
  end if;

  v_plan:=v_grant.plan_payload;

  if (v_plan-array[
       'operation_key','operation_version','track_id',
       'title','normalized_title','slug','isrc',
       'identity_artist_id','collision_state_fingerprint',
       'evidence_assertion_id','evidence_assertion_fingerprint',
       'trust_class','policy_ruleset_version'
     ]::text[])<>'{}'::jsonb
     or v_plan->>'operation_key'<>'registry.track.create'
     or coalesce((v_plan->>'operation_version')::integer,0)<>2
     or (v_plan->>'track_id')::uuid<>v_target.subject_id
     or nullif(btrim(v_plan->>'title'),'') is null
     or nullif(btrim(v_plan->>'normalized_title'),'') is null
     or nullif(btrim(v_plan->>'slug'),'') is null
     or not exists (
       select 1
       from public.registry_artists artist
       where artist.id=(v_plan->>'identity_artist_id')::uuid
         and artist.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Track Create V2 plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>v_target.subject_id
     or v_evidence.claim_key<>'registry.track.identity.create'
     or v_evidence.trust_class<>'EXTERNAL_EVIDENCE'
     or v_evidence.source_kind<>'track_intake_review'
     or v_evidence.assertion_fingerprint is distinct from
        v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.recorded_by_principal_key is distinct from
        v_grant.issued_by_principal_key
  then
    raise exception using errcode='42501',
      message='Track Create V2 evidence no longer satisfies the exact grant.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'registry.track.create.v2:'||
      coalesce(
        nullif(v_plan->>'isrc',''),
        (v_plan->>'normalized_title')||':'||
        (v_plan->>'identity_artist_id')
      ),
      0
    )
  );

  v_collision_state:=
    platform_private.registry_track_creation_collision_state_v2(
      v_target.subject_id,
      v_plan->>'title',
      (v_plan->>'identity_artist_id')::uuid,
      nullif(v_plan->>'isrc',''),
      v_plan->>'slug'
    );
  v_collision_fingerprint:=
    platform_private.registry_identity_creation_collision_fingerprint_v1(
      v_collision_state
    );

  if v_collision_state<>'[]'::jsonb
     or v_collision_fingerprint is distinct from
        v_plan->>'collision_state_fingerprint'
  then
    raise exception using errcode='40001',
      message='Track Create V2 collision state changed before execution.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  insert into public.registry_tracks (
    id,
    slug,
    title,
    normalized_title,
    isrc,
    status,
    metadata
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
    v_target.subject_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'identity',
    'public.registry_tracks',
    null,
    jsonb_build_object(
      'id',v_target.subject_id,
      'slug',v_plan->>'slug',
      'title',v_plan->>'title',
      'normalized_title',v_plan->>'normalized_title',
      'isrc',nullif(v_plan->>'isrc',''),
      'status','draft'
    ),
    'create_identity',
    'succeeded',
    'system:'||p_actor_key
  )
  returning id into v_event_id;

  if v_rows<>1 or v_event_id is null then
    raise exception using errcode='40001',
      message='Track Create V2 lost its exact one-row boundary.';
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
  set affected_rows=1,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'subject_type','track',
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

create function platform_private.verify_registry_track_create_v2(
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
     or v_operation.operation_key<>'registry.track.create'
     or v_operation.operation_version<>2
     or v_operation.actor_key<>'registry_track_intake_admin'
  then
    raise exception using errcode='P0002',
      message='Track Create V2 operation not found.';
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
       or v_grant.actor_key<>'registry_track_intake_admin'
       or v_grant.operation_key<>'registry.track.create'
       or v_grant.operation_version<>2
       or v_grant.policy_ruleset_version<>'registry-track-create-v2'
     )
  then
    v_failure:='execution_grant_mismatch';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;

    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id=v_grant.id;

    if not found
       or v_target.subject_type<>'track'
       or v_target.expected_state_fingerprint is not null
       or (
         select count(*)
         from platform_private.registry_execution_grant_targets target_count
         where target_count.execution_grant_id=v_grant.id
       )<>1
    then
      v_failure:='exact_target_missing';
    end if;
  end if;

  if v_failure is null
     and not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_target.subject_id
         and track.slug=v_plan->>'slug'
         and track.title=v_plan->>'title'
         and track.normalized_title=v_plan->>'normalized_title'
         and track.isrc is not distinct from nullif(v_plan->>'isrc','')
         and track.status='draft'
         and coalesce(track.metadata,'{}'::jsonb)='{}'::jsonb
     )
  then
    v_failure:='canonical_track_identity_mismatch';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type='track'
      and event.registry_entity_id=v_target.subject_id::text
      and event.source_table='platform_private.registry_evidence_assertions'
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
      error_code='registry_track_create_v2_verification_failed',
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

create function public.admin_create_registry_track_intake_identity_v1(
  p_suggestion_id uuid,
  p_title text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_review jsonb;
  v_title text;
  v_normalized_title text;
  v_slug text;
  v_isrc text;
  v_primary_artist_id uuid;
  v_future_track_id uuid;
  v_collision jsonb;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_existing_grant platform_private.registry_execution_grants%rowtype;
  v_existing_evidence platform_private.registry_evidence_assertions%rowtype;
  v_idempotency_key text;
  v_execution record;
  v_verification record;
  v_track public.registry_tracks%rowtype;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();
  v_review:=platform_private.registry_track_intake_identity_review_snapshot_v1(p_suggestion_id);

  v_title:=nullif(btrim(p_title),'');
  if v_title is null then
    raise exception using errcode='22023',
      message='Confirm the canonical Track title before creating Registry identity.';
  end if;

  v_normalized_title:=trim(
    regexp_replace(
      lower(v_title),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  );

  v_slug:=
    platform_private.registry_track_intake_reviewed_slug_v1(
      p_suggestion_id,
      v_title
    );

  if nullif(v_slug,'') is null then
    raise exception using errcode='22023',
      message='Canonical Track title cannot produce a valid Registry slug.';
  end if;

  select credit.registry_artist_id
  into v_primary_artist_id
  from public.registry_provider_track_suggestion_artists credit
  join public.registry_artists artist
    on artist.id=credit.registry_artist_id
  where credit.suggestion_id=p_suggestion_id
    and credit.credit_role='primary'
    and credit.resolution_mode='existing_artist'
    and artist.status='active'
  order by credit.credit_order,credit.id
  limit 1;

  if v_primary_artist_id is null then
    raise exception using errcode='42501',
      message='A reviewed active primary Registry Artist is required.';
  end if;

  v_isrc:=
    platform_private.registry_identity_canonical_isrc_v1(
      nullif(
        btrim(
          coalesce(
            v_review->'approved_identity_fields'->>'isrc',
            ''
          )
        ),
        ''
      )
    );

  v_future_track_id:=
    platform_private.registry_track_intake_deterministic_track_uuid_v1(
      p_suggestion_id
    );
  v_idempotency_key:=
    'track-intake-create-v2:'||p_suggestion_id::text;

  select execution_grant.*
  into v_existing_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_track_intake_admin'
    and execution_grant.operation_key='registry.track.create'
    and execution_grant.operation_version=2
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    select assertion.*
    into v_existing_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=
      (v_existing_grant.plan_payload->>'evidence_assertion_id')::uuid;

    if not found
       or v_existing_grant.issued_by_user_id<>v_user_id
       or v_existing_grant.plan_payload->>'track_id'
            is distinct from v_future_track_id::text
       or v_existing_grant.plan_payload->>'title'
            is distinct from v_title
       or v_existing_grant.plan_payload->>'normalized_title'
            is distinct from v_normalized_title
       or v_existing_grant.plan_payload->>'slug'
            is distinct from v_slug
       or nullif(v_existing_grant.plan_payload->>'isrc','')
            is distinct from v_isrc
       or v_existing_grant.plan_payload->>'identity_artist_id'
            is distinct from v_primary_artist_id::text
       or v_existing_evidence.source_payload_fingerprint
            is distinct from v_review->>'review_fingerprint'
    then
      raise exception using errcode='23514',
        message='Track Intake reviewed identity changed after the existing exact grant.';
    end if;

    v_grant_id:=v_existing_grant.id;
  else
    v_collision:=
      platform_private.registry_track_creation_collision_state_v2(
        v_future_track_id,
        v_title,
        v_primary_artist_id,
        v_isrc,
        v_slug
      );

    if v_collision<>'[]'::jsonb then
      raise exception using errcode='40001',
        message='A conflicting canonical Track identity exists. Select or review that Track instead.';
    end if;

    v_evidence_id:=
      platform_private.record_registry_track_intake_identity_evidence_v1(
        p_suggestion_id,
        v_future_track_id,
        v_title,
        v_normalized_title,
        v_slug,
        v_isrc,
        v_primary_artist_id
      );

    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=v_evidence_id;

    v_plan:=jsonb_build_object(
      'operation_key','registry.track.create',
      'operation_version',2,
      'track_id',v_future_track_id,
      'title',v_title,
      'normalized_title',v_normalized_title,
      'slug',v_slug,
      'isrc',v_isrc,
      'identity_artist_id',v_primary_artist_id,
      'collision_state_fingerprint',
        platform_private.registry_identity_creation_collision_fingerprint_v1(
          v_collision
        ),
      'evidence_assertion_id',v_evidence.id,
      'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
      'trust_class',v_evidence.trust_class,
      'policy_ruleset_version','registry-track-create-v2'
    );

    v_grant_id:=
      platform_private.issue_registry_track_intake_create_v2_grant(
        p_suggestion_id,
        v_evidence.id,
        v_future_track_id,
        v_plan
      );
  end if;

  select *
  into v_execution
  from platform_private.execute_registry_track_create_v2(
    'registry_track_intake_admin',
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_track_create_v2(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='40001',
      message='Track Intake draft identity independent verification failed.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=v_future_track_id;

  if not found
     or v_track.status<>'draft'
  then
    raise exception using errcode='40001',
      message='Track Intake identity did not materialize as a draft Track.';
  end if;

  return jsonb_build_object(
    'created',not v_execution.idempotent_replay,
    'track',jsonb_build_object(
      'track_id',v_track.id,
      'track_slug',v_track.slug,
      'track_title',v_track.title,
      'status',v_track.status
    ),
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status,
    'idempotent_replay',v_execution.idempotent_replay
  );
end
$$;

revoke all on function
  public.admin_create_registry_track_intake_identity_v1(uuid,text)
  from public, anon, service_role;
grant execute on function
  public.admin_create_registry_track_intake_identity_v1(uuid,text)
  to authenticated;

revoke all on function
  platform_private.registry_track_intake_current_admin_v1()
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.registry_track_intake_identity_review_snapshot_v1(uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.registry_track_intake_deterministic_track_uuid_v1(uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.registry_track_intake_reviewed_slug_v1(uuid,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.registry_track_creation_collision_state_v2(uuid,text,uuid,text,text)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.record_registry_track_intake_identity_evidence_v1(uuid,uuid,text,text,text,text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.issue_registry_track_intake_create_v2_grant(uuid,uuid,uuid,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.execute_registry_track_create_v2(text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  platform_private.verify_registry_track_create_v2(uuid)
  from public,anon,authenticated,service_role;

commit;
