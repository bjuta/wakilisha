-- MIZIZI Slice 2 / #939
-- Registry relation-admission primitive foundation.
--
-- Installs inert typed authority for Track↔Artist credits,
-- Release↔Track membership and Release↔Artist credits.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-relation-admission-primitive-foundation-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.registry_identity_normalize_text_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_plan_fingerprint(jsonb)'
     ) is null
  then
    raise exception
      'STOP: accepted Registry identity/governance foundation required by #939 is missing';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key in (
      'registry.track_artist_credit.admit',
      'registry.release_track.admit',
      'registry.release_artist_credit.admit'
    )
  ) then
    raise exception
      'STOP: Registry relation-admission operation authority already exists';
  end if;
end
$preflight$;

alter table platform_private.registry_operation_types
  drop constraint registry_operation_types_subjects_check;

alter table platform_private.registry_operation_types
  add constraint registry_operation_types_subjects_check
  check (
    cardinality(allowed_subject_types) >= 1
    and cardinality(allowed_subject_types) <= 8
    and array_position(allowed_subject_types, null::text) is null
    and allowed_subject_types <@ array[
      'artist',
      'track',
      'release',
      'registry_relationship',
      'track_artist_credit',
      'release_track_membership',
      'release_artist_credit'
    ]::text[]
  );

create or replace function
platform_private.registry_subject_exists(
  p_subject_type text,
  p_subject_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_subject_id is null then
    return false;
  end if;

  return case p_subject_type
    when 'artist' then
      exists (
        select 1
        from public.registry_artists artist
        where artist.id = p_subject_id
      )
    when 'track' then
      exists (
        select 1
        from public.registry_tracks track
        where track.id = p_subject_id
      )
    when 'release' then
      exists (
        select 1
        from public.registry_releases release
        where release.id = p_subject_id
      )
    when 'registry_relationship' then
      exists (
        select 1
        from public.registry_entity_relationships relationship
        where relationship.id = p_subject_id
      )
    when 'track_artist_credit' then
      exists (
        select 1
        from public.registry_track_artists credit
        where credit.id = p_subject_id
      )
    when 'release_track_membership' then
      exists (
        select 1
        from public.registry_release_tracks membership
        where membership.id = p_subject_id
      )
    when 'release_artist_credit' then
      exists (
        select 1
        from public.registry_release_artists credit
        where credit.id = p_subject_id
      )
    else false
  end;
end
$$;

create or replace function
platform_private.registry_subject_state_fingerprint(
  p_subject_type text,
  p_subject_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_state jsonb;
begin
  if p_subject_id is null then
    return null;
  end if;

  case p_subject_type
    when 'artist' then
      select to_jsonb(artist)
      into v_state
      from public.registry_artists artist
      where artist.id = p_subject_id;
    when 'track' then
      select to_jsonb(track)
      into v_state
      from public.registry_tracks track
      where track.id = p_subject_id;
    when 'release' then
      select to_jsonb(release)
      into v_state
      from public.registry_releases release
      where release.id = p_subject_id;
    when 'registry_relationship' then
      select to_jsonb(relationship)
      into v_state
      from public.registry_entity_relationships relationship
      where relationship.id = p_subject_id;
    when 'track_artist_credit' then
      select to_jsonb(credit)
      into v_state
      from public.registry_track_artists credit
      where credit.id = p_subject_id;
    when 'release_track_membership' then
      select to_jsonb(membership)
      into v_state
      from public.registry_release_tracks membership
      where membership.id = p_subject_id;
    when 'release_artist_credit' then
      select to_jsonb(credit)
      into v_state
      from public.registry_release_artists credit
      where credit.id = p_subject_id;
    else
      return null;
  end case;

  if v_state is null then
    return null;
  end if;

  return encode(
    extensions.digest(
      v_state::text,
      'sha256'
    ),
    'hex'
  );
end
$$;

revoke all on function
  platform_private.registry_subject_exists(text,uuid)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_subject_state_fingerprint(text,uuid)
from public, anon, authenticated, service_role;

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values
  (
    'admit_registry_track_artist_credit',
    'Admit Registry Track Artist Credit',
    'Admit one exact evidence-bound Track-to-Artist credit through a typed Registry operation.',
    'registry'
  ),
  (
    'admit_registry_release_track',
    'Admit Registry Release Track',
    'Admit one exact evidence-bound Release-to-Track membership through a typed Registry operation.',
    'registry'
  ),
  (
    'admit_registry_release_artist_credit',
    'Admit Registry Release Artist Credit',
    'Admit one exact evidence-bound Release-to-Artist credit through a typed Registry operation.',
    'registry'
  )
on conflict (capability_key) do nothing;

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
    'registry.track_artist_credit.admit',
    1,
    'admit_registry_track_artist_credit',
    'medium',
    array['track_artist_credit']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Admit exactly one canonical Track-to-Artist credit relation.'
  ),
  (
    'registry.release_track.admit',
    1,
    'admit_registry_release_track',
    'medium',
    array['release_track_membership']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Admit exactly one canonical Release-to-Track membership relation.'
  ),
  (
    'registry.release_artist_credit.admit',
    1,
    'admit_registry_release_artist_credit',
    'medium',
    array['release_artist_credit']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Admit exactly one canonical Release-to-Artist credit relation.'
  );

create or replace function
platform_private.registry_credit_role_v1(
  p_role text
)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_role text;
begin
  v_role := lower(btrim(coalesce(p_role, '')));

  if v_role not in ('primary_artist', 'featured_artist') then
    raise exception
      using errcode = '22023',
            message = 'Registry credit role V1 must be primary_artist or featured_artist.';
  end if;

  return v_role;
end
$$;

create or replace function
platform_private.registry_relation_confidence_v1(
  p_confidence integer
)
returns integer
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_confidence is null
     or p_confidence < 1
     or p_confidence > 100
  then
    raise exception
      using errcode = '22023',
            message = 'Registry relation confidence V1 must be between 1 and 100.';
  end if;

  return p_confidence;
end
$$;

create or replace function
platform_private.registry_credit_order_v1(
  p_credit_order integer
)
returns integer
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_credit_order is null
     or p_credit_order < 1
  then
    raise exception
      using errcode = '22023',
            message = 'Registry credit order V1 must be at least 1.';
  end if;

  return p_credit_order;
end
$$;

create or replace function
platform_private.registry_release_disc_number_v1(
  p_disc_number integer
)
returns integer
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_disc_number is null
     or p_disc_number < 1
  then
    raise exception
      using errcode = '22023',
            message = 'Registry release disc number V1 must be at least 1.';
  end if;

  return p_disc_number;
end
$$;

create or replace function
platform_private.registry_release_track_number_v1(
  p_track_number integer
)
returns integer
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_track_number is not null
     and p_track_number < 1
  then
    raise exception
      using errcode = '22023',
            message = 'Registry release track number V1 must be null or at least 1.';
  end if;

  return p_track_number;
end
$$;

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
      and credit.status <> 'archived'
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
      and membership.status <> 'archived'
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
      and credit.status <> 'archived'
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
platform_private.registry_relation_collision_fingerprint_v1(
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
  platform_private.registry_credit_role_v1(text)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_relation_confidence_v1(integer)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_credit_order_v1(integer)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_release_disc_number_v1(integer)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_release_track_number_v1(integer)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_track_artist_credit_collision_state_v1(uuid,uuid,uuid)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_release_track_collision_state_v1(uuid,uuid,uuid)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_release_artist_credit_collision_state_v1(uuid,uuid,uuid)
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.registry_relation_collision_fingerprint_v1(jsonb)
from public, anon, authenticated, service_role;

commit;
