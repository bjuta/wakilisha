-- MIZIZI Slice 2 / #939
-- Registry identity creation primitive foundation.
--
-- This migration establishes the shared normalization/collision authority and
-- installs inert typed Artist / Track / Release creation operation types.
-- It does not grant product roles, enable operations, or route chart runtime.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-identity-creation-primitive-foundation-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.begin_registry_mutation_operation(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_plan_fingerprint(jsonb)'
     ) is null
     or to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null
     or to_regprocedure(
       'public.wk_slugify_text(text)'
     ) is null
  then
    raise exception
      'STOP: accepted Registry governance authority required by #939 is missing';
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
    where actor_key = 'registry_chart_admission'
  ) then
    raise exception
      'STOP: registry_chart_admission actor already exists; audit before applying #939';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key in (
      'registry.artist.create',
      'registry.track.create',
      'registry.release.create'
    )
  ) then
    raise exception
      'STOP: Registry identity creation operation authority already exists';
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
    'create_registry_artist',
    'Create Registry Artist',
    'Create one evidence-bound canonical Artist identity through a typed Registry operation.',
    'registry'
  ),
  (
    'create_registry_track',
    'Create Registry Track',
    'Create one evidence-bound canonical Track identity through a typed Registry operation.',
    'registry'
  ),
  (
    'create_registry_release',
    'Create Registry Release',
    'Create one evidence-bound canonical Release identity through a typed Registry operation.',
    'registry'
  )
on conflict (capability_key) do nothing;

insert into platform_private.system_actors (
  actor_key,
  label,
  actor_kind,
  status,
  capability_profile
)
values (
  'registry_chart_admission',
  'Registry Chart Admission Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain', 'registry',
    'product_surface', 'charts',
    'authority_mode', 'human_exact_grant',
    'materialization_family', jsonb_build_array(
      'registry.artist.create/v1',
      'registry.track.create/v1',
      'registry.release.create/v1'
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
  'registry_chart_admission',
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
    'registry.artist.create',
    1,
    'create_registry_artist',
    'medium',
    array['artist']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Create exactly one draft Registry Artist identity from immutable evidence.'
  ),
  (
    'registry.track.create',
    1,
    'create_registry_track',
    'medium',
    array['track']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Create exactly one draft Registry Track identity from immutable evidence.'
  ),
  (
    'registry.release.create',
    1,
    'create_registry_release',
    'medium',
    array['release']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Create exactly one draft Registry Release identity from immutable evidence.'
  );

create or replace function
platform_private.registry_identity_normalize_text_v1(
  p_value text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select btrim(
    regexp_replace(
      lower(pg_catalog.normalize(btrim(coalesce(p_value, '')), 'NFKC')),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function
platform_private.registry_identity_comparison_key_v1(
  p_value text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select btrim(
    regexp_replace(
      lower(pg_catalog.normalize(btrim(coalesce(p_value, '')), 'NFKC')),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function
platform_private.registry_identity_canonical_isrc_v1(
  p_value text
)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_value text;
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then
    return null;
  end if;

  v_value := upper(
    regexp_replace(
      btrim(p_value),
      '[-[:space:]]+',
      '',
      'g'
    )
  );

  if v_value !~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$' then
    raise exception
      using errcode = '22023',
            message = 'ISRC is not canonical V1 shape.';
  end if;

  return v_value;
end
$$;

create or replace function
platform_private.registry_identity_canonical_upc_v1(
  p_value text
)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_value text;
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then
    return null;
  end if;

  v_value := regexp_replace(
    btrim(p_value),
    '[-[:space:]]+',
    '',
    'g'
  );

  if v_value !~ '^[0-9]{8,14}$' then
    raise exception
      using errcode = '22023',
            message = 'UPC is not canonical V1 shape.';
  end if;

  return v_value;
end
$$;

create or replace function
platform_private.registry_artist_creation_slug_v1(
  p_display_name text
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.wk_slugify_text(
    platform_private.registry_identity_normalize_text_v1(
      p_display_name
    )
  );
$$;

create or replace function
platform_private.registry_track_creation_slug_v1(
  p_title text,
  p_identity_artist_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_artist_slug text;
begin
  select artist.slug
  into v_artist_slug
  from public.registry_artists artist
  where artist.id = p_identity_artist_id;

  if not found then
    return null;
  end if;

  return public.wk_slugify_text(
    platform_private.registry_identity_normalize_text_v1(p_title)
    || '-'
    || v_artist_slug
  );
end
$$;

create or replace function
platform_private.registry_release_creation_slug_v1(
  p_title text,
  p_identity_artist_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_artist_slug text;
begin
  select artist.slug
  into v_artist_slug
  from public.registry_artists artist
  where artist.id = p_identity_artist_id;

  if not found then
    return null;
  end if;

  return public.wk_slugify_text(
    platform_private.registry_identity_normalize_text_v1(p_title)
    || '-'
    || v_artist_slug
  );
end
$$;

create or replace function
platform_private.registry_artist_creation_collision_state_v1(
  p_future_artist_id uuid,
  p_display_name text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
  with proposed as (
    select
      platform_private.registry_identity_normalize_text_v1(
        p_display_name
      ) as normalized_name,
      platform_private.registry_identity_comparison_key_v1(
        p_display_name
      ) as comparison_key,
      platform_private.registry_artist_creation_slug_v1(
        p_display_name
      ) as slug
  ),
  collisions as (
    select
      artist.id::text as registry_entity_id,
      'future_id'::text as reason
    from public.registry_artists artist
    where artist.id = p_future_artist_id

    union all

    select
      artist.id::text,
      'slug'
    from public.registry_artists artist
    cross join proposed
    where proposed.slug is not null
      and artist.slug = proposed.slug

    union all

    select
      artist.id::text,
      'normalized_name'
    from public.registry_artists artist
    cross join proposed
    where artist.normalized_name = proposed.normalized_name

    union all

    select
      artist.id::text,
      'comparison_key'
    from public.registry_artists artist
    cross join proposed
    where platform_private.registry_identity_comparison_key_v1(
            artist.display_name
          ) = proposed.comparison_key
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'registry_entity_id', collision.registry_entity_id,
        'reason', collision.reason
      )
      order by collision.registry_entity_id, collision.reason
    ),
    '[]'::jsonb
  )
  from collisions collision;
$$;

create or replace function
platform_private.registry_track_creation_collision_state_v1(
  p_future_track_id uuid,
  p_title text,
  p_identity_artist_id uuid,
  p_isrc text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
  with proposed as (
    select
      platform_private.registry_identity_normalize_text_v1(
        p_title
      ) as normalized_title,
      platform_private.registry_identity_comparison_key_v1(
        p_title
      ) as comparison_key,
      platform_private.registry_track_creation_slug_v1(
        p_title,
        p_identity_artist_id
      ) as slug,
      platform_private.registry_identity_canonical_isrc_v1(
        p_isrc
      ) as isrc
  ),
  collisions as (
    select
      track.id::text as registry_entity_id,
      'future_id'::text as reason
    from public.registry_tracks track
    where track.id = p_future_track_id

    union all

    select
      track.id::text,
      'slug'
    from public.registry_tracks track
    cross join proposed
    where proposed.slug is not null
      and track.slug = proposed.slug

    union all

    select
      track.id::text,
      'isrc'
    from public.registry_tracks track
    cross join proposed
    where proposed.isrc is not null
      and track.isrc = proposed.isrc

    union all

    select
      track.id::text,
      'title_artist'
    from public.registry_tracks track
    cross join proposed
    where platform_private.registry_identity_comparison_key_v1(
            track.title
          ) = proposed.comparison_key
      and exists (
        select 1
        from public.registry_track_artists credit
        where credit.track_id = track.id
          and credit.artist_id = p_identity_artist_id
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'registry_entity_id', collision.registry_entity_id,
        'reason', collision.reason
      )
      order by collision.registry_entity_id, collision.reason
    ),
    '[]'::jsonb
  )
  from collisions collision;
$$;

create or replace function
platform_private.registry_release_creation_collision_state_v1(
  p_future_release_id uuid,
  p_title text,
  p_identity_artist_id uuid,
  p_upc text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
  with proposed as (
    select
      platform_private.registry_identity_normalize_text_v1(
        p_title
      ) as normalized_title,
      platform_private.registry_identity_comparison_key_v1(
        p_title
      ) as comparison_key,
      platform_private.registry_release_creation_slug_v1(
        p_title,
        p_identity_artist_id
      ) as slug,
      platform_private.registry_identity_canonical_upc_v1(
        p_upc
      ) as upc
  ),
  collisions as (
    select
      release.id::text as registry_entity_id,
      'future_id'::text as reason
    from public.registry_releases release
    where release.id = p_future_release_id

    union all

    select
      release.id::text,
      'slug'
    from public.registry_releases release
    cross join proposed
    where proposed.slug is not null
      and release.slug = proposed.slug

    union all

    select
      release.id::text,
      'upc'
    from public.registry_releases release
    cross join proposed
    where proposed.upc is not null
      and release.upc = proposed.upc

    union all

    select
      release.id::text,
      'title_artist'
    from public.registry_releases release
    cross join proposed
    where platform_private.registry_identity_comparison_key_v1(
            release.title
          ) = proposed.comparison_key
      and exists (
        select 1
        from public.registry_release_artists credit
        where credit.release_id = release.id
          and credit.artist_id = p_identity_artist_id
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'registry_entity_id', collision.registry_entity_id,
        'reason', collision.reason
      )
      order by collision.registry_entity_id, collision.reason
    ),
    '[]'::jsonb
  )
  from collisions collision;
$$;

create or replace function
platform_private.registry_identity_creation_collision_fingerprint_v1(
  p_collision_state jsonb
)
returns text
language sql
immutable
set search_path = pg_catalog, extensions
as $$
  select encode(
    extensions.digest(
      coalesce(p_collision_state, '[]'::jsonb)::text,
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function
  platform_private.registry_identity_normalize_text_v1(text)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_identity_comparison_key_v1(text)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_identity_canonical_isrc_v1(text)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_identity_canonical_upc_v1(text)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_artist_creation_slug_v1(text)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_track_creation_slug_v1(text,uuid)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_release_creation_slug_v1(text,uuid)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_artist_creation_collision_state_v1(uuid,text)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_track_creation_collision_state_v1(uuid,text,uuid,text)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_release_creation_collision_state_v1(uuid,text,uuid,text)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_identity_creation_collision_fingerprint_v1(jsonb)
from public, anon, authenticated, service_role;

commit;
