-- MIZIZI Slice 2 Artist Enrichment Authority V1
--
-- Installs four exact, human-authorized one-Artist operations:
--   registry.artist.provider_profile.admit/v1
--   registry.artist.public_image.admit/v1
--   registry.artist.bio.admit/v1
--   registry.artist.type.admit/v1
--
-- This migration performs no Artist backfill and creates no standing MIZIZI
-- capability grant. Product callers must hold manage_registry and every write
-- is bound to one exact Artist, one immutable evidence assertion, one exact
-- short-lived grant, one mutation journal entry, and an independent verifier.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-artist-enrichment-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.capability_definitions') is null
     or to_regclass('public.role_capabilities') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regclass('public.registry_audit_log') is null
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
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
  then
    raise exception
      'STOP: accepted Slice-2 Registry governance foundation is missing';
  end if;

  if not exists (
    select 1
    from pg_roles
    where rolname = 'authenticator'
      and rolcanlogin
      and not rolsuper
  ) then
    raise exception
      'STOP: expected PostgREST authenticator role is missing';
  end if;

  if exists (
       select 1
       from platform_private.system_actors
       where actor_key = 'registry_artist_enrichment_admin'
     )
     or exists (
       select 1
       from public.capability_definitions
       where capability_key in (
         'admit_registry_artist_provider_profile',
         'admit_registry_artist_public_image',
         'admit_registry_artist_bio',
         'admit_registry_artist_type'
       )
     )
     or exists (
       select 1
       from platform_private.registry_operation_types
       where operation_key in (
         'registry.artist.provider_profile.admit',
         'registry.artist.public_image.admit',
         'registry.artist.bio.admit',
         'registry.artist.type.admit'
       )
     )
     or to_regprocedure(
       'platform_private.registry_artist_enrichment_claim_is_valid(text,jsonb,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_artist_enrichment_unowned_state_fingerprint(uuid,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.record_registry_artist_enrichment_user_evidence(uuid,text,jsonb,text,text,text,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'platform_private.issue_registry_artist_enrichment_user_execution_grant(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_artist_enrichment_admission(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_artist_enrichment_admission(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_artist_enrichment_user_claim(uuid,text,jsonb,text,text,text,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'public.admin_execute_registry_artist_provider_profile_admission(uuid,text,text,bigint,integer,text[],text,text,text,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'public.admin_execute_registry_artist_public_image_admission(uuid,text,text,text,text,text,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'public.admin_execute_registry_artist_bio_admission(uuid,text,text,text,text,text,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'public.admin_execute_registry_artist_type_admission(uuid,text,text,text,text,text,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'public.admin_verify_registry_artist_enrichment_admission(uuid)'
     ) is not null
  then
    raise exception
      'STOP: Artist Enrichment V1 authority already exists';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Narrow operation capability vocabulary. These capabilities are operation
-- scopes, not product-role grants. Human caller authority remains
-- manage_registry and exact grants bind the concrete operation/target/plan.
-- ---------------------------------------------------------------------------

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values
  (
    'admit_registry_artist_provider_profile',
    'Admit Registry Artist provider profile',
    'Admit exact provider identity/metric compatibility metadata for one Artist through evidence-bound Registry governance.',
    'registry'
  ),
  (
    'admit_registry_artist_public_image',
    'Admit Registry Artist public image',
    'Admit one evidence-backed public Artist image/source decision.',
    'registry'
  ),
  (
    'admit_registry_artist_bio',
    'Admit Registry Artist biography',
    'Admit one explicitly reviewed Artist biography decision.',
    'registry'
  ),
  (
    'admit_registry_artist_type',
    'Admit Registry Artist type',
    'Admit one explicitly reviewed Artist identity-type decision.',
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
  'registry_artist_enrichment_admin',
  'Registry Artist Enrichment Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain', 'registry',
    'operation_family', 'registry.artist.enrichment',
    'operation_versions', jsonb_build_object(
      'registry.artist.provider_profile.admit', 1,
      'registry.artist.public_image.admit', 1,
      'registry.artist.bio.admit', 1,
      'registry.artist.type.admit', 1
    ),
    'authority_mode', 'human_exact_grant',
    'required_user_capability', 'manage_registry'
  )
);

insert into platform_private.system_actor_executor_bindings (
  actor_key,
  executor_kind,
  executor_key,
  status
)
values (
  'registry_artist_enrichment_admin',
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
    'registry.artist.provider_profile.admit',
    1,
    'admit_registry_artist_provider_profile',
    'medium',
    array['artist']::text[],
    true,
    1,
    1,
    300,
    true,
    true,
    true,
    'Admit exact provider identity/metric compatibility metadata for one existing Artist.'
  ),
  (
    'registry.artist.public_image.admit',
    1,
    'admit_registry_artist_public_image',
    'medium',
    array['artist']::text[],
    true,
    1,
    1,
    300,
    true,
    true,
    true,
    'Admit one exact evidence-backed public image/source for an existing Artist.'
  ),
  (
    'registry.artist.bio.admit',
    1,
    'admit_registry_artist_bio',
    'medium',
    array['artist']::text[],
    true,
    1,
    1,
    300,
    true,
    true,
    true,
    'Admit one explicitly reviewed biography for an existing Artist.'
  ),
  (
    'registry.artist.type.admit',
    1,
    'admit_registry_artist_type',
    'high',
    array['artist']::text[],
    true,
    1,
    1,
    300,
    true,
    true,
    true,
    'Admit one explicitly reviewed identity-semantic Artist type.'
  );

-- ---------------------------------------------------------------------------
-- Strict claim validator. The payload is evidence/proposal, not a patch.
-- Each claim has an explicit field vocabulary and source vocabulary.
-- ---------------------------------------------------------------------------

create function platform_private.registry_artist_enrichment_claim_is_valid(
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
     or jsonb_typeof(p_claim_payload) <> 'object'
     or p_claim_payload = '{}'::jsonb
  then
    return false;
  end if;

  if p_claim_key = 'registry.artist.provider_profile' then
    if p_source_kind not in ('spotify', 'apple_music', 'spotify_apple_music')
       or (
         p_claim_payload - array[
           'spotify_id',
           'apple_music_id',
           'spotify_followers',
           'spotify_popularity',
           'enriched_genres'
         ]::text[]
       ) <> '{}'::jsonb
    then
      return false;
    end if;

    if p_claim_payload ? 'spotify_id' then
      if jsonb_typeof(p_claim_payload -> 'spotify_id') <> 'string'
         or nullif(btrim(p_claim_payload ->> 'spotify_id'), '') is null
         or octet_length(p_claim_payload ->> 'spotify_id') > 512
      then
        return false;
      end if;
    end if;

    if p_claim_payload ? 'apple_music_id' then
      if jsonb_typeof(p_claim_payload -> 'apple_music_id') <> 'string'
         or nullif(btrim(p_claim_payload ->> 'apple_music_id'), '') is null
         or octet_length(p_claim_payload ->> 'apple_music_id') > 512
      then
        return false;
      end if;
    end if;

    if p_claim_payload ? 'spotify_followers' then
      if jsonb_typeof(p_claim_payload -> 'spotify_followers') <> 'number'
         or (p_claim_payload ->> 'spotify_followers') !~ '^[0-9]+$'
         or (p_claim_payload ->> 'spotify_followers')::numeric > 1000000000000
      then
        return false;
      end if;
    end if;

    if p_claim_payload ? 'spotify_popularity' then
      if jsonb_typeof(p_claim_payload -> 'spotify_popularity') <> 'number'
         or (p_claim_payload ->> 'spotify_popularity') !~ '^[0-9]+$'
         or (p_claim_payload ->> 'spotify_popularity')::integer not between 0 and 100
      then
        return false;
      end if;
    end if;

    if p_claim_payload ? 'enriched_genres' then
      if jsonb_typeof(p_claim_payload -> 'enriched_genres') <> 'array'
         or jsonb_array_length(p_claim_payload -> 'enriched_genres') > 100
         or exists (
           select 1
           from jsonb_array_elements(p_claim_payload -> 'enriched_genres') item
           where jsonb_typeof(item) <> 'string'
              or nullif(btrim(item #>> '{}'), '') is null
              or octet_length(item #>> '{}') > 200
         )
      then
        return false;
      end if;
    end if;

    if p_source_kind = 'spotify'
       and p_claim_payload ? 'apple_music_id'
    then
      return false;
    end if;

    if p_source_kind = 'apple_music'
       and (
         p_claim_payload ? 'spotify_id'
         or p_claim_payload ? 'spotify_followers'
         or p_claim_payload ? 'spotify_popularity'
       )
    then
      return false;
    end if;

    return true;
  end if;

  if p_claim_key = 'registry.artist.public_image' then
    if p_source_kind not in ('spotify', 'apple_music')
       or (
         p_claim_payload - array[
           'public_image_url',
           'image_source_provider'
         ]::text[]
       ) <> '{}'::jsonb
       or not (p_claim_payload ? 'public_image_url')
       or not (p_claim_payload ? 'image_source_provider')
       or jsonb_typeof(p_claim_payload -> 'public_image_url') <> 'string'
       or jsonb_typeof(p_claim_payload -> 'image_source_provider') <> 'string'
       or (p_claim_payload ->> 'public_image_url') !~ '^https?://'
       or octet_length(p_claim_payload ->> 'public_image_url') > 4000
       or p_claim_payload ->> 'image_source_provider' <> p_source_kind
    then
      return false;
    end if;
    return true;
  end if;

  if p_claim_key = 'registry.artist.bio' then
    if p_source_kind <> 'apple_music'
       or (
         p_claim_payload - array['bio']::text[]
       ) <> '{}'::jsonb
       or not (p_claim_payload ? 'bio')
       or jsonb_typeof(p_claim_payload -> 'bio') <> 'string'
       or nullif(btrim(p_claim_payload ->> 'bio'), '') is null
       or octet_length(p_claim_payload ->> 'bio') > 32768
    then
      return false;
    end if;
    return true;
  end if;

  if p_claim_key = 'registry.artist.type' then
    if p_source_kind not in ('musicbrainz', 'manual_review')
       or (
         p_claim_payload - array['artist_type']::text[]
       ) <> '{}'::jsonb
       or not (p_claim_payload ? 'artist_type')
       or jsonb_typeof(p_claim_payload -> 'artist_type') <> 'string'
    then
      return false;
    end if;

    v_value := p_claim_payload ->> 'artist_type';
    return v_value in (
      'solo',
      'group',
      'collective',
      'band',
      'duo',
      'unknown'
    );
  end if;

  return false;
end
$$;

-- ---------------------------------------------------------------------------
-- Fingerprint all Artist state not owned by the selected operation. For the
-- provider-profile operation only the five compatibility metadata keys are
-- excluded; every other metadata key remains part of the invariant.
-- ---------------------------------------------------------------------------

create function platform_private.registry_artist_enrichment_unowned_state_fingerprint(
  p_artist_id uuid,
  p_operation_key text
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_artist public.registry_artists%rowtype;
  v_state jsonb;
  v_metadata jsonb;
begin
  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id = p_artist_id;

  if not found then
    return null;
  end if;

  v_state := to_jsonb(v_artist) - 'updated_at';

  case p_operation_key
    when 'registry.artist.provider_profile.admit' then
      v_metadata := coalesce(v_artist.metadata, '{}'::jsonb) - array[
        'spotify_id',
        'apple_music_id',
        'spotify_followers',
        'spotify_popularity',
        'enriched_genres'
      ]::text[];
      v_state := jsonb_set(v_state, '{metadata}', v_metadata, true);
    when 'registry.artist.public_image.admit' then
      v_state := v_state - array[
        'public_image_url',
        'image_source_provider'
      ]::text[];
    when 'registry.artist.bio.admit' then
      v_state := v_state - 'bio';
    when 'registry.artist.type.admit' then
      v_state := v_state - 'artist_type';
    else
      return null;
  end case;

  return encode(
    extensions.digest(v_state::text, 'sha256'),
    'hex'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Immutable user-recorded evidence. Shapes and source kinds are validated by
-- the claim contract; the human caller is recorded as the principal.
-- ---------------------------------------------------------------------------

create function platform_private.record_registry_artist_enrichment_user_evidence(
  p_artist_id uuid,
  p_claim_key text,
  p_claim_payload jsonb,
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
  v_user_id uuid := auth.uid();
  v_recorded_by text;
  v_trust_class text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  if v_user_id is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
  then
    raise exception
      using errcode = '42501',
            message = 'manage_registry is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key = 'registry_artist_enrichment_admin'
      and binding.executor_kind = 'database_role'
      and binding.executor_key = session_user
      and binding.status = 'active'
  ) then
    raise exception
      using errcode = '42501',
            message = 'Current transport is not the Artist-enrichment admin broker.';
  end if;

  if p_artist_id is null
     or p_observed_at is null
     or not exists (
       select 1
       from public.registry_artists artist
       where artist.id = p_artist_id
         and artist.status in ('active', 'draft')
     )
  then
    raise exception
      using errcode = '22023',
            message = 'A valid active/draft Artist and observation time are required.';
  end if;

  if not platform_private.registry_artist_enrichment_claim_is_valid(
    p_claim_key,
    p_claim_payload,
    p_source_kind
  ) then
    raise exception
      using errcode = '22023',
            message = 'Artist enrichment evidence violates the typed V1 claim contract.';
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

  v_trust_class :=
    case
      when p_source_kind = 'manual_review' then 'INTERNAL_FACT'
      else 'EXTERNAL_EVIDENCE'
    end;
  v_recorded_by := 'user:' || v_user_id::text;

  select assertion.id
  into v_assertion_id
  from platform_private.registry_evidence_assertions assertion
  where assertion.subject_type = 'artist'
    and assertion.subject_id = p_artist_id
    and assertion.claim_key = p_claim_key
    and assertion.claim_payload = p_claim_payload
    and assertion.trust_class = v_trust_class
    and assertion.source_kind = p_source_kind
    and assertion.source_ref = btrim(p_source_ref)
    and assertion.source_payload_fingerprint = p_source_payload_fingerprint
    and assertion.recorded_by_principal_key = v_recorded_by
    and assertion.created_at >= now() - interval '10 minutes'
  order by assertion.created_at desc
  limit 1;

  if found then
    return v_assertion_id;
  end if;

  v_assertion_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type', 'artist',
        'subject_id', p_artist_id::text,
        'claim_key', p_claim_key,
        'claim_payload', p_claim_payload,
        'trust_class', v_trust_class,
        'source_kind', p_source_kind,
        'source_ref', btrim(p_source_ref),
        'source_payload_fingerprint', p_source_payload_fingerprint,
        'observed_at', p_observed_at,
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
    p_claim_key,
    p_claim_payload,
    v_trust_class,
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

-- ---------------------------------------------------------------------------
-- Human exact-grant issuer. Claim key selects one immutable operation contract;
-- no standing System Actor grant is involved.
-- ---------------------------------------------------------------------------

create function platform_private.issue_registry_artist_enrichment_user_execution_grant(
  p_evidence_assertion_id uuid
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
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_artist public.registry_artists%rowtype;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_operation_key text;
  v_capability_key text;
  v_ruleset text;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_state_fingerprint text;
  v_unowned_fingerprint text;
  v_target_fingerprint text;
  v_execution_grant_id uuid;
  v_idempotency_key text;
  v_expires_at timestamptz;
begin
  if v_user_id is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
  then
    raise exception
      using errcode = '42501',
            message = 'manage_registry is required.';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key = 'registry_artist_enrichment_admin'
         and actor.status = 'active'
     )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = 'registry_artist_enrichment_admin'
         and binding.executor_kind = 'database_role'
         and binding.executor_key = session_user
         and binding.status = 'active'
     )
  then
    raise exception
      using errcode = '42501',
            message = 'Artist-enrichment admin broker is not active.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id = p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type <> 'artist'
     or v_evidence.recorded_by_principal_key <>
       'user:' || v_user_id::text
     or not platform_private.registry_artist_enrichment_claim_is_valid(
       v_evidence.claim_key,
       v_evidence.claim_payload,
       v_evidence.source_kind
     )
  then
    raise exception
      using errcode = '42501',
            message = 'Evidence assertion is not admissible for this Artist-enrichment grant.';
  end if;

  if v_evidence.observed_at < now() - interval '30 days'
     or v_evidence.observed_at > now() + interval '5 minutes'
  then
    raise exception
      using errcode = '42501',
            message = 'Evidence assertion is outside the V1 freshness window.';
  end if;

  case v_evidence.claim_key
    when 'registry.artist.provider_profile' then
      v_operation_key := 'registry.artist.provider_profile.admit';
      v_capability_key := 'admit_registry_artist_provider_profile';
      v_ruleset := 'registry-artist-provider-profile-admission-v1';
    when 'registry.artist.public_image' then
      v_operation_key := 'registry.artist.public_image.admit';
      v_capability_key := 'admit_registry_artist_public_image';
      v_ruleset := 'registry-artist-public-image-admission-v1';
    when 'registry.artist.bio' then
      v_operation_key := 'registry.artist.bio.admit';
      v_capability_key := 'admit_registry_artist_bio';
      v_ruleset := 'registry-artist-bio-admission-v1';
    when 'registry.artist.type' then
      v_operation_key := 'registry.artist.type.admit';
      v_capability_key := 'admit_registry_artist_type';
      v_ruleset := 'registry-artist-type-admission-v1';
    else
      raise exception
        using errcode = '42501',
              message = 'Evidence claim is outside Artist Enrichment V1.';
  end case;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key = v_operation_key
      and operation_type.operation_version = 1
      and operation_type.capability_key = v_capability_key
      and operation_type.enabled
      and operation_type.max_targets = 1
      and operation_type.max_rows_ceiling = 1
      and operation_type.requires_existing_target
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception
      using errcode = '42501',
            message = 'Typed Artist-enrichment operation is disabled or malformed.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id = v_evidence.subject_id;

  if not found
     or v_artist.status not in ('active', 'draft')
  then
    raise exception
      using errcode = '42501',
            message = 'Artist is not eligible for V1 enrichment admission.';
  end if;

  v_idempotency_key :=
    'admin-enrichment:' ||
    substr(replace(v_evidence.claim_key, 'registry.artist.', ''), 1, 24) ||
    ':' || substr(v_evidence.assertion_fingerprint, 1, 40);

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key = 'registry_artist_enrichment_admin'
    and execution_grant.operation_key = v_operation_key
    and execution_grant.operation_version = 1
    and execution_grant.idempotency_key = v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id <> v_user_id
       or v_existing.plan_payload ->> 'evidence_assertion_id'
         is distinct from v_evidence.id::text
    then
      raise exception
        using errcode = '23505',
              message = 'Idempotency key is already bound to different Artist-enrichment authority.';
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

  v_state_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'artist',
      v_artist.id
    );
  v_unowned_fingerprint :=
    platform_private.registry_artist_enrichment_unowned_state_fingerprint(
      v_artist.id,
      v_operation_key
    );

  if v_state_fingerprint is null
     or v_unowned_fingerprint is null
  then
    raise exception
      using errcode = '42501',
            message = 'Artist state cannot be fingerprinted for exact admission.';
  end if;

  v_plan := jsonb_build_object(
    'operation_key', v_operation_key,
    'operation_version', 1,
    'artist_id', v_artist.id::text,
    'evidence_assertion_id', v_evidence.id::text,
    'evidence_assertion_fingerprint', v_evidence.assertion_fingerprint,
    'claim_key', v_evidence.claim_key,
    'proposed', v_evidence.claim_payload,
    'expected_state_fingerprint', v_state_fingerprint,
    'expected_unowned_state_fingerprint', v_unowned_fingerprint,
    'trust_class', v_evidence.trust_class,
    'policy_ruleset_version', v_ruleset
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
  v_expires_at := now() + interval '5 minutes';

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
    'registry_artist_enrichment_admin',
    v_capability_key,
    null,
    v_operation_key,
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:' || v_user_id::text,
    v_ruleset,
    'manage_registry',
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

-- ---------------------------------------------------------------------------
-- Exact family executor. It shares grant/journal mechanics but every branch
-- owns a fixed column set. No operation can supply arbitrary field names.
-- ---------------------------------------------------------------------------

create function platform_private.execute_registry_artist_enrichment_admission(
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
  v_proposed jsonb;
  v_artist_id uuid;
  v_evidence_id uuid;
  v_claim_key text;
  v_ruleset text;
  v_expected_capability text;
  v_expected_claim_key text;
  v_current_fingerprint text;
  v_unowned_fingerprint text;
  v_new_metadata jsonb;
  v_before_owned jsonb;
  v_after_owned jsonb;
  v_event_id uuid;
  v_event_ids uuid[] := array[]::uuid[];
  v_rows integer;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_artist_enrichment_admin',
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
            message = 'Artist-enrichment operation is not in an executable state.';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = p_execution_grant_id;

  if not found
     or v_grant.actor_key <> 'registry_artist_enrichment_admin'
     or v_grant.operation_version <> 1
     or v_grant.max_rows <> 1
     or v_grant.required_user_capability_key <> 'manage_registry'
     or v_grant.issued_by_user_id is null
  then
    raise exception
      using errcode = '42501',
            message = 'Execution grant is not a human Artist Enrichment V1 grant.';
  end if;

  case v_grant.operation_key
    when 'registry.artist.provider_profile.admit' then
      v_expected_capability := 'admit_registry_artist_provider_profile';
      v_expected_claim_key := 'registry.artist.provider_profile';
      v_ruleset := 'registry-artist-provider-profile-admission-v1';
    when 'registry.artist.public_image.admit' then
      v_expected_capability := 'admit_registry_artist_public_image';
      v_expected_claim_key := 'registry.artist.public_image';
      v_ruleset := 'registry-artist-public-image-admission-v1';
    when 'registry.artist.bio.admit' then
      v_expected_capability := 'admit_registry_artist_bio';
      v_expected_claim_key := 'registry.artist.bio';
      v_ruleset := 'registry-artist-bio-admission-v1';
    when 'registry.artist.type.admit' then
      v_expected_capability := 'admit_registry_artist_type';
      v_expected_claim_key := 'registry.artist.type';
      v_ruleset := 'registry-artist-type-admission-v1';
    else
      raise exception
        using errcode = '42501',
              message = 'Execution grant is outside Artist Enrichment V1.';
  end case;

  if v_grant.capability_key <> v_expected_capability
     or v_grant.policy_ruleset_version <> v_ruleset
  then
    raise exception
      using errcode = '42501',
            message = 'Execution grant capability/ruleset does not match its typed operation.';
  end if;

  v_plan := v_grant.plan_payload;
  if (
    v_plan - array[
      'operation_key',
      'operation_version',
      'artist_id',
      'evidence_assertion_id',
      'evidence_assertion_fingerprint',
      'claim_key',
      'proposed',
      'expected_state_fingerprint',
      'expected_unowned_state_fingerprint',
      'trust_class',
      'policy_ruleset_version'
    ]::text[]
  ) <> '{}'::jsonb
  then
    raise exception
      using errcode = '42501',
            message = 'Execution plan contains fields outside Artist Enrichment V1.';
  end if;

  begin
    v_artist_id := (v_plan ->> 'artist_id')::uuid;
    v_evidence_id := (v_plan ->> 'evidence_assertion_id')::uuid;
  exception
    when others then
      raise exception
        using errcode = '22023',
              message = 'Execution plan contains malformed typed values.';
  end;

  v_claim_key := v_plan ->> 'claim_key';
  v_proposed := v_plan -> 'proposed';

  if v_plan ->> 'operation_key' <> v_grant.operation_key
     or (v_plan ->> 'operation_version')::integer <> 1
     or v_claim_key <> v_expected_claim_key
     or v_plan ->> 'policy_ruleset_version' <> v_ruleset
     or not platform_private.registry_artist_enrichment_claim_is_valid(
       v_claim_key,
       v_proposed,
       case
         when v_claim_key = 'registry.artist.public_image'
           then v_proposed ->> 'image_source_provider'
         when v_claim_key = 'registry.artist.bio'
           then 'apple_music'
         else coalesce(
           (
             select assertion.source_kind
             from platform_private.registry_evidence_assertions assertion
             where assertion.id = v_evidence_id
           ),
           ''
         )
       end
     )
  then
    raise exception
      using errcode = '42501',
            message = 'Execution plan violates the typed Artist Enrichment V1 policy.';
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
     or v_evidence.claim_key <> v_expected_claim_key
     or v_evidence.claim_payload <> v_proposed
     or v_evidence.assertion_fingerprint is distinct from
       v_plan ->> 'evidence_assertion_fingerprint'
     or v_evidence.trust_class is distinct from
       v_plan ->> 'trust_class'
     or v_evidence.recorded_by_principal_key <>
       'user:' || v_grant.issued_by_user_id::text
     or not platform_private.registry_artist_enrichment_claim_is_valid(
       v_evidence.claim_key,
       v_evidence.claim_payload,
       v_evidence.source_kind
     )
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
  then
    raise exception
      using errcode = '42501',
            message = 'Artist is no longer eligible for enrichment admission.';
  end if;

  v_current_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'artist',
      v_artist.id
    );
  v_unowned_fingerprint :=
    platform_private.registry_artist_enrichment_unowned_state_fingerprint(
      v_artist.id,
      v_grant.operation_key
    );

  if v_current_fingerprint <> v_target.expected_state_fingerprint
     or v_current_fingerprint <>
       v_plan ->> 'expected_state_fingerprint'
     or v_unowned_fingerprint <>
       v_plan ->> 'expected_unowned_state_fingerprint'
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

  if v_grant.operation_key = 'registry.artist.provider_profile.admit' then
    v_before_owned := jsonb_build_object(
      'spotify_id', v_artist.metadata -> 'spotify_id',
      'apple_music_id', v_artist.metadata -> 'apple_music_id',
      'spotify_followers', v_artist.metadata -> 'spotify_followers',
      'spotify_popularity', v_artist.metadata -> 'spotify_popularity',
      'enriched_genres', v_artist.metadata -> 'enriched_genres'
    );
    v_new_metadata := v_artist.metadata;

    if v_proposed ? 'spotify_id' then
      v_new_metadata := jsonb_set(
        v_new_metadata,
        '{spotify_id}',
        v_proposed -> 'spotify_id',
        true
      );
    end if;
    if v_proposed ? 'apple_music_id' then
      v_new_metadata := jsonb_set(
        v_new_metadata,
        '{apple_music_id}',
        v_proposed -> 'apple_music_id',
        true
      );
    end if;
    if v_proposed ? 'spotify_followers' then
      v_new_metadata := jsonb_set(
        v_new_metadata,
        '{spotify_followers}',
        v_proposed -> 'spotify_followers',
        true
      );
    end if;
    if v_proposed ? 'spotify_popularity' then
      v_new_metadata := jsonb_set(
        v_new_metadata,
        '{spotify_popularity}',
        v_proposed -> 'spotify_popularity',
        true
      );
    end if;
    if v_proposed ? 'enriched_genres' then
      v_new_metadata := jsonb_set(
        v_new_metadata,
        '{enriched_genres}',
        v_proposed -> 'enriched_genres',
        true
      );
    end if;

    update public.registry_artists
    set
      metadata = v_new_metadata,
      updated_at = now()
    where id = v_artist.id;
    get diagnostics v_rows = row_count;

    v_after_owned := jsonb_build_object(
      'spotify_id', v_new_metadata -> 'spotify_id',
      'apple_music_id', v_new_metadata -> 'apple_music_id',
      'spotify_followers', v_new_metadata -> 'spotify_followers',
      'spotify_popularity', v_new_metadata -> 'spotify_popularity',
      'enriched_genres', v_new_metadata -> 'enriched_genres'
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
      'artist',
      v_artist.id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'metadata.provider_profile',
      'public.registry_artists.metadata',
      jsonb_build_object('value', v_before_owned),
      jsonb_build_object(
        'value', v_after_owned,
        'evidence_assertion_id', v_evidence.id,
        'policy_ruleset_version', v_ruleset
      ),
      'admit_artist_provider_profile',
      'succeeded',
      'system:registry_artist_enrichment_admin'
    )
    returning id into v_event_id;
    v_event_ids := array_append(v_event_ids, v_event_id);

  elsif v_grant.operation_key = 'registry.artist.public_image.admit' then
    update public.registry_artists
    set
      public_image_url = v_proposed ->> 'public_image_url',
      image_source_provider = v_proposed ->> 'image_source_provider',
      updated_at = now()
    where id = v_artist.id;
    get diagnostics v_rows = row_count;

    insert into public.registry_canonical_write_events (
      registry_entity_type, registry_entity_id, source_suggestion_id,
      source_table, field_name, target_path, before_value, after_value,
      action, status, actor
    ) values (
      'artist', v_artist.id::text, v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'public_image_url', 'public.registry_artists.public_image_url',
      jsonb_build_object('value', v_artist.public_image_url),
      jsonb_build_object(
        'value', v_proposed ->> 'public_image_url',
        'evidence_assertion_id', v_evidence.id,
        'policy_ruleset_version', v_ruleset
      ),
      'admit_artist_public_image', 'succeeded',
      'system:registry_artist_enrichment_admin'
    ) returning id into v_event_id;
    v_event_ids := array_append(v_event_ids, v_event_id);

    insert into public.registry_canonical_write_events (
      registry_entity_type, registry_entity_id, source_suggestion_id,
      source_table, field_name, target_path, before_value, after_value,
      action, status, actor
    ) values (
      'artist', v_artist.id::text, v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'image_source_provider', 'public.registry_artists.image_source_provider',
      jsonb_build_object('value', v_artist.image_source_provider),
      jsonb_build_object(
        'value', v_proposed ->> 'image_source_provider',
        'evidence_assertion_id', v_evidence.id,
        'policy_ruleset_version', v_ruleset
      ),
      'admit_artist_public_image', 'succeeded',
      'system:registry_artist_enrichment_admin'
    ) returning id into v_event_id;
    v_event_ids := array_append(v_event_ids, v_event_id);

  elsif v_grant.operation_key = 'registry.artist.bio.admit' then
    update public.registry_artists
    set
      bio = v_proposed ->> 'bio',
      updated_at = now()
    where id = v_artist.id;
    get diagnostics v_rows = row_count;

    insert into public.registry_canonical_write_events (
      registry_entity_type, registry_entity_id, source_suggestion_id,
      source_table, field_name, target_path, before_value, after_value,
      action, status, actor
    ) values (
      'artist', v_artist.id::text, v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'bio', 'public.registry_artists.bio',
      jsonb_build_object('value', v_artist.bio),
      jsonb_build_object(
        'value', v_proposed ->> 'bio',
        'evidence_assertion_id', v_evidence.id,
        'policy_ruleset_version', v_ruleset
      ),
      'admit_artist_bio', 'succeeded',
      'system:registry_artist_enrichment_admin'
    ) returning id into v_event_id;
    v_event_ids := array_append(v_event_ids, v_event_id);

  elsif v_grant.operation_key = 'registry.artist.type.admit' then
    update public.registry_artists
    set
      artist_type = v_proposed ->> 'artist_type',
      updated_at = now()
    where id = v_artist.id;
    get diagnostics v_rows = row_count;

    insert into public.registry_canonical_write_events (
      registry_entity_type, registry_entity_id, source_suggestion_id,
      source_table, field_name, target_path, before_value, after_value,
      action, status, actor
    ) values (
      'artist', v_artist.id::text, v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'artist_type', 'public.registry_artists.artist_type',
      jsonb_build_object('value', v_artist.artist_type),
      jsonb_build_object(
        'value', v_proposed ->> 'artist_type',
        'evidence_assertion_id', v_evidence.id,
        'policy_ruleset_version', v_ruleset
      ),
      'admit_artist_type', 'succeeded',
      'system:registry_artist_enrichment_admin'
    ) returning id into v_event_id;
    v_event_ids := array_append(v_event_ids, v_event_id);
  else
    raise exception
      using errcode = '42501',
            message = 'No executor exists for this Artist Enrichment V1 operation.';
  end if;

  if v_rows <> 1 then
    raise exception
      using errcode = '40001',
            message = 'Artist-enrichment admission lost its one-row compare-and-set boundary.';
  end if;

  if platform_private.registry_artist_enrichment_unowned_state_fingerprint(
       v_artist.id,
       v_grant.operation_key
     ) <>
     v_plan ->> 'expected_unowned_state_fingerprint'
  then
    raise exception
      using errcode = '23514',
            message = 'Artist-enrichment operation changed state outside its owned field family.';
  end if;

  insert into platform_private.registry_operation_write_events (
    operation_id,
    canonical_write_event_id
  )
  select
    v_operation.id,
    event_id
  from unnest(v_event_ids) as event_id;

  update platform_private.registry_mutation_operations
  set
    affected_rows = 1,
    status = 'succeeded',
    verifier_status = 'pending',
    result_payload = jsonb_build_object(
      'artist_id', v_artist.id,
      'claim_key', v_claim_key,
      'evidence_assertion_id', v_evidence.id,
      'canonical_write_event_ids', to_jsonb(v_event_ids)
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

-- ---------------------------------------------------------------------------
-- Independent verifier. It rechecks exact target/evidence/final owned state,
-- verifies that every unowned Artist field remains fingerprint-identical, and
-- validates canonical write-event causality.
-- ---------------------------------------------------------------------------

create function platform_private.verify_registry_artist_enrichment_admission(
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
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_artist public.registry_artists%rowtype;
  v_plan jsonb;
  v_proposed jsonb;
  v_artist_id uuid;
  v_evidence_id uuid;
  v_claim_key text;
  v_expected_capability text;
  v_expected_action text;
  v_expected_event_count integer;
  v_valid_event_count integer;
  v_link_count integer;
  v_failure text;
begin
  if p_operation_id is null then
    raise exception
      using errcode = '22023',
            message = 'Operation id is required.';
  end if;

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id = p_operation_id
  for update;

  if not found
     or v_operation.actor_key <> 'registry_artist_enrichment_admin'
     or v_operation.operation_version <> 1
  then
    raise exception
      using errcode = 'P0002',
            message = 'Artist Enrichment V1 operation not found.';
  end if;

  if v_operation.verifier_status = 'passed' then
    operation_id := v_operation.id;
    verifier_status := 'passed';
    return next;
    return;
  end if;

  case v_operation.operation_key
    when 'registry.artist.provider_profile.admit' then
      v_expected_capability := 'admit_registry_artist_provider_profile';
      v_expected_action := 'admit_artist_provider_profile';
      v_expected_event_count := 1;
    when 'registry.artist.public_image.admit' then
      v_expected_capability := 'admit_registry_artist_public_image';
      v_expected_action := 'admit_artist_public_image';
      v_expected_event_count := 2;
    when 'registry.artist.bio.admit' then
      v_expected_capability := 'admit_registry_artist_bio';
      v_expected_action := 'admit_artist_bio';
      v_expected_event_count := 1;
    when 'registry.artist.type.admit' then
      v_expected_capability := 'admit_registry_artist_type';
      v_expected_action := 'admit_artist_type';
      v_expected_event_count := 1;
    else
      raise exception
        using errcode = 'P0002',
              message = 'Artist Enrichment V1 operation key is invalid.';
  end case;

  if v_operation.capability_key <> v_expected_capability then
    v_failure := 'operation_capability_mismatch';
  end if;

  if v_failure is null
     and (
       v_operation.status <> 'succeeded'
       or v_operation.affected_rows <> 1
     )
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
    v_claim_key := v_plan ->> 'claim_key';
    v_proposed := v_plan -> 'proposed';
    begin
      v_artist_id := (v_plan ->> 'artist_id')::uuid;
      v_evidence_id := (v_plan ->> 'evidence_assertion_id')::uuid;
    exception
      when others then
        v_failure := 'plan_typed_values_malformed';
    end;
  end if;

  if v_failure is null then
    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_grant.id
      and target.subject_type = 'artist';

    if not found
       or v_target.subject_id <> v_artist_id
       or (
         select count(*)
         from platform_private.registry_execution_grant_targets target_count
         where target_count.execution_grant_id = v_grant.id
       ) <> 1
    then
      v_failure := 'exact_artist_target_missing';
    end if;
  end if;

  if v_failure is null then
    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id = v_evidence_id;

    if not found
       or v_evidence.subject_type <> 'artist'
       or v_evidence.subject_id <> v_artist_id
       or v_evidence.claim_key <> v_claim_key
       or v_evidence.claim_payload <> v_proposed
       or v_evidence.assertion_fingerprint <>
         v_plan ->> 'evidence_assertion_fingerprint'
    then
      v_failure := 'bound_evidence_missing_or_mismatched';
    end if;
  end if;

  if v_failure is null then
    select artist.*
    into v_artist
    from public.registry_artists artist
    where artist.id = v_artist_id;

    if not found then
      v_failure := 'canonical_artist_missing';
    end if;
  end if;

  if v_failure is null
     and platform_private.registry_artist_enrichment_unowned_state_fingerprint(
       v_artist_id,
       v_operation.operation_key
     ) <> v_plan ->> 'expected_unowned_state_fingerprint'
  then
    v_failure := 'unowned_artist_state_changed';
  end if;

  if v_failure is null then
    if v_operation.operation_key = 'registry.artist.provider_profile.admit' then
      if exists (
        select 1
        from jsonb_each(v_proposed) item
        where v_artist.metadata -> item.key is distinct from item.value
      ) then
        v_failure := 'provider_profile_state_mismatch';
      end if;
    elsif v_operation.operation_key = 'registry.artist.public_image.admit' then
      if v_artist.public_image_url is distinct from
           v_proposed ->> 'public_image_url'
         or v_artist.image_source_provider is distinct from
           v_proposed ->> 'image_source_provider'
      then
        v_failure := 'public_image_state_mismatch';
      end if;
    elsif v_operation.operation_key = 'registry.artist.bio.admit' then
      if v_artist.bio is distinct from v_proposed ->> 'bio' then
        v_failure := 'bio_state_mismatch';
      end if;
    elsif v_operation.operation_key = 'registry.artist.type.admit' then
      if v_artist.artist_type is distinct from
           v_proposed ->> 'artist_type'
      then
        v_failure := 'artist_type_state_mismatch';
      end if;
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_link_count
    from platform_private.registry_operation_write_events link
    where link.operation_id = v_operation.id;

    select count(*)::integer
    into v_valid_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id = link.canonical_write_event_id
    where link.operation_id = v_operation.id
      and event.registry_entity_type = 'artist'
      and event.registry_entity_id = v_artist_id::text
      and event.source_suggestion_id = v_evidence_id::text
      and event.source_table =
        'platform_private.registry_evidence_assertions'
      and event.action = v_expected_action
      and event.status = 'succeeded'
      and event.actor = 'system:registry_artist_enrichment_admin'
      and (
        (
          v_operation.operation_key = 'registry.artist.provider_profile.admit'
          and event.field_name = 'metadata.provider_profile'
          and event.target_path = 'public.registry_artists.metadata'
        )
        or (
          v_operation.operation_key = 'registry.artist.public_image.admit'
          and (
            (
              event.field_name = 'public_image_url'
              and event.target_path =
                'public.registry_artists.public_image_url'
            )
            or (
              event.field_name = 'image_source_provider'
              and event.target_path =
                'public.registry_artists.image_source_provider'
            )
          )
        )
        or (
          v_operation.operation_key = 'registry.artist.bio.admit'
          and event.field_name = 'bio'
          and event.target_path = 'public.registry_artists.bio'
        )
        or (
          v_operation.operation_key = 'registry.artist.type.admit'
          and event.field_name = 'artist_type'
          and event.target_path = 'public.registry_artists.artist_type'
        )
      );

    if v_link_count <> v_expected_event_count
       or v_valid_event_count <> v_expected_event_count
    then
      v_failure := 'canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set
      verifier_status = 'passed',
      result_payload =
        result_payload ||
        jsonb_build_object(
          'verification',
          jsonb_build_object(
            'status', 'passed',
            'verified_at', now()
          )
        ),
      updated_at = now()
    where id = v_operation.id;

    operation_id := v_operation.id;
    verifier_status := 'passed';
    return next;
    return;
  end if;

  update platform_private.registry_mutation_operations
  set
    verifier_status = 'failed',
    error_code = 'artist_enrichment_verification_failed',
    error_message = v_failure,
    result_payload =
      result_payload ||
      jsonb_build_object(
        'verification',
        jsonb_build_object(
          'status', 'failed',
          'reason', v_failure,
          'verified_at', now()
        )
      ),
    updated_at = now()
  where id = v_operation.id;

  operation_id := v_operation.id;
  verifier_status := 'failed';
  return next;
end
$$;

-- ---------------------------------------------------------------------------
-- Internal human-claim composition helper. Public wrappers below expose only
-- typed signatures; this helper cannot be invoked directly by product roles.
-- ---------------------------------------------------------------------------

create function platform_private.execute_registry_artist_enrichment_user_claim(
  p_artist_id uuid,
  p_claim_key text,
  p_claim_payload jsonb,
  p_source_kind text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz
)
returns table (
  evidence_assertion_id uuid,
  execution_grant_id uuid,
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_evidence_id uuid;
  v_grant record;
  v_execution record;
begin
  if v_user_id is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
  then
    raise exception
      using errcode = '42501',
            message = 'manage_registry is required.';
  end if;

  v_evidence_id :=
    platform_private.record_registry_artist_enrichment_user_evidence(
      p_artist_id,
      p_claim_key,
      p_claim_payload,
      p_source_kind,
      p_source_ref,
      p_source_payload_fingerprint,
      p_observed_at
    );

  select *
  into v_grant
  from platform_private.issue_registry_artist_enrichment_user_execution_grant(
    v_evidence_id
  );

  select *
  into v_execution
  from platform_private.execute_registry_artist_enrichment_admission(
    v_grant.execution_grant_id
  );

  if not v_execution.idempotent_replay then
    insert into public.registry_audit_log (
      actor_id,
      actor_label,
      action,
      entity_type,
      entity_id,
      after_value,
      metadata
    )
    values (
      v_user_id,
      'registry_admin',
      'execute_registry_artist_enrichment_admission',
      'registry_artist',
      p_artist_id,
      p_claim_payload,
      jsonb_build_object(
        'claim_key', p_claim_key,
        'evidence_assertion_id', v_evidence_id,
        'execution_grant_id', v_grant.execution_grant_id,
        'operation_id', v_execution.operation_id,
        'source_kind', p_source_kind
      )
    );
  end if;

  evidence_assertion_id := v_evidence_id;
  execution_grant_id := v_grant.execution_grant_id;
  operation_id := v_execution.operation_id;
  operation_status := v_execution.operation_status;
  verifier_status := v_execution.verifier_status;
  idempotent_replay := v_execution.idempotent_replay;
  return next;
end
$$;

-- ---------------------------------------------------------------------------
-- Typed public broker wrappers. Each signature owns one semantic field family.
-- ---------------------------------------------------------------------------

create function public.admin_execute_registry_artist_provider_profile_admission(
  p_artist_id uuid,
  p_spotify_id text default null,
  p_apple_music_id text default null,
  p_spotify_followers bigint default null,
  p_spotify_popularity integer default null,
  p_enriched_genres text[] default null,
  p_source_kind text default 'spotify_apple_music',
  p_source_ref text default null,
  p_source_payload_fingerprint text default null,
  p_observed_at timestamptz default now()
)
returns table (
  evidence_assertion_id uuid,
  execution_grant_id uuid,
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_payload jsonb := '{}'::jsonb;
begin
  if p_spotify_id is not null then
    v_payload := v_payload ||
      jsonb_build_object('spotify_id', btrim(p_spotify_id));
  end if;
  if p_apple_music_id is not null then
    v_payload := v_payload ||
      jsonb_build_object('apple_music_id', btrim(p_apple_music_id));
  end if;
  if p_spotify_followers is not null then
    v_payload := v_payload ||
      jsonb_build_object('spotify_followers', p_spotify_followers);
  end if;
  if p_spotify_popularity is not null then
    v_payload := v_payload ||
      jsonb_build_object('spotify_popularity', p_spotify_popularity);
  end if;
  if p_enriched_genres is not null then
    v_payload := v_payload ||
      jsonb_build_object(
        'enriched_genres',
        to_jsonb(
          array(
            select distinct btrim(genre)
            from unnest(p_enriched_genres) genre
            where nullif(btrim(genre), '') is not null
            order by btrim(genre)
          )
        )
      );
  end if;

  return query
  select *
  from platform_private.execute_registry_artist_enrichment_user_claim(
    p_artist_id,
    'registry.artist.provider_profile',
    v_payload,
    p_source_kind,
    p_source_ref,
    p_source_payload_fingerprint,
    p_observed_at
  );
end
$$;

create function public.admin_execute_registry_artist_public_image_admission(
  p_artist_id uuid,
  p_public_image_url text,
  p_image_source_provider text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz default now()
)
returns table (
  evidence_assertion_id uuid,
  execution_grant_id uuid,
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language sql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
  select *
  from platform_private.execute_registry_artist_enrichment_user_claim(
    p_artist_id,
    'registry.artist.public_image',
    jsonb_build_object(
      'public_image_url', p_public_image_url,
      'image_source_provider', p_image_source_provider
    ),
    p_image_source_provider,
    p_source_ref,
    p_source_payload_fingerprint,
    p_observed_at
  )
$$;

create function public.admin_execute_registry_artist_bio_admission(
  p_artist_id uuid,
  p_bio text,
  p_source_kind text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz default now()
)
returns table (
  evidence_assertion_id uuid,
  execution_grant_id uuid,
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language sql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
  select *
  from platform_private.execute_registry_artist_enrichment_user_claim(
    p_artist_id,
    'registry.artist.bio',
    jsonb_build_object('bio', p_bio),
    p_source_kind,
    p_source_ref,
    p_source_payload_fingerprint,
    p_observed_at
  )
$$;

create function public.admin_execute_registry_artist_type_admission(
  p_artist_id uuid,
  p_artist_type text,
  p_source_kind text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz default now()
)
returns table (
  evidence_assertion_id uuid,
  execution_grant_id uuid,
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language sql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
  select *
  from platform_private.execute_registry_artist_enrichment_user_claim(
    p_artist_id,
    'registry.artist.type',
    jsonb_build_object('artist_type', p_artist_type),
    p_source_kind,
    p_source_ref,
    p_source_payload_fingerprint,
    p_observed_at
  )
$$;

create function public.admin_verify_registry_artist_enrichment_admission(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
begin
  if auth.uid() is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
  then
    raise exception
      using errcode = '42501',
            message = 'manage_registry is required.';
  end if;

  if not exists (
    select 1
    from platform_private.registry_mutation_operations operation
    join platform_private.registry_execution_grants execution_grant
      on execution_grant.id = operation.execution_grant_id
    where operation.id = p_operation_id
      and operation.actor_key = 'registry_artist_enrichment_admin'
      and execution_grant.issued_by_user_id = auth.uid()
      and execution_grant.required_user_capability_key = 'manage_registry'
  ) then
    raise exception
      using errcode = '42501',
            message =
              'Current user is not authorized to verify this Artist-enrichment operation.';
  end if;

  return query
  select *
  from platform_private.verify_registry_artist_enrichment_admission(
    p_operation_id
  );
end
$$;

-- ---------------------------------------------------------------------------
-- ACL closure. Private machinery is not a product RPC surface. Public wrappers
-- remain request-user only and still enforce manage_registry internally.
-- ---------------------------------------------------------------------------

revoke all on function
  platform_private.registry_artist_enrichment_claim_is_valid(text,jsonb,text),
  platform_private.registry_artist_enrichment_unowned_state_fingerprint(uuid,text),
  platform_private.record_registry_artist_enrichment_user_evidence(uuid,text,jsonb,text,text,text,timestamptz),
  platform_private.issue_registry_artist_enrichment_user_execution_grant(uuid),
  platform_private.execute_registry_artist_enrichment_admission(uuid),
  platform_private.verify_registry_artist_enrichment_admission(uuid),
  platform_private.execute_registry_artist_enrichment_user_claim(uuid,text,jsonb,text,text,text,timestamptz)
from public, anon, authenticated, service_role;

revoke all on function
  public.admin_execute_registry_artist_provider_profile_admission(uuid,text,text,bigint,integer,text[],text,text,text,timestamptz),
  public.admin_execute_registry_artist_public_image_admission(uuid,text,text,text,text,timestamptz),
  public.admin_execute_registry_artist_bio_admission(uuid,text,text,text,text,text,timestamptz),
  public.admin_execute_registry_artist_type_admission(uuid,text,text,text,text,text,timestamptz),
  public.admin_verify_registry_artist_enrichment_admission(uuid)
from public, anon, service_role;

grant execute on function
  public.admin_execute_registry_artist_provider_profile_admission(uuid,text,text,bigint,integer,text[],text,text,text,timestamptz),
  public.admin_execute_registry_artist_public_image_admission(uuid,text,text,text,text,timestamptz),
  public.admin_execute_registry_artist_bio_admission(uuid,text,text,text,text,text,timestamptz),
  public.admin_execute_registry_artist_type_admission(uuid,text,text,text,text,text,timestamptz),
  public.admin_verify_registry_artist_enrichment_admission(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Postflight invariants: operation capability keys are not standing product
-- role grants and MIZIZI gains no authority merely because the operations exist.
-- ---------------------------------------------------------------------------

do $postflight$
begin
  if exists (
    select 1
    from public.role_capabilities
    where capability_key in (
      'admit_registry_artist_provider_profile',
      'admit_registry_artist_public_image',
      'admit_registry_artist_bio',
      'admit_registry_artist_type'
    )
  ) then
    raise exception
      'STOP: Artist Enrichment V1 operation capabilities leaked into product roles';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key = 'mizizi'
      and capability_key in (
        'admit_registry_artist_provider_profile',
        'admit_registry_artist_public_image',
        'admit_registry_artist_bio',
        'admit_registry_artist_type'
      )
      and status = 'active'
      and valid_from <= now()
      and expires_at > now()
  ) then
    raise exception
      'STOP: MIZIZI must have zero standing Artist Enrichment V1 authority';
  end if;
end
$postflight$;

commit;
