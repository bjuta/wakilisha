-- MIZIZI Slice 2 Discography Reviewed Evidence Authority V1
--
-- Persists immutable provider observations outside the bounded generic
-- evidence assertion payload, freezes reviewed selections before mutation,
-- and installs the paired reviewed-evidence authority for Discography V1.

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
      and octet_length(frozen_plan::text) <= 2097152
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
    p_artist_id,
    p_observation,
    p_source_payload_fingerprint
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

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type <> 'artist'
     or v_evidence.claim_key <> 'registry.artist.discography.provider_snapshot'
     or v_evidence.trust_class <> 'EXTERNAL_EVIDENCE'
     or v_evidence.recorded_by_principal_key <> 'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Reviewed Discography evidence is missing or belongs to another principal.';
  end if;

  select snapshot.*
  into v_snapshot
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

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=v_snapshot.artist_id
    and artist.status <> 'archived';

  if not found then
    raise exception using errcode='P0002',
      message='Discography Artist no longer exists.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'apple_music_id',album->>'apple_music_id',
        'title',album->>'title',
        'slug',platform_private.registry_release_creation_slug_v1(
          album->>'title',
          v_artist.id
        ),
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
                else ((track->>'duration_ms')::integer / 60000)::text || ':' ||
                     lpad((((track->>'duration_ms')::integer / 1000) % 60)::text,2,'0')
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
        'existing_release',case
          when match.release_id is null then null
          else jsonb_build_object(
            'id',existing_release.id,
            'slug',existing_release.slug,
            'title',existing_release.title,
            'source',coalesce(existing_release.metadata->>'source','registry')
          )
        end,
        'album_artist_name',album->>'album_artist_name'
      )
      order by
        case when match.release_id is null then 1 else 0 end,
        nullif(album->>'release_date','') desc nulls last,
        album->>'apple_music_id'
    ),
    '[]'::jsonb
  )
  into v_albums
  from jsonb_array_elements(v_snapshot.observation->'albums') album
  cross join lateral (
    select platform_private.registry_discography_resolve_release_v1(
      v_artist.id,
      album
    ) as release_id
  ) match
  left join public.registry_releases existing_release
    on existing_release.id=match.release_id;

  return jsonb_build_object(
    'artist',jsonb_build_object(
      'id',v_artist.id,
      'slug',v_artist.slug,
      'name',v_artist.display_name
    ),
    'storefront',v_snapshot.storefront,
    'albums_searched',
      jsonb_array_length(v_snapshot.observation->'albums')+
      jsonb_array_length(v_snapshot.observation->'failed_album_ids'),
    'albums_fetched',jsonb_array_length(v_snapshot.observation->'albums'),
    'albums_failed',v_snapshot.observation->'failed_album_ids',
    'albums',v_albums
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
  platform_private.registry_discography_resolve_release_v1(uuid,jsonb)
from public, anon, authenticated, service_role;

revoke all on function
  public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text),
  public.admin_preview_registry_discography_evidence_v1(uuid)
from public, anon, service_role;

grant execute on function
  public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text),
  public.admin_preview_registry_discography_evidence_v1(uuid)
to authenticated;

commit;