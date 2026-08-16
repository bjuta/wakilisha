begin;

-- WAKILISHA M8C-M1: Personal Playlist authority inside the canonical Playlist domain.
-- Personal Playlists remain canonical wk_playlists rows and do not use editorial review.
-- This migration does not broaden generic editorial Playlist capabilities.

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $preflight$
begin
  if to_regclass('public.wk_playlists') is null
     or to_regclass('public.wk_playlist_items') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('editorial.playlist_item_resources') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('private.phase_0a_rpc_classification') is null then
    raise exception
      'M8C-M1 requires canonical Playlist, Resource, Registry, profile, command receipt, and RPC classification authority';
  end if;

  if to_regprocedure('public.create_playlist(text,text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('public.update_playlist_metadata(uuid,bigint,jsonb,text,uuid)') is null
     or to_regprocedure('public.current_user_is_administrator()') is null
     or to_regprocedure('platform_private.command_actor_context()') is null
     or to_regprocedure('platform_private.command_request_fingerprint(text,uuid,jsonb)') is null
     or to_regprocedure('platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)') is null
     or to_regprocedure('platform_private.read_authenticated_resource_command_result(uuid,boolean)') is null
     or to_regprocedure('platform_private.complete_resource_command(uuid,jsonb)') is null
     or to_regprocedure('platform_private.reject_resource_command(uuid,text,text,jsonb)') is null
     or to_regprocedure('public.community_normalize_username(text)') is null then
    raise exception
      'M8C-M1 requires the live canonical Playlist command receipt API and username normalization';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wk_playlists'
      and column_name = 'authority_revision'
  )
  or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wk_playlist_items'
      and column_name = 'lifecycle_state'
  ) then
    raise exception
      'M8C-M1 requires current Playlist authority_revision and Playlist item lifecycle columns';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wk_playlists'
      and column_name = 'playlist_kind'
  ) then
    raise exception
      'M8C-M1 playlist_kind already exists; do not re-run this migration';
  end if;

  if to_regprocedure('public.create_personal_playlist(text,text,text,text,text,uuid)') is not null
     or to_regprocedure('public.update_personal_playlist(uuid,bigint,jsonb,text,uuid)') is not null
     or to_regprocedure('public.add_personal_playlist_track(uuid,bigint,uuid,text,uuid)') is not null
     or to_regprocedure('public.remove_personal_playlist_item(uuid,uuid,bigint,text,uuid)') is not null
     or to_regprocedure('public.reorder_personal_playlist_items(uuid,bigint,uuid[],text,uuid)') is not null
     or to_regprocedure('public.archive_personal_playlist(uuid,bigint,text,text,uuid)') is not null
     or to_regprocedure('public.list_my_personal_playlists(boolean,integer)') is not null
     or to_regprocedure('public.get_my_personal_playlist(uuid)') is not null
     or to_regprocedure('public.get_my_personal_playlist_by_route(text,text)') is not null
     or to_regprocedure('public.get_public_personal_playlist(text,text)') is not null
     or to_regprocedure('public.list_public_personal_playlists_for_username(text,integer)') is not null then
    raise exception
      'M8C-M1 Personal Playlist RPC authority already exists; do not re-run this migration';
  end if;
end;
$preflight$;

alter table public.wk_playlists
  add column playlist_kind text not null default 'editorial';

alter table public.wk_playlists
  add constraint wk_playlists_playlist_kind_check
  check (playlist_kind in ('editorial', 'personal'));

comment on column public.wk_playlists.playlist_kind is
  'Canonical Playlist kind. Editorial rows use editorial review/publication. Personal rows use owner self-service authority.';

create index wk_playlists_personal_created_by_idx
  on public.wk_playlists (created_by, updated_at desc)
  where playlist_kind = 'personal';

create or replace function editorial.current_user_owns_personal_playlist(
  p_playlist_id uuid,
  p_include_archived boolean default false
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial'
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.wk_playlists playlist
      join editorial.playlist_resources binding
        on binding.playlist_id = playlist.id
       and binding.resource_kind = 'playlist'
      join editorial.resources resource
        on resource.id = binding.resource_id
       and resource.resource_kind = 'playlist'
      where playlist.id = p_playlist_id
        and playlist.playlist_kind = 'personal'
        and resource.owner_id = auth.uid()
        and (
          p_include_archived
          or (
            playlist.status <> 'archived'
            and resource.lifecycle_state = 'active'
          )
        )
    );
$function$;

revoke all
on function editorial.current_user_owns_personal_playlist(uuid,boolean)
from public, anon;

grant execute
on function editorial.current_user_owns_personal_playlist(uuid,boolean)
to authenticated, service_role;

create or replace function editorial.current_user_can_manage_personal_playlist(
  p_playlist_id uuid,
  p_include_archived boolean default false
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial'
as $function$
  select
    auth.uid() is not null
    and (
      coalesce(public.current_user_is_administrator(), false)
      or editorial.current_user_owns_personal_playlist(
        p_playlist_id,
        p_include_archived
      )
    );
$function$;

revoke all
on function editorial.current_user_can_manage_personal_playlist(uuid,boolean)
from public, anon, authenticated;

grant execute
on function editorial.current_user_can_manage_personal_playlist(uuid,boolean)
to service_role;

create or replace function editorial.personal_playlist_is_public(
  p_playlist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select exists (
    select 1
    from public.wk_playlists playlist
    join editorial.playlist_resources binding
      on binding.playlist_id = playlist.id
     and binding.resource_kind = 'playlist'
    join editorial.resources resource
      on resource.id = binding.resource_id
     and resource.resource_kind = 'playlist'
    where playlist.id = p_playlist_id
      and playlist.playlist_kind = 'personal'
      and playlist.status = 'draft'
      and resource.visibility = 'public'
      and resource.lifecycle_state = 'active'
  );
$function$;

revoke all
on function editorial.personal_playlist_is_public(uuid)
from public, anon, authenticated;

grant execute
on function editorial.personal_playlist_is_public(uuid)
to service_role;

create policy wk_playlists_personal_owner_read
on public.wk_playlists
for select
to authenticated
using (
  playlist_kind = 'personal'
  and editorial.current_user_owns_personal_playlist(id, true)
);

create policy wk_playlist_items_personal_owner_read
on public.wk_playlist_items
for select
to authenticated
using (
  editorial.current_user_owns_personal_playlist(playlist_id, true)
);

create or replace function editorial.personal_playlist_command_context(
  p_playlist_id uuid,
  p_include_archived boolean default false
)
returns table (
  actor_id uuid,
  owner_id uuid,
  resource_id uuid,
  authority_revision bigint,
  playlist_status text,
  visibility text,
  lifecycle_state text
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_context record;
begin
  select *
  into v_context
  from platform_private.command_actor_context();

  if not editorial.current_user_can_manage_personal_playlist(
    p_playlist_id,
    p_include_archived
  ) then
    raise exception using
      errcode = '42501',
      message = 'You cannot manage this Playlist.';
  end if;

  return query
  select
    v_context.actor_user_id,
    resource.owner_id,
    resource.id,
    playlist.authority_revision,
    playlist.status,
    resource.visibility,
    resource.lifecycle_state
  from public.wk_playlists playlist
  join editorial.playlist_resources binding
    on binding.playlist_id = playlist.id
   and binding.resource_kind = 'playlist'
  join editorial.resources resource
    on resource.id = binding.resource_id
   and resource.resource_kind = 'playlist'
  where playlist.id = p_playlist_id
    and playlist.playlist_kind = 'personal'
    and (
      p_include_archived
      or (
        playlist.status <> 'archived'
        and resource.lifecycle_state = 'active'
      )
    )
  for update of playlist;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Personal Playlist does not exist.';
  end if;
end;
$function$;

revoke all
on function editorial.personal_playlist_command_context(uuid,boolean)
from public, anon, authenticated;

grant execute
on function editorial.personal_playlist_command_context(uuid,boolean)
to service_role;

create or replace function editorial.personal_playlist_payload(
  p_playlist_id uuid,
  p_public_view boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  with base as (
    select
      playlist.id as playlist_id,
      binding.resource_id,
      playlist.title,
      playlist.slug,
      playlist.description,
      playlist.playlist_kind,
      playlist.status,
      playlist.authority_revision,
      playlist.created_at,
      playlist.updated_at,
      resource.owner_id,
      resource.visibility,
      resource.lifecycle_state
    from public.wk_playlists playlist
    join editorial.playlist_resources binding
      on binding.playlist_id = playlist.id
     and binding.resource_kind = 'playlist'
    join editorial.resources resource
      on resource.id = binding.resource_id
     and resource.resource_kind = 'playlist'
    where playlist.id = p_playlist_id
      and playlist.playlist_kind = 'personal'
      and (
        not p_public_view
        or (
          playlist.status = 'draft'
          and resource.visibility = 'public'
          and resource.lifecycle_state = 'active'
        )
      )
  ),
  owner_profile as (
    select
      base.playlist_id,
      profile.username,
      profile.display_name,
      profile.avatar_url
    from base
    left join public.user_profiles profile
      on profile.user_id = base.owner_id
     and (
       not p_public_view
       or profile.is_public
     )
  ),
  item_rows as (
    select
      item.id as playlist_item_id,
      item.position,
      item.registry_track_id,
      coalesce(track.title, item.title, 'Untitled Track') as title,
      coalesce(
        artists.artist_names,
        to_jsonb(item.artist_names),
        '[]'::jsonb
      ) as artist_names,
      coalesce(release.title, item.release_title) as release_title,
      coalesce(track.artwork_url, item.artwork_url) as artwork_url,
      coalesce(track.preview_url, item.preview_url) as preview_url,
      coalesce(track.duration_ms, item.duration_ms) as duration_ms,
      track.slug as track_slug,
      release.slug as release_slug
    from base
    join public.wk_playlist_items item
      on item.playlist_id = base.playlist_id
     and item.lifecycle_state = 'active'
    left join public.registry_tracks track
      on track.id = item.registry_track_id
     and track.status = 'active'
    left join public.registry_releases release
      on release.id = track.release_id
     and release.status = 'active'
    left join lateral (
      select coalesce(
        jsonb_agg(
          coalesce(
            registry_artist.display_name,
            track_artist.artist_name_text
          )
          order by
            track_artist.is_primary desc,
            track_artist.credit_order,
            track_artist.id
        ) filter (
          where coalesce(
            registry_artist.display_name,
            track_artist.artist_name_text
          ) is not null
        ),
        '[]'::jsonb
      ) as artist_names
      from public.registry_track_artists track_artist
      left join public.registry_artists registry_artist
        on registry_artist.id = track_artist.artist_id
       and registry_artist.status = 'active'
      where track_artist.track_id = track.id
        and track_artist.status = 'active'
    ) artists on true
  )
  select jsonb_build_object(
    'playlist_id', base.playlist_id,
    'resource_id', base.resource_id,
    'playlist_kind', base.playlist_kind,
    'title', base.title,
    'slug', base.slug,
    'description', base.description,
    'visibility', base.visibility,
    'lifecycle_status', base.lifecycle_state,
    'authority_revision', base.authority_revision,
    'item_count', (
      select count(*)
      from item_rows
    ),
    'created_at', base.created_at,
    'updated_at', base.updated_at,
    'owner', case
      when owner_profile.username is null
       and owner_profile.display_name is null
       and owner_profile.avatar_url is null
      then null
      else jsonb_build_object(
        'username', owner_profile.username,
        'display_name', owner_profile.display_name,
        'avatar_url', owner_profile.avatar_url
      )
    end,
    'tracks', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'playlist_item_id', item_rows.playlist_item_id,
            'position', item_rows.position,
            'registry_track_id', item_rows.registry_track_id,
            'title', item_rows.title,
            'artist_names', item_rows.artist_names,
            'release_title', item_rows.release_title,
            'artwork_url', item_rows.artwork_url,
            'preview_url', item_rows.preview_url,
            'duration_ms', item_rows.duration_ms,
            'track_path', case
              when item_rows.track_slug is null then null
              else '/tracks/' || item_rows.track_slug
            end,
            'release_path', case
              when item_rows.release_slug is null then null
              else '/releases/' || item_rows.release_slug
            end
          )
          order by item_rows.position, item_rows.playlist_item_id
        )
        from item_rows
      ),
      '[]'::jsonb
    )
  )
  from base
  left join owner_profile
    on owner_profile.playlist_id = base.playlist_id;
$function$;

revoke all
on function editorial.personal_playlist_payload(uuid,boolean)
from public, anon, authenticated;

grant execute
on function editorial.personal_playlist_payload(uuid,boolean)
to service_role;

create or replace function public.create_personal_playlist(
  p_title text,
  p_slug text,
  p_description text default null,
  p_visibility text default 'private',
  p_idempotency_key text default null,
  p_correlation_id uuid default null
)
returns table (
  receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  result_payload jsonb
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_actor uuid;
  v_principal_key text;
  v_title text;
  v_slug text;
  v_description text;
  v_visibility text;
  v_correlation_id uuid;
  v_request jsonb;
  v_existing platform_private.command_receipts%rowtype;
  v_expected_fingerprint text;
  v_resource_id uuid;
  v_begin record;
  v_read record;
  v_result jsonb;
begin
  select
    context.actor_user_id,
    context.principal_key
  into
    v_actor,
    v_principal_key
  from platform_private.command_actor_context() context;

  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception using
      errcode = '22023',
      message = 'idempotency_key is invalid.';
  end if;

  v_title := nullif(btrim(p_title), '');
  v_slug := nullif(btrim(lower(p_slug)), '');
  v_description := nullif(btrim(p_description), '');
  v_visibility := lower(btrim(coalesce(p_visibility, 'private')));
  v_correlation_id := coalesce(p_correlation_id, gen_random_uuid());

  if v_title is null or length(v_title) > 300 then
    raise exception using
      errcode = '22023',
      message = 'Playlist title is required and must not exceed 300 characters.';
  end if;

  if v_slug is null
     or length(v_slug) > 200
     or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using
      errcode = '22023',
      message = 'Playlist slug is invalid.';
  end if;

  if length(coalesce(v_description, '')) > 10000 then
    raise exception using
      errcode = '22023',
      message = 'Playlist description is too long.';
  end if;

  if v_visibility not in ('private', 'public') then
    raise exception using
      errcode = '22023',
      message = 'Playlist visibility must be Private or Public.';
  end if;

  v_request := jsonb_build_object(
    'title', v_title,
    'slug', v_slug,
    'description', v_description,
    'visibility', v_visibility,
    'playlist_kind', 'personal',
    'correlation_id', v_correlation_id
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_principal_key || ':playlist.create:' || p_idempotency_key,
      0
    )
  );

  select receipt.*
  into v_existing
  from platform_private.command_receipts receipt
  where receipt.principal_key = v_principal_key
    and receipt.command_type = 'playlist.create'
    and receipt.idempotency_key = p_idempotency_key
  for update;

  if found then
    v_expected_fingerprint :=
      platform_private.command_request_fingerprint(
        'playlist.create',
        v_existing.resource_id,
        v_request
      );

    if v_existing.request_fingerprint <> v_expected_fingerprint then
      raise exception using
        errcode = '23505',
        message = 'The idempotency key was already used for a different Playlist create request.';
    end if;

    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_existing.id,
      true
    );

    receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := nullif(v_read.result_payload ->> 'playlist_id', '')::uuid;
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    result_payload := v_read.result_payload;
    return next;
    return;
  end if;

  if exists (
    select 1
    from public.wk_playlists playlist
    where playlist.slug = v_slug
  ) then
    raise exception using
      errcode = '23505',
      message = 'Playlist slug already exists.';
  end if;

  v_resource_id := gen_random_uuid();

  insert into editorial.resources (
    id,
    resource_kind,
    owner_id,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_resource_id,
    'playlist',
    v_actor,
    v_visibility,
    'active',
    v_actor
  );

  insert into public.wk_playlists (
    id,
    title,
    slug,
    description,
    status,
    metadata,
    created_by,
    authority_revision,
    playlist_kind
  )
  values (
    v_resource_id,
    v_title,
    v_slug,
    v_description,
    'draft',
    jsonb_build_object('playlist_kind', 'personal'),
    v_actor,
    1,
    'personal'
  );

  insert into editorial.playlist_resources (
    resource_id,
    resource_kind,
    playlist_id
  )
  values (
    v_resource_id,
    'playlist',
    v_resource_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.create',
    v_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    raise exception
      'Unexpected Personal Playlist create replay after serialized preflight.';
  end if;

  v_result := jsonb_build_object(
    'playlist_id', v_resource_id,
    'resource_id', v_resource_id,
    'slug', v_slug,
    'playlist_kind', 'personal',
    'visibility', v_visibility,
    'lifecycle_status', 'active',
    'authority_revision', 1,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  receipt_id := v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  playlist_id := v_resource_id;
  resource_id := v_resource_id;
  authority_revision := 1;
  result_payload := v_result;
  return next;
end;
$function$;

revoke all
on function public.create_personal_playlist(text,text,text,text,text,uuid)
from public, anon;

grant execute
on function public.create_personal_playlist(text,text,text,text,text,uuid)
to authenticated, service_role;

create or replace function public.update_personal_playlist(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_payload jsonb,
  p_idempotency_key text default null,
  p_correlation_id uuid default null
)
returns table (
  receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  result_payload jsonb
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_context record;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_title text;
  v_description text;
  v_visibility text;
  v_revision bigint;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or p_payload = '{}'::jsonb
     or p_payload - array[
       'title',
       'description',
       'visibility'
     ] <> '{}'::jsonb then
    raise exception using
      errcode = '22023',
      message = 'Playlist changes may include only title, description, and visibility.';
  end if;

  select *
  into v_context
  from editorial.personal_playlist_command_context(
    p_playlist_id,
    false
  );

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'expected_authority_revision', p_expected_authority_revision,
    'changes', p_payload,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.metadata.update',
    v_context.resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    result_payload := v_read.result_payload;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision <> v_context.authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before these changes could be saved.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_context.authority_revision,
        'error_message', 'The Playlist changed before these changes could be saved.'
      )
    );
  else
    select
      case
        when p_payload ? 'title'
        then nullif(btrim(p_payload ->> 'title'), '')
        else playlist.title
      end,
      case
        when p_payload ? 'description'
        then nullif(btrim(p_payload ->> 'description'), '')
        else playlist.description
      end,
      case
        when p_payload ? 'visibility'
        then lower(btrim(p_payload ->> 'visibility'))
        else v_context.visibility
      end
    into
      v_title,
      v_description,
      v_visibility
    from public.wk_playlists playlist
    where playlist.id = p_playlist_id;

    if v_title is null or length(v_title) > 300 then
      raise exception using
        errcode = '22023',
        message = 'Playlist title is invalid.';
    end if;

    if length(coalesce(v_description, '')) > 10000 then
      raise exception using
        errcode = '22023',
        message = 'Playlist description is too long.';
    end if;

    if v_visibility not in ('private', 'public') then
      raise exception using
        errcode = '22023',
        message = 'Playlist visibility must be Private or Public.';
    end if;

    update public.wk_playlists playlist
    set
      title = v_title,
      description = v_description,
      authority_revision = playlist.authority_revision + 1,
      updated_at = now()
    where playlist.id = p_playlist_id
      and playlist.playlist_kind = 'personal'
      and playlist.authority_revision = p_expected_authority_revision
    returning playlist.authority_revision
    into v_revision;

    if v_revision is null then
      raise exception
        'Personal Playlist revision update did not converge.';
    end if;

    update editorial.resources resource
    set
      visibility = v_visibility,
      updated_at = now()
    where resource.id = v_context.resource_id
      and resource.resource_kind = 'playlist';

    v_result := jsonb_build_object(
      'playlist_id', p_playlist_id,
      'resource_id', v_context.resource_id,
      'slug', (
        select playlist.slug
        from public.wk_playlists playlist
        where playlist.id = p_playlist_id
      ),
      'visibility', v_visibility,
      'authority_revision', v_revision,
      'correlation_id', v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  result_payload := v_read.result_payload;
  return next;
end;
$function$;

revoke all
on function public.update_personal_playlist(uuid,bigint,jsonb,text,uuid)
from public, anon;

grant execute
on function public.update_personal_playlist(uuid,bigint,jsonb,text,uuid)
to authenticated, service_role;

create or replace function public.add_personal_playlist_track(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_registry_track_id uuid,
  p_idempotency_key text default null,
  p_correlation_id uuid default null
)
returns table (
  receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  playlist_item_id uuid,
  authority_revision bigint,
  result_payload jsonb
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_context record;
  v_track public.registry_tracks%rowtype;
  v_release public.registry_releases%rowtype;
  v_artist_names text[];
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_item_id uuid;
  v_position integer;
  v_revision bigint;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_registry_track_id is null then
    raise exception using
      errcode = '22023',
      message = 'A Registry Track is required.';
  end if;

  select *
  into v_context
  from editorial.personal_playlist_command_context(
    p_playlist_id,
    false
  );

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id = p_registry_track_id
    and track.status = 'active';

  if not found then
    raise exception using
      errcode = '22023',
      message = 'Track is not available in the Registry.';
  end if;

  select release.*
  into v_release
  from public.registry_releases release
  where release.id = v_track.release_id
    and release.status = 'active';

  select coalesce(
    array_agg(
      coalesce(
        artist.display_name,
        link.artist_name_text
      )
      order by
        link.is_primary desc,
        link.credit_order,
        link.id
    ) filter (
      where coalesce(
        artist.display_name,
        link.artist_name_text
      ) is not null
    ),
    '{}'::text[]
  )
  into v_artist_names
  from public.registry_track_artists link
  left join public.registry_artists artist
    on artist.id = link.artist_id
   and artist.status = 'active'
  where link.track_id = p_registry_track_id
    and link.status = 'active';

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'expected_authority_revision', p_expected_authority_revision,
    'registry_track_id', p_registry_track_id,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.item.add',
    v_context.resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    playlist_item_id := nullif(
      v_read.result_payload ->> 'playlist_item_id',
      ''
    )::uuid;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    result_payload := v_read.result_payload;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision <> v_context.authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before this Track could be added.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_context.authority_revision,
        'error_message', 'The Playlist changed before this Track could be added.'
      )
    );
  elsif exists (
    select 1
    from public.wk_playlist_items item
    where item.playlist_id = p_playlist_id
      and item.lifecycle_state = 'active'
      and item.registry_track_id = p_registry_track_id
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_track_duplicate',
      'This Track is already in the Playlist.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'registry_track_id', p_registry_track_id,
        'authority_revision', v_context.authority_revision,
        'error_message', 'This Track is already in the Playlist.'
      )
    );
  else
    select coalesce(max(item.position), 0) + 1
    into v_position
    from public.wk_playlist_items item
    where item.playlist_id = p_playlist_id
      and item.lifecycle_state = 'active';

    v_item_id := gen_random_uuid();

    insert into editorial.resources (
      id,
      resource_kind,
      owner_id,
      visibility,
      lifecycle_state,
      created_by
    )
    values (
      v_item_id,
      'playlist_item',
      v_context.owner_id,
      'internal',
      'active',
      v_context.actor_id
    );

    insert into public.wk_playlist_items (
      id,
      playlist_id,
      position,
      registry_track_id,
      registry_release_id,
      title,
      artist_names,
      release_title,
      artwork_url,
      preview_url,
      duration_ms,
      isrc,
      match_status,
      match_confidence,
      normalization_payload,
      created_by,
      lifecycle_state
    )
    values (
      v_item_id,
      p_playlist_id,
      v_position,
      p_registry_track_id,
      v_track.release_id,
      v_track.title,
      v_artist_names,
      v_release.title,
      coalesce(v_track.artwork_url, v_release.artwork_url),
      v_track.preview_url,
      v_track.duration_ms,
      v_track.isrc,
      'matched',
      1.0000,
      jsonb_strip_nulls(
        jsonb_build_object(
          'registry_track_id', p_registry_track_id,
          'track_slug', v_track.slug,
          'release_id', v_track.release_id,
          'release_slug', v_release.slug,
          'release_title', v_release.title,
          'artist_names', to_jsonb(v_artist_names)
        )
      ),
      v_context.actor_id,
      'active'
    );

    insert into editorial.playlist_item_resources (
      resource_id,
      resource_kind,
      playlist_item_id
    )
    values (
      v_item_id,
      'playlist_item',
      v_item_id
    );

    update public.wk_playlists playlist
    set
      authority_revision = playlist.authority_revision + 1,
      updated_at = now()
    where playlist.id = p_playlist_id
      and playlist.playlist_kind = 'personal'
      and playlist.authority_revision = p_expected_authority_revision
    returning playlist.authority_revision
    into v_revision;

    if v_revision is null then
      raise exception
        'Personal Playlist revision update did not converge.';
    end if;

    v_result := jsonb_build_object(
      'playlist_id', p_playlist_id,
      'playlist_item_id', v_item_id,
      'playlist_item_resource_id', v_item_id,
      'registry_track_id', p_registry_track_id,
      'position', v_position,
      'authority_revision', v_revision,
      'correlation_id', v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  playlist_item_id := nullif(
    v_read.result_payload ->> 'playlist_item_id',
    ''
  )::uuid;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  result_payload := v_read.result_payload;
  return next;
end;
$function$;

revoke all
on function public.add_personal_playlist_track(uuid,bigint,uuid,text,uuid)
from public, anon;

grant execute
on function public.add_personal_playlist_track(uuid,bigint,uuid,text,uuid)
to authenticated, service_role;

create or replace function public.remove_personal_playlist_item(
  p_playlist_id uuid,
  p_playlist_item_id uuid,
  p_expected_authority_revision bigint,
  p_idempotency_key text default null,
  p_correlation_id uuid default null
)
returns table (
  receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  playlist_item_id uuid,
  authority_revision bigint,
  result_payload jsonb
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_context record;
  v_item public.wk_playlist_items%rowtype;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_count integer;
  v_offset integer;
  v_revision bigint;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  select *
  into v_context
  from editorial.personal_playlist_command_context(
    p_playlist_id,
    false
  );

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'playlist_item_id', p_playlist_item_id,
    'expected_authority_revision', p_expected_authority_revision,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.item.remove',
    v_context.resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    playlist_item_id := p_playlist_item_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    result_payload := v_read.result_payload;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision <> v_context.authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before this Track could be removed.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_context.authority_revision,
        'error_message', 'The Playlist changed before this Track could be removed.'
      )
    );
  else
    select item.*
    into v_item
    from public.wk_playlist_items item
    where item.id = p_playlist_item_id
      and item.playlist_id = p_playlist_id
      and item.lifecycle_state = 'active'
    for update;

    if not found then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'playlist_item_not_active',
        'The Playlist Track is missing or no longer active.',
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_context.authority_revision,
          'error_message', 'The Playlist Track is missing or no longer active.'
        )
      );
    else
      update public.wk_playlist_items item
      set
        lifecycle_state = 'removed',
        position = null,
        removed_at = now(),
        removed_by = v_context.actor_id,
        updated_at = now()
      where item.id = p_playlist_item_id;

      select
        count(*)::integer,
        coalesce(max(item.position), 0)
      into
        v_count,
        v_offset
      from public.wk_playlist_items item
      where item.playlist_id = p_playlist_id
        and item.lifecycle_state = 'active';

      v_offset := v_offset + v_count + 1;

      if v_count > 0 then
        update public.wk_playlist_items item
        set
          position = item.position + v_offset,
          updated_at = now()
        where item.playlist_id = p_playlist_id
          and item.lifecycle_state = 'active';

        with ordered as (
          select
            item.id,
            row_number() over (
              order by item.position, item.id
            )::integer as new_position
          from public.wk_playlist_items item
          where item.playlist_id = p_playlist_id
            and item.lifecycle_state = 'active'
        )
        update public.wk_playlist_items item
        set
          position = ordered.new_position,
          updated_at = now()
        from ordered
        where item.id = ordered.id;
      end if;

      update public.wk_playlists playlist
      set
        authority_revision = playlist.authority_revision + 1,
        updated_at = now()
      where playlist.id = p_playlist_id
        and playlist.playlist_kind = 'personal'
        and playlist.authority_revision = p_expected_authority_revision
      returning playlist.authority_revision
      into v_revision;

      if v_revision is null then
        raise exception
          'Personal Playlist revision update did not converge.';
      end if;

      v_result := jsonb_build_object(
        'playlist_id', p_playlist_id,
        'playlist_item_id', p_playlist_item_id,
        'active_item_count', v_count,
        'authority_revision', v_revision,
        'changed', true,
        'correlation_id', v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  playlist_item_id := p_playlist_item_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  result_payload := v_read.result_payload;
  return next;
end;
$function$;

revoke all
on function public.remove_personal_playlist_item(uuid,uuid,bigint,text,uuid)
from public, anon;

grant execute
on function public.remove_personal_playlist_item(uuid,uuid,bigint,text,uuid)
to authenticated, service_role;

create or replace function public.reorder_personal_playlist_items(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_ordered_item_ids uuid[],
  p_idempotency_key text default null,
  p_correlation_id uuid default null
)
returns table (
  receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  authority_revision bigint,
  result_payload jsonb
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_context record;
  v_active_count integer;
  v_distinct_count integer;
  v_offset integer;
  v_current_order uuid[];
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_revision bigint;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_ordered_item_ids is null then
    raise exception using
      errcode = '22023',
      message = 'Complete ordered Playlist Track identity is required.';
  end if;

  select *
  into v_context
  from editorial.personal_playlist_command_context(
    p_playlist_id,
    false
  );

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'expected_authority_revision', p_expected_authority_revision,
    'ordered_item_ids', to_jsonb(p_ordered_item_ids),
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.items.reorder',
    v_context.resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    result_payload := v_read.result_payload;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision <> v_context.authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before this order could be applied.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_context.authority_revision,
        'error_message', 'The Playlist changed before this order could be applied.'
      )
    );
  else
    select
      count(*)::integer,
      coalesce(max(item.position), 0),
      coalesce(
        array_agg(item.id order by item.position),
        '{}'::uuid[]
      )
    into
      v_active_count,
      v_offset,
      v_current_order
    from public.wk_playlist_items item
    where item.playlist_id = p_playlist_id
      and item.lifecycle_state = 'active';

    select count(distinct item_id)
    into v_distinct_count
    from unnest(p_ordered_item_ids) item_id;

    if cardinality(p_ordered_item_ids) <> v_active_count
       or v_distinct_count <> v_active_count
       or exists (
         select 1
         from unnest(p_ordered_item_ids) requested(item_id)
         where not exists (
           select 1
           from public.wk_playlist_items item
           where item.id = requested.item_id
             and item.playlist_id = p_playlist_id
             and item.lifecycle_state = 'active'
         )
       ) then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'invalid_playlist_order',
        'Reorder must contain every active Playlist Track exactly once.',
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_context.authority_revision,
          'active_item_count', v_active_count,
          'error_message', 'Reorder must contain every active Playlist Track exactly once.'
        )
      );
    elsif v_current_order = p_ordered_item_ids then
      v_result := jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_context.authority_revision,
        'active_item_count', v_active_count,
        'changed', false,
        'correlation_id', v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    else
      v_offset := v_offset + v_active_count + 1;

      update public.wk_playlist_items item
      set
        position = item.position + v_offset,
        updated_at = now()
      where item.playlist_id = p_playlist_id
        and item.lifecycle_state = 'active';

      with requested as (
        select
          requested.item_id,
          requested.ordinality::integer as new_position
        from unnest(p_ordered_item_ids)
          with ordinality as requested(item_id, ordinality)
      )
      update public.wk_playlist_items item
      set
        position = requested.new_position,
        updated_at = now()
      from requested
      where item.id = requested.item_id
        and item.playlist_id = p_playlist_id
        and item.lifecycle_state = 'active';

      update public.wk_playlists playlist
      set
        authority_revision = playlist.authority_revision + 1,
        updated_at = now()
      where playlist.id = p_playlist_id
        and playlist.playlist_kind = 'personal'
        and playlist.authority_revision = p_expected_authority_revision
      returning playlist.authority_revision
      into v_revision;

      if v_revision is null then
        raise exception
          'Personal Playlist revision update did not converge.';
      end if;

      v_result := jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_revision,
        'active_item_count', v_active_count,
        'changed', true,
        'correlation_id', v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  result_payload := v_read.result_payload;
  return next;
end;
$function$;

revoke all
on function public.reorder_personal_playlist_items(uuid,bigint,uuid[],text,uuid)
from public, anon;

grant execute
on function public.reorder_personal_playlist_items(uuid,bigint,uuid[],text,uuid)
to authenticated, service_role;

create or replace function public.archive_personal_playlist(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_idempotency_key text default null,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table (
  receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  result_payload jsonb
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_context record;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_revision bigint;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  select *
  into v_context
  from editorial.personal_playlist_command_context(
    p_playlist_id,
    false
  );

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'expected_authority_revision', p_expected_authority_revision,
    'note', nullif(btrim(p_note), ''),
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.archive',
    v_context.resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    result_payload := v_read.result_payload;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision <> v_context.authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before it could be archived.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_context.authority_revision,
        'error_message', 'The Playlist changed before it could be archived.'
      )
    );
  else
    update editorial.resources resource
    set
      lifecycle_state = 'archived',
      visibility = 'private',
      updated_at = now()
    where resource.id = v_context.resource_id
      and resource.resource_kind = 'playlist';

    update public.wk_playlists playlist
    set
      status = 'archived',
      authority_revision = playlist.authority_revision + 1,
      updated_at = now()
    where playlist.id = p_playlist_id
      and playlist.playlist_kind = 'personal'
      and playlist.authority_revision = p_expected_authority_revision
    returning playlist.authority_revision
    into v_revision;

    if v_revision is null then
      raise exception
        'Personal Playlist revision update did not converge.';
    end if;

    v_result := jsonb_build_object(
      'playlist_id', p_playlist_id,
      'resource_id', v_context.resource_id,
      'lifecycle_status', 'archived',
      'visibility', 'private',
      'authority_revision', v_revision,
      'note', nullif(btrim(p_note), ''),
      'correlation_id', v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  result_payload := v_read.result_payload;
  return next;
end;
$function$;

revoke all
on function public.archive_personal_playlist(uuid,bigint,text,text,uuid)
from public, anon;

grant execute
on function public.archive_personal_playlist(uuid,bigint,text,text,uuid)
to authenticated, service_role;

create or replace function public.list_my_personal_playlists(
  p_include_archived boolean default false,
  p_limit integer default 100
)
returns table (
  playlist_id uuid,
  title text,
  slug text,
  description text,
  visibility text,
  lifecycle_status text,
  authority_revision bigint,
  item_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial'
as $function$
  select
    playlist.id,
    playlist.title,
    playlist.slug,
    playlist.description,
    resource.visibility,
    resource.lifecycle_state,
    playlist.authority_revision,
    (
      select count(*)
      from public.wk_playlist_items item
      where item.playlist_id = playlist.id
        and item.lifecycle_state = 'active'
    ),
    playlist.created_at,
    playlist.updated_at
  from public.wk_playlists playlist
  join editorial.playlist_resources binding
    on binding.playlist_id = playlist.id
   and binding.resource_kind = 'playlist'
  join editorial.resources resource
    on resource.id = binding.resource_id
   and resource.resource_kind = 'playlist'
  where auth.uid() is not null
    and playlist.playlist_kind = 'personal'
    and resource.owner_id = auth.uid()
    and (
      p_include_archived
      or (
        playlist.status <> 'archived'
        and resource.lifecycle_state = 'active'
      )
    )
  order by playlist.updated_at desc, playlist.id
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$function$;

revoke all
on function public.list_my_personal_playlists(boolean,integer)
from public, anon;

grant execute
on function public.list_my_personal_playlists(boolean,integer)
to authenticated, service_role;

create or replace function public.get_my_personal_playlist(
  p_playlist_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial'
as $function$
  select editorial.personal_playlist_payload(
    p_playlist_id,
    false
  )
  where editorial.current_user_owns_personal_playlist(
    p_playlist_id,
    true
  );
$function$;

revoke all
on function public.get_my_personal_playlist(uuid)
from public, anon;

grant execute
on function public.get_my_personal_playlist(uuid)
to authenticated, service_role;

create or replace function public.get_my_personal_playlist_by_route(
  p_username text,
  p_slug text
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial'
as $function$
  select editorial.personal_playlist_payload(
    playlist.id,
    false
  )
  from public.user_profiles profile
  join editorial.resources resource
    on resource.owner_id = profile.user_id
   and resource.resource_kind = 'playlist'
  join editorial.playlist_resources binding
    on binding.resource_id = resource.id
   and binding.resource_kind = 'playlist'
  join public.wk_playlists playlist
    on playlist.id = binding.playlist_id
  where auth.uid() is not null
    and profile.user_id = auth.uid()
    and profile.username_normalized =
      public.community_normalize_username(p_username)
    and playlist.playlist_kind = 'personal'
    and playlist.slug = lower(btrim(p_slug))
  limit 1;
$function$;

revoke all
on function public.get_my_personal_playlist_by_route(text,text)
from public, anon;

grant execute
on function public.get_my_personal_playlist_by_route(text,text)
to authenticated, service_role;

create or replace function public.get_public_personal_playlist(
  p_username text,
  p_slug text
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select editorial.personal_playlist_payload(
    playlist.id,
    true
  )
  from public.user_profiles profile
  join editorial.resources resource
    on resource.owner_id = profile.user_id
   and resource.resource_kind = 'playlist'
  join editorial.playlist_resources binding
    on binding.resource_id = resource.id
   and binding.resource_kind = 'playlist'
  join public.wk_playlists playlist
    on playlist.id = binding.playlist_id
  where profile.is_public
    and profile.username_normalized =
      public.community_normalize_username(p_username)
    and playlist.playlist_kind = 'personal'
    and playlist.slug = lower(btrim(p_slug))
    and editorial.personal_playlist_is_public(
      playlist.id
    )
  limit 1;
$function$;

revoke all
on function public.get_public_personal_playlist(text,text)
from public;

grant execute
on function public.get_public_personal_playlist(text,text)
to anon, authenticated, service_role;

create or replace function public.list_public_personal_playlists_for_username(
  p_username text,
  p_limit integer default 24
)
returns table (
  playlist_id uuid,
  title text,
  slug text,
  description text,
  visibility text,
  lifecycle_status text,
  authority_revision bigint,
  item_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select
    playlist.id,
    playlist.title,
    playlist.slug,
    playlist.description,
    resource.visibility,
    resource.lifecycle_state,
    playlist.authority_revision,
    (
      select count(*)
      from public.wk_playlist_items item
      where item.playlist_id = playlist.id
        and item.lifecycle_state = 'active'
    ),
    playlist.created_at,
    playlist.updated_at
  from public.user_profiles profile
  join editorial.resources resource
    on resource.owner_id = profile.user_id
   and resource.resource_kind = 'playlist'
  join editorial.playlist_resources binding
    on binding.resource_id = resource.id
   and binding.resource_kind = 'playlist'
  join public.wk_playlists playlist
    on playlist.id = binding.playlist_id
  where profile.is_public
    and profile.username_normalized =
      public.community_normalize_username(p_username)
    and playlist.playlist_kind = 'personal'
    and playlist.status = 'draft'
    and resource.visibility = 'public'
    and resource.lifecycle_state = 'active'
  order by playlist.updated_at desc, playlist.id
  limit greatest(1, least(coalesce(p_limit, 24), 100));
$function$;

revoke all
on function public.list_public_personal_playlists_for_username(text,integer)
from public;

grant execute
on function public.list_public_personal_playlists_for_username(text,integer)
to anon, authenticated, service_role;

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale,
  reviewed_at
)
values
  (
    'create_personal_playlist(text,text,text,text,text,uuid)',
    'authenticated_self_service',
    'Creates one canonical Personal Playlist Resource owned by auth.uid() and reuses playlist.create command receipts.',
    now()
  ),
  (
    'update_personal_playlist(uuid,bigint,jsonb,text,uuid)',
    'authenticated_self_service',
    'Updates title, description, or visibility for an owned Personal Playlist with canonical command receipts and optimistic revision control.',
    now()
  ),
  (
    'add_personal_playlist_track(uuid,bigint,uuid,text,uuid)',
    'authenticated_self_service',
    'Adds one active Registry Track to an owned Personal Playlist using canonical Playlist Item Resource identity.',
    now()
  ),
  (
    'remove_personal_playlist_item(uuid,uuid,bigint,text,uuid)',
    'authenticated_self_service',
    'Soft-removes one active Track from an owned Personal Playlist and compacts active positions.',
    now()
  ),
  (
    'reorder_personal_playlist_items(uuid,bigint,uuid[],text,uuid)',
    'authenticated_self_service',
    'Reorders the complete active Track set of an owned Personal Playlist.',
    now()
  ),
  (
    'archive_personal_playlist(uuid,bigint,text,text,uuid)',
    'authenticated_self_service',
    'Archives an owned Personal Playlist without entering editorial review or publication.',
    now()
  ),
  (
    'list_my_personal_playlists(boolean,integer)',
    'authenticated_read',
    'Lists only Personal Playlists whose canonical Resource is owned by auth.uid().',
    now()
  ),
  (
    'get_my_personal_playlist(uuid)',
    'authenticated_read',
    'Returns one Personal Playlist only when auth.uid() owns its canonical Resource.',
    now()
  ),
  (
    'get_my_personal_playlist_by_route(text,text)',
    'authenticated_read',
    'Returns a Personal Playlist by owner username and Playlist slug only when auth.uid() owns that Person route.',
    now()
  ),
  (
    'get_public_personal_playlist(text,text)',
    'public_read',
    'Returns one Personal Playlist only when public Person username, Playlist slug, and public active Resource all match.',
    now()
  ),
  (
    'list_public_personal_playlists_for_username(text,integer)',
    'public_read',
    'Lists public active Personal Playlists for a public Person username without exposing owner UUIDs.',
    now()
  );

do $postconditions$
declare
  v_rpc_count integer;
  v_policy_count integer;
  v_personal_count integer;
begin
  select count(*)
  into v_rpc_count
  from private.phase_0a_rpc_classification
  where function_signature = any (
    array[
      'create_personal_playlist(text,text,text,text,text,uuid)',
      'update_personal_playlist(uuid,bigint,jsonb,text,uuid)',
      'add_personal_playlist_track(uuid,bigint,uuid,text,uuid)',
      'remove_personal_playlist_item(uuid,uuid,bigint,text,uuid)',
      'reorder_personal_playlist_items(uuid,bigint,uuid[],text,uuid)',
      'archive_personal_playlist(uuid,bigint,text,text,uuid)',
      'list_my_personal_playlists(boolean,integer)',
      'get_my_personal_playlist(uuid)',
      'get_my_personal_playlist_by_route(text,text)',
      'get_public_personal_playlist(text,text)',
      'list_public_personal_playlists_for_username(text,integer)'
    ]::text[]
  );

  if v_rpc_count <> 11 then
    raise exception
      'M8C-M1 expected 11 classified RPCs, found %',
      v_rpc_count;
  end if;

  select count(*)
  into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'wk_playlists_personal_owner_read',
      'wk_playlist_items_personal_owner_read'
    );

  if v_policy_count <> 2 then
    raise exception
      'M8C-M1 expected two Personal Playlist owner-read policies, found %',
      v_policy_count;
  end if;

  select count(*)
  into v_personal_count
  from public.wk_playlists
  where playlist_kind = 'personal';

  if v_personal_count <> 0 then
    raise exception
      'M8C-M1 migration must not create acceptance fixtures, found % Personal Playlist rows',
      v_personal_count;
  end if;
end;
$postconditions$;

commit;
