-- Phase 5A Migration 216: Playlist/Registry review unification.
--
-- Product correction:
-- A Playlist entry remains a Playlist entry while Registry identity is pending.
-- Registry review changes identity state, not Playlist editing behaviour.
--
-- This migration:
-- 1. materializes pending Registry-intake tracks as ordinary wk_playlist_items;
-- 2. makes the existing Playlist note/reorder commands the only editor UX authority;
-- 3. keeps Registry review metadata attached to the same Playlist item;
-- 4. updates that same Playlist item in place when Registry canonicalizes it;
-- 5. exposes a governed Music Registry Track Intake review queue;
-- 6. allows Registry reviewers to resolve to an existing canonical track or reject;
-- 7. aligns legacy Media compatibility with canonical playlist_cover purpose.

begin;

do $phase_5a_m216_preflight$
declare
  v_media_constraint text;
begin
  if to_regclass('public.wk_playlists') is null
     or to_regclass('public.wk_playlist_items') is null
     or to_regclass('public.registry_provider_track_suggestions') is null
     or to_regclass('public.registry_provider_track_suggestion_artists') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('media.asset_purposes') is null
     or to_regclass('public.registry_media_assets') is null
  then
    raise exception
      'STOP: Required Playlist, Registry, or Media authority is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'playlist_note'
  ) then
    raise exception
      'STOP: M215 pending-note authority is missing';
  end if;

  if to_regprocedure(
       'public.reorder_playlist_items_with_intake_slots(uuid,bigint,uuid[],text,uuid)'
     ) is null
     or to_regprocedure(
       'public.save_playlist_item_note(uuid,uuid,bigint,text,text,uuid)'
     ) is null
  then
    raise exception
      'STOP: Canonical Playlist reorder or note authority is missing';
  end if;

  if not exists (
    select 1
    from media.asset_purposes purpose
    where purpose.asset_purpose = 'playlist_cover'
      and purpose.enabled
  ) then
    raise exception
      'STOP: Canonical Media purpose playlist_cover is not enabled';
  end if;

  select pg_get_constraintdef(c.oid)
  into v_media_constraint
  from pg_constraint c
  where c.conrelid = 'public.registry_media_assets'::regclass
    and c.conname = 'registry_media_assets_asset_purpose_check';

  if v_media_constraint is null then
    raise exception
      'STOP: Legacy Media asset-purpose compatibility constraint is missing';
  end if;

  if position('playlist_cover' in v_media_constraint) > 0 then
    raise exception
      'STOP: Media compatibility already accepts playlist_cover';
  end if;

  if to_regprocedure(
       'editorial.ensure_playlist_registry_intake_item(uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_get_registry_track_intake_queue(text,integer,integer,uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake(uuid,uuid,text)'
     ) is not null
     or to_regprocedure(
       'public.admin_reject_registry_track_intake(uuid,text)'
     ) is not null
  then
    raise exception
      'STOP: One or more M216 authorities already exist';
  end if;
end;
$phase_5a_m216_preflight$;

-- M216 materializes Registry-review tracks as Editorial playlist_item
-- resources. The generic deferred resource-binding invariant must therefore
-- understand the playlist_item typed binding before any new item is committed.
create or replace function editorial.assert_resource_binding_integrity()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial'
as $function$
declare
  target_resource_id uuid;
  target_kind text;
  binding_count integer;
begin
  if tg_table_name = 'resources' then
    if tg_op = 'DELETE' then
      return null;
    end if;

    target_resource_id := new.id;
  else
    if tg_op = 'DELETE' then
      target_resource_id := old.resource_id;
    else
      target_resource_id := new.resource_id;
    end if;
  end if;

  select resource_kind
  into target_kind
  from editorial.resources
  where id = target_resource_id;

  if not found then
    return null;
  end if;

  case target_kind
    when 'article' then
      select count(*)
      into binding_count
      from editorial.article_resources
      where resource_id = target_resource_id;

    when 'playlist' then
      select count(*)
      into binding_count
      from editorial.playlist_resources
      where resource_id = target_resource_id;

    when 'playlist_item' then
      select count(*)
      into binding_count
      from editorial.playlist_item_resources
      where resource_id = target_resource_id;

    when 'registry_artist' then
      select count(*)
      into binding_count
      from editorial.registry_artist_resources
      where resource_id = target_resource_id;

    when 'correction_case' then
      select count(*)
      into binding_count
      from editorial.correction_cases
      where resource_id = target_resource_id;

    when 'media_asset' then
      select count(*)
      into binding_count
      from editorial.media_asset_resources
      where resource_id = target_resource_id;

    else
      raise exception
        'Unsupported resource kind: %',
        target_kind;
  end case;

  if binding_count <> 1 then
    raise exception
      'Resource % with kind % must have exactly one typed binding.',
      target_resource_id,
      target_kind;
  end if;

  return null;
end;
$function$;

comment on function editorial.assert_resource_binding_integrity()
is
  'Deferred integrity check requiring exactly one typed binding for each Editorial resource kind, including Playlist items.';

-- Canonical Media already owns playlist_cover. The compatibility projection
-- must not reject that valid canonical purpose.
alter table public.registry_media_assets
  drop constraint registry_media_assets_asset_purpose_check;

alter table public.registry_media_assets
  add constraint registry_media_assets_asset_purpose_check
  check (
    asset_purpose is null
    or asset_purpose = any (
      array[
        'general'::text,
        'article_hero'::text,
        'article_inline'::text,
        'chart_artwork'::text,
        'artist_photo'::text,
        'release_artwork'::text,
        'track_artwork'::text,
        'downloadable'::text,
        'press_kit'::text,
        'brand_asset'::text,
        'profile_media'::text,
        'social_card'::text,
        'system'::text,
        'playlist_cover'::text
      ]
    )
  );

comment on constraint
  registry_media_assets_asset_purpose_check
  on public.registry_media_assets
is
  'Legacy Media compatibility projection mirrors enabled canonical Media purposes, including playlist_cover.';

-- M208 blocks arbitrary active Playlist rows without canonical Music Registry
-- identity. M216 keeps that boundary and adds one narrow exception: a row may
-- be active while identity is pending only when it is bound to the exact
-- unresolved Registry intake suggestion for the same Playlist, provider
-- identity and reserved position.
create or replace function editorial.guard_new_playlist_item_registry_identity()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
declare
  v_suggestion_id uuid;
  v_is_valid_pending_intake boolean := false;
begin
  if new.lifecycle_state = 'active'
     and new.registry_track_id is null
  then
    begin
      v_suggestion_id := nullif(
        new.normalization_payload ->> 'registry_intake_suggestion_id',
        ''
      )::uuid;
    exception
      when invalid_text_representation then
        v_suggestion_id := null;
    end;

    if v_suggestion_id is not null
       and new.match_status = 'needs_review'
    then
      select exists (
        select 1
        from public.registry_provider_track_suggestions suggestion
        where suggestion.id = v_suggestion_id
          and suggestion.source_playlist_id = new.playlist_id
          and suggestion.status = 'needs_review'
          and suggestion.canonical_track_id is null
          and suggestion.canonicalized_track_id is null
          and suggestion.provider_key is not distinct from new.provider_key
          and suggestion.provider_object_id is not distinct from new.provider_track_id
          and (
            (
              tg_op = 'INSERT'
              and suggestion.source_playlist_item_id is null
              and suggestion.reserved_position = new.position
            )
            or (
              tg_op = 'UPDATE'
              and suggestion.source_playlist_item_id = new.id
            )
          )
      ) into v_is_valid_pending_intake;
    end if;

    if not v_is_valid_pending_intake then
      raise exception
        using errcode = '23514',
          message = 'Playlist items must resolve to a canonical Music Registry track or be backed by an active Registry intake review.';
    end if;
  end if;

  return new;
end;
$function$;

comment on function editorial.guard_new_playlist_item_registry_identity()
is 'Requires canonical Registry identity for active Playlist items except the narrow M216 case backed by an unresolved Registry intake suggestion.';

do $phase_5a_m216_pending_registry_identity_guard$
begin
  if position(
       'registry_intake_suggestion_id'
       in pg_get_functiondef(
         'editorial.guard_new_playlist_item_registry_identity()'::regprocedure
       )
     ) = 0
  then
    raise exception 'STOP: M216 pending Registry identity guard was not installed';
  end if;
end;
$phase_5a_m216_pending_registry_identity_guard$;

create or replace function editorial.ensure_playlist_registry_intake_item(
  p_suggestion_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial'
as $function$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_playlist public.wk_playlists%rowtype;
  v_playlist_resource editorial.resources%rowtype;
  v_item_id uuid;
  v_artist_names text[];
begin
  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception 'Registry intake suggestion does not exist.';
  end if;

  if v_suggestion.source_playlist_item_id is not null then
    return v_suggestion.source_playlist_item_id;
  end if;

  if v_suggestion.status <> 'needs_review'
     or v_suggestion.canonical_track_id is not null
  then
    return null;
  end if;

  if v_suggestion.reserved_position is null
     or v_suggestion.reserved_position < 1
  then
    raise exception
      'Pending Registry intake has no valid Playlist position.';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = v_suggestion.source_playlist_id
  for update of playlist;

  if not found then
    raise exception
      'Pending Registry intake lost its source Playlist.';
  end if;

  if exists (
    select 1
    from public.wk_playlist_items item
    where item.playlist_id = v_suggestion.source_playlist_id
      and item.lifecycle_state = 'active'
      and item.position = v_suggestion.reserved_position
  ) then
    raise exception
      'Pending Registry intake position is already occupied.';
  end if;

  select resource_row.*
  into v_playlist_resource
  from editorial.resources resource_row
  where resource_row.id = v_suggestion.source_playlist_id;

  if not found then
    raise exception
      'Pending Registry intake lost its Playlist resource authority.';
  end if;

  select coalesce(
    array_agg(
      coalesce(artist.display_name, credit.observed_name)
      order by credit.credit_order
    ) filter (
      where coalesce(artist.display_name, credit.observed_name) is not null
    ),
    v_suggestion.provider_artist_names,
    '{}'::text[]
  )
  into v_artist_names
  from public.registry_provider_track_suggestion_artists credit
  left join public.registry_artists artist
    on artist.id = credit.registry_artist_id
  where credit.suggestion_id = v_suggestion.id;

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
    v_playlist_resource.owner_id,
    'internal',
    'active',
    coalesce(
      v_suggestion.requested_by,
      v_playlist.created_by,
      auth.uid()
    )
  );

  insert into public.wk_playlist_items (
    id,
    playlist_id,
    position,
    registry_track_id,
    registry_release_id,
    provider_key,
    provider_track_id,
    provider_url,
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
    notes,
    created_by,
    lifecycle_state
  )
  values (
    v_item_id,
    v_suggestion.source_playlist_id,
    v_suggestion.reserved_position,
    null,
    null,
    v_suggestion.provider_key,
    v_suggestion.provider_object_id,
    v_suggestion.provider_url,
    coalesce(
      nullif(btrim(v_suggestion.provider_title), ''),
      'Track awaiting Music Registry'
    ),
    coalesce(v_artist_names, '{}'::text[]),
    v_suggestion.provider_release_title,
    v_suggestion.validation_snapshot ->> 'artwork_url',
    v_suggestion.validation_snapshot ->> 'preview_url',
    null,
    null,
    'needs_review',
    null,
    jsonb_build_object(
      'registry_intake_suggestion_id', v_suggestion.id,
      'registry_intake_status', 'needs_review',
      'playlist_position_authority', 'playlist_item',
      'playback', v_suggestion.validation_snapshot
    ),
    v_suggestion.playlist_note,
    coalesce(
      v_suggestion.requested_by,
      v_playlist.created_by,
      auth.uid()
    ),
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

  update public.registry_provider_track_suggestions suggestion
  set
    source_playlist_item_id = v_item_id,
    reserved_position = null
  where suggestion.id = v_suggestion.id;

  return v_item_id;
end;
$function$;

revoke all
on function editorial.ensure_playlist_registry_intake_item(uuid)
from public, anon, authenticated, service_role;

create or replace function editorial.sync_playlist_registry_intake_item_artists()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_suggestion_id uuid;
  v_item_id uuid;
  v_artist_names text[];
begin
  v_suggestion_id := coalesce(new.suggestion_id, old.suggestion_id);

  v_item_id :=
    editorial.ensure_playlist_registry_intake_item(
      v_suggestion_id
    );

  if v_item_id is null then
    return coalesce(new, old);
  end if;

  select coalesce(
    array_agg(
      coalesce(artist.display_name, credit.observed_name)
      order by credit.credit_order
    ) filter (
      where coalesce(artist.display_name, credit.observed_name) is not null
    ),
    '{}'::text[]
  )
  into v_artist_names
  from public.registry_provider_track_suggestion_artists credit
  left join public.registry_artists artist
    on artist.id = credit.registry_artist_id
  where credit.suggestion_id = v_suggestion_id;

  update public.wk_playlist_items item
  set artist_names = coalesce(v_artist_names, '{}'::text[])
  where item.id = v_item_id
    and item.lifecycle_state = 'active';

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;

drop trigger if exists
  registry_provider_track_suggestion_sync_playlist_item_artists
on public.registry_provider_track_suggestion_artists;

create trigger registry_provider_track_suggestion_sync_playlist_item_artists
after insert or update or delete
on public.registry_provider_track_suggestion_artists
for each row
execute function editorial.sync_playlist_registry_intake_item_artists();

-- Backfill all live pending Registry-intake tracks into the ordinary Playlist
-- item authority. Each affected Playlist receives one revision bump.
do $phase_5a_m216_backfill$
declare
  v_playlist_id uuid;
  v_suggestion_id uuid;
begin
  for v_playlist_id in
    select distinct suggestion.source_playlist_id
    from public.registry_provider_track_suggestions suggestion
    where suggestion.status = 'needs_review'
      and suggestion.source_playlist_item_id is null
      and suggestion.canonical_track_id is null
  loop
    for v_suggestion_id in
      select suggestion.id
      from public.registry_provider_track_suggestions suggestion
      where suggestion.source_playlist_id = v_playlist_id
        and suggestion.status = 'needs_review'
        and suggestion.source_playlist_item_id is null
        and suggestion.canonical_track_id is null
      order by suggestion.reserved_position, suggestion.created_at
    loop
      perform editorial.ensure_playlist_registry_intake_item(
        v_suggestion_id
      );
    end loop;

    update public.wk_playlists playlist
    set authority_revision = playlist.authority_revision + 1
    where playlist.id = v_playlist_id;
  end loop;
end;
$phase_5a_m216_backfill$;

-- Canonicalization now updates the already-existing Playlist item in place.
create or replace function editorial.materialize_canonicalized_playlist_registry_intake()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_playlist_resource editorial.resources%rowtype;
  v_item_id uuid;
  v_title text;
  v_release_id uuid;
  v_release_title text;
  v_artwork_url text;
  v_preview_url text;
  v_duration_ms integer;
  v_isrc text;
  v_artist_names text[];
  v_actor uuid;
begin
  if new.status <> 'canonicalized'
     or new.canonicalized_track_id is null
  then
    return new;
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = new.source_playlist_id
  for update of playlist;

  if not found then
    raise exception
      'Canonicalized Registry intake lost its source Playlist.';
  end if;

  select
    track.title,
    track.release_id,
    release.title,
    coalesce(
      track.artwork_url,
      new.validation_snapshot ->> 'artwork_url'
    ),
    coalesce(
      track.preview_url,
      new.validation_snapshot ->> 'preview_url'
    ),
    track.duration_ms,
    track.isrc,
    coalesce(
      array_agg(
        coalesce(
          artist.display_name,
          link.artist_name_text
        )
        order by link.credit_order, link.id
      ) filter (
        where coalesce(
          artist.display_name,
          link.artist_name_text
        ) is not null
      ),
      '{}'::text[]
    )
  into
    v_title,
    v_release_id,
    v_release_title,
    v_artwork_url,
    v_preview_url,
    v_duration_ms,
    v_isrc,
    v_artist_names
  from public.registry_tracks track
  left join public.registry_releases release
    on release.id = track.release_id
  left join public.registry_track_artists link
    on link.track_id = track.id
    and link.status = 'active'
  left join public.registry_artists artist
    on artist.id = link.artist_id
  where track.id = new.canonicalized_track_id
    and track.status = 'active'
  group by
    track.id,
    track.title,
    track.release_id,
    release.title,
    track.artwork_url,
    track.preview_url,
    track.duration_ms,
    track.isrc;

  if not found then
    raise exception
      'Canonicalized Registry intake points to an unavailable track.';
  end if;

  v_actor := coalesce(
    new.reviewed_by,
    new.requested_by,
    auth.uid(),
    v_playlist.created_by
  );

  if new.source_playlist_item_id is not null then
    update public.wk_playlist_items item
    set
      registry_track_id = new.canonicalized_track_id,
      registry_release_id = v_release_id,
      provider_key = new.provider_key,
      provider_track_id = new.provider_object_id,
      provider_url = new.provider_url,
      title = v_title,
      artist_names = v_artist_names,
      release_title = v_release_title,
      artwork_url = v_artwork_url,
      preview_url = v_preview_url,
      duration_ms = v_duration_ms,
      isrc = v_isrc,
      match_status = 'matched',
      match_confidence = 1.0000,
      normalization_payload =
        coalesce(item.normalization_payload, '{}'::jsonb)
        || jsonb_build_object(
          'registry_intake_suggestion_id', new.id,
          'registry_intake_status', 'canonicalized',
          'playlist_position_authority', 'playlist_item',
          'playback', new.validation_snapshot
        ),
      notes = coalesce(item.notes, new.playlist_note)
    where item.id = new.source_playlist_item_id
      and item.playlist_id = new.source_playlist_id
      and item.lifecycle_state = 'active';

    if not found then
      raise exception
        'Canonicalized Registry intake lost its Playlist item.';
    end if;

    update public.wk_playlists playlist
    set authority_revision = playlist.authority_revision + 1
    where playlist.id = new.source_playlist_id;

    return new;
  end if;

  if new.reserved_position is null then
    raise exception
      'Legacy canonicalized Registry intake has no Playlist position.';
  end if;

  if exists (
    select 1
    from public.wk_playlist_items item
    where item.playlist_id = new.source_playlist_id
      and item.lifecycle_state = 'active'
      and item.position = new.reserved_position
  ) then
    raise exception
      'Reserved Playlist intake position is already occupied.';
  end if;

  select resource_row.*
  into v_playlist_resource
  from editorial.resources resource_row
  where resource_row.id = new.source_playlist_id;

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
    v_playlist_resource.owner_id,
    'internal',
    'active',
    v_actor
  );

  insert into public.wk_playlist_items (
    id,
    playlist_id,
    position,
    registry_track_id,
    registry_release_id,
    provider_key,
    provider_track_id,
    provider_url,
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
    notes,
    created_by,
    lifecycle_state
  )
  values (
    v_item_id,
    new.source_playlist_id,
    new.reserved_position,
    new.canonicalized_track_id,
    v_release_id,
    new.provider_key,
    new.provider_object_id,
    new.provider_url,
    v_title,
    v_artist_names,
    v_release_title,
    v_artwork_url,
    v_preview_url,
    v_duration_ms,
    v_isrc,
    'matched',
    1.0000,
    jsonb_build_object(
      'registry_intake_suggestion_id', new.id,
      'registry_intake_status', 'canonicalized',
      'playlist_position_authority', 'playlist_item',
      'playback', new.validation_snapshot
    ),
    new.playlist_note,
    v_actor,
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

  update public.registry_provider_track_suggestions suggestion
  set
    source_playlist_item_id = v_item_id,
    reserved_position = null
  where suggestion.id = new.id;

  update public.wk_playlists playlist
  set authority_revision = playlist.authority_revision + 1
  where playlist.id = new.source_playlist_id;

  return new;
end;
$function$;

-- The M215 special pending-item commands are now retired from authenticated
-- callers. Playlist items use the same note and reorder commands regardless of
-- Registry identity state.
revoke execute
on function public.save_playlist_pending_registry_note(
  uuid, uuid, bigint, text, text, uuid
)
from authenticated;

revoke execute
on function public.move_playlist_pending_registry_intake(
  uuid, uuid, bigint, text, text, uuid
)
from authenticated;

create or replace function public.admin_get_registry_track_intake_queue(
  p_status text default 'needs_review',
  p_limit integer default 100,
  p_offset integer default 0,
  p_suggestion_id uuid default null,
  p_playlist_item_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial'
as $function$
declare
  v_status text := lower(btrim(coalesce(p_status, 'needs_review')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 250));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using errcode = '42501', message = 'Registry management permission is required.';
  end if;

  if v_status not in (
    'needs_review',
    'rejected',
    'canonicalized',
    'all'
  ) then
    raise exception
      'Track Intake status filter is invalid.';
  end if;

  select count(*)::integer
  into v_total
  from public.registry_provider_track_suggestions suggestion
  where (
      v_status = 'all'
      or suggestion.status = v_status
    )
    and (
      p_suggestion_id is null
      or suggestion.id = p_suggestion_id
    )
    and (
      p_playlist_item_id is null
      or suggestion.source_playlist_item_id = p_playlist_item_id
    );

  select coalesce(
    jsonb_agg(queue_row.payload order by queue_row.created_at desc),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      suggestion.created_at,
      jsonb_build_object(
        'suggestion_id', suggestion.id,
        'status', suggestion.status,
        'playlist_id', suggestion.source_playlist_id,
        'playlist_title', playlist.title,
        'playlist_item_id', suggestion.source_playlist_item_id,
        'playlist_position', item.position,
        'playlist_note', item.notes,
        'provider_key', suggestion.provider_key,
        'provider_object_id', suggestion.provider_object_id,
        'provider_url', suggestion.provider_url,
        'provider_title', suggestion.provider_title,
        'provider_release_title', suggestion.provider_release_title,
        'provider_artist_names', suggestion.provider_artist_names,
        'playback_kind', suggestion.playback_kind,
        'artwork_url', suggestion.validation_snapshot ->> 'artwork_url',
        'preview_url', suggestion.validation_snapshot ->> 'preview_url',
        'requested_by', suggestion.requested_by,
        'requested_by_name', requester.display_name,
        'created_at', suggestion.created_at,
        'reviewed_at', suggestion.reviewed_at,
        'review_note', suggestion.review_note,
        'canonical_track_id', suggestion.canonical_track_id,
        'canonical_track_title', canonical_track.title,
        'canonicalized_track_id', suggestion.canonicalized_track_id,
        'canonicalized_track_title', canonical_track.title,
        'artist_credits',
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'credit_order', credit.credit_order,
                  'credit_role', credit.credit_role,
                  'resolution_mode', credit.resolution_mode,
                  'registry_artist_id', credit.registry_artist_id,
                  'observed_name', credit.observed_name,
                  'display_name',
                    coalesce(
                      artist.display_name,
                      credit.observed_name
                    )
                )
                order by credit.credit_order
              )
              from public.registry_provider_track_suggestion_artists credit
              left join public.registry_artists artist
                on artist.id = credit.registry_artist_id
              where credit.suggestion_id = suggestion.id
            ),
            '[]'::jsonb
          )
      ) as payload
    from public.registry_provider_track_suggestions suggestion
    left join public.wk_playlists playlist
      on playlist.id = suggestion.source_playlist_id
    left join public.wk_playlist_items item
      on item.id = suggestion.source_playlist_item_id
    left join public.user_profiles requester
      on requester.user_id = suggestion.requested_by
    left join public.registry_tracks canonical_track
      on canonical_track.id = coalesce(
        suggestion.canonicalized_track_id,
        suggestion.canonical_track_id
      )
    where (
        v_status = 'all'
        or suggestion.status = v_status
      )
      and (
        p_suggestion_id is null
        or suggestion.id = p_suggestion_id
      )
      and (
        p_playlist_item_id is null
        or suggestion.source_playlist_item_id = p_playlist_item_id
      )
    order by suggestion.created_at desc
    limit v_limit
    offset v_offset
  ) queue_row;

  return jsonb_build_object(
    'status', v_status,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'rows', v_rows
  );
end;
$function$;

revoke all
on function public.admin_get_registry_track_intake_queue(
  text, integer, integer, uuid, uuid
)
from public, anon, service_role;

grant execute
on function public.admin_get_registry_track_intake_queue(
  text, integer, integer, uuid, uuid
)
to authenticated;

create or replace function public.admin_resolve_registry_track_intake(
  p_suggestion_id uuid,
  p_registry_track_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public'
as $function$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_track public.registry_tracks%rowtype;
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using errcode = '42501', message = 'Registry management permission is required.';
  end if;

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'Track Intake item does not exist.';
  end if;

  if v_suggestion.status <> 'needs_review' then
    raise exception
      'Only Track Intake items awaiting review can be resolved.';
  end if;

  if v_suggestion.source_playlist_item_id is null then
    raise exception
      'Track Intake item has not been materialized into its Playlist.';
  end if;

select suggestion.*
into v_suggestion
from public.registry_provider_track_suggestions suggestion
where suggestion.id = p_suggestion_id
for update;

if not found then
  raise exception
    using
      errcode = 'P0002',
      message = 'Track Intake item does not exist.';
end if;

if v_suggestion.status <> 'needs_review' then
  raise exception
    'Only Track Intake items awaiting review can be resolved.';
end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id = p_registry_track_id
    and track.status = 'active';

  if not found then
    raise exception
      'Selected Music Registry track is unavailable.';
  end if;

  update public.registry_provider_track_suggestions suggestion
  set
    status = 'canonicalized',
    canonical_track_id = p_registry_track_id,
    canonicalized_track_id = p_registry_track_id,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = nullif(btrim(p_review_note), '')
  where suggestion.id = p_suggestion_id;

  return jsonb_build_object(
    'suggestion_id', p_suggestion_id,
    'playlist_id', v_suggestion.source_playlist_id,
    'playlist_item_id', v_suggestion.source_playlist_item_id,
    'status', 'canonicalized',
    'registry_track_id', p_registry_track_id,
    'registry_track_title', v_track.title
  );
end;
$function$;


revoke all
on function public.admin_resolve_registry_track_intake(
  uuid, uuid, text
)
from public, anon, service_role;

grant execute
on function public.admin_resolve_registry_track_intake(
  uuid, uuid, text
)
to authenticated;

create or replace function public.admin_reject_registry_track_intake(
  p_suggestion_id uuid,
  p_review_note text
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public'
as $function$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using errcode = '42501', message = 'Registry management permission is required.';
  end if;

  if nullif(btrim(p_review_note), '') is null then
    raise exception
      'A rejection reason is required.';
  end if;

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'Track Intake item does not exist.';
  end if;

  if v_suggestion.status <> 'needs_review' then
    raise exception
      'Only Track Intake items awaiting review can be rejected.';
  end if;

  update public.registry_provider_track_suggestions suggestion
  set
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = btrim(p_review_note)
  where suggestion.id = p_suggestion_id;

  if v_suggestion.source_playlist_item_id is not null then
    update public.wk_playlist_items item
    set
      match_status = 'rejected',
      normalization_payload =
        coalesce(item.normalization_payload, '{}'::jsonb)
        || jsonb_build_object(
          'registry_intake_status', 'rejected'
        )
    where item.id = v_suggestion.source_playlist_item_id
      and item.lifecycle_state = 'active';

    update public.wk_playlists playlist
    set authority_revision = playlist.authority_revision + 1
    where playlist.id = v_suggestion.source_playlist_id;
  end if;

  return jsonb_build_object(
    'suggestion_id', p_suggestion_id,
    'playlist_id', v_suggestion.source_playlist_id,
    'playlist_item_id', v_suggestion.source_playlist_item_id,
    'status', 'rejected',
    'review_note', btrim(p_review_note)
  );
end;
$function$;

revoke all
on function public.admin_reject_registry_track_intake(
  uuid, text
)
from public, anon, service_role;

grant execute
on function public.admin_reject_registry_track_intake(
  uuid, text
)
to authenticated;

-- ---------------------------------------------------------------------------
-- Track Intake enrichment authority.
--
-- WAKILISHA already has generic provider observation, provider-link, and
-- enrichment-suggestion tables. Track Intake reuses those shared systems rather
-- than creating a Playlist-specific metadata store.
--
-- An intake suggestion is a pre-canonical Registry object, so its UUID is used
-- as the observation/provider-item key and as the enrichment suggestion entity
-- key with registry_entity_type = 'track'.
-- ---------------------------------------------------------------------------

create or replace function editorial.seed_registry_track_intake_provider_observations(
  p_suggestion_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_metadata jsonb;
begin
  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id = p_suggestion_id;

  if not found then
    return;
  end if;

  v_metadata :=
    coalesce(
      v_suggestion.validation_snapshot -> 'provider_metadata',
      '{}'::jsonb
    );

  insert into public.provider_field_observations (
    provider_item_id,
    entity_type,
    field_name,
    field_value,
    provider,
    confidence_score,
    source_path,
    raw_payload,
    created_at
  )
  select
    v_suggestion.id::text,
    'track',
    observed.field_name,
    observed.field_value,
    v_suggestion.provider_key,
    observed.confidence_score,
    observed.source_path,
    v_suggestion.validation_snapshot,
    now()
  from (
    values
      (
        'title'::text,
        nullif(btrim(v_suggestion.provider_title), ''),
        0.85::numeric,
        'playlist_validation.provider_title'::text
      ),
      (
        'release_title',
        nullif(btrim(v_suggestion.provider_release_title), ''),
        0.80::numeric,
        'playlist_validation.provider_release_title'
      ),
      (
        'track_artwork_url',
        nullif(
          btrim(v_suggestion.validation_snapshot ->> 'artwork_url'),
          ''
        ),
        0.85::numeric,
        'playlist_validation.artwork_url'
      ),
      (
        'preview_url',
        nullif(
          btrim(v_suggestion.validation_snapshot ->> 'preview_url'),
          ''
        ),
        0.85::numeric,
        'playlist_validation.preview_url'
      ),
      (
        'duration_ms',
        nullif(btrim(v_metadata ->> 'track_time_millis'), ''),
        0.90::numeric,
        'playlist_validation.provider_metadata.track_time_millis'
      ),
      (
        'release_date',
        nullif(btrim(v_metadata ->> 'release_date'), ''),
        0.80::numeric,
        'playlist_validation.provider_metadata.release_date'
      ),
      (
        'genre',
        nullif(btrim(v_metadata ->> 'primary_genre_name'), ''),
        0.65::numeric,
        'playlist_validation.provider_metadata.primary_genre_name'
      ),
      (
        'provider_url',
        nullif(btrim(v_suggestion.provider_url), ''),
        1.00::numeric,
        'playlist_validation.provider_url'
      ),
      (
        'video_published_at',
        case
          when v_suggestion.provider_key = 'youtube'
          then nullif(btrim(v_metadata ->> 'published_at'), '')
          else null
        end,
        0.65::numeric,
        'playlist_validation.provider_metadata.published_at'
      )
  ) observed(
    field_name,
    field_value,
    confidence_score,
    source_path
  )
  where observed.field_value is not null
    and not exists (
      select 1
      from public.provider_field_observations existing
      where existing.provider_item_id = v_suggestion.id::text
        and existing.entity_type = 'track'
        and existing.provider = v_suggestion.provider_key
        and existing.field_name = observed.field_name
        and existing.field_value = observed.field_value
        and existing.source_path = observed.source_path
    );

  if nullif(btrim(v_suggestion.provider_object_id), '') is not null
     and not exists (
       select 1
       from public.provider_entity_links link
       where link.registry_entity_type = 'track'
         and link.registry_entity_id = v_suggestion.id::text
         and link.provider = v_suggestion.provider_key
         and link.provider_entity_id =
           v_suggestion.provider_object_id
     )
  then
    insert into public.provider_entity_links (
      registry_entity_type,
      registry_entity_id,
      provider,
      provider_entity_id,
      provider_url,
      match_status,
      confidence_score,
      created_at,
      updated_at
    )
    values (
      'track',
      v_suggestion.id::text,
      v_suggestion.provider_key,
      v_suggestion.provider_object_id,
      v_suggestion.provider_url,
      'confirmed',
      1.0000,
      now(),
      now()
    );
  end if;
end;
$function$;

revoke all
on function editorial.seed_registry_track_intake_provider_observations(uuid)
from public, anon, authenticated, service_role;

create or replace function editorial.seed_registry_track_intake_provider_observations_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
begin
  perform editorial.seed_registry_track_intake_provider_observations(new.id);
  return new;
end;
$function$;

drop trigger if exists
  registry_track_intake_seed_provider_observations
on public.registry_provider_track_suggestions;

create trigger registry_track_intake_seed_provider_observations
after insert or update of
  provider_key,
  provider_object_id,
  provider_url,
  provider_title,
  provider_release_title,
  validation_snapshot
on public.registry_provider_track_suggestions
for each row
execute function editorial.seed_registry_track_intake_provider_observations_trigger();

do $phase_5a_m216_seed_existing_intake_evidence$
declare
  v_suggestion_id uuid;
begin
  for v_suggestion_id in
    select suggestion.id
    from public.registry_provider_track_suggestions suggestion
  loop
    perform editorial.seed_registry_track_intake_provider_observations(
      v_suggestion_id
    );
  end loop;
end;
$phase_5a_m216_seed_existing_intake_evidence$;

create or replace function public.admin_record_registry_track_intake_provider_evidence(
  p_suggestion_id uuid,
  p_provider text,
  p_provider_entity_id text,
  p_provider_url text,
  p_fields jsonb,
  p_raw_payload jsonb default '{}'::jsonb,
  p_confidence numeric default 0.9000
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public'
as $function$
declare
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_confidence numeric := greatest(
    0,
    least(coalesce(p_confidence, 0.9000), 1)
  );
  v_field record;
  v_field_value text;
  v_count integer := 0;
  v_allowed constant text[] := array[
    'title',
    'artist_names',
    'release_title',
    'isrc',
    'duration_ms',
    'track_artwork_url',
    'release_artwork_url',
    'preview_url',
    'release_date',
    'release_date_precision',
    'label_name',
    'imprint_name',
    'genre',
    'track_number',
    'disc_number',
    'explicit',
    'provider_url',
    'upc',
    'copyright_text'
  ];
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  if not exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    where suggestion.id = p_suggestion_id
  ) then
    raise exception
      using errcode = 'P0002',
        message = 'Track Intake item does not exist.';
  end if;

  if v_provider = ''
     or nullif(btrim(p_provider_entity_id), '') is null
  then
    raise exception
      'Provider and provider entity ID are required.';
  end if;

  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    raise exception
      'Provider enrichment fields must be a JSON object.';
  end if;

  if not exists (
    select 1
    from public.provider_entity_links link
    where link.registry_entity_type = 'track'
      and link.registry_entity_id = p_suggestion_id::text
      and link.provider = v_provider
      and link.provider_entity_id = btrim(p_provider_entity_id)
  ) then
    insert into public.provider_entity_links (
      registry_entity_type,
      registry_entity_id,
      provider,
      provider_entity_id,
      provider_url,
      match_status,
      confidence_score,
      created_at,
      updated_at
    )
    values (
      'track',
      p_suggestion_id::text,
      v_provider,
      btrim(p_provider_entity_id),
      nullif(btrim(p_provider_url), ''),
      'confirmed',
      v_confidence,
      now(),
      now()
    );
  end if;

  for v_field in
    select entry.key, entry.value
    from jsonb_each(p_fields) entry
  loop
    if not (v_field.key = any(v_allowed)) then
      raise exception
        'Unsupported Track Intake enrichment field: %',
        v_field.key;
    end if;

    if v_field.value = 'null'::jsonb then
      continue;
    end if;

    v_field_value :=
      case jsonb_typeof(v_field.value)
        when 'string' then v_field.value #>> '{}'
        else v_field.value::text
      end;

    if nullif(btrim(v_field_value), '') is null then
      continue;
    end if;

    insert into public.provider_field_observations (
      provider_item_id,
      entity_type,
      field_name,
      field_value,
      provider,
      confidence_score,
      source_path,
      raw_payload,
      created_at
    )
    values (
      p_suggestion_id::text,
      'track',
      v_field.key,
      v_field_value,
      v_provider,
      v_confidence,
      'track_intake.provider_inspect',
      coalesce(p_raw_payload, '{}'::jsonb),
      now()
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'suggestion_id', p_suggestion_id,
    'provider', v_provider,
    'provider_entity_id', btrim(p_provider_entity_id),
    'observation_count', v_count
  );
end;
$function$;

revoke all
on function public.admin_record_registry_track_intake_provider_evidence(
  uuid, text, text, text, jsonb, jsonb, numeric
)
from public, anon, service_role;

grant execute
on function public.admin_record_registry_track_intake_provider_evidence(
  uuid, text, text, text, jsonb, jsonb, numeric
)
to authenticated;

create or replace function public.admin_get_registry_track_intake_enrichment(
  p_suggestion_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public'
as $function$
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  if not exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    where suggestion.id = p_suggestion_id
  ) then
    raise exception
      using errcode = 'P0002',
        message = 'Track Intake item does not exist.';
  end if;

  return jsonb_build_object(
    'suggestion_id', p_suggestion_id,
    'observations',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', observation.id,
              'field_name', observation.field_name,
              'field_value', observation.field_value,
              'provider', observation.provider,
              'confidence_score', observation.confidence_score,
              'source_path', observation.source_path,
              'created_at', observation.created_at
            )
            order by
              observation.field_name,
              observation.created_at desc
          )
          from public.provider_field_observations observation
          where observation.provider_item_id =
              p_suggestion_id::text
            and observation.entity_type = 'track'
        ),
        '[]'::jsonb
      ),
    'accepted',
      coalesce(
        (
          select jsonb_object_agg(
            suggestion.field_name,
            suggestion.suggested_value
          )
          from public.registry_enrichment_suggestions suggestion
          where suggestion.registry_entity_type = 'track'
            and suggestion.registry_entity_id =
              p_suggestion_id::text
            and suggestion.decision_status = 'approved'
        ),
        '{}'::jsonb
      ),
    'provider_links',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'provider', link.provider,
              'provider_entity_id', link.provider_entity_id,
              'provider_url', link.provider_url,
              'match_status', link.match_status,
              'confidence_score', link.confidence_score,
              'created_at', link.created_at
            )
            order by link.created_at desc
          )
          from public.provider_entity_links link
          where link.registry_entity_type = 'track'
            and link.registry_entity_id =
              p_suggestion_id::text
        ),
        '[]'::jsonb
      )
  );
end;
$function$;

revoke all
on function public.admin_get_registry_track_intake_enrichment(uuid)
from public, anon, service_role;

grant execute
on function public.admin_get_registry_track_intake_enrichment(uuid)
to authenticated;

create or replace function public.admin_save_registry_track_intake_enrichment(
  p_suggestion_id uuid,
  p_fields jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public'
as $function$
declare
  v_field record;
  v_value text;
  v_count integer := 0;
  v_allowed constant text[] := array[
    'isrc',
    'duration_ms',
    'track_artwork_url',
    'preview_url',
    'release_title',
    'release_artwork_url',
    'release_date',
    'release_date_precision',
    'label_name',
    'imprint_name',
    'genre',
    'track_number',
    'disc_number',
    'explicit',
    'upc',
    'copyright_text'
  ];
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  if not exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    where suggestion.id = p_suggestion_id
      and suggestion.status = 'needs_review'
  ) then
    raise exception
      'Only Track Intake items awaiting review can be enriched.';
  end if;

  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    raise exception
      'Accepted enrichment fields must be a JSON object.';
  end if;

  for v_field in
    select entry.key, entry.value
    from jsonb_each(p_fields) entry
  loop
    if not (v_field.key = any(v_allowed)) then
      raise exception
        'Unsupported accepted Track Intake field: %',
        v_field.key;
    end if;

    if v_field.value = 'null'::jsonb then
      delete from public.registry_enrichment_suggestions suggestion
      where suggestion.registry_entity_type = 'track'
        and suggestion.registry_entity_id =
          p_suggestion_id::text
        and suggestion.field_name = v_field.key
        and suggestion.decision_status in (
          'draft',
          'approved'
        );
      continue;
    end if;

    v_value :=
      case jsonb_typeof(v_field.value)
        when 'string' then v_field.value #>> '{}'
        else v_field.value::text
      end;

    if nullif(btrim(v_value), '') is null then
      continue;
    end if;

    delete from public.registry_enrichment_suggestions suggestion
    where suggestion.registry_entity_type = 'track'
      and suggestion.registry_entity_id =
        p_suggestion_id::text
      and suggestion.field_name = v_field.key
      and suggestion.decision_status in (
        'draft',
        'approved'
      );

    insert into public.registry_enrichment_suggestions (
      registry_entity_type,
      registry_entity_id,
      field_name,
      current_value,
      suggested_value,
      provider_item_id,
      confidence_score,
      decision_status,
      decision_reason,
      created_at,
      updated_at
    )
    values (
      'track',
      p_suggestion_id::text,
      v_field.key,
      null,
      v_value,
      p_suggestion_id::text,
      1.0000,
      'approved',
      nullif(btrim(p_reason), ''),
      now(),
      now()
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'suggestion_id', p_suggestion_id,
    'accepted_field_count', v_count
  );
end;
$function$;

revoke all
on function public.admin_save_registry_track_intake_enrichment(
  uuid, jsonb, text
)
from public, anon, service_role;

grant execute
on function public.admin_save_registry_track_intake_enrichment(
  uuid, jsonb, text
)
to authenticated;

create or replace function public.admin_resolve_registry_track_intake_enriched(
  p_suggestion_id uuid,
  p_registry_track_id uuid,
  p_review_note text default null,
  p_allow_overwrite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public'
as $function$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_track public.registry_tracks%rowtype;
  v_release public.registry_releases%rowtype;
  v_fields jsonb := '{}'::jsonb;
  v_result jsonb;
  v_label_id uuid;
  v_label_name text;
  v_before jsonb;
  v_after jsonb;
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Track Intake item does not exist.';
  end if;

  if v_suggestion.status <> 'needs_review' then
    raise exception
      'Only Track Intake items awaiting review can be resolved.';
  end if;

  if v_suggestion.canonical_track_id is not null
     and v_suggestion.canonical_track_id <> p_registry_track_id
  then
    raise exception
      'This Track Intake item already has canonical Registry identity. Enrichment review cannot silently remap it to another track.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id = p_registry_track_id
    and track.status = 'active'
  for update;

  if not found then
    raise exception
      'Selected Music Registry track is unavailable.';
  end if;

  select coalesce(
    jsonb_object_agg(
      suggestion.field_name,
      suggestion.suggested_value
    ),
    '{}'::jsonb
  )
  into v_fields
  from public.registry_enrichment_suggestions suggestion
  where suggestion.registry_entity_type = 'track'
    and suggestion.registry_entity_id =
      p_suggestion_id::text
    and suggestion.decision_status = 'approved';

  if not p_allow_overwrite then
    if v_fields ? 'isrc'
       and v_track.isrc is not null
       and v_track.isrc is distinct from
         nullif(btrim(v_fields ->> 'isrc'), '')
    then
      raise exception
        'Accepted ISRC conflicts with the canonical track. Review the conflict before replacing it.';
    end if;

    if v_fields ? 'duration_ms'
       and v_track.duration_ms is not null
       and v_track.duration_ms is distinct from
         nullif(v_fields ->> 'duration_ms', '')::integer
    then
      raise exception
        'Accepted duration conflicts with the canonical track. Review the conflict before replacing it.';
    end if;

    if v_fields ? 'track_artwork_url'
       and v_track.artwork_url is not null
       and v_track.artwork_url is distinct from
         nullif(btrim(v_fields ->> 'track_artwork_url'), '')
    then
      raise exception
        'Accepted artwork conflicts with the canonical track. Review the conflict before replacing it.';
    end if;
  end if;

  v_before := jsonb_build_object(
    'track',
      jsonb_build_object(
        'isrc', v_track.isrc,
        'duration_ms', v_track.duration_ms,
        'artwork_url', v_track.artwork_url,
        'preview_url', v_track.preview_url,
        'track_number', v_track.track_number,
        'disc_number', v_track.disc_number,
        'explicit', v_track.explicit,
        'metadata', v_track.metadata
      )
  );

  update public.registry_tracks track
  set
    isrc =
      case
        when v_fields ? 'isrc'
        then nullif(btrim(v_fields ->> 'isrc'), '')
        else track.isrc
      end,
    duration_ms =
      case
        when v_fields ? 'duration_ms'
        then nullif(v_fields ->> 'duration_ms', '')::integer
        else track.duration_ms
      end,
    artwork_url =
      case
        when v_fields ? 'track_artwork_url'
        then nullif(
          btrim(v_fields ->> 'track_artwork_url'),
          ''
        )
        else track.artwork_url
      end,
    preview_url =
      case
        when v_fields ? 'preview_url'
        then nullif(btrim(v_fields ->> 'preview_url'), '')
        else track.preview_url
      end,
    track_number =
      case
        when v_fields ? 'track_number'
        then nullif(v_fields ->> 'track_number', '')::integer
        else track.track_number
      end,
    disc_number =
      case
        when v_fields ? 'disc_number'
        then nullif(v_fields ->> 'disc_number', '')::integer
        else track.disc_number
      end,
    explicit =
      case
        when v_fields ? 'explicit'
        then nullif(v_fields ->> 'explicit', '')::boolean
        else track.explicit
      end,
    metadata =
      coalesce(track.metadata, '{}'::jsonb)
      || jsonb_strip_nulls(
        jsonb_build_object(
          'provider_genre',
            nullif(btrim(v_fields ->> 'genre'), ''),
          'track_intake_enriched_at',
            now()
        )
      ),
    updated_at = now()
  where track.id = p_registry_track_id
  returning track.*
  into v_track;

  if v_track.release_id is not null then
    select release.*
    into v_release
    from public.registry_releases release
    where release.id = v_track.release_id
    for update;

    if found then
      if not p_allow_overwrite then
        if v_fields ? 'release_date'
           and v_release.release_date is not null
           and v_release.release_date is distinct from
             (v_fields ->> 'release_date')::date
        then
          raise exception
            'Accepted release date conflicts with the canonical release. Review the conflict before replacing it.';
        end if;

        if v_fields ? 'release_title'
           and nullif(btrim(v_release.title), '') is not null
           and v_release.title is distinct from
             nullif(btrim(v_fields ->> 'release_title'), '')
        then
          raise exception
            'Accepted release title conflicts with the canonical release. Review the conflict before replacing it.';
        end if;
      end if;

      v_label_name :=
        nullif(btrim(v_fields ->> 'label_name'), '');

      if v_label_name is not null
         and v_release.label_id is null
      then
        select label.id
        into v_label_id
        from public.registry_labels label
        where label.status in ('active', 'draft')
          and (
            lower(btrim(label.name)) =
              lower(v_label_name)
            or lower(btrim(label.normalized_name)) =
              lower(v_label_name)
          )
        order by
          case when label.status = 'active' then 0 else 1 end,
          label.created_at
        limit 1;
      end if;

      update public.registry_releases release
      set
        title =
          case
            when v_fields ? 'release_title'
            then nullif(
              btrim(v_fields ->> 'release_title'),
              ''
            )
            else release.title
          end,
        normalized_title =
          case
            when v_fields ? 'release_title'
            then trim(
              regexp_replace(
                lower(
                  nullif(
                    btrim(v_fields ->> 'release_title'),
                    ''
                  )
                ),
                '[^[:alnum:]]+',
                ' ',
                'g'
              )
            )
            else release.normalized_title
          end,
        release_date =
          case
            when v_fields ? 'release_date'
            then (v_fields ->> 'release_date')::date
            else release.release_date
          end,
        release_date_precision =
          case
            when v_fields ? 'release_date_precision'
            then nullif(
              btrim(v_fields ->> 'release_date_precision'),
              ''
            )
            else release.release_date_precision
          end,
        artwork_url =
          case
            when v_fields ? 'release_artwork_url'
            then nullif(
              btrim(v_fields ->> 'release_artwork_url'),
              ''
            )
            else release.artwork_url
          end,
        upc =
          case
            when v_fields ? 'upc'
            then nullif(btrim(v_fields ->> 'upc'), '')
            else release.upc
          end,
        label_id =
          coalesce(v_label_id, release.label_id),
        metadata =
          coalesce(release.metadata, '{}'::jsonb)
          || jsonb_strip_nulls(
            jsonb_build_object(
              'label_name_observation',
                case
                  when v_label_name is not null
                       and v_label_id is null
                  then v_label_name
                  else null
                end,
              'imprint_name',
                nullif(
                  btrim(v_fields ->> 'imprint_name'),
                  ''
                ),
              'copyright_text',
                nullif(
                  btrim(v_fields ->> 'copyright_text'),
                  ''
                ),
              'provider_genre',
                nullif(btrim(v_fields ->> 'genre'), ''),
              'track_intake_enriched_at',
                now()
            )
          ),
        updated_at = now()
      where release.id = v_track.release_id;
    end if;
  end if;

  select public.admin_resolve_registry_track_intake(
    p_suggestion_id,
    p_registry_track_id,
    p_review_note
  )
  into v_result;

  insert into public.provider_entity_links (
    registry_entity_type,
    registry_entity_id,
    provider,
    provider_entity_id,
    provider_url,
    match_status,
    confidence_score,
    created_at,
    updated_at
  )
  select
    'track',
    p_registry_track_id::text,
    link.provider,
    link.provider_entity_id,
    link.provider_url,
    'confirmed',
    link.confidence_score,
    now(),
    now()
  from public.provider_entity_links link
  where link.registry_entity_type = 'track'
    and link.registry_entity_id =
      p_suggestion_id::text
    and not exists (
      select 1
      from public.provider_entity_links canonical_link
      where canonical_link.registry_entity_type = 'track'
        and canonical_link.registry_entity_id =
          p_registry_track_id::text
        and canonical_link.provider = link.provider
        and canonical_link.provider_entity_id =
          link.provider_entity_id
    );

  select jsonb_build_object(
    'track',
      jsonb_build_object(
        'isrc', track.isrc,
        'duration_ms', track.duration_ms,
        'artwork_url', track.artwork_url,
        'preview_url', track.preview_url,
        'track_number', track.track_number,
        'disc_number', track.disc_number,
        'explicit', track.explicit,
        'metadata', track.metadata
      )
  )
  into v_after
  from public.registry_tracks track
  where track.id = p_registry_track_id;

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
    error_message,
    actor,
    created_at
  )
  values (
    'track',
    p_registry_track_id::text,
    p_suggestion_id::text,
    'registry_provider_track_suggestions',
    'track_intake_enrichment',
    'registry_tracks',
    v_before,
    v_after,
    'apply_enrichment',
    'applied',
    null,
    auth.uid()::text,
    now()
  );

  return coalesce(v_result, '{}'::jsonb)
    || jsonb_build_object(
      'enrichment_applied', v_fields,
      'label_linked', v_label_id is not null
    );
end;
$function$;

revoke all
on function public.admin_resolve_registry_track_intake_enriched(
  uuid, uuid, text, boolean
)
from public, anon, service_role;

grant execute
on function public.admin_resolve_registry_track_intake_enriched(
  uuid, uuid, text, boolean
)
to authenticated;

-- The review UI must use the enriched resolution path. Keep the old function
-- callable internally by the enriched wrapper but remove it from direct
-- authenticated use.
revoke execute
on function public.admin_resolve_registry_track_intake(
  uuid, uuid, text
)
from authenticated;

-- Force deferred constraint triggers before the final COMMIT. This makes the
-- pre-deploy rollback gate exercise the same commit-time integrity checks that
-- production will execute.
set constraints all immediate;

commit;
