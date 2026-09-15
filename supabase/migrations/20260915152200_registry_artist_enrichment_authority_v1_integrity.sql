-- MIZIZI Slice 2 Artist Enrichment Authority V1 Integrity
--
-- Hardens the V1 family after its foundation migration without widening
-- authority or performing any Artist backfill.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-artist-enrichment-authority-v1-integrity',
    0
  )
);

do $preflight$
begin
  if to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regprocedure(
       'platform_private.registry_artist_enrichment_claim_is_valid(text,jsonb,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_artist_enrichment_unowned_state_fingerprint(uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_artist_enrichment_admission(uuid)'
     ) is null
  then
    raise exception
      'STOP: Artist Enrichment V1 foundation is incomplete';
  end if;
end
$preflight$;

-- Keep the typed claim vocabulary but make the validator respect the exact
-- immutable evidence-row payload ceiling. Testing the serialized JSONB size
-- avoids discrepancies caused by quoting/escaping overhead.
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
     or jsonb_typeof(p_claim_payload) <> 'object'
     or p_claim_payload = '{}'::jsonb
     or octet_length(p_claim_payload::text) > 16000
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
    then
      return false;
    end if;
    return true;
  end if;

  if p_claim_key = 'registry.artist.type' then
    if p_source_kind not in ('musicbrainz', 'name_heuristic')
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

-- Strengthen verification so it proves grant/evidence authority and the exact
-- canonical receipt values in addition to target/row/field isolation.
create or replace function platform_private.verify_registry_artist_enrichment_admission(
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
  v_expected_claim_key text;
  v_expected_ruleset text;
  v_expected_action text;
  v_expected_event_count integer;
  v_expected_owned jsonb;
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
      v_expected_claim_key := 'registry.artist.provider_profile';
      v_expected_ruleset := 'registry-artist-provider-profile-admission-v1';
      v_expected_action := 'admit_artist_provider_profile';
      v_expected_event_count := 1;
    when 'registry.artist.public_image.admit' then
      v_expected_capability := 'admit_registry_artist_public_image';
      v_expected_claim_key := 'registry.artist.public_image';
      v_expected_ruleset := 'registry-artist-public-image-admission-v1';
      v_expected_action := 'admit_artist_public_image';
      v_expected_event_count := 2;
    when 'registry.artist.bio.admit' then
      v_expected_capability := 'admit_registry_artist_bio';
      v_expected_claim_key := 'registry.artist.bio';
      v_expected_ruleset := 'registry-artist-bio-admission-v1';
      v_expected_action := 'admit_artist_bio';
      v_expected_event_count := 1;
    when 'registry.artist.type.admit' then
      v_expected_capability := 'admit_registry_artist_type';
      v_expected_claim_key := 'registry.artist.type';
      v_expected_ruleset := 'registry-artist-type-admission-v1';
      v_expected_action := 'admit_artist_type';
      v_expected_event_count := 1;
    else
      raise exception
        using errcode = 'P0002',
              message = 'Artist Enrichment V1 operation key is invalid.';
  end case;

  if v_operation.capability_key <> v_expected_capability
     or v_operation.status <> 'succeeded'
     or v_operation.affected_rows <> 1
  then
    v_failure := 'operation_authority_or_row_count_mismatch';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = v_operation.execution_grant_id;

  if v_failure is null
     and (
       not found
       or v_grant.actor_key <> 'registry_artist_enrichment_admin'
       or v_grant.operation_key <> v_operation.operation_key
       or v_grant.operation_version <> 1
       or v_grant.capability_key <> v_expected_capability
       or v_grant.max_rows <> 1
       or v_grant.issued_by_user_id is null
       or v_grant.issued_by_principal_key <>
         'user:' || v_grant.issued_by_user_id::text
       or v_grant.system_actor_capability_grant_id is not null
       or v_grant.required_user_capability_key <> 'manage_registry'
       or v_grant.policy_ruleset_version <> v_expected_ruleset
     )
  then
    v_failure := 'execution_grant_authority_mismatch';
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

  if v_failure is null
     and (
       v_plan ->> 'operation_key' <> v_operation.operation_key
       or (v_plan ->> 'operation_version')::integer <> 1
       or v_claim_key <> v_expected_claim_key
       or v_plan ->> 'policy_ruleset_version' <> v_expected_ruleset
       or platform_private.registry_plan_fingerprint(v_plan) <>
         v_grant.plan_fingerprint
     )
  then
    v_failure := 'plan_identity_or_fingerprint_mismatch';
  end if;

  if v_failure is null then
    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_grant.id
      and target.subject_type = 'artist';

    if not found
       or v_target.subject_id <> v_artist_id
       or v_target.expected_state_fingerprint is distinct from
         v_plan ->> 'expected_state_fingerprint'
       or (
         select count(*)
         from platform_private.registry_execution_grant_targets target_count
         where target_count.execution_grant_id = v_grant.id
       ) <> 1
    then
      v_failure := 'exact_artist_target_mismatch';
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
       or v_evidence.claim_key <> v_expected_claim_key
       or v_evidence.claim_payload <> v_proposed
       or v_evidence.assertion_fingerprint <>
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
      v_expected_owned := jsonb_build_object(
        'spotify_id', v_artist.metadata -> 'spotify_id',
        'apple_music_id', v_artist.metadata -> 'apple_music_id',
        'spotify_followers', v_artist.metadata -> 'spotify_followers',
        'spotify_popularity', v_artist.metadata -> 'spotify_popularity',
        'enriched_genres', v_artist.metadata -> 'enriched_genres'
      );
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
          and event.after_value -> 'value' = v_expected_owned
        )
        or (
          v_operation.operation_key = 'registry.artist.public_image.admit'
          and (
            (
              event.field_name = 'public_image_url'
              and event.target_path =
                'public.registry_artists.public_image_url'
              and event.after_value ->> 'value' = v_artist.public_image_url
            )
            or (
              event.field_name = 'image_source_provider'
              and event.target_path =
                'public.registry_artists.image_source_provider'
              and event.after_value ->> 'value' =
                v_artist.image_source_provider
            )
          )
        )
        or (
          v_operation.operation_key = 'registry.artist.bio.admit'
          and event.field_name = 'bio'
          and event.target_path = 'public.registry_artists.bio'
          and event.after_value ->> 'value' = v_artist.bio
        )
        or (
          v_operation.operation_key = 'registry.artist.type.admit'
          and event.field_name = 'artist_type'
          and event.target_path = 'public.registry_artists.artist_type'
          and event.after_value ->> 'value' = v_artist.artist_type
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

revoke all on function
  platform_private.registry_artist_enrichment_claim_is_valid(text,jsonb,text),
  platform_private.verify_registry_artist_enrichment_admission(uuid)
from public, anon, authenticated, service_role;

do $postflight$
begin
  if platform_private.registry_artist_enrichment_claim_is_valid(
       'registry.artist.bio',
       jsonb_build_object('bio', repeat('x', 16100)),
       'apple_music'
     )
  then
    raise exception
      'STOP: Artist Enrichment V1 admits evidence above the immutable payload ceiling';
  end if;

  if not platform_private.registry_artist_enrichment_claim_is_valid(
       'registry.artist.type',
       jsonb_build_object('artist_type', 'collective'),
       'name_heuristic'
     )
     or platform_private.registry_artist_enrichment_claim_is_valid(
       'registry.artist.type',
       jsonb_build_object('artist_type', 'corporation'),
       'name_heuristic'
     )
  then
    raise exception
      'STOP: Artist Enrichment V1 type vocabulary drifted';
  end if;
end
$postflight$;

commit;
