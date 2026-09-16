-- MIZIZI Slice 2 Discography Reviewed Evidence Authority V1
--
-- Persists immutable provider observations outside the bounded generic
-- evidence assertion payload, freezes reviewed selections before mutation,
-- and installs the paired reviewed-evidence authority for Discography V1.
--
-- Shared governance envelopes remain unchanged: generic evidence claims stay
-- under 16 KiB and execution-grant plans stay under 32 KiB. Full provider
-- observations and complete exact-set plans therefore live in bounded private,
-- immutable Discography storage and are referenced by exact grants.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-discography-reviewed-evidence-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure('platform_private.registry_discography_set_fingerprint_v1(jsonb)') is null
     or to_regprocedure('platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)') is null
     or to_regprocedure('platform_private.execute_registry_materialization_v1(text,uuid)') is null
     or to_regprocedure('platform_private.verify_registry_materialization_v1(uuid)') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
  then
    raise exception 'STOP: Discography Exact-Set Authority V1 foundation is missing';
  end if;

  if to_regclass('platform_private.registry_discography_provider_snapshots') is not null
     or to_regclass('platform_private.registry_discography_review_plans') is not null
     or to_regprocedure('public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text)') is not null
  then
    raise exception 'STOP: Discography Reviewed Evidence Authority V1 already exists';
  end if;
end
$preflight$;

create table platform_private.registry_discography_provider_snapshots (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.registry_artists(id),
  provider text not null check (provider = 'apple_music'),
  storefront text not null check (storefront ~ '^[a-z]{2}$'),
  acquired_at timestamptz not null,
  source_payload_fingerprint text not null
    check (source_payload_fingerprint ~ '^[0-9a-f]{64}$'),
  observation_fingerprint text not null
    check (observation_fingerprint ~ '^[0-9a-f]{64}$'),
  observation jsonb not null
    check (
      jsonb_typeof(observation) = 'object'
      and octet_length(observation::text) <= 2097152
    ),
  recorded_by_user_id uuid not null,
  recorded_by_principal_key text not null,
  created_at timestamptz not null default now(),
  constraint registry_discography_provider_snapshots_principal_check
    check (recorded_by_principal_key = 'user:' || recorded_by_user_id::text),
  constraint registry_discography_provider_snapshots_unique_observation
    unique (
      recorded_by_user_id,
      artist_id,
      source_payload_fingerprint,
      observation_fingerprint
    )
);

create index registry_discography_provider_snapshots_artist_created_idx
  on platform_private.registry_discography_provider_snapshots (
    artist_id,
    created_at desc
  );

create table platform_private.registry_discography_review_plans (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.registry_artists(id),
  evidence_assertion_id uuid not null
    references platform_private.registry_evidence_assertions(id),
  snapshot_id uuid not null
    references platform_private.registry_discography_provider_snapshots(id),
  reviewed_by_user_id uuid not null,
  reviewed_selections jsonb not null
    check (
      jsonb_typeof(reviewed_selections) = 'array'
      and octet_length(reviewed_selections::text) <= 131072
    ),
  selection_fingerprint text not null
    check (selection_fingerprint ~ '^[0-9a-f]{64}$'),
  frozen_plan jsonb not null
    check (
      jsonb_typeof(frozen_plan) = 'object'
      and octet_length(frozen_plan::text) <= 4194304
    ),
  frozen_plan_fingerprint text not null
    check (frozen_plan_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint registry_discography_review_plans_unique_selection
    unique (
      reviewed_by_user_id,
      evidence_assertion_id,
      selection_fingerprint
    )
);

create function platform_private.reject_registry_discography_immutable_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception using errcode='55000',
    message='Discography provider snapshots and reviewed plans are immutable.';
end
$$;

create trigger registry_discography_provider_snapshots_immutable
before update or delete
on platform_private.registry_discography_provider_snapshots
for each row execute function
  platform_private.reject_registry_discography_immutable_mutation_v1();

create trigger registry_discography_review_plans_immutable
before update or delete
on platform_private.registry_discography_review_plans
for each row execute function
  platform_private.reject_registry_discography_immutable_mutation_v1();

create function platform_private.registry_discography_deterministic_uuid_v1(
  p_namespace text,
  p_semantic_key text
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
  if nullif(btrim(p_namespace),'') is null
     or nullif(btrim(p_semantic_key),'') is null
  then
    raise exception using errcode='22023',
      message='Discography deterministic UUID namespace and semantic key are required.';
  end if;

  v_hex := encode(
    extensions.digest(
      btrim(p_namespace) || ':' || btrim(p_semantic_key),
      'sha256'
    ),
    'hex'
  );

  return (
    substr(v_hex,1,8) || '-' ||
    substr(v_hex,9,4) || '-' ||
    '5' || substr(v_hex,14,3) || '-' ||
    '8' || substr(v_hex,18,3) || '-' ||
    substr(v_hex,21,12)
  )::uuid;
end
$$;

create function platform_private.registry_discography_current_admin_v1()
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
    where binding.actor_key='registry_discography_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry discography admin broker.';
  end if;

  return v_user_id;
end
$$;

create function platform_private.registry_discography_observation_fingerprint_v1(
  p_observation jsonb
)
returns text
language sql
immutable
security definer
set search_path = pg_catalog, extensions
as $$
  select encode(
    extensions.digest(
      coalesce(p_observation, '{}'::jsonb)::text,
      'sha256'
    ),
    'hex'
  );
$$;

create function platform_private.registry_discography_validate_observation_v1(
  p_artist_id uuid,
  p_observation jsonb,
  p_source_payload_fingerprint text
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_artist public.registry_artists%rowtype;
  v_acquired_at timestamptz;
  v_album_count integer;
  v_distinct_album_count integer;
begin
  if p_artist_id is null
     or p_observation is null
     or jsonb_typeof(p_observation) <> 'object'
     or p_source_payload_fingerprint !~ '^[0-9a-f]{64}$'
     or octet_length(p_observation::text) > 2097152
  then
    raise exception using errcode='22023',
      message='Discography provider observation is malformed or exceeds the V1 boundary.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status <> 'archived';

  if not found then
    raise exception using errcode='P0002',
      message='Discography Artist does not exist.';
  end if;

  if p_observation->>'provider' <> 'apple_music'
     or coalesce(p_observation->>'storefront','') !~ '^[a-z]{2}$'
     or p_observation#>>'{artist,id}' is distinct from p_artist_id::text
     or p_observation#>>'{artist,slug}' is distinct from v_artist.slug
     or p_observation#>>'{artist,display_name}' is distinct from v_artist.display_name
     or jsonb_typeof(p_observation->'albums') <> 'array'
     or jsonb_typeof(p_observation->'failed_album_ids') <> 'array'
  then
    raise exception using errcode='22023',
      message='Discography provider observation is outside the exact Artist/provider V1 contract.';
  end if;

  begin
    v_acquired_at := (p_observation->>'acquired_at')::timestamptz;
  exception when others then
    raise exception using errcode='22023',
      message='Discography provider acquisition time is invalid.';
  end;

  if v_acquired_at < now() - interval '30 days'
     or v_acquired_at > now() + interval '5 minutes'
  then
    raise exception using errcode='22023',
      message='Discography provider observation is outside the V1 freshness window.';
  end if;

  v_album_count := jsonb_array_length(p_observation->'albums');
  if v_album_count > 25 then
    raise exception using errcode='22023',
      message='Discography provider observation exceeds the 25-Album V1 ceiling.';
  end if;

  select count(distinct album->>'apple_music_id')::integer
  into v_distinct_album_count
  from jsonb_array_elements(p_observation->'albums') album
  where nullif(btrim(album->>'apple_music_id'),'') is not null;

  if v_distinct_album_count <> v_album_count
     or exists (
       select 1
       from jsonb_array_elements(p_observation->'albums') album
       where jsonb_typeof(album) <> 'object'
          or nullif(btrim(album->>'title'),'') is null
          or album->>'release_type' not in ('album','ep','single')
          or jsonb_typeof(album->'tracks') <> 'array'
          or jsonb_typeof(album->'related_artists') <> 'array'
     )
     or exists (
       select 1
       from jsonb_array_elements(p_observation->'albums') album,
            lateral jsonb_array_elements(album->'tracks') track
       where jsonb_typeof(track) <> 'object'
          or nullif(btrim(track->>'apple_music_id'),'') is null
          or nullif(btrim(track->>'title'),'') is null
     )
     or exists (
       select 1
       from jsonb_array_elements(p_observation->'albums') album
       where (
         select count(*)
         from jsonb_array_elements(album->'tracks') track
       ) <> (
         select count(distinct track->>'apple_music_id')
         from jsonb_array_elements(album->'tracks') track
       )
     )
  then
    raise exception using errcode='22023',
      message='Discography provider observation contains malformed or duplicate Album/Track identity.';
  end if;
end
$$;

create function platform_private.record_registry_discography_provider_evidence_v1(
  p_artist_id uuid,
  p_observation jsonb,
  p_source_payload_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid;
  v_snapshot_id uuid;
  v_observation_fingerprint text;
  v_claim_payload jsonb;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
  v_acquired_at timestamptz;
begin
  v_user_id := platform_private.registry_discography_current_admin_v1();

  perform platform_private.registry_discography_validate_observation_v1(
    p_artist_id,
    p_observation,
    lower(p_source_payload_fingerprint)
  );

  v_acquired_at := (p_observation->>'acquired_at')::timestamptz;
  v_observation_fingerprint :=
    platform_private.registry_discography_observation_fingerprint_v1(
      p_observation
    );

  insert into platform_private.registry_discography_provider_snapshots (
    artist_id,
    provider,
    storefront,
    acquired_at,
    source_payload_fingerprint,
    observation_fingerprint,
    observation,
    recorded_by_user_id,
    recorded_by_principal_key
  ) values (
    p_artist_id,
    'apple_music',
    p_observation->>'storefront',
    v_acquired_at,
    lower(p_source_payload_fingerprint),
    v_observation_fingerprint,
    p_observation,
    v_user_id,
    'user:'||v_user_id::text
  )
  on conflict (
    recorded_by_user_id,
    artist_id,
    source_payload_fingerprint,
    observation_fingerprint
  ) do nothing
  returning id into v_snapshot_id;

  if v_snapshot_id is null then
    select snapshot.id
    into v_snapshot_id
    from platform_private.registry_discography_provider_snapshots snapshot
    where snapshot.recorded_by_user_id=v_user_id
      and snapshot.artist_id=p_artist_id
      and snapshot.source_payload_fingerprint=lower(p_source_payload_fingerprint)
      and snapshot.observation_fingerprint=v_observation_fingerprint;
  end if;

  v_claim_payload := jsonb_build_object(
    'snapshot_id',v_snapshot_id,
    'provider','apple_music',
    'storefront',p_observation->>'storefront',
    'album_count',jsonb_array_length(p_observation->'albums'),
    'failed_album_count',jsonb_array_length(p_observation->'failed_album_ids'),
    'source_payload_fingerprint',lower(p_source_payload_fingerprint),
    'observation_fingerprint',v_observation_fingerprint
  );

  v_assertion_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','artist',
        'subject_id',p_artist_id::text,
        'claim_key','registry.artist.discography.provider_snapshot',
        'claim_payload',v_claim_payload,
        'trust_class','EXTERNAL_EVIDENCE',
        'source_kind','apple_music_discography_snapshot',
        'source_ref','registry_discography_provider_snapshot:'||v_snapshot_id::text,
        'source_payload_fingerprint',lower(p_source_payload_fingerprint),
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
    p_artist_id,
    'registry.artist.discography.provider_snapshot',
    v_claim_payload,
    'EXTERNAL_EVIDENCE',
    'apple_music_discography_snapshot',
    'registry_discography_provider_snapshot:'||v_snapshot_id::text,
    lower(p_source_payload_fingerprint),
    v_acquired_at,
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

create function platform_private.registry_discography_resolve_release_v1(
  p_artist_id uuid,
  p_album jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_apple_id text := nullif(btrim(p_album->>'apple_music_id'),'');
  v_upc text;
  v_slug text;
  v_normalized_title text;
  v_ids uuid[];
begin
  if p_artist_id is null
     or p_album is null
     or jsonb_typeof(p_album) <> 'object'
     or v_apple_id is null
     or nullif(btrim(p_album->>'title'),'') is null
  then
    raise exception using errcode='22023',
      message='Release resolution requires exact Artist and provider Album identity.';
  end if;

  v_upc := platform_private.registry_identity_canonical_upc_v1(
    nullif(p_album->>'upc','')
  );
  v_slug := platform_private.registry_release_creation_slug_v1(
    p_album->>'title',
    p_artist_id
  );
  v_normalized_title :=
    platform_private.registry_identity_normalize_text_v1(p_album->>'title');

  select array_agg(release.id order by release.id)
  into v_ids
  from public.registry_releases release
  where release.status <> 'archived'
    and release.metadata->>'apple_music_album_id'=v_apple_id;

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Apple Music Album identity resolves to multiple Registry Releases.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  if v_upc is not null then
    select array_agg(release.id order by release.id)
    into v_ids
    from public.registry_releases release
    where release.status <> 'archived'
      and release.upc=v_upc;

    if coalesce(array_length(v_ids,1),0)>1 then
      raise exception using errcode='40001',
        message='UPC resolves to multiple Registry Releases.';
    elsif coalesce(array_length(v_ids,1),0)=1 then
      return v_ids[1];
    end if;
  end if;

  select array_agg(release.id order by release.id)
  into v_ids
  from public.registry_releases release
  where release.status <> 'archived'
    and release.slug=v_slug;

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Deterministic Release slug resolves to multiple Registry Releases.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  select array_agg(release.id order by release.id)
  into v_ids
  from public.registry_releases release
  where release.status <> 'archived'
    and release.normalized_title=v_normalized_title
    and exists (
      select 1
      from public.registry_release_artists credit
      where credit.release_id=release.id
        and credit.artist_id=p_artist_id
        and credit.status <> 'archived'
    );

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Release title/Artist identity resolves ambiguously.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  return null;
end
$$;

create function platform_private.registry_discography_resolve_track_v1(
  p_artist_id uuid,
  p_track jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_apple_id text := nullif(btrim(p_track->>'apple_music_id'),'');
  v_isrc text;
  v_slug text;
  v_normalized_title text;
  v_ids uuid[];
begin
  if p_artist_id is null
     or p_track is null
     or jsonb_typeof(p_track) <> 'object'
     or v_apple_id is null
     or nullif(btrim(p_track->>'title'),'') is null
  then
    raise exception using errcode='22023',
      message='Track resolution requires exact Artist and provider Track identity.';
  end if;

  v_isrc := platform_private.registry_identity_canonical_isrc_v1(
    nullif(p_track->>'isrc','')
  );
  v_slug := platform_private.registry_track_creation_slug_v1(
    p_track->>'title',
    p_artist_id
  );
  v_normalized_title :=
    platform_private.registry_identity_normalize_text_v1(p_track->>'title');

  select array_agg(track.id order by track.id)
  into v_ids
  from public.registry_tracks track
  where track.status <> 'archived'
    and track.metadata->>'apple_music_track_id'=v_apple_id;

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Apple Music Track identity resolves to multiple Registry Tracks.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  if v_isrc is not null then
    select array_agg(track.id order by track.id)
    into v_ids
    from public.registry_tracks track
    where track.status <> 'archived'
      and track.isrc=v_isrc;

    if coalesce(array_length(v_ids,1),0)>1 then
      raise exception using errcode='40001',
        message='ISRC resolves to multiple Registry Tracks.';
    elsif coalesce(array_length(v_ids,1),0)=1 then
      return v_ids[1];
    end if;
  end if;

  select array_agg(track.id order by track.id)
  into v_ids
  from public.registry_tracks track
  where track.status <> 'archived'
    and track.slug=v_slug;

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Deterministic Track slug resolves to multiple Registry Tracks.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  select array_agg(track.id order by track.id)
  into v_ids
  from public.registry_tracks track
  where track.status <> 'archived'
    and track.normalized_title=v_normalized_title
    and exists (
      select 1
      from public.registry_track_artists credit
      where credit.track_id=track.id
        and credit.artist_id=p_artist_id
        and credit.status <> 'archived'
    );

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Track title/Artist identity resolves ambiguously.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  return null;
end
$$;

create function platform_private.registry_discography_resolve_artist_name_v1(
  p_artist_name text
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_normalized text;
  v_slug text;
  v_ids uuid[];
begin
  if nullif(btrim(p_artist_name),'') is null then
    return null;
  end if;

  v_normalized :=
    platform_private.registry_identity_normalize_text_v1(p_artist_name);
  v_slug := public.wk_slugify_text(v_normalized);

  select array_agg(distinct artist.id order by artist.id)
  into v_ids
  from public.registry_artists artist
  where artist.status <> 'archived'
    and (
      artist.normalized_name=v_normalized
      or artist.slug=v_slug
    );

  if coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  return null;
end
$$;

create function platform_private.registry_discography_credit_includes_artist_v1(
  p_credit_text text,
  p_artist_name text
)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from regexp_split_to_table(
      coalesce(p_credit_text,''),
      '\s*(?:,|&|\sand\s|\sx\s|\+)\s*',
      'i'
    ) part
    where btrim(part) <> ''
      and btrim(regexp_replace(lower(pg_catalog.normalize(part,'NFKC')),'[[:space:]]+',' ','g')) =
          btrim(regexp_replace(lower(pg_catalog.normalize(coalesce(p_artist_name,''),'NFKC')),'[[:space:]]+',' ','g'))
  );
$$;

create function platform_private.registry_discography_track_credit_names_v1(
  p_artist_display text,
  p_title text,
  p_fallback_artist_name text
)
returns text[]
language plpgsql
immutable
security definer
set search_path = pg_catalog
as $$
declare
  v_result text[] := array[]::text[];
  v_seen text[] := array[]::text[];
  v_source text := coalesce(nullif(btrim(p_artist_display),''),p_fallback_artist_name,'');
  v_part text;
  v_key text;
  v_match text[];
  v_feature_text text;
  v_pattern text;
begin
  for v_part in
    select btrim(part)
    from regexp_split_to_table(
      v_source,
      '\s*(?:,|&|\sand\s|\sx\s|\+|\s+(?:feat\.?|ft\.?|featuring)\s+)\s*',
      'i'
    ) part
    where btrim(part) <> ''
  loop
    v_key := btrim(regexp_replace(lower(pg_catalog.normalize(v_part,'NFKC')),'[[:space:]]+',' ','g'));
    if v_key <> '' and array_position(v_seen,v_key) is null then
      v_seen := array_append(v_seen,v_key);
      v_result := array_append(v_result,v_part);
    end if;
  end loop;

  foreach v_pattern in array array[
    '\((?:feat\.?|ft\.?|featuring|with|w/)\s+([^)]+)\)',
    '\[(?:feat\.?|ft\.?|featuring|with|w/)\s+([^]]+)\]',
    '\s[-–—]\s*(?:feat\.?|ft\.?|featuring|with|w/)\s+(.+)$',
    '\s+x\s+([^,()\[]+)$',
    '\s+\+\s+([^,()\[]+)$'
  ]
  loop
    v_match := regexp_match(coalesce(p_title,''),v_pattern,'i');
    if v_match is not null and array_length(v_match,1)>=1 then
      v_feature_text := v_match[1];
      for v_part in
        select btrim(part)
        from regexp_split_to_table(
          coalesce(v_feature_text,''),
          '\s*(?:,|&|\sand\s|\sx\s|\+)\s*',
          'i'
        ) part
        where btrim(part) <> ''
      loop
        v_key := btrim(regexp_replace(lower(pg_catalog.normalize(v_part,'NFKC')),'[[:space:]]+',' ','g'));
        if v_key <> '' and array_position(v_seen,v_key) is null then
          v_seen := array_append(v_seen,v_key);
          v_result := array_append(v_result,v_part);
        end if;
      end loop;
    end if;
  end loop;

  if coalesce(array_length(v_result,1),0)=0
     and nullif(btrim(coalesce(p_fallback_artist_name,'')),'') is not null
  then
    v_result := array[p_fallback_artist_name];
  end if;

  return v_result;
end
$$;

create function platform_private.registry_discography_normalize_reviewed_selections_v1(
  p_artist_id uuid,
  p_observation jsonb,
  p_reviewed_selections jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_selection jsonb;
  v_album_id text;
  v_action text;
  v_additional jsonb;
  v_additional_row jsonb;
  v_normalized_additional jsonb;
  v_additional_id uuid;
  v_additional_artist public.registry_artists%rowtype;
  v_seen_album_ids text[] := array[]::text[];
  v_seen_artist_ids uuid[];
  v_mutation_count integer := 0;
begin
  if p_artist_id is null
     or p_reviewed_selections is null
     or jsonb_typeof(p_reviewed_selections) <> 'array'
     or jsonb_array_length(p_reviewed_selections)=0
     or octet_length(p_reviewed_selections::text)>131072
  then
    raise exception using errcode='22023',
      message='Reviewed Discography selections are required.';
  end if;

  for v_selection in
    select value
    from jsonb_array_elements(p_reviewed_selections)
    order by value->>'apple_music_id'
  loop
    if jsonb_typeof(v_selection) <> 'object'
       or (v_selection-array['apple_music_id','action','additional_primary_artists']::text[]) <> '{}'::jsonb
    then
      raise exception using errcode='22023',
        message='Reviewed Discography selection contains fields outside the V1 browser contract.';
    end if;

    v_album_id := nullif(btrim(v_selection->>'apple_music_id'),'');
    v_action := nullif(btrim(v_selection->>'action'),'');

    if v_album_id is null
       or v_action not in ('merge','canonicalize','ignore')
       or array_position(v_seen_album_ids,v_album_id) is not null
       or not exists (
         select 1
         from jsonb_array_elements(p_observation->'albums') album
         where album->>'apple_music_id'=v_album_id
       )
    then
      raise exception using errcode='22023',
        message='Reviewed Discography selection is invalid, duplicated, or absent from immutable evidence.';
    end if;

    v_seen_album_ids := array_append(v_seen_album_ids,v_album_id);
    v_additional := coalesce(v_selection->'additional_primary_artists','[]'::jsonb);

    if jsonb_typeof(v_additional) <> 'array' then
      raise exception using errcode='22023',
        message='Additional primary Artist selection must be an array.';
    end if;

    if v_action='ignore' and jsonb_array_length(v_additional)>0 then
      raise exception using errcode='22023',
        message='Ignored Albums cannot carry canonical co-primary Artist authority.';
    end if;

    v_normalized_additional := '[]'::jsonb;
    v_seen_artist_ids := array[]::uuid[];

    for v_additional_row in
      select value
      from jsonb_array_elements(v_additional)
      order by value->>'artist_id'
    loop
      if jsonb_typeof(v_additional_row) <> 'object'
         or (v_additional_row-array['artist_id','artist_slug','artist_name']::text[]) <> '{}'::jsonb
         or coalesce(v_additional_row->>'artist_id','') !~
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then
        raise exception using errcode='22023',
          message='Additional primary Artist identity is malformed.';
      end if;

      v_additional_id := (v_additional_row->>'artist_id')::uuid;
      select artist.*
      into v_additional_artist
      from public.registry_artists artist
      where artist.id=v_additional_id
        and artist.status <> 'archived';

      if not found
         or v_additional_id=p_artist_id
         or array_position(v_seen_artist_ids,v_additional_id) is not null
         or btrim(coalesce(v_additional_row->>'artist_slug','')) is distinct from v_additional_artist.slug
         or btrim(coalesce(v_additional_row->>'artist_name','')) is distinct from v_additional_artist.display_name
      then
        raise exception using errcode='22023',
          message='Additional primary Artist identity is inconsistent inside one reviewed plan.';
      end if;

      v_seen_artist_ids := array_append(v_seen_artist_ids,v_additional_id);
      v_normalized_additional := v_normalized_additional || jsonb_build_array(
        jsonb_build_object(
          'artist_id',v_additional_artist.id,
          'artist_slug',v_additional_artist.slug,
          'artist_name',v_additional_artist.display_name
        )
      );
    end loop;

    if v_action <> 'ignore' then
      v_mutation_count := v_mutation_count+1;
    end if;

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'apple_music_id',v_album_id,
        'action',v_action,
        'additional_primary_artists',v_normalized_additional
      )
    );
  end loop;

  if v_mutation_count=0 then
    raise exception using errcode='22023',
      message='Reviewed Discography plan cannot ignore every Album.';
  end if;

  return v_result;
end
$$;

create function platform_private.registry_discography_release_artist_desired_v1(
  p_release_id uuid,
  p_artist_id uuid,
  p_album jsonb,
  p_additional_primary_artists jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_artist public.registry_artists%rowtype;
  v_result jsonb := '[]'::jsonb;
  v_seen_slugs text[] := array[]::text[];
  v_current_primary boolean;
  v_additional jsonb;
  v_related jsonb;
  v_related_name text;
  v_resolved_id uuid;
  v_resolved_artist public.registry_artists%rowtype;
  v_slug text;
  v_name text;
  v_order integer := 2;
  v_related_order integer := 99;
begin
  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status <> 'archived';

  if not found then
    raise exception using errcode='P0002', message='Discography Artist is missing.';
  end if;

  v_current_primary :=
    platform_private.registry_discography_credit_includes_artist_v1(
      p_album->>'album_artist_name',
      v_artist.display_name
    );

  v_result := v_result || jsonb_build_array(
    jsonb_build_object(
      'release_id',p_release_id,
      'artist_id',v_artist.id,
      'artist_slug',v_artist.slug,
      'artist_name_text',v_artist.display_name,
      'role',case when v_current_primary then 'primary_artist' else 'featured_artist' end,
      'is_primary',v_current_primary,
      'is_featured',not v_current_primary,
      'credit_order',case when v_current_primary then 1 else 98 end,
      'display_credit',null,
      'source','apple_music_ingest',
      'confidence',case when v_current_primary then 90 else 70 end,
      'status','active',
      'metadata',case
        when v_current_primary then jsonb_build_object('apple_music_album_id',p_album->>'apple_music_id')
        else jsonb_build_object(
          'apple_music_album_id',p_album->>'apple_music_id',
          'ingested_artist_is_featured',true
        )
      end
    )
  );
  v_seen_slugs := array_append(v_seen_slugs,v_artist.slug);

  for v_additional in
    select value
    from jsonb_array_elements(coalesce(p_additional_primary_artists,'[]'::jsonb))
    order by value->>'artist_id'
  loop
    select artist.*
    into v_resolved_artist
    from public.registry_artists artist
    where artist.id=(v_additional->>'artist_id')::uuid
      and artist.status <> 'archived';

    if not found
       or v_resolved_artist.slug is distinct from v_additional->>'artist_slug'
       or v_resolved_artist.display_name is distinct from v_additional->>'artist_name'
    then
      raise exception using errcode='40001',
        message='Reviewed co-primary Artist changed before plan freeze.';
    end if;

    if array_position(v_seen_slugs,v_resolved_artist.slug) is null then
      v_result := v_result || jsonb_build_array(
        jsonb_build_object(
          'release_id',p_release_id,
          'artist_id',v_resolved_artist.id,
          'artist_slug',v_resolved_artist.slug,
          'artist_name_text',v_resolved_artist.display_name,
          'role','primary_artist',
          'is_primary',true,
          'is_featured',false,
          'credit_order',v_order,
          'display_credit',null,
          'source','apple_music_ingest',
          'confidence',90,
          'status','active',
          'metadata',jsonb_build_object(
            'apple_music_album_id',p_album->>'apple_music_id',
            'admin_selected',true
          )
        )
      );
      v_seen_slugs := array_append(v_seen_slugs,v_resolved_artist.slug);
      v_order := v_order+1;
    end if;
  end loop;

  for v_related in
    select value
    from jsonb_array_elements(coalesce(p_album->'related_artists','[]'::jsonb))
    order by value->>'name', value->>'apple_music_artist_id'
  loop
    v_related_name := nullif(btrim(v_related->>'name'),'');
    if v_related_name is null then
      continue;
    end if;

    v_resolved_id :=
      platform_private.registry_discography_resolve_artist_name_v1(v_related_name);

    if v_resolved_id is not null then
      select artist.*
      into v_resolved_artist
      from public.registry_artists artist
      where artist.id=v_resolved_id;
      v_slug := v_resolved_artist.slug;
      v_name := v_resolved_artist.display_name;
    else
      v_slug := public.wk_slugify_text(
        platform_private.registry_identity_normalize_text_v1(v_related_name)
      );
      v_name := v_related_name;
    end if;

    if nullif(v_slug,'') is null then
      raise exception using errcode='22023',
        message='Provider Release credit cannot be normalized to credited-name identity.';
    end if;

    if array_position(v_seen_slugs,v_slug) is not null then
      continue;
    end if;

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'release_id',p_release_id,
        'artist_id',v_resolved_id,
        'artist_slug',v_slug,
        'artist_name_text',v_name,
        'role','featured_artist',
        'is_primary',false,
        'is_featured',true,
        'credit_order',v_related_order,
        'display_credit',null,
        'source','apple_music_ingest',
        'confidence',case when v_resolved_id is null then 50 else 85 end,
        'status','active',
        'metadata',jsonb_build_object(
          'apple_music_album_id',p_album->>'apple_music_id',
          'apple_music_artist_id',nullif(v_related->>'apple_music_artist_id',''),
          'resolved_by',case when v_resolved_id is null then 'text_only' else 'name_match' end
        )
      )
    );
    v_seen_slugs := array_append(v_seen_slugs,v_slug);
    v_related_order := v_related_order+1;
  end loop;

  return v_result;
end
$$;

create function platform_private.registry_discography_track_artist_desired_v1(
  p_track_id uuid,
  p_current_artist_id uuid,
  p_album_id text,
  p_track jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_current public.registry_artists%rowtype;
  v_result jsonb := '[]'::jsonb;
  v_seen_slugs text[] := array[]::text[];
  v_names text[];
  v_name text;
  v_name_key text;
  v_current_key text;
  v_resolved_id uuid;
  v_resolved public.registry_artists%rowtype;
  v_slug text;
  v_display text;
  v_feature_order integer := 2;
begin
  select artist.*
  into v_current
  from public.registry_artists artist
  where artist.id=p_current_artist_id
    and artist.status <> 'archived';

  if not found then
    raise exception using errcode='P0002', message='Discography Artist is missing.';
  end if;

  v_current_key :=
    platform_private.registry_identity_normalize_text_v1(v_current.display_name);
  v_names := platform_private.registry_discography_track_credit_names_v1(
    p_track->>'artist_name',
    p_track->>'title',
    v_current.display_name
  );

  foreach v_name in array v_names
  loop
    v_name_key :=
      platform_private.registry_identity_normalize_text_v1(v_name);

    if v_name_key=v_current_key
       or public.wk_slugify_text(v_name_key)=v_current.slug
    then
      if array_position(v_seen_slugs,v_current.slug) is null then
        v_result := v_result || jsonb_build_array(
          jsonb_build_object(
            'track_id',p_track_id,
            'artist_id',v_current.id,
            'artist_slug',v_current.slug,
            'artist_name_text',v_current.display_name,
            'role','primary_artist',
            'is_primary',true,
            'is_featured',false,
            'credit_order',1,
            'display_credit',null,
            'source','apple_music_ingest',
            'confidence',90,
            'status','active',
            'metadata',jsonb_build_object(
              'apple_music_track_id',p_track->>'apple_music_id',
              'apple_music_album_id',p_album_id
            )
          )
        );
        v_seen_slugs := array_append(v_seen_slugs,v_current.slug);
      end if;
      continue;
    end if;

    v_resolved_id :=
      platform_private.registry_discography_resolve_artist_name_v1(v_name);

    if v_resolved_id is not null then
      select artist.* into v_resolved
      from public.registry_artists artist
      where artist.id=v_resolved_id;
      v_slug := v_resolved.slug;
      v_display := v_resolved.display_name;
    else
      v_slug := public.wk_slugify_text(v_name_key);
      v_display := btrim(v_name);
    end if;

    if nullif(v_slug,'') is null then
      raise exception using errcode='22023',
        message='Provider Track credit cannot be normalized to credited-name identity.';
    end if;

    if array_position(v_seen_slugs,v_slug) is not null then
      continue;
    end if;

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'track_id',p_track_id,
        'artist_id',v_resolved_id,
        'artist_slug',v_slug,
        'artist_name_text',v_display,
        'role','featured_artist',
        'is_primary',false,
        'is_featured',true,
        'credit_order',v_feature_order,
        'display_credit',null,
        'source','apple_music_ingest',
        'confidence',case when v_resolved_id is null then 50 else 85 end,
        'status','active',
        'metadata',jsonb_build_object(
          'apple_music_track_id',p_track->>'apple_music_id',
          'apple_music_album_id',p_album_id,
          'resolved_by',case when v_resolved_id is null then 'text_only' else 'name_match' end
        )
      )
    );
    v_seen_slugs := array_append(v_seen_slugs,v_slug);
    v_feature_order := v_feature_order+1;
  end loop;

  return v_result;
end
$$;

create function platform_private.registry_discography_dedupe_track_credit_rows_v1(
  p_rows jsonb
)
returns jsonb
language sql
immutable
security definer
set search_path = pg_catalog
as $$
  with source_rows as (
    select value as row_payload
    from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb))
  ),
  ranked as (
    select
      row_payload,
      row_payload->>'artist_slug' as artist_slug,
      coalesce((row_payload->>'is_primary')::boolean,false) as is_primary,
      coalesce((row_payload->>'confidence')::integer,0) as confidence,
      coalesce((row_payload->>'credit_order')::integer,2147483647) as original_order,
      row_number() over (
        partition by row_payload->>'artist_slug'
        order by
          coalesce((row_payload->>'is_primary')::boolean,false) desc,
          coalesce((row_payload->>'confidence')::integer,0) desc,
          coalesce((row_payload->>'credit_order')::integer,2147483647),
          row_payload::text
      ) as duplicate_rank
    from source_rows
  ),
  chosen as (
    select *
    from ranked
    where duplicate_rank=1
  ),
  ordered as (
    select
      row_payload,
      artist_slug,
      is_primary,
      original_order,
      sum(case when not is_primary then 1 else 0 end) over (
        order by is_primary desc, original_order, artist_slug
        rows between unbounded preceding and current row
      ) as featured_ordinal
    from chosen
  )
  select coalesce(
    jsonb_agg(
      (row_payload-'credit_order') ||
      jsonb_build_object(
        'credit_order',case when is_primary then 1 else 1+featured_ordinal end
      )
      order by is_primary desc,
               case when is_primary then 1 else 1+featured_ordinal end,
               artist_slug
    ),
    '[]'::jsonb
  )
  from ordered;
$$;

create function platform_private.registry_discography_preserve_set_ids_v1(
  p_current_set jsonb,
  p_desired_rows jsonb,
  p_namespace text
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = pg_catalog, platform_private
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_desired jsonb;
  v_existing_id text;
  v_id uuid;
begin
  if jsonb_typeof(coalesce(p_current_set,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_desired_rows,'[]'::jsonb)) <> 'array'
  then
    raise exception using errcode='22023', message='Discography exact-set inputs must be arrays.';
  end if;

  for v_desired in
    select value
    from jsonb_array_elements(coalesce(p_desired_rows,'[]'::jsonb))
    order by value::text
  loop
    if v_desired ? 'id' then
      raise exception using errcode='22023',
        message='Desired Discography set rows must not supply database row UUIDs.';
    end if;

    select current_row->>'id'
    into v_existing_id
    from jsonb_array_elements(coalesce(p_current_set,'[]'::jsonb)) current_row
    where (current_row-'id')=v_desired
    order by current_row->>'id'
    limit 1;

    if v_existing_id is not null then
      v_id := v_existing_id::uuid;
    else
      v_id := platform_private.registry_discography_deterministic_uuid_v1(
        p_namespace,
        v_desired::text
      );

      if exists (
        select 1
        from jsonb_array_elements(coalesce(p_current_set,'[]'::jsonb)) current_row
        where current_row->>'id'=v_id::text
          and (current_row-'id')<>v_desired
      ) then
        raise exception using errcode='40001',
          message='Deterministic Discography relation UUID collides with different current semantics.';
      end if;
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_result) result_row
      where result_row->>'id'=v_id::text
    ) then
      raise exception using errcode='40001',
        message='Discography final set contains a duplicate relation UUID.';
    end if;

    v_result := v_result || jsonb_build_array(
      v_desired || jsonb_build_object('id',v_id)
    );
    v_existing_id := null;
  end loop;

  select coalesce(jsonb_agg(value order by value->>'id'),'[]'::jsonb)
  into v_result
  from jsonb_array_elements(v_result);

  return v_result;
end
$$;

create function platform_private.registry_discography_set_delta_v1(
  p_current_set jsonb,
  p_final_set jsonb
)
returns jsonb
language sql
immutable
security definer
set search_path = pg_catalog
as $$
  with removed as (
    select count(*)::integer as count
    from jsonb_array_elements(coalesce(p_current_set,'[]'::jsonb)) current_row
    where not exists (
      select 1
      from jsonb_array_elements(coalesce(p_final_set,'[]'::jsonb)) final_row
      where final_row->>'id'=current_row->>'id'
    )
  ),
  inserted as (
    select count(*)::integer as count
    from jsonb_array_elements(coalesce(p_final_set,'[]'::jsonb)) final_row
    where not exists (
      select 1
      from jsonb_array_elements(coalesce(p_current_set,'[]'::jsonb)) current_row
      where current_row->>'id'=final_row->>'id'
    )
  )
  select jsonb_build_object(
    'removed_rows',removed.count,
    'inserted_rows',inserted.count,
    'total_rows',removed.count+inserted.count
  )
  from removed,inserted;
$$;

create function platform_private.registry_discography_build_frozen_plan_v1(
  p_artist_id uuid,
  p_evidence_assertion_id uuid,
  p_snapshot_id uuid,
  p_reviewed_selections jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_snapshot platform_private.registry_discography_provider_snapshots%rowtype;
  v_artist public.registry_artists%rowtype;
  v_selection jsonb;
  v_album jsonb;
  v_track jsonb;
  v_release_id uuid;
  v_track_id uuid;
  v_release_is_new boolean;
  v_track_is_new boolean;
  v_release_key text;
  v_track_key text;
  v_release_identity_key text;
  v_track_identity_key text;
  v_release_identity_map jsonb := '{}'::jsonb;
  v_track_identity_map jsonb := '{}'::jsonb;
  v_release_buckets jsonb := '{}'::jsonb;
  v_track_buckets jsonb := '{}'::jsonb;
  v_bucket jsonb;
  v_desired jsonb;
  v_current jsonb;
  v_final jsonb;
  v_delta jsonb;
  v_operations jsonb := '[]'::jsonb;
  v_pair record;
  v_profile jsonb;
  v_collision_state jsonb;
  v_collision_fingerprint text;
  v_upc text;
  v_isrc text;
  v_slug text;
  v_all_album_ids jsonb;
  v_ignored integer := 0;
  v_merged integer := 0;
  v_canonicalized integer := 0;
  v_track_occurrences integer := 0;
  v_featured_links integer := 0;
  v_count integer;
begin
  select snapshot.*
  into v_snapshot
  from platform_private.registry_discography_provider_snapshots snapshot
  where snapshot.id=p_snapshot_id
    and snapshot.artist_id=p_artist_id;

  if not found then
    raise exception using errcode='P0002', message='Immutable Discography snapshot is missing.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status <> 'archived';

  if not found then
    raise exception using errcode='P0002', message='Discography Artist is missing.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(selection->>'apple_music_id') order by selection->>'apple_music_id'),'[]'::jsonb)
  into v_all_album_ids
  from jsonb_array_elements(p_reviewed_selections) selection;

  for v_selection in
    select value
    from jsonb_array_elements(p_reviewed_selections)
    order by value->>'apple_music_id'
  loop
    if v_selection->>'action'='ignore' then
      v_ignored := v_ignored+1;
      continue;
    end if;

    select value
    into v_album
    from jsonb_array_elements(v_snapshot.observation->'albums')
    where value->>'apple_music_id'=v_selection->>'apple_music_id';

    if v_album is null then
      raise exception using errcode='40001',
        message='Reviewed Album disappeared from immutable provider snapshot.';
    end if;

    v_upc := platform_private.registry_identity_canonical_upc_v1(nullif(v_album->>'upc',''));
    v_slug := platform_private.registry_release_creation_slug_v1(v_album->>'title',p_artist_id);
    v_release_identity_key := case
      when v_upc is not null then 'upc:'||v_upc
      else 'slug:'||v_slug
    end;

    if v_release_identity_map ? v_release_identity_key then
      v_release_id := (v_release_identity_map->>v_release_identity_key)::uuid;
      v_release_is_new := coalesce((v_release_buckets->v_release_id::text->>'is_new')::boolean,false);
    else
      v_release_id := platform_private.registry_discography_resolve_release_v1(p_artist_id,v_album);
      v_release_is_new := v_release_id is null;
      if v_release_is_new then
        v_release_id := platform_private.registry_discography_deterministic_uuid_v1(
          'release.apple_music',
          v_album->>'apple_music_id'
        );
      end if;
      v_release_identity_map := jsonb_set(
        v_release_identity_map,
        array[v_release_identity_key],
        to_jsonb(v_release_id::text),
        true
      );
    end if;

    v_release_key := v_release_id::text;
    if v_release_buckets ? v_release_key then
      raise exception using errcode='22023',
        message='Two reviewed provider Albums converge onto the same Registry Release; review them separately in V1.';
    end if;

    if v_release_is_new then
      v_canonicalized := v_canonicalized+1;
    else
      v_merged := v_merged+1;
    end if;

    v_profile := jsonb_build_object(
      'release_type',v_album->>'release_type',
      'release_date',nullif(v_album->>'release_date',''),
      'artwork_url',nullif(v_album->>'artwork_url',''),
      'apple_music_album_id',v_album->>'apple_music_id',
      'apple_music_url',nullif(v_album->>'apple_music_url',''),
      'genre_names',coalesce(v_album->'genre_names','[]'::jsonb),
      'record_label',nullif(v_album->>'record_label',''),
      'source','apple_music_ingest'
    );

    v_bucket := jsonb_build_object(
      'release_id',v_release_id,
      'is_new',v_release_is_new,
      'action',v_selection->>'action',
      'title',v_album->>'title',
      'normalized_title',platform_private.registry_identity_normalize_text_v1(v_album->>'title'),
      'slug',v_slug,
      'upc',v_upc,
      'profile',v_profile,
      'desired_artist_rows',platform_private.registry_discography_release_artist_desired_v1(
        v_release_id,
        p_artist_id,
        v_album,
        v_selection->'additional_primary_artists'
      ),
      'desired_track_rows','[]'::jsonb
    );

    for v_track in
      select value
      from jsonb_array_elements(v_album->'tracks')
      order by coalesce((value->>'disc_number')::integer,1),
               coalesce((value->>'track_number')::integer,2147483647),
               value->>'apple_music_id'
    loop
      v_track_occurrences := v_track_occurrences+1;
      v_isrc := platform_private.registry_identity_canonical_isrc_v1(nullif(v_track->>'isrc',''));
      v_slug := platform_private.registry_track_creation_slug_v1(v_track->>'title',p_artist_id);
      v_track_identity_key := case
        when v_isrc is not null then 'isrc:'||v_isrc
        else 'slug:'||v_slug
      end;

      if v_track_identity_map ? v_track_identity_key then
        v_track_id := (v_track_identity_map->>v_track_identity_key)::uuid;
        v_track_is_new := coalesce((v_track_buckets->v_track_id::text->>'is_new')::boolean,false);
      else
        v_track_id := platform_private.registry_discography_resolve_track_v1(p_artist_id,v_track);
        v_track_is_new := v_track_id is null;
        if v_track_is_new then
          v_track_id := platform_private.registry_discography_deterministic_uuid_v1(
            'track.apple_music',
            v_track->>'apple_music_id'
          );
        end if;
        v_track_identity_map := jsonb_set(
          v_track_identity_map,
          array[v_track_identity_key],
          to_jsonb(v_track_id::text),
          true
        );
      end if;

      if exists (
        select 1
        from jsonb_array_elements(v_bucket->'desired_track_rows') row_payload
        where row_payload->>'track_id'=v_track_id::text
          and (
            coalesce((row_payload->>'disc_number')::integer,1) is distinct from coalesce((v_track->>'disc_number')::integer,1)
            or (row_payload->>'track_number')::integer is distinct from (v_track->>'track_number')::integer
          )
      ) then
        raise exception using errcode='22023',
          message='Provider Album maps two positions onto one canonical Track; V1 refuses ambiguous sequencing.';
      end if;

      if not exists (
        select 1
        from jsonb_array_elements(v_bucket->'desired_track_rows') row_payload
        where row_payload->>'track_id'=v_track_id::text
      ) then
        v_bucket := jsonb_set(
          v_bucket,
          '{desired_track_rows}',
          (v_bucket->'desired_track_rows') || jsonb_build_array(
            jsonb_build_object(
              'release_id',v_release_id,
              'track_id',v_track_id,
              'disc_number',coalesce((v_track->>'disc_number')::integer,1),
              'track_number',case when v_track->>'track_number' is null then null else (v_track->>'track_number')::integer end,
              'source','apple_music_ingest',
              'confidence',90,
              'status','active',
              'metadata',jsonb_build_object(
                'apple_music_track_id',v_track->>'apple_music_id',
                'apple_music_album_id',v_album->>'apple_music_id'
              )
            )
          ),
          true
        );
      end if;

      v_desired := platform_private.registry_discography_track_artist_desired_v1(
        v_track_id,
        p_artist_id,
        v_album->>'apple_music_id',
        v_track
      );
      v_track_key := v_track_id::text;

      if v_track_buckets ? v_track_key then
        v_bucket := jsonb_set(
          v_track_buckets->v_track_key,
          '{desired_credit_rows}',
          (v_track_buckets->v_track_key->'desired_credit_rows') || v_desired,
          true
        );
        v_track_buckets := jsonb_set(v_track_buckets,array[v_track_key],v_bucket,true);
      else
        v_profile := jsonb_build_object(
          'duration_ms',case when v_track->>'duration_ms' is null then null else (v_track->>'duration_ms')::integer end,
          'explicit',coalesce((v_track->>'explicit')::boolean,false),
          'track_number',case when v_track->>'track_number' is null then null else (v_track->>'track_number')::integer end,
          'disc_number',coalesce((v_track->>'disc_number')::integer,1),
          'artwork_url',coalesce(nullif(v_track->>'artwork_url',''),nullif(v_album->>'artwork_url','')),
          'preview_url',nullif(v_track->>'preview_url',''),
          'apple_music_track_id',v_track->>'apple_music_id',
          'apple_music_album_id',v_album->>'apple_music_id',
          'genre_names',coalesce(v_track->'genre_names','[]'::jsonb),
          'source','apple_music_ingest'
        );
        v_track_buckets := jsonb_set(
          v_track_buckets,
          array[v_track_key],
          jsonb_build_object(
            'track_id',v_track_id,
            'is_new',v_track_is_new,
            'title',v_track->>'title',
            'normalized_title',platform_private.registry_identity_normalize_text_v1(v_track->>'title'),
            'slug',v_slug,
            'isrc',v_isrc,
            'profile',v_profile,
            'desired_credit_rows',v_desired
          ),
          true
        );
      end if;
    end loop;

    v_release_buckets := jsonb_set(v_release_buckets,array[v_release_key],v_bucket,true);
  end loop;

  -- Freeze all identity operations before provider facts or relationship sets.
  for v_pair in select key,value from jsonb_each(v_release_buckets) order by key
  loop
    if coalesce((v_pair.value->>'is_new')::boolean,false) then
      v_collision_state := platform_private.registry_release_creation_collision_state_v1(
        (v_pair.value->>'release_id')::uuid,
        v_pair.value->>'title',
        p_artist_id,
        nullif(v_pair.value->>'upc','')
      );
      if v_collision_state <> '[]'::jsonb then
        raise exception using errcode='40001',
          message='New Release identity collides with Registry state before reviewed plan freeze.';
      end if;
      v_collision_fingerprint := platform_private.registry_identity_creation_collision_fingerprint_v1(v_collision_state);
      v_operations := v_operations || jsonb_build_array(
        jsonb_build_object(
          'ref','release.create:'||v_pair.key,
          'kind','materialization',
          'operation_key','registry.release.create',
          'subject_type','release',
          'subject_id',v_pair.value->>'release_id',
          'payload',jsonb_build_object(
            'release_id',v_pair.value->>'release_id',
            'title',v_pair.value->>'title',
            'normalized_title',v_pair.value->>'normalized_title',
            'slug',v_pair.value->>'slug',
            'upc',nullif(v_pair.value->>'upc',''),
            'identity_artist_id',p_artist_id,
            'collision_state_fingerprint',v_collision_fingerprint
          )
        )
      );
    end if;
  end loop;

  for v_pair in select key,value from jsonb_each(v_track_buckets) order by key
  loop
    if coalesce((v_pair.value->>'is_new')::boolean,false) then
      v_collision_state := platform_private.registry_track_creation_collision_state_v1(
        (v_pair.value->>'track_id')::uuid,
        v_pair.value->>'title',
        p_artist_id,
        nullif(v_pair.value->>'isrc','')
      );
      if v_collision_state <> '[]'::jsonb then
        raise exception using errcode='40001',
          message='New Track identity collides with Registry state before reviewed plan freeze.';
      end if;
      v_collision_fingerprint := platform_private.registry_identity_creation_collision_fingerprint_v1(v_collision_state);
      v_operations := v_operations || jsonb_build_array(
        jsonb_build_object(
          'ref','track.create:'||v_pair.key,
          'kind','materialization',
          'operation_key','registry.track.create',
          'subject_type','track',
          'subject_id',v_pair.value->>'track_id',
          'payload',jsonb_build_object(
            'track_id',v_pair.value->>'track_id',
            'title',v_pair.value->>'title',
            'normalized_title',v_pair.value->>'normalized_title',
            'slug',v_pair.value->>'slug',
            'isrc',nullif(v_pair.value->>'isrc',''),
            'identity_artist_id',p_artist_id,
            'collision_state_fingerprint',v_collision_fingerprint
          )
        )
      );
    end if;
  end loop;

  for v_pair in select key,value from jsonb_each(v_release_buckets) order by key
  loop
    v_operations := v_operations || jsonb_build_array(
      jsonb_build_object(
        'ref','release.profile:'||v_pair.key,
        'kind','discography',
        'operation_key','registry.release.provider_profile.admit',
        'subject_type','release',
        'subject_id',v_pair.value->>'release_id',
        'payload',v_pair.value->'profile'
      )
    );
  end loop;

  for v_pair in select key,value from jsonb_each(v_track_buckets) order by key
  loop
    v_operations := v_operations || jsonb_build_array(
      jsonb_build_object(
        'ref','track.profile:'||v_pair.key,
        'kind','discography',
        'operation_key','registry.track.provider_profile.admit',
        'subject_type','track',
        'subject_id',v_pair.value->>'track_id',
        'payload',v_pair.value->'profile'
      )
    );
  end loop;

  for v_pair in select key,value from jsonb_each(v_release_buckets) order by key
  loop
    v_current := platform_private.registry_release_artist_set_v1((v_pair.value->>'release_id')::uuid);
    v_final := platform_private.registry_discography_preserve_set_ids_v1(
      v_current,
      v_pair.value->'desired_artist_rows',
      'release_artist_set:'||v_pair.key
    );
    v_delta := platform_private.registry_discography_set_delta_v1(v_current,v_final);
    v_operations := v_operations || jsonb_build_array(
      jsonb_build_object(
        'ref','release.artist_set:'||v_pair.key,
        'kind','discography',
        'operation_key','registry.release_artist_set.replace',
        'subject_type','release',
        'subject_id',v_pair.value->>'release_id',
        'payload',jsonb_build_object(
          'current_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_current),
          'final_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_final),
          'removed_rows',(v_delta->>'removed_rows')::integer,
          'inserted_rows',(v_delta->>'inserted_rows')::integer,
          'total_rows',(v_delta->>'total_rows')::integer,
          'final_set',v_final
        )
      )
    );
  end loop;

  for v_pair in select key,value from jsonb_each(v_track_buckets) order by key
  loop
    v_desired := platform_private.registry_discography_dedupe_track_credit_rows_v1(
      v_pair.value->'desired_credit_rows'
    );
    select count(*)::integer
    into v_count
    from jsonb_array_elements(v_desired) row_payload
    where coalesce((row_payload->>'is_featured')::boolean,false);
    v_featured_links := v_featured_links+v_count;

    v_current := platform_private.registry_track_artist_credit_set_v1((v_pair.value->>'track_id')::uuid);
    v_final := platform_private.registry_discography_preserve_set_ids_v1(
      v_current,
      v_desired,
      'track_artist_set:'||v_pair.key
    );
    v_delta := platform_private.registry_discography_set_delta_v1(v_current,v_final);
    v_operations := v_operations || jsonb_build_array(
      jsonb_build_object(
        'ref','track.artist_set:'||v_pair.key,
        'kind','discography',
        'operation_key','registry.track_artist_credit_set.replace',
        'subject_type','track',
        'subject_id',v_pair.value->>'track_id',
        'payload',jsonb_build_object(
          'current_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_current),
          'final_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_final),
          'removed_rows',(v_delta->>'removed_rows')::integer,
          'inserted_rows',(v_delta->>'inserted_rows')::integer,
          'total_rows',(v_delta->>'total_rows')::integer,
          'final_set',v_final
        )
      )
    );
  end loop;

  for v_pair in select key,value from jsonb_each(v_release_buckets) order by key
  loop
    v_current := platform_private.registry_release_track_set_v1((v_pair.value->>'release_id')::uuid);
    v_final := platform_private.registry_discography_preserve_set_ids_v1(
      v_current,
      v_pair.value->'desired_track_rows',
      'release_track_set:'||v_pair.key
    );
    v_delta := platform_private.registry_discography_set_delta_v1(v_current,v_final);
    v_operations := v_operations || jsonb_build_array(
      jsonb_build_object(
        'ref','release.track_set:'||v_pair.key,
        'kind','discography',
        'operation_key','registry.release_track_set.replace',
        'subject_type','release',
        'subject_id',v_pair.value->>'release_id',
        'payload',jsonb_build_object(
          'current_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_current),
          'final_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_final),
          'removed_rows',(v_delta->>'removed_rows')::integer,
          'inserted_rows',(v_delta->>'inserted_rows')::integer,
          'total_rows',(v_delta->>'total_rows')::integer,
          'final_set',v_final
        )
      )
    );
  end loop;

  v_operations := v_operations || jsonb_build_array(
    jsonb_build_object(
      'ref','artist.discography_summary:'||p_artist_id::text,
      'kind','discography',
      'operation_key','registry.artist.discography_summary.admit',
      'subject_type','artist',
      'subject_id',p_artist_id,
      'payload',jsonb_build_object(
        'apple_music_album_ids',v_all_album_ids,
        'apple_music_discography_ingested_at',v_snapshot.acquired_at
      )
    )
  );

  return jsonb_build_object(
    'plan_version',1,
    'artist_id',p_artist_id,
    'evidence_assertion_id',p_evidence_assertion_id,
    'snapshot_id',p_snapshot_id,
    'source_payload_fingerprint',v_snapshot.source_payload_fingerprint,
    'observation_fingerprint',v_snapshot.observation_fingerprint,
    'provider_acquired_at',v_snapshot.acquired_at,
    'operations',v_operations,
    'summary',jsonb_build_object(
      'merged',v_merged,
      'canonicalized',v_canonicalized,
      'ignored',v_ignored,
      'tracks_created',v_track_occurrences,
      'featured_artist_links',v_featured_links
    )
  );
end
$$;

create function platform_private.freeze_registry_discography_review_plan_v1(
  p_artist_id uuid,
  p_evidence_assertion_id uuid,
  p_reviewed_selections jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_snapshot platform_private.registry_discography_provider_snapshots%rowtype;
  v_normalized jsonb;
  v_selection_fingerprint text;
  v_frozen_plan jsonb;
  v_plan_fingerprint text;
  v_review_plan_id uuid;
begin
  v_user_id := platform_private.registry_discography_current_admin_v1();

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type <> 'artist'
     or v_evidence.subject_id <> p_artist_id
     or v_evidence.claim_key <> 'registry.artist.discography.provider_snapshot'
     or v_evidence.trust_class <> 'EXTERNAL_EVIDENCE'
     or v_evidence.recorded_by_principal_key <> 'user:'||v_user_id::text
     or v_evidence.observed_at < now()-interval '30 days'
     or v_evidence.observed_at > now()+interval '5 minutes'
  then
    raise exception using errcode='42501',
      message='Reviewed Discography evidence is missing, stale, or belongs to another principal/Artist.';
  end if;

  select snapshot.*
  into v_snapshot
  from platform_private.registry_discography_provider_snapshots snapshot
  where snapshot.id=(v_evidence.claim_payload->>'snapshot_id')::uuid
    and snapshot.artist_id=p_artist_id
    and snapshot.recorded_by_user_id=v_user_id
    and snapshot.source_payload_fingerprint=v_evidence.source_payload_fingerprint
    and snapshot.observation_fingerprint=v_evidence.claim_payload->>'observation_fingerprint';

  if not found
     or platform_private.registry_discography_observation_fingerprint_v1(v_snapshot.observation)
        <> v_snapshot.observation_fingerprint
  then
    raise exception using errcode='42501',
      message='Immutable Discography provider snapshot no longer satisfies reviewed evidence.';
  end if;

  v_normalized := platform_private.registry_discography_normalize_reviewed_selections_v1(
    p_artist_id,
    v_snapshot.observation,
    p_reviewed_selections
  );
  v_selection_fingerprint := platform_private.registry_discography_set_fingerprint_v1(v_normalized);

  select review.id
  into v_review_plan_id
  from platform_private.registry_discography_review_plans review
  where review.reviewed_by_user_id=v_user_id
    and review.evidence_assertion_id=p_evidence_assertion_id
    and review.selection_fingerprint=v_selection_fingerprint;

  if found then
    return v_review_plan_id;
  end if;

  v_frozen_plan := platform_private.registry_discography_build_frozen_plan_v1(
    p_artist_id,
    p_evidence_assertion_id,
    v_snapshot.id,
    v_normalized
  );
  v_plan_fingerprint :=
    platform_private.registry_discography_observation_fingerprint_v1(v_frozen_plan);

  insert into platform_private.registry_discography_review_plans (
    artist_id,
    evidence_assertion_id,
    snapshot_id,
    reviewed_by_user_id,
    reviewed_selections,
    selection_fingerprint,
    frozen_plan,
    frozen_plan_fingerprint
  ) values (
    p_artist_id,
    p_evidence_assertion_id,
    v_snapshot.id,
    v_user_id,
    v_normalized,
    v_selection_fingerprint,
    v_frozen_plan,
    v_plan_fingerprint
  )
  on conflict (
    reviewed_by_user_id,
    evidence_assertion_id,
    selection_fingerprint
  ) do nothing
  returning id into v_review_plan_id;

  if v_review_plan_id is null then
    select review.id
    into v_review_plan_id
    from platform_private.registry_discography_review_plans review
    where review.reviewed_by_user_id=v_user_id
      and review.evidence_assertion_id=p_evidence_assertion_id
      and review.selection_fingerprint=v_selection_fingerprint;
  end if;

  return v_review_plan_id;
end
$$;

create function platform_private.record_registry_discography_derived_evidence_v1(
  p_review_plan_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_claim_key text,
  p_claim_payload jsonb,
  p_trust_class text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid;
  v_review platform_private.registry_discography_review_plans%rowtype;
  v_master platform_private.registry_evidence_assertions%rowtype;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
  v_source_ref text;
begin
  v_user_id := platform_private.registry_discography_current_admin_v1();

  select review.*
  into v_review
  from platform_private.registry_discography_review_plans review
  where review.id=p_review_plan_id
    and review.reviewed_by_user_id=v_user_id;

  if not found
     or p_subject_id is null
     or p_subject_type not in ('artist','track','release')
     or nullif(btrim(p_claim_key),'') is null
     or p_claim_payload is null
     or jsonb_typeof(p_claim_payload)<>'object'
     or octet_length(p_claim_payload::text)>16384
     or p_trust_class not in ('EXTERNAL_EVIDENCE','INTERNAL_FACT')
  then
    raise exception using errcode='22023',
      message='Derived Discography evidence is outside the V1 contract.';
  end if;

  select assertion.*
  into v_master
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_review.evidence_assertion_id
    and assertion.recorded_by_principal_key='user:'||v_user_id::text;

  if not found then
    raise exception using errcode='42501', message='Master Discography evidence is unavailable.';
  end if;

  v_source_ref := 'registry_discography_review_plan:'||p_review_plan_id::text;
  v_assertion_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type',p_subject_type,
        'subject_id',p_subject_id::text,
        'claim_key',p_claim_key,
        'claim_payload',p_claim_payload,
        'trust_class',p_trust_class,
        'source_kind','discography_review_plan',
        'source_ref',v_source_ref,
        'source_payload_fingerprint',v_master.source_payload_fingerprint,
        'recorded_by_principal_key','user:'||v_user_id::text
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_evidence_assertions (
    subject_type,subject_id,claim_key,claim_payload,trust_class,
    source_kind,source_ref,source_payload_fingerprint,observed_at,
    recorded_by_principal_key,assertion_fingerprint
  ) values (
    p_subject_type,p_subject_id,p_claim_key,p_claim_payload,p_trust_class,
    'discography_review_plan',v_source_ref,v_master.source_payload_fingerprint,
    v_master.observed_at,'user:'||v_user_id::text,v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint) do nothing
  returning id into v_assertion_id;

  if v_assertion_id is null then
    select assertion.id into v_assertion_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint=v_assertion_fingerprint;
  end if;

  return v_assertion_id;
end
$$;

create function platform_private.registry_discography_idempotency_key_v1(
  p_review_plan_id uuid,
  p_child_ref text
)
returns text
language sql
immutable
security definer
set search_path = pg_catalog, extensions
as $$
  select 'discography:' || p_review_plan_id::text || ':' ||
         substr(encode(extensions.digest(coalesce(p_child_ref,''),'sha256'),'hex'),1,20);
$$;

create function platform_private.registry_discography_validate_final_set_v1(
  p_operation_key text,
  p_subject_id uuid,
  p_final_set jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_final_set is null or jsonb_typeof(p_final_set)<>'array' then
    raise exception using errcode='22023', message='Discography final set must be an array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_final_set) row_payload
    where coalesce(row_payload->>'id','') !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  )
     or (
       select count(*) from jsonb_array_elements(p_final_set)
     ) <> (
       select count(distinct row_payload->>'id') from jsonb_array_elements(p_final_set) row_payload
     )
  then
    raise exception using errcode='22023', message='Discography final set has invalid or duplicate row UUIDs.';
  end if;

  if p_operation_key='registry.release_artist_set.replace' then
    if exists (
      select 1
      from jsonb_array_elements(p_final_set) row_payload
      where (row_payload->>'release_id')::uuid<>p_subject_id
         or nullif(btrim(row_payload->>'artist_slug'),'') is null
         or nullif(btrim(row_payload->>'artist_name_text'),'') is null
         or row_payload->>'role' not in ('primary_artist','featured_artist')
         or coalesce((row_payload->>'is_primary')::boolean,false) <> (row_payload->>'role'='primary_artist')
         or coalesce((row_payload->>'is_featured')::boolean,false) <> (row_payload->>'role'='featured_artist')
         or coalesce((row_payload->>'credit_order')::integer,0)<1
         or coalesce((row_payload->>'confidence')::integer,-1) not between 0 and 100
         or row_payload->>'source'<>'apple_music_ingest'
         or row_payload->>'status'<>'active'
         or jsonb_typeof(coalesce(row_payload->'metadata','{}'::jsonb))<>'object'
    )
       or (
         select count(*) from jsonb_array_elements(p_final_set)
       ) <> (
         select count(distinct row_payload->>'artist_slug') from jsonb_array_elements(p_final_set) row_payload
       )
       or exists (
         select 1
         from jsonb_array_elements(p_final_set) row_payload
         where nullif(row_payload->>'artist_id','') is not null
           and not exists (
             select 1 from public.registry_artists artist
             where artist.id=(row_payload->>'artist_id')::uuid
               and artist.status<>'archived'
               and artist.slug=row_payload->>'artist_slug'
               and artist.display_name=row_payload->>'artist_name_text'
           )
       )
    then
      raise exception using errcode='22023', message='Release Artist final set violates V1 credit semantics.';
    end if;
  elsif p_operation_key='registry.release_track_set.replace' then
    if exists (
      select 1
      from jsonb_array_elements(p_final_set) row_payload
      where (row_payload->>'release_id')::uuid<>p_subject_id
         or coalesce((row_payload->>'disc_number')::integer,0)<1
         or (row_payload->>'track_number' is not null and (row_payload->>'track_number')::integer<1)
         or row_payload->>'source'<>'apple_music_ingest'
         or row_payload->>'status'<>'active'
         or not exists (
           select 1 from public.registry_tracks track
           where track.id=(row_payload->>'track_id')::uuid
             and track.status<>'archived'
         )
    )
       or (
         select count(*) from jsonb_array_elements(p_final_set)
       ) <> (
         select count(distinct row_payload->>'track_id') from jsonb_array_elements(p_final_set) row_payload
       )
    then
      raise exception using errcode='22023', message='Release Track final set violates V1 membership semantics.';
    end if;
  elsif p_operation_key='registry.track_artist_credit_set.replace' then
    if exists (
      select 1
      from jsonb_array_elements(p_final_set) row_payload
      where (row_payload->>'track_id')::uuid<>p_subject_id
         or nullif(btrim(row_payload->>'artist_slug'),'') is null
         or nullif(btrim(row_payload->>'artist_name_text'),'') is null
         or row_payload->>'role' not in ('primary_artist','featured_artist')
         or coalesce((row_payload->>'is_primary')::boolean,false) <> (row_payload->>'role'='primary_artist')
         or coalesce((row_payload->>'is_featured')::boolean,false) <> (row_payload->>'role'='featured_artist')
         or coalesce((row_payload->>'credit_order')::integer,0)<1
         or coalesce((row_payload->>'confidence')::integer,-1) not between 0 and 100
         or row_payload->>'source'<>'apple_music_ingest'
         or row_payload->>'status'<>'active'
         or jsonb_typeof(coalesce(row_payload->'metadata','{}'::jsonb))<>'object'
    )
       or (
         select count(*) from jsonb_array_elements(p_final_set)
       ) <> (
         select count(distinct row_payload->>'artist_slug') from jsonb_array_elements(p_final_set) row_payload
       )
       or exists (
         select 1
         from jsonb_array_elements(p_final_set) row_payload
         where nullif(row_payload->>'artist_id','') is not null
           and not exists (
             select 1 from public.registry_artists artist
             where artist.id=(row_payload->>'artist_id')::uuid
               and artist.status<>'archived'
               and artist.slug=row_payload->>'artist_slug'
               and artist.display_name=row_payload->>'artist_name_text'
           )
       )
    then
      raise exception using errcode='22023', message='Track Artist final set violates V1 credit semantics.';
    end if;
  else
    raise exception using errcode='22023', message='Unknown Discography exact-set operation.';
  end if;
end
$$;

create function platform_private.execute_registry_discography_operation_v1(
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
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_plan jsonb;
  v_review platform_private.registry_discography_review_plans%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_child jsonb;
  v_payload jsonb;
  v_current_set jsonb;
  v_final_set jsonb;
  v_delta jsonb;
  v_event_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_rows integer := 0;
  v_deleted integer := 0;
  v_inserted integer := 0;
  v_expected_total integer;
  v_user_id uuid := auth.uid();
begin
  select * into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_discography_admin',
    p_execution_grant_id
  );

  select operation.* into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_begin.operation_id
  for update;

  if v_begin.idempotent_replay and v_operation.status='succeeded' then
    operation_id:=v_operation.id;
    operation_status:=v_operation.status;
    verifier_status:=v_operation.verifier_status;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  select execution_grant.* into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=p_execution_grant_id;

  if not found
     or v_operation.status<>'authorized'
     or v_grant.actor_key<>'registry_discography_admin'
     or v_grant.operation_version<>1
     or v_grant.policy_ruleset_version<>'registry-discography-exact-set-v1'
     or v_grant.operation_key not in (
       'registry.discography.apply',
       'registry.release.provider_profile.admit',
       'registry.track.provider_profile.admit',
       'registry.artist.discography_summary.admit',
       'registry.release_artist_set.replace',
       'registry.release_track_set.replace',
       'registry.track_artist_credit_set.replace'
     )
  then
    raise exception using errcode='42501', message='Execution grant is not Discography Exact-Set V1 authority.';
  end if;

  select target.* into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or (select count(*) from platform_private.registry_execution_grant_targets t where t.execution_grant_id=v_grant.id)<>1
  then
    raise exception using errcode='42501', message='Discography V1 requires one exact target.';
  end if;

  v_plan:=v_grant.plan_payload;
  select review.* into v_review
  from platform_private.registry_discography_review_plans review
  where review.id=(v_plan->>'review_plan_id')::uuid
    and review.reviewed_by_user_id=v_grant.issued_by_user_id
    and review.reviewed_by_user_id=v_user_id;

  if not found
     or platform_private.registry_discography_observation_fingerprint_v1(v_review.frozen_plan)
        <> v_review.frozen_plan_fingerprint
     or v_review.evidence_assertion_id::text is distinct from v_plan->>'evidence_assertion_id'
  then
    raise exception using errcode='42501', message='Frozen Discography review plan no longer satisfies the exact grant.';
  end if;

  select assertion.* into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_review.evidence_assertion_id;

  if not found
     or v_evidence.assertion_fingerprint is distinct from v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.recorded_by_principal_key<>'user:'||v_grant.issued_by_user_id::text
  then
    raise exception using errcode='42501', message='Discography master evidence no longer satisfies the exact grant.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',started_at=coalesce(started_at,now()),updated_at=now()
  where id=v_operation.id;

  if v_grant.operation_key='registry.discography.apply' then
    if v_target.subject_type<>'artist'
       or v_target.subject_id<>v_review.artist_id
       or jsonb_typeof(v_plan->'child_operation_ids')<>'array'
       or exists (
         select 1
         from jsonb_array_elements_text(v_plan->'child_operation_ids') child_id
         where child_id !~ '^[0-9a-fA-F-]{36}$'
            or not exists (
              select 1
              from platform_private.registry_mutation_operations child_operation
              join platform_private.registry_execution_grants child_grant
                on child_grant.id=child_operation.execution_grant_id
              where child_operation.id=child_id::uuid
                and child_operation.actor_key='registry_discography_admin'
                and child_operation.status='succeeded'
                and child_operation.verifier_status='passed'
                and child_grant.issued_by_user_id=v_grant.issued_by_user_id
            )
       )
    then
      raise exception using errcode='42501', message='Discography parent apply receipt contains unverified child authority.';
    end if;
    v_rows:=0;
    v_after:=jsonb_build_object(
      'review_plan_id',v_review.id,
      'child_operation_ids',v_plan->'child_operation_ids'
    );
  else
    select value into v_child
    from jsonb_array_elements(v_review.frozen_plan->'operations')
    where value->>'ref'=v_plan->>'child_ref';

    if v_child is null
       or v_child->>'operation_key'<>v_grant.operation_key
       or v_child->>'subject_type'<>v_target.subject_type
       or (v_child->>'subject_id')::uuid<>v_target.subject_id
    then
      raise exception using errcode='42501', message='Discography child reference escaped the frozen review plan.';
    end if;
    v_payload:=v_child->'payload';

    if v_grant.operation_key='registry.release.provider_profile.admit' then
      select jsonb_build_object(
        'release_type',release.release_type,
        'release_date',release.release_date,
        'artwork_url',release.artwork_url,
        'apple_music_album_id',release.metadata->>'apple_music_album_id',
        'apple_music_url',release.metadata->>'apple_music_url',
        'genre_names',release.metadata->'genre_names',
        'record_label',release.metadata->>'record_label',
        'source',release.metadata->>'source'
      ) into v_before
      from public.registry_releases release
      where release.id=v_target.subject_id
      for update;

      if v_before is null then
        raise exception using errcode='P0002', message='Discography Release target is missing.';
      end if;

      update public.registry_releases
      set release_type=v_payload->>'release_type',
          release_date=nullif(v_payload->>'release_date','')::date,
          artwork_url=nullif(v_payload->>'artwork_url',''),
          metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
            'apple_music_album_id',v_payload->>'apple_music_album_id',
            'apple_music_url',nullif(v_payload->>'apple_music_url',''),
            'genre_names',coalesce(v_payload->'genre_names','[]'::jsonb),
            'record_label',nullif(v_payload->>'record_label',''),
            'source','apple_music_ingest'
          ),
          updated_at=now()
      where id=v_target.subject_id;
      get diagnostics v_rows=row_count;

      select jsonb_build_object(
        'release_type',release.release_type,
        'release_date',release.release_date,
        'artwork_url',release.artwork_url,
        'apple_music_album_id',release.metadata->>'apple_music_album_id',
        'apple_music_url',release.metadata->>'apple_music_url',
        'genre_names',release.metadata->'genre_names',
        'record_label',release.metadata->>'record_label',
        'source',release.metadata->>'source'
      ) into v_after
      from public.registry_releases release
      where release.id=v_target.subject_id;

    elsif v_grant.operation_key='registry.track.provider_profile.admit' then
      select jsonb_build_object(
        'duration_ms',track.duration_ms,
        'explicit',track.explicit,
        'track_number',track.track_number,
        'disc_number',track.disc_number,
        'artwork_url',track.artwork_url,
        'preview_url',track.preview_url,
        'apple_music_track_id',track.metadata->>'apple_music_track_id',
        'apple_music_album_id',track.metadata->>'apple_music_album_id',
        'genre_names',track.metadata->'genre_names',
        'source',track.metadata->>'source'
      ) into v_before
      from public.registry_tracks track
      where track.id=v_target.subject_id
      for update;

      if v_before is null then
        raise exception using errcode='P0002', message='Discography Track target is missing.';
      end if;

      update public.registry_tracks
      set duration_ms=case when v_payload->>'duration_ms' is null then null else (v_payload->>'duration_ms')::integer end,
          explicit=coalesce((v_payload->>'explicit')::boolean,false),
          track_number=case when v_payload->>'track_number' is null then null else (v_payload->>'track_number')::integer end,
          disc_number=case when v_payload->>'disc_number' is null then null else (v_payload->>'disc_number')::integer end,
          artwork_url=nullif(v_payload->>'artwork_url',''),
          preview_url=nullif(v_payload->>'preview_url',''),
          metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
            'apple_music_track_id',v_payload->>'apple_music_track_id',
            'apple_music_album_id',v_payload->>'apple_music_album_id',
            'genre_names',coalesce(v_payload->'genre_names','[]'::jsonb),
            'source','apple_music_ingest'
          ),
          updated_at=now()
      where id=v_target.subject_id;
      get diagnostics v_rows=row_count;

      select jsonb_build_object(
        'duration_ms',track.duration_ms,
        'explicit',track.explicit,
        'track_number',track.track_number,
        'disc_number',track.disc_number,
        'artwork_url',track.artwork_url,
        'preview_url',track.preview_url,
        'apple_music_track_id',track.metadata->>'apple_music_track_id',
        'apple_music_album_id',track.metadata->>'apple_music_album_id',
        'genre_names',track.metadata->'genre_names',
        'source',track.metadata->>'source'
      ) into v_after
      from public.registry_tracks track
      where track.id=v_target.subject_id;

    elsif v_grant.operation_key='registry.artist.discography_summary.admit' then
      select jsonb_build_object(
        'apple_music_album_ids',artist.metadata->'apple_music_album_ids',
        'apple_music_discography_ingested_at',artist.metadata->>'apple_music_discography_ingested_at'
      ) into v_before
      from public.registry_artists artist
      where artist.id=v_target.subject_id
      for update;

      if v_before is null then
        raise exception using errcode='P0002', message='Discography Artist summary target is missing.';
      end if;

      update public.registry_artists
      set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
            'apple_music_album_ids',coalesce(v_payload->'apple_music_album_ids','[]'::jsonb),
            'apple_music_discography_ingested_at',v_payload->>'apple_music_discography_ingested_at'
          ),
          updated_at=now()
      where id=v_target.subject_id;
      get diagnostics v_rows=row_count;

      select jsonb_build_object(
        'apple_music_album_ids',artist.metadata->'apple_music_album_ids',
        'apple_music_discography_ingested_at',artist.metadata->>'apple_music_discography_ingested_at'
      ) into v_after
      from public.registry_artists artist
      where artist.id=v_target.subject_id;

    elsif v_grant.operation_key in (
      'registry.release_artist_set.replace',
      'registry.release_track_set.replace',
      'registry.track_artist_credit_set.replace'
    ) then
      if v_grant.operation_key='registry.release_artist_set.replace' then
        v_current_set:=platform_private.registry_release_artist_set_v1(v_target.subject_id);
      elsif v_grant.operation_key='registry.release_track_set.replace' then
        v_current_set:=platform_private.registry_release_track_set_v1(v_target.subject_id);
      else
        v_current_set:=platform_private.registry_track_artist_credit_set_v1(v_target.subject_id);
      end if;

      v_final_set:=v_payload->'final_set';
      if platform_private.registry_discography_set_fingerprint_v1(v_current_set)
           is distinct from v_payload->>'current_set_fingerprint'
         or platform_private.registry_discography_set_fingerprint_v1(v_final_set)
           is distinct from v_payload->>'final_set_fingerprint'
      then
        raise exception using errcode='40001',
          message='Discography exact set changed after reviewed plan freeze.';
      end if;

      perform platform_private.registry_discography_validate_final_set_v1(
        v_grant.operation_key,
        v_target.subject_id,
        v_final_set
      );
      v_delta:=platform_private.registry_discography_set_delta_v1(v_current_set,v_final_set);
      v_expected_total:=(v_delta->>'total_rows')::integer;

      if (v_delta->>'removed_rows')::integer<>(v_payload->>'removed_rows')::integer
         or (v_delta->>'inserted_rows')::integer<>(v_payload->>'inserted_rows')::integer
         or v_expected_total<>(v_payload->>'total_rows')::integer
         or v_grant.max_rows<>greatest(v_expected_total,1)
      then
        raise exception using errcode='42501',
          message='Discography exact-set row budget no longer matches the frozen reviewed plan.';
      end if;

      if exists (
        select 1
        from jsonb_array_elements(v_final_set) final_row
        where not exists (
          select 1 from jsonb_array_elements(v_current_set) current_row
          where current_row->>'id'=final_row->>'id'
        )
          and (
            exists (select 1 from public.registry_release_artists r where r.id=(final_row->>'id')::uuid)
            or exists (select 1 from public.registry_release_tracks r where r.id=(final_row->>'id')::uuid)
            or exists (select 1 from public.registry_track_artists r where r.id=(final_row->>'id')::uuid)
          )
      ) then
        raise exception using errcode='40001',
          message='Discography final set attempts to reuse a relation UUID owned by different Registry state.';
      end if;

      if v_grant.operation_key='registry.release_artist_set.replace' then
        delete from public.registry_release_artists target_row
        where target_row.release_id=v_target.subject_id
          and exists (
            select 1 from jsonb_array_elements(v_current_set) current_row
            where current_row->>'id'=target_row.id::text
              and not exists (
                select 1 from jsonb_array_elements(v_final_set) final_row
                where final_row->>'id'=current_row->>'id'
              )
          );
        get diagnostics v_deleted=row_count;

        insert into public.registry_release_artists (
          id,release_id,artist_id,artist_slug,artist_name_text,
          role,is_primary,is_featured,credit_order,display_credit,
          source,confidence,status,metadata
        )
        select
          (row_payload->>'id')::uuid,
          (row_payload->>'release_id')::uuid,
          nullif(row_payload->>'artist_id','')::uuid,
          row_payload->>'artist_slug',
          row_payload->>'artist_name_text',
          row_payload->>'role',
          (row_payload->>'is_primary')::boolean,
          (row_payload->>'is_featured')::boolean,
          (row_payload->>'credit_order')::integer,
          nullif(row_payload->>'display_credit',''),
          row_payload->>'source',
          (row_payload->>'confidence')::integer,
          row_payload->>'status',
          coalesce(row_payload->'metadata','{}'::jsonb)
        from jsonb_array_elements(v_final_set) row_payload
        where not exists (
          select 1 from jsonb_array_elements(v_current_set) current_row
          where current_row->>'id'=row_payload->>'id'
        );
        get diagnostics v_inserted=row_count;

      elsif v_grant.operation_key='registry.release_track_set.replace' then
        delete from public.registry_release_tracks target_row
        where target_row.release_id=v_target.subject_id
          and exists (
            select 1 from jsonb_array_elements(v_current_set) current_row
            where current_row->>'id'=target_row.id::text
              and not exists (
                select 1 from jsonb_array_elements(v_final_set) final_row
                where final_row->>'id'=current_row->>'id'
              )
          );
        get diagnostics v_deleted=row_count;

        insert into public.registry_release_tracks (
          id,release_id,track_id,disc_number,track_number,
          source,confidence,status,metadata
        )
        select
          (row_payload->>'id')::uuid,
          (row_payload->>'release_id')::uuid,
          (row_payload->>'track_id')::uuid,
          (row_payload->>'disc_number')::integer,
          case when row_payload->>'track_number' is null then null else (row_payload->>'track_number')::integer end,
          row_payload->>'source',
          (row_payload->>'confidence')::integer,
          row_payload->>'status',
          coalesce(row_payload->'metadata','{}'::jsonb)
        from jsonb_array_elements(v_final_set) row_payload
        where not exists (
          select 1 from jsonb_array_elements(v_current_set) current_row
          where current_row->>'id'=row_payload->>'id'
        );
        get diagnostics v_inserted=row_count;

      else
        delete from public.registry_track_artists target_row
        where target_row.track_id=v_target.subject_id
          and exists (
            select 1 from jsonb_array_elements(v_current_set) current_row
            where current_row->>'id'=target_row.id::text
              and not exists (
                select 1 from jsonb_array_elements(v_final_set) final_row
                where final_row->>'id'=current_row->>'id'
              )
          );
        get diagnostics v_deleted=row_count;

        insert into public.registry_track_artists (
          id,track_id,artist_id,artist_slug,artist_name_text,
          role,is_primary,is_featured,credit_order,display_credit,
          source,confidence,status,metadata
        )
        select
          (row_payload->>'id')::uuid,
          (row_payload->>'track_id')::uuid,
          nullif(row_payload->>'artist_id','')::uuid,
          row_payload->>'artist_slug',
          row_payload->>'artist_name_text',
          row_payload->>'role',
          (row_payload->>'is_primary')::boolean,
          (row_payload->>'is_featured')::boolean,
          (row_payload->>'credit_order')::integer,
          nullif(row_payload->>'display_credit',''),
          row_payload->>'source',
          (row_payload->>'confidence')::integer,
          row_payload->>'status',
          coalesce(row_payload->'metadata','{}'::jsonb)
        from jsonb_array_elements(v_final_set) row_payload
        where not exists (
          select 1 from jsonb_array_elements(v_current_set) current_row
          where current_row->>'id'=row_payload->>'id'
        );
        get diagnostics v_inserted=row_count;
      end if;

      if v_deleted<>(v_delta->>'removed_rows')::integer
         or v_inserted<>(v_delta->>'inserted_rows')::integer
      then
        raise exception using errcode='40001',
          message='Discography exact-set physical mutation escaped the frozen delta budget.';
      end if;

      v_rows:=v_deleted+v_inserted;
      v_before:=jsonb_build_object(
        'set_fingerprint',v_payload->>'current_set_fingerprint',
        'row_count',jsonb_array_length(v_current_set)
      );
      v_after:=jsonb_build_object(
        'set_fingerprint',v_payload->>'final_set_fingerprint',
        'row_count',jsonb_array_length(v_final_set),
        'removed_rows',v_deleted,
        'inserted_rows',v_inserted
      );
    end if;

    if v_rows>v_grant.max_rows then
      raise exception using errcode='42501', message='Discography operation exceeded exact row budget.';
    end if;

    insert into public.registry_canonical_write_events (
      registry_entity_type,registry_entity_id,source_suggestion_id,
      source_table,field_name,target_path,before_value,after_value,
      action,status,actor
    ) values (
      v_target.subject_type,
      v_target.subject_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      case v_grant.operation_key
        when 'registry.release.provider_profile.admit' then 'provider_profile'
        when 'registry.track.provider_profile.admit' then 'provider_profile'
        when 'registry.artist.discography_summary.admit' then 'discography_summary'
        when 'registry.release_artist_set.replace' then 'artist_credit_set'
        when 'registry.release_track_set.replace' then 'track_membership_set'
        else 'artist_credit_set'
      end,
      case v_grant.operation_key
        when 'registry.release.provider_profile.admit' then 'public.registry_releases'
        when 'registry.track.provider_profile.admit' then 'public.registry_tracks'
        when 'registry.artist.discography_summary.admit' then 'public.registry_artists'
        when 'registry.release_artist_set.replace' then 'public.registry_release_artists'
        when 'registry.release_track_set.replace' then 'public.registry_release_tracks'
        else 'public.registry_track_artists'
      end,
      v_before,
      v_after,
      case when v_grant.operation_key like '%.replace' then 'replace_exact_set' else 'admit_provider_fact' end,
      'succeeded',
      'system:registry_discography_admin'
    ) returning id into v_event_id;
  end if;

  if v_event_id is not null then
    insert into platform_private.registry_operation_write_events (
      operation_id,canonical_write_event_id
    ) values (v_operation.id,v_event_id);
  end if;

  update platform_private.registry_mutation_operations
  set affected_rows=v_rows,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'review_plan_id',v_review.id,
        'child_ref',nullif(v_plan->>'child_ref',''),
        'subject_type',v_target.subject_type,
        'subject_id',v_target.subject_id,
        'evidence_assertion_id',v_evidence.id,
        'canonical_write_event_id',v_event_id,
        'result',coalesce(v_after,'{}'::jsonb)
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

create function platform_private.verify_registry_discography_operation_v1(
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
  v_review platform_private.registry_discography_review_plans%rowtype;
  v_child jsonb;
  v_payload jsonb;
  v_actual jsonb;
  v_event_count integer;
  v_expected_rows integer;
  v_failure text;
begin
  select operation.* into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.operation_version<>1
     or v_operation.operation_key not in (
       'registry.discography.apply',
       'registry.release.provider_profile.admit',
       'registry.track.provider_profile.admit',
       'registry.artist.discography_summary.admit',
       'registry.release_artist_set.replace',
       'registry.release_track_set.replace',
       'registry.track_artist_credit_set.replace'
     )
  then
    raise exception using errcode='P0002', message='Discography V1 operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded' then
    v_failure:='operation_not_succeeded';
  end if;

  select execution_grant.* into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;
  if v_failure is null and not found then
    v_failure:='execution_grant_missing';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    select target.* into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id=v_grant.id;
    if not found then
      v_failure:='exact_target_missing';
    end if;
  end if;

  if v_failure is null then
    select review.* into v_review
    from platform_private.registry_discography_review_plans review
    where review.id=(v_plan->>'review_plan_id')::uuid;
    if not found
       or platform_private.registry_discography_observation_fingerprint_v1(v_review.frozen_plan)
          <> v_review.frozen_plan_fingerprint
    then
      v_failure:='review_plan_integrity_mismatch';
    end if;
  end if;

  if v_failure is null and v_operation.operation_key='registry.discography.apply' then
    if v_operation.affected_rows<>0
       or jsonb_typeof(v_plan->'child_operation_ids')<>'array'
       or exists (
         select 1
         from jsonb_array_elements_text(v_plan->'child_operation_ids') child_id
         where not exists (
           select 1
           from platform_private.registry_mutation_operations child_operation
           where child_operation.id=child_id::uuid
             and child_operation.actor_key='registry_discography_admin'
             and child_operation.status='succeeded'
             and child_operation.verifier_status='passed'
         )
       )
    then
      v_failure:='parent_child_verification_mismatch';
    end if;
  elsif v_failure is null then
    select value into v_child
    from jsonb_array_elements(v_review.frozen_plan->'operations')
    where value->>'ref'=v_plan->>'child_ref';

    if v_child is null
       or v_child->>'operation_key'<>v_operation.operation_key
       or (v_child->>'subject_id')::uuid<>v_target.subject_id
    then
      v_failure:='frozen_child_mismatch';
    else
      v_payload:=v_child->'payload';
    end if;
  end if;

  if v_failure is null and v_operation.operation_key='registry.release.provider_profile.admit' then
    select jsonb_build_object(
      'release_type',release.release_type,
      'release_date',release.release_date,
      'artwork_url',release.artwork_url,
      'apple_music_album_id',release.metadata->>'apple_music_album_id',
      'apple_music_url',release.metadata->>'apple_music_url',
      'genre_names',release.metadata->'genre_names',
      'record_label',release.metadata->>'record_label',
      'source',release.metadata->>'source'
    ) into v_actual
    from public.registry_releases release
    where release.id=v_target.subject_id;
    if v_actual is distinct from jsonb_build_object(
      'release_type',v_payload->>'release_type',
      'release_date',nullif(v_payload->>'release_date','')::date,
      'artwork_url',nullif(v_payload->>'artwork_url',''),
      'apple_music_album_id',v_payload->>'apple_music_album_id',
      'apple_music_url',nullif(v_payload->>'apple_music_url',''),
      'genre_names',coalesce(v_payload->'genre_names','[]'::jsonb),
      'record_label',nullif(v_payload->>'record_label',''),
      'source','apple_music_ingest'
    ) or v_operation.affected_rows<>1 then
      v_failure:='release_provider_profile_mismatch';
    end if;
  elsif v_failure is null and v_operation.operation_key='registry.track.provider_profile.admit' then
    select jsonb_build_object(
      'duration_ms',track.duration_ms,
      'explicit',track.explicit,
      'track_number',track.track_number,
      'disc_number',track.disc_number,
      'artwork_url',track.artwork_url,
      'preview_url',track.preview_url,
      'apple_music_track_id',track.metadata->>'apple_music_track_id',
      'apple_music_album_id',track.metadata->>'apple_music_album_id',
      'genre_names',track.metadata->'genre_names',
      'source',track.metadata->>'source'
    ) into v_actual
    from public.registry_tracks track
    where track.id=v_target.subject_id;
    if v_actual is distinct from jsonb_build_object(
      'duration_ms',case when v_payload->>'duration_ms' is null then null else (v_payload->>'duration_ms')::integer end,
      'explicit',coalesce((v_payload->>'explicit')::boolean,false),
      'track_number',case when v_payload->>'track_number' is null then null else (v_payload->>'track_number')::integer end,
      'disc_number',case when v_payload->>'disc_number' is null then null else (v_payload->>'disc_number')::integer end,
      'artwork_url',nullif(v_payload->>'artwork_url',''),
      'preview_url',nullif(v_payload->>'preview_url',''),
      'apple_music_track_id',v_payload->>'apple_music_track_id',
      'apple_music_album_id',v_payload->>'apple_music_album_id',
      'genre_names',coalesce(v_payload->'genre_names','[]'::jsonb),
      'source','apple_music_ingest'
    ) or v_operation.affected_rows<>1 then
      v_failure:='track_provider_profile_mismatch';
    end if;
  elsif v_failure is null and v_operation.operation_key='registry.artist.discography_summary.admit' then
    select jsonb_build_object(
      'apple_music_album_ids',artist.metadata->'apple_music_album_ids',
      'apple_music_discography_ingested_at',artist.metadata->>'apple_music_discography_ingested_at'
    ) into v_actual
    from public.registry_artists artist
    where artist.id=v_target.subject_id;
    if v_actual is distinct from jsonb_build_object(
      'apple_music_album_ids',coalesce(v_payload->'apple_music_album_ids','[]'::jsonb),
      'apple_music_discography_ingested_at',v_payload->>'apple_music_discography_ingested_at'
    ) or v_operation.affected_rows<>1 then
      v_failure:='artist_discography_summary_mismatch';
    end if;
  elsif v_failure is null and v_operation.operation_key in (
    'registry.release_artist_set.replace',
    'registry.release_track_set.replace',
    'registry.track_artist_credit_set.replace'
  ) then
    if v_operation.operation_key='registry.release_artist_set.replace' then
      v_actual:=platform_private.registry_release_artist_set_v1(v_target.subject_id);
    elsif v_operation.operation_key='registry.release_track_set.replace' then
      v_actual:=platform_private.registry_release_track_set_v1(v_target.subject_id);
    else
      v_actual:=platform_private.registry_track_artist_credit_set_v1(v_target.subject_id);
    end if;
    v_expected_rows:=(v_payload->>'total_rows')::integer;
    if platform_private.registry_discography_set_fingerprint_v1(v_actual)
         is distinct from v_payload->>'final_set_fingerprint'
       or v_operation.affected_rows<>v_expected_rows
    then
      v_failure:='canonical_exact_set_mismatch';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer into v_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_id=v_target.subject_id::text
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.source_suggestion_id=v_review.evidence_assertion_id::text
      and event.status='succeeded'
      and event.actor='system:registry_discography_admin';

    if v_operation.operation_key='registry.discography.apply' then
      if v_event_count<>0 then v_failure:='parent_write_event_mismatch'; end if;
    elsif v_event_count<>1 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set verifier_status='passed',
        result_payload=result_payload || jsonb_build_object(
          'verification',jsonb_build_object('status','passed','verified_at',now())
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
      error_code='registry_discography_verification_failed',
      error_message=v_failure,
      result_payload=result_payload || jsonb_build_object(
        'verification',jsonb_build_object('status','failed','reason',v_failure,'verified_at',now())
      ),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  verifier_status:='failed';
  return next;
end
$$;

create function platform_private.record_registry_discography_artist_shell_evidence_v1(
  p_current_artist_id uuid,
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
  v_claim jsonb;
  v_source_fingerprint text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  v_user_id:=platform_private.registry_discography_current_admin_v1();
  if not exists (
    select 1 from public.registry_artists artist
    where artist.id=p_current_artist_id and artist.status<>'archived'
  ) then
    raise exception using errcode='P0002', message='Current Discography Artist is missing.';
  end if;

  v_claim:=jsonb_build_object(
    'current_artist_id',p_current_artist_id,
    'future_artist_id',p_future_artist_id,
    'display_name',p_display_name,
    'normalized_name',p_normalized_name,
    'slug',p_slug
  );
  v_source_fingerprint:=encode(extensions.digest(v_claim::text,'sha256'),'hex');
  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','artist',
        'subject_id',p_future_artist_id::text,
        'claim_key','registry.artist.identity.create',
        'claim_payload',v_claim,
        'trust_class','INTERNAL_FACT',
        'source_kind','discography_admin_artist_shell',
        'source_ref','registry_artist:'||p_current_artist_id::text,
        'source_payload_fingerprint',v_source_fingerprint,
        'recorded_by_principal_key','user:'||v_user_id::text
      )::text,'sha256'
    ),'hex'
  );

  insert into platform_private.registry_evidence_assertions (
    subject_type,subject_id,claim_key,claim_payload,trust_class,
    source_kind,source_ref,source_payload_fingerprint,observed_at,
    recorded_by_principal_key,assertion_fingerprint
  ) values (
    'artist',p_future_artist_id,'registry.artist.identity.create',v_claim,'INTERNAL_FACT',
    'discography_admin_artist_shell','registry_artist:'||p_current_artist_id::text,
    v_source_fingerprint,now(),'user:'||v_user_id::text,v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint) do nothing
  returning id into v_assertion_id;

  if v_assertion_id is null then
    select assertion.id into v_assertion_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint=v_assertion_fingerprint;
  end if;
  return v_assertion_id;
end
$$;

create function public.admin_prepare_registry_discography_evidence_v1(
  p_artist_id uuid,
  p_observation jsonb,
  p_source_payload_fingerprint text
)
returns uuid
language sql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
  select platform_private.record_registry_discography_provider_evidence_v1(
    p_artist_id,p_observation,p_source_payload_fingerprint
  );
$$;

create function public.admin_preview_registry_discography_evidence_v1(
  p_evidence_assertion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_snapshot platform_private.registry_discography_provider_snapshots%rowtype;
  v_artist public.registry_artists%rowtype;
  v_albums jsonb;
begin
  v_user_id := platform_private.registry_discography_current_admin_v1();

  select assertion.* into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.claim_key<>'registry.artist.discography.provider_snapshot'
     or v_evidence.trust_class<>'EXTERNAL_EVIDENCE'
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Reviewed Discography evidence is missing or belongs to another principal.';
  end if;

  select snapshot.* into v_snapshot
  from platform_private.registry_discography_provider_snapshots snapshot
  where snapshot.id=(v_evidence.claim_payload->>'snapshot_id')::uuid
    and snapshot.artist_id=v_evidence.subject_id
    and snapshot.recorded_by_user_id=v_user_id
    and snapshot.source_payload_fingerprint=v_evidence.source_payload_fingerprint
    and snapshot.observation_fingerprint=v_evidence.claim_payload->>'observation_fingerprint';

  if not found
     or platform_private.registry_discography_observation_fingerprint_v1(v_snapshot.observation)
        <> v_snapshot.observation_fingerprint
  then
    raise exception using errcode='42501',
      message='Immutable Discography provider snapshot no longer satisfies the evidence assertion.';
  end if;

  select artist.* into v_artist
  from public.registry_artists artist
  where artist.id=v_snapshot.artist_id and artist.status<>'archived';
  if not found then
    raise exception using errcode='P0002', message='Discography Artist no longer exists.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'apple_music_id',album->>'apple_music_id',
        'title',album->>'title',
        'slug',platform_private.registry_release_creation_slug_v1(album->>'title',v_artist.id),
        'release_type',album->>'release_type',
        'release_date',nullif(album->>'release_date',''),
        'upc',nullif(album->>'upc',''),
        'record_label',nullif(album->>'record_label',''),
        'genre_names',coalesce(album->'genre_names','[]'::jsonb),
        'artwork_url',nullif(album->>'artwork_url',''),
        'apple_music_url',nullif(album->>'apple_music_url',''),
        'track_count',jsonb_array_length(album->'tracks'),
        'tracks',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'apple_music_id',track->>'apple_music_id',
              'title',track->>'title',
              'track_number',case when track->>'track_number' is null then null else (track->>'track_number')::integer end,
              'disc_number',case when track->>'disc_number' is null then null else (track->>'disc_number')::integer end,
              'duration_ms',case when track->>'duration_ms' is null then null else (track->>'duration_ms')::integer end,
              'duration_display',case
                when track->>'duration_ms' is null then '0:00'
                else ((track->>'duration_ms')::integer/60000)::text || ':' ||
                     lpad((((track->>'duration_ms')::integer/1000)%60)::text,2,'0')
              end,
              'isrc',nullif(track->>'isrc',''),
              'artist_name',track->>'artist_name',
              'explicit',coalesce((track->>'explicit')::boolean,false),
              'preview_url',nullif(track->>'preview_url','')
            )
            order by coalesce((track->>'disc_number')::integer,1),
                     coalesce((track->>'track_number')::integer,2147483647),
                     track->>'apple_music_id'
          )
          from jsonb_array_elements(album->'tracks') track
        ),'[]'::jsonb),
        'match_status',case when match.release_id is null then 'new' else 'existing' end,
        'existing_release',case when match.release_id is null then null else jsonb_build_object(
          'id',existing_release.id,
          'slug',existing_release.slug,
          'title',existing_release.title,
          'source',coalesce(existing_release.metadata->>'source','registry')
        ) end,
        'album_artist_name',album->>'album_artist_name'
      )
      order by case when match.release_id is null then 1 else 0 end,
               nullif(album->>'release_date','') desc nulls last,
               album->>'apple_music_id'
    ),'[]'::jsonb
  ) into v_albums
  from jsonb_array_elements(v_snapshot.observation->'albums') album
  cross join lateral (
    select platform_private.registry_discography_resolve_release_v1(v_artist.id,album) as release_id
  ) match
  left join public.registry_releases existing_release on existing_release.id=match.release_id;

  return jsonb_build_object(
    'artist',jsonb_build_object('id',v_artist.id,'slug',v_artist.slug,'name',v_artist.display_name),
    'storefront',v_snapshot.storefront,
    'albums_searched',jsonb_array_length(v_snapshot.observation->'albums')+jsonb_array_length(v_snapshot.observation->'failed_album_ids'),
    'albums_fetched',jsonb_array_length(v_snapshot.observation->'albums'),
    'albums_failed',v_snapshot.observation->'failed_album_ids',
    'albums',v_albums
  );
end
$$;

create function public.admin_create_registry_discography_artist_shell_v1(
  p_current_artist_id uuid,
  p_artist_name text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_display_name text;
  v_normalized_name text;
  v_slug text;
  v_existing_ids uuid[];
  v_existing public.registry_artists%rowtype;
  v_future_id uuid;
  v_collision jsonb;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
  v_idempotency_key text;
begin
  v_user_id:=platform_private.registry_discography_current_admin_v1();
  if not exists (
    select 1 from public.registry_artists artist
    where artist.id=p_current_artist_id and artist.status<>'archived'
  ) then
    raise exception using errcode='P0002', message='Current Discography Artist is missing.';
  end if;

  v_display_name:=btrim(regexp_replace(coalesce(p_artist_name,''),'[[:space:]]+',' ','g'));
  v_normalized_name:=platform_private.registry_identity_normalize_text_v1(v_display_name);
  v_slug:=platform_private.registry_artist_creation_slug_v1(v_display_name);

  if length(v_display_name)<2 or nullif(v_normalized_name,'') is null or nullif(v_slug,'') is null then
    raise exception using errcode='22023', message='Valid Artist name is required.';
  end if;

  select array_agg(distinct artist.id order by artist.id)
  into v_existing_ids
  from public.registry_artists artist
  where artist.status<>'archived'
    and (artist.normalized_name=v_normalized_name or artist.slug=v_slug);

  if coalesce(array_length(v_existing_ids,1),0)>1 then
    raise exception using errcode='40001', message='Artist shell identity is ambiguous in Registry state.';
  elsif coalesce(array_length(v_existing_ids,1),0)=1 then
    select artist.* into v_existing
    from public.registry_artists artist where artist.id=v_existing_ids[1];
    return jsonb_build_object(
      'created',false,
      'artist',jsonb_build_object(
        'artist_id',v_existing.id,
        'artist_slug',v_existing.slug,
        'artist_name',v_existing.display_name
      ),
      'operation_id',null,
      'verifier_status',null
    );
  end if;

  v_future_id:=platform_private.registry_discography_deterministic_uuid_v1(
    'artist.discography_shell',
    v_normalized_name
  );
  v_collision:=platform_private.registry_artist_creation_collision_state_v1(v_future_id,v_display_name);
  if v_collision<>'[]'::jsonb then
    raise exception using errcode='40001', message='Artist shell collision state is not empty.';
  end if;

  v_evidence_id:=platform_private.record_registry_discography_artist_shell_evidence_v1(
    p_current_artist_id,v_future_id,v_display_name,v_normalized_name,v_slug
  );
  select assertion.* into v_evidence
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
  v_idempotency_key:='discography:artist-shell:'||v_future_id::text;

  select execution_grant.id into v_grant_id
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_discography_admin'
    and execution_grant.operation_key='registry.artist.create'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if v_grant_id is null then
    v_grant_id:=platform_private.issue_registry_discography_user_execution_grant_v1(
      v_evidence.id,'registry.artist.create','artist',v_future_id,v_plan,null,1
    );
  end if;

  select * into v_execution
  from platform_private.execute_registry_materialization_v1('registry_discography_admin',v_grant_id);
  select * into v_verification
  from platform_private.verify_registry_materialization_v1(v_execution.operation_id);

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='40001', message='Artist shell independent verification failed.';
  end if;

  select artist.* into v_existing
  from public.registry_artists artist where artist.id=v_future_id;

  return jsonb_build_object(
    'created',true,
    'artist',jsonb_build_object(
      'artist_id',v_existing.id,
      'artist_slug',v_existing.slug,
      'artist_name',v_existing.display_name
    ),
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status
  );
end
$$;

create function public.admin_execute_registry_discography_evidence_v1(
  p_artist_id uuid,
  p_evidence_assertion_id uuid,
  p_reviewed_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_review_plan_id uuid;
  v_review platform_private.registry_discography_review_plans%rowtype;
  v_master platform_private.registry_evidence_assertions%rowtype;
  v_child jsonb;
  v_payload jsonb;
  v_operation_key text;
  v_subject_type text;
  v_subject_id uuid;
  v_child_ref text;
  v_idempotency_key text;
  v_grant_id uuid;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_grant_plan jsonb;
  v_expected_state text;
  v_max_rows integer;
  v_execution record;
  v_verification record;
  v_receipts jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_child_operation_ids jsonb := '[]'::jsonb;
  v_parent_plan jsonb;
  v_parent_idempotency text;
begin
  v_user_id:=platform_private.registry_discography_current_admin_v1();
  v_review_plan_id:=platform_private.freeze_registry_discography_review_plan_v1(
    p_artist_id,p_evidence_assertion_id,p_reviewed_selections
  );

  select review.* into v_review
  from platform_private.registry_discography_review_plans review
  where review.id=v_review_plan_id and review.reviewed_by_user_id=v_user_id;
  select assertion.* into v_master
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_review.evidence_assertion_id;

  for v_child in
    select value
    from jsonb_array_elements(v_review.frozen_plan->'operations')
    with ordinality as operation(value,ordinality)
    order by ordinality
  loop
    begin
      v_operation_key:=v_child->>'operation_key';
      v_subject_type:=v_child->>'subject_type';
      v_subject_id:=(v_child->>'subject_id')::uuid;
      v_child_ref:=v_child->>'ref';
      v_payload:=v_child->'payload';
      v_idempotency_key:=platform_private.registry_discography_idempotency_key_v1(v_review.id,v_child_ref);
      v_grant_id:=null;

      select execution_grant.id into v_grant_id
      from platform_private.registry_execution_grants execution_grant
      where execution_grant.actor_key='registry_discography_admin'
        and execution_grant.operation_key=v_operation_key
        and execution_grant.operation_version=1
        and execution_grant.idempotency_key=v_idempotency_key;

      if v_grant_id is null then
        if v_child->>'kind'='materialization' then
          v_evidence_id:=platform_private.record_registry_discography_derived_evidence_v1(
            v_review.id,
            v_subject_type,
            v_subject_id,
            case v_operation_key
              when 'registry.release.create' then 'registry.release.identity.create'
              when 'registry.track.create' then 'registry.track.identity.create'
              else 'registry.artist.identity.create'
            end,
            v_payload,
            'EXTERNAL_EVIDENCE'
          );
          select assertion.* into v_evidence
          from platform_private.registry_evidence_assertions assertion
          where assertion.id=v_evidence_id;

          if v_operation_key='registry.release.create' then
            v_grant_plan:=jsonb_build_object(
              'operation_key',v_operation_key,
              'operation_version',1,
              'release_id',v_subject_id,
              'title',v_payload->>'title',
              'normalized_title',v_payload->>'normalized_title',
              'slug',v_payload->>'slug',
              'upc',nullif(v_payload->>'upc',''),
              'identity_artist_id',(v_payload->>'identity_artist_id')::uuid,
              'collision_state_fingerprint',v_payload->>'collision_state_fingerprint',
              'evidence_assertion_id',v_evidence.id,
              'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
              'trust_class',v_evidence.trust_class,
              'policy_ruleset_version','registry-materialization-v1'
            );
          else
            v_grant_plan:=jsonb_build_object(
              'operation_key',v_operation_key,
              'operation_version',1,
              'track_id',v_subject_id,
              'title',v_payload->>'title',
              'normalized_title',v_payload->>'normalized_title',
              'slug',v_payload->>'slug',
              'isrc',nullif(v_payload->>'isrc',''),
              'identity_artist_id',(v_payload->>'identity_artist_id')::uuid,
              'collision_state_fingerprint',v_payload->>'collision_state_fingerprint',
              'evidence_assertion_id',v_evidence.id,
              'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
              'trust_class',v_evidence.trust_class,
              'policy_ruleset_version','registry-materialization-v1'
            );
          end if;

          v_grant_id:=platform_private.issue_registry_discography_user_execution_grant_v1(
            v_evidence.id,v_operation_key,v_subject_type,v_subject_id,v_grant_plan,null,1
          );
        else
          v_expected_state:=platform_private.registry_subject_state_fingerprint(v_subject_type,v_subject_id);
          if v_expected_state is null then
            raise exception using errcode='40001', message='Frozen Discography child target does not exist at execution time.';
          end if;
          v_max_rows:=case
            when v_operation_key in (
              'registry.release_artist_set.replace',
              'registry.release_track_set.replace',
              'registry.track_artist_credit_set.replace'
            ) then greatest((v_payload->>'total_rows')::integer,1)
            else 1
          end;

          v_grant_plan:=jsonb_build_object(
            'operation_key',v_operation_key,
            'operation_version',1,
            'review_plan_id',v_review.id,
            'child_ref',v_child_ref,
            'expected_state_fingerprint',v_expected_state,
            'evidence_assertion_id',v_master.id,
            'evidence_assertion_fingerprint',v_master.assertion_fingerprint,
            'trust_class',v_master.trust_class,
            'policy_ruleset_version','registry-discography-exact-set-v1',
            'child_payload_fingerprint',platform_private.registry_discography_observation_fingerprint_v1(v_payload),
            'current_set_fingerprint',v_payload->>'current_set_fingerprint',
            'final_set_fingerprint',v_payload->>'final_set_fingerprint',
            'removed_rows',case when v_payload->>'removed_rows' is null then null else (v_payload->>'removed_rows')::integer end,
            'inserted_rows',case when v_payload->>'inserted_rows' is null then null else (v_payload->>'inserted_rows')::integer end,
            'total_rows',case when v_payload->>'total_rows' is null then null else (v_payload->>'total_rows')::integer end
          );

          v_grant_id:=platform_private.issue_registry_discography_user_execution_grant_v1(
            v_master.id,v_operation_key,v_subject_type,v_subject_id,
            v_grant_plan,v_expected_state,v_max_rows
          );
        end if;
      end if;

      if v_child->>'kind'='materialization' then
        select * into v_execution
        from platform_private.execute_registry_materialization_v1('registry_discography_admin',v_grant_id);
        select * into v_verification
        from platform_private.verify_registry_materialization_v1(v_execution.operation_id);
      else
        select * into v_execution
        from platform_private.execute_registry_discography_operation_v1(v_grant_id);
        select * into v_verification
        from platform_private.verify_registry_discography_operation_v1(v_execution.operation_id);
      end if;

      if v_verification.verifier_status<>'passed' then
        raise exception using errcode='40001', message='Independent Discography child verification failed.';
      end if;

      v_receipts:=v_receipts || jsonb_build_array(jsonb_build_object(
        'ref',v_child_ref,
        'operation_key',v_operation_key,
        'operation_id',v_execution.operation_id,
        'verifier_status',v_verification.verifier_status,
        'idempotent_replay',v_execution.idempotent_replay
      ));
      v_child_operation_ids:=v_child_operation_ids || to_jsonb(v_execution.operation_id::text);
    exception when others then
      v_errors:=v_errors || to_jsonb(v_child_ref||': '||sqlerrm);
    end;
  end loop;

  if jsonb_array_length(v_errors)=0 then
    begin
      v_parent_idempotency:=platform_private.registry_discography_idempotency_key_v1(v_review.id,'parent.apply');
      v_grant_id:=null;
      select execution_grant.id into v_grant_id
      from platform_private.registry_execution_grants execution_grant
      where execution_grant.actor_key='registry_discography_admin'
        and execution_grant.operation_key='registry.discography.apply'
        and execution_grant.operation_version=1
        and execution_grant.idempotency_key=v_parent_idempotency;

      if v_grant_id is null then
        v_expected_state:=platform_private.registry_subject_state_fingerprint('artist',p_artist_id);
        v_parent_plan:=jsonb_build_object(
          'operation_key','registry.discography.apply',
          'operation_version',1,
          'artist_id',p_artist_id,
          'review_plan_id',v_review.id,
          'child_operation_ids',v_child_operation_ids,
          'expected_state_fingerprint',v_expected_state,
          'evidence_assertion_id',v_master.id,
          'evidence_assertion_fingerprint',v_master.assertion_fingerprint,
          'trust_class',v_master.trust_class,
          'policy_ruleset_version','registry-discography-exact-set-v1'
        );
        v_grant_id:=platform_private.issue_registry_discography_user_execution_grant_v1(
          v_master.id,'registry.discography.apply','artist',p_artist_id,
          v_parent_plan,v_expected_state,1
        );
      end if;

      select * into v_execution
      from platform_private.execute_registry_discography_operation_v1(v_grant_id);
      select * into v_verification
      from platform_private.verify_registry_discography_operation_v1(v_execution.operation_id);
      if v_verification.verifier_status<>'passed' then
        raise exception using errcode='40001', message='Discography parent receipt verification failed.';
      end if;
      v_receipts:=v_receipts || jsonb_build_array(jsonb_build_object(
        'ref','parent.apply',
        'operation_key','registry.discography.apply',
        'operation_id',v_execution.operation_id,
        'verifier_status',v_verification.verifier_status,
        'idempotent_replay',v_execution.idempotent_replay
      ));
    exception when others then
      v_errors:=v_errors || to_jsonb('parent.apply: '||sqlerrm);
    end;
  end if;

  return jsonb_build_object(
    'summary',
      (v_review.frozen_plan->'summary') ||
      jsonb_build_object('operations',v_receipts,'errors',v_errors)
  );
end
$$;

create function public.admin_verify_registry_discography_operation_v1(
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_result record;
begin
  v_user_id:=platform_private.registry_discography_current_admin_v1();
  select operation.* into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id and operation.actor_key='registry_discography_admin';
  if not found then
    raise exception using errcode='P0002', message='Discography operation not found.';
  end if;
  select execution_grant.* into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id
    and execution_grant.issued_by_user_id=v_user_id;
  if not found then
    raise exception using errcode='42501', message='Discography operation belongs to another principal.';
  end if;

  if v_operation.operation_key in ('registry.artist.create','registry.track.create','registry.release.create') then
    select * into v_result
    from platform_private.verify_registry_materialization_v1(p_operation_id);
  else
    select * into v_result
    from platform_private.verify_registry_discography_operation_v1(p_operation_id);
  end if;

  return jsonb_build_object(
    'operation_id',v_result.operation_id,
    'verifier_status',v_result.verifier_status
  );
end
$$;

revoke all on table
  platform_private.registry_discography_provider_snapshots,
  platform_private.registry_discography_review_plans
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.reject_registry_discography_immutable_mutation_v1(),
  platform_private.registry_discography_deterministic_uuid_v1(text,text),
  platform_private.registry_discography_current_admin_v1(),
  platform_private.registry_discography_observation_fingerprint_v1(jsonb),
  platform_private.registry_discography_validate_observation_v1(uuid,jsonb,text),
  platform_private.record_registry_discography_provider_evidence_v1(uuid,jsonb,text),
  platform_private.registry_discography_resolve_release_v1(uuid,jsonb),
  platform_private.registry_discography_resolve_track_v1(uuid,jsonb),
  platform_private.registry_discography_resolve_artist_name_v1(text),
  platform_private.registry_discography_credit_includes_artist_v1(text,text),
  platform_private.registry_discography_track_credit_names_v1(text,text,text),
  platform_private.registry_discography_normalize_reviewed_selections_v1(uuid,jsonb,jsonb),
  platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb),
  platform_private.registry_discography_track_artist_desired_v1(uuid,uuid,text,jsonb),
  platform_private.registry_discography_dedupe_track_credit_rows_v1(jsonb),
  platform_private.registry_discography_preserve_set_ids_v1(jsonb,jsonb,text),
  platform_private.registry_discography_set_delta_v1(jsonb,jsonb),
  platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb),
  platform_private.freeze_registry_discography_review_plan_v1(uuid,uuid,jsonb),
  platform_private.record_registry_discography_derived_evidence_v1(uuid,text,uuid,text,jsonb,text),
  platform_private.registry_discography_idempotency_key_v1(uuid,text),
  platform_private.registry_discography_validate_final_set_v1(text,uuid,jsonb),
  platform_private.execute_registry_discography_operation_v1(uuid),
  platform_private.verify_registry_discography_operation_v1(uuid),
  platform_private.record_registry_discography_artist_shell_evidence_v1(uuid,uuid,text,text,text)
from public, anon, authenticated, service_role;

revoke all on function
  public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text),
  public.admin_preview_registry_discography_evidence_v1(uuid),
  public.admin_create_registry_discography_artist_shell_v1(uuid,text),
  public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb),
  public.admin_verify_registry_discography_operation_v1(uuid)
from public, anon, service_role;

grant execute on function
  public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text),
  public.admin_preview_registry_discography_evidence_v1(uuid),
  public.admin_create_registry_discography_artist_shell_v1(uuid,text),
  public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb),
  public.admin_verify_registry_discography_operation_v1(uuid)
to authenticated;

commit;