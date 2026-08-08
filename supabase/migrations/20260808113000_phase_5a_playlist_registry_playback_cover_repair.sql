-- Phase 5A Migration 213: Registry-first Playlist intake, playback validation,
-- and prepared cover repair.
--
-- Forward repair after immutable M212. It does not edit migration history.
--
-- Product invariants:
-- 1. Playlist never creates track or artist identity.
-- 2. Every new active Playlist item resolves to one canonical Registry track.
-- 3. Provider URLs are playback evidence, never canonical music identity.
-- 4. External playback is server-validated before a Playlist can consume it.
-- 5. Missing Registry entities become Registry suggestions, not Playlist rows.
-- 6. Existing pre-M213 external draft rows are preserved but block review until resolved.
-- 7. Any canonical Media image may be chosen as source for a prepared Playlist-cover
--    variant; the prepared derivative can be attached while the Playlist is still draft.
-- 8. Video playback is represented alongside audio so mixed Playlists are not designed out.

begin;

do $phase_5a_m213_preflight$
begin
  if to_regclass('public.wk_playlists') is null
     or to_regclass('public.wk_playlist_items') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('media.assets') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('public.registry_media_assets') is null
  then
    raise exception
      'STOP: Phase 5A Playlist or Media authority required by M213 is incomplete';
  end if;

  if to_regprocedure(
       'public.add_playlist_item(uuid,bigint,text,uuid,text,text,text,text,text[],text,uuid)'
     ) is null
     or to_regprocedure(
       'public.set_playlist_cover(uuid,bigint,uuid,text,jsonb,text,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.current_user_can_edit_playlist(uuid)'
     ) is null
  then
    raise exception
      'STOP: M209/M212 Playlist command authority is incomplete';
  end if;

  if to_regclass('platform_private.playlist_playback_validations') is not null
     or to_regclass('public.registry_provider_track_suggestions') is not null
     or to_regprocedure(
       'public.add_playlist_validated_provider_track(uuid,bigint,uuid,uuid,text,uuid)'
     ) is not null
  then
    raise exception
      'STOP: One or more M213 authorities already exist';
  end if;
end;
$phase_5a_m213_preflight$;

create table platform_private.playlist_playback_validations (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null,
  playlist_id uuid not null,
  provider_key text not null,
  provider_object_id text not null,
  provider_url text not null,
  canonical_url text not null,
  playback_kind text not null,
  embed_url text,
  preview_url text,
  playable boolean not null,
  validation_status text not null,
  title_hint text,
  artist_names_hint text[] not null default '{}'::text[],
  release_title_hint text,
  artwork_url text,
  provider_metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  correlation_id uuid not null,

  constraint playlist_playback_validations_requested_by_fkey
    foreign key (requested_by)
    references auth.users(id)
    on delete cascade,

  constraint playlist_playback_validations_playlist_fkey
    foreign key (playlist_id)
    references public.wk_playlists(id)
    on delete cascade,

  constraint playlist_playback_validations_provider_key_check
    check (
      provider_key = lower(provider_key)
      and provider_key ~ '^[a-z0-9_]+$'
    ),

  constraint playlist_playback_validations_kind_check
    check (playback_kind in ('audio', 'video')),

  constraint playlist_playback_validations_status_check
    check (
      validation_status in (
        'probe_required',
        'playable',
        'unplayable',
        'error'
      )
    ),

  constraint playlist_playback_validations_metadata_check
    check (jsonb_typeof(provider_metadata) = 'object'),

  constraint playlist_playback_validations_expiry_check
    check (expires_at > checked_at)
);

create index playlist_playback_validations_actor_playlist_idx
  on platform_private.playlist_playback_validations (
    requested_by,
    playlist_id,
    checked_at desc
  );

create index playlist_playback_validations_expiry_idx
  on platform_private.playlist_playback_validations (expires_at);

revoke all
on platform_private.playlist_playback_validations
from public, anon, authenticated;

grant select, insert, update, delete
on platform_private.playlist_playback_validations
to service_role;

create table public.registry_provider_track_suggestions (
  id uuid primary key default gen_random_uuid(),
  source_playlist_id uuid not null,
  source_playlist_item_id uuid,
  requested_by uuid,
  canonical_track_id uuid,
  registry_artist_id uuid,
  artist_resolution_mode text not null default 'unresolved',
  provider_key text not null,
  provider_object_id text not null,
  provider_url text not null,
  provider_title text,
  provider_artist_names text[] not null default '{}'::text[],
  provider_release_title text,
  playback_kind text not null,
  validation_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'needs_review',
  canonicalized_track_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registry_provider_track_suggestions_playlist_fkey
    foreign key (source_playlist_id)
    references public.wk_playlists(id)
    on delete restrict,

  constraint registry_provider_track_suggestions_item_fkey
    foreign key (source_playlist_item_id)
    references public.wk_playlist_items(id)
    on delete set null,

  constraint registry_provider_track_suggestions_requested_by_fkey
    foreign key (requested_by)
    references auth.users(id)
    on delete set null,

  constraint registry_provider_track_suggestions_track_fkey
    foreign key (canonical_track_id)
    references public.registry_tracks(id)
    on delete set null,

  constraint registry_provider_track_suggestions_artist_fkey
    foreign key (registry_artist_id)
    references public.registry_artists(id)
    on delete set null,

  constraint registry_provider_track_suggestions_canonicalized_track_fkey
    foreign key (canonicalized_track_id)
    references public.registry_tracks(id)
    on delete set null,

  constraint registry_provider_track_suggestions_reviewed_by_fkey
    foreign key (reviewed_by)
    references auth.users(id)
    on delete set null,

  constraint registry_provider_track_suggestions_artist_mode_check
    check (
      artist_resolution_mode in (
        'existing_track',
        'existing_artist',
        'alias_candidate',
        'new_artist',
        'unresolved'
      )
    ),

  constraint registry_provider_track_suggestions_playback_kind_check
    check (playback_kind in ('audio', 'video')),

  constraint registry_provider_track_suggestions_status_check
    check (
      status in (
        'needs_review',
        'accepted',
        'rejected',
        'canonicalized'
      )
    ),

  constraint registry_provider_track_suggestions_snapshot_check
    check (jsonb_typeof(validation_snapshot) = 'object')
);

comment on table public.registry_provider_track_suggestions is
  'Registry-owned intake queue for provider evidence surfaced by Playlist editors. Suggestions are not canonical Registry identity.';

alter table public.registry_provider_track_suggestions enable row level security;

revoke insert, update, delete, truncate, references, trigger
on public.registry_provider_track_suggestions
from public, anon, authenticated;

grant select
on public.registry_provider_track_suggestions
to authenticated;

grant all
on public.registry_provider_track_suggestions
to service_role;

create policy registry_provider_track_suggestions_read
on public.registry_provider_track_suggestions
for select
to authenticated
using (
  requested_by = auth.uid()
  or public.current_user_is_administrator()
  or public.current_user_has_capability('manage_registry')
);

create or replace function public.current_user_can_edit_playlist_id(
  p_playlist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select coalesce(
    (
      select editorial.current_user_can_edit_playlist(binding.resource_id)
      from editorial.playlist_resources binding
      where binding.playlist_id = p_playlist_id
    ),
    false
  );
$function$;

revoke all
on function public.current_user_can_edit_playlist_id(uuid)
from public, anon, service_role;

grant execute
on function public.current_user_can_edit_playlist_id(uuid)
to authenticated;

create or replace function public.record_playlist_playback_validation(
  p_requested_by uuid,
  p_playlist_id uuid,
  p_provider_key text,
  p_provider_object_id text,
  p_provider_url text,
  p_canonical_url text,
  p_playback_kind text,
  p_embed_url text,
  p_preview_url text,
  p_title_hint text,
  p_artist_names_hint text[],
  p_release_title_hint text,
  p_artwork_url text,
  p_provider_metadata jsonb,
  p_expires_at timestamptz,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'platform_private'
as $function$
declare
  v_id uuid := gen_random_uuid();
begin
  if p_requested_by is null
     or p_playlist_id is null
     or nullif(btrim(p_provider_key), '') is null
     or nullif(btrim(p_provider_object_id), '') is null
     or nullif(btrim(p_provider_url), '') is null
     or nullif(btrim(p_canonical_url), '') is null
     or p_playback_kind not in ('audio', 'video')
     or p_expires_at is null
     or p_expires_at <= now()
  then
    raise exception
      'Complete playable provider validation is required';
  end if;

  if not exists (
    select 1
    from public.wk_playlists playlist
    where playlist.id = p_playlist_id
  ) then
    raise exception 'Playlist does not exist';
  end if;

  insert into platform_private.playlist_playback_validations (
    id,
    requested_by,
    playlist_id,
    provider_key,
    provider_object_id,
    provider_url,
    canonical_url,
    playback_kind,
    embed_url,
    preview_url,
    playable,
    validation_status,
    title_hint,
    artist_names_hint,
    release_title_hint,
    artwork_url,
    provider_metadata,
    checked_at,
    expires_at,
    correlation_id
  )
  values (
    v_id,
    p_requested_by,
    p_playlist_id,
    lower(btrim(p_provider_key)),
    btrim(p_provider_object_id),
    btrim(p_provider_url),
    btrim(p_canonical_url),
    p_playback_kind,
    nullif(btrim(p_embed_url), ''),
    nullif(btrim(p_preview_url), ''),
    true,
    'playable',
    nullif(btrim(p_title_hint), ''),
    coalesce(p_artist_names_hint, '{}'::text[]),
    nullif(btrim(p_release_title_hint), ''),
    nullif(btrim(p_artwork_url), ''),
    coalesce(p_provider_metadata, '{}'::jsonb),
    now(),
    p_expires_at,
    coalesce(p_correlation_id, gen_random_uuid())
  );

  return v_id;
end;
$function$;

revoke all
on function public.record_playlist_playback_validation(
  uuid, uuid, text, text, text, text, text, text, text,
  text, text[], text, text, jsonb, timestamptz, uuid
)
from public, anon, authenticated;

grant execute
on function public.record_playlist_playback_validation(
  uuid, uuid, text, text, text, text, text, text, text,
  text, text[], text, text, jsonb, timestamptz, uuid
)
to service_role;


create or replace function public.record_playlist_playback_probe_candidate(
  p_requested_by uuid,
  p_playlist_id uuid,
  p_provider_key text,
  p_provider_object_id text,
  p_provider_url text,
  p_canonical_url text,
  p_playback_kind text,
  p_embed_url text,
  p_title_hint text,
  p_artist_names_hint text[],
  p_artwork_url text,
  p_provider_metadata jsonb,
  p_expires_at timestamptz,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'platform_private'
as $function$
declare
  v_id uuid := gen_random_uuid();
begin
  if p_requested_by is null
     or p_playlist_id is null
     or nullif(btrim(p_provider_key), '') is null
     or nullif(btrim(p_provider_object_id), '') is null
     or nullif(btrim(p_provider_url), '') is null
     or nullif(btrim(p_canonical_url), '') is null
     or p_playback_kind not in ('audio', 'video')
     or p_expires_at is null
     or p_expires_at <= now()
  then
    raise exception
      'Complete browser playback probe metadata is required';
  end if;

  if not exists (
    select 1
    from public.wk_playlists playlist
    where playlist.id = p_playlist_id
  ) then
    raise exception 'Playlist does not exist';
  end if;

  insert into platform_private.playlist_playback_validations (
    id,
    requested_by,
    playlist_id,
    provider_key,
    provider_object_id,
    provider_url,
    canonical_url,
    playback_kind,
    embed_url,
    preview_url,
    playable,
    validation_status,
    title_hint,
    artist_names_hint,
    release_title_hint,
    artwork_url,
    provider_metadata,
    checked_at,
    expires_at,
    correlation_id
  )
  values (
    v_id,
    p_requested_by,
    p_playlist_id,
    lower(btrim(p_provider_key)),
    btrim(p_provider_object_id),
    btrim(p_provider_url),
    btrim(p_canonical_url),
    p_playback_kind,
    nullif(btrim(p_embed_url), ''),
    null,
    false,
    'probe_required',
    nullif(btrim(p_title_hint), ''),
    coalesce(p_artist_names_hint, '{}'::text[]),
    null,
    nullif(btrim(p_artwork_url), ''),
    coalesce(p_provider_metadata, '{}'::jsonb),
    now(),
    p_expires_at,
    coalesce(p_correlation_id, gen_random_uuid())
  );

  return v_id;
end;
$function$;

revoke all
on function public.record_playlist_playback_probe_candidate(
  uuid, uuid, text, text, text, text, text, text,
  text, text[], text, jsonb, timestamptz, uuid
)
from public, anon, authenticated;

grant execute
on function public.record_playlist_playback_probe_candidate(
  uuid, uuid, text, text, text, text, text, text,
  text, text[], text, jsonb, timestamptz, uuid
)
to service_role;

create or replace function public.confirm_playlist_playback_validation(
  p_validation_id uuid,
  p_requested_by uuid,
  p_playlist_id uuid,
  p_probe_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'platform_private'
as $function$
declare
  v_validation
    platform_private.playlist_playback_validations%rowtype;
begin
  select validation.*
  into v_validation
  from platform_private.playlist_playback_validations validation
  where validation.id = p_validation_id
    and validation.requested_by = p_requested_by
    and validation.playlist_id = p_playlist_id
  for update;

  if not found then
    raise exception
      'Playback probe candidate does not exist for this editor and Playlist';
  end if;

  if v_validation.validation_status = 'playable'
     and v_validation.playable
     and v_validation.expires_at > now()
  then
    return jsonb_build_object(
      'validation_id', v_validation.id,
      'validation_status', 'playable',
      'playback_kind', v_validation.playback_kind,
      'expires_at', v_validation.expires_at,
      'idempotent_replay', true
    );
  end if;

  if v_validation.validation_status <> 'probe_required'
     or v_validation.playable
     or v_validation.expires_at <= now()
  then
    raise exception
      'Playback probe candidate is no longer confirmable';
  end if;

  if p_probe_metadata is null
     or jsonb_typeof(p_probe_metadata) <> 'object'
     or p_probe_metadata ->> 'result' <> 'iframe_cued'
  then
    raise exception
      'Confirmed browser playback probe result is required';
  end if;

  update platform_private.playlist_playback_validations validation
  set
    playable = true,
    validation_status = 'playable',
    checked_at = now(),
    expires_at = now() + interval '30 minutes',
    provider_metadata =
      coalesce(validation.provider_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'browser_probe',
        p_probe_metadata
      )
  where validation.id = v_validation.id
  returning validation.*
  into v_validation;

  return jsonb_build_object(
    'validation_id', v_validation.id,
    'validation_status', v_validation.validation_status,
    'playback_kind', v_validation.playback_kind,
    'expires_at', v_validation.expires_at,
    'idempotent_replay', false
  );
end;
$function$;

revoke all
on function public.confirm_playlist_playback_validation(
  uuid, uuid, uuid, jsonb
)
from public, anon, authenticated;

grant execute
on function public.confirm_playlist_playback_validation(
  uuid, uuid, uuid, jsonb
)
to service_role;

create or replace function editorial.guard_new_playlist_item_registry_identity()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  if new.lifecycle_state = 'active'
     and new.registry_track_id is null
     and (
       tg_op = 'INSERT'
       or old.registry_track_id is not null
     )
  then
    raise exception
      using
        errcode = '23514',
        message =
          'Playlist items must resolve to a canonical Music Registry track. Send missing music to Registry intake instead.';
  end if;

  return new;
end;
$function$;

create trigger playlist_item_registry_identity_guard
before insert or update of registry_track_id, lifecycle_state
on public.wk_playlist_items
for each row
execute function editorial.guard_new_playlist_item_registry_identity();

create or replace function editorial.guard_playlist_review_registry_integrity()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.status is distinct from old.status
     and new.status in (
       'ready_for_review',
       'in_review',
       'approved',
       'scheduled',
       'published'
     )
  then
    if exists (
      select 1
      from public.wk_playlist_items item
      where item.playlist_id = new.id
        and item.lifecycle_state = 'active'
        and item.registry_track_id is null
    ) then
      raise exception
        using
          errcode = '23514',
          message =
            'Resolve every Playlist item to the Music Registry before review.';
    end if;

    if exists (
      select 1
      from public.wk_playlist_items item
      where item.playlist_id = new.id
        and item.lifecycle_state = 'active'
        and item.provider_url is not null
        and coalesce(
              item.normalization_payload
                #>> '{playback,validation_status}',
              ''
            ) <> 'playable'
    ) then
      raise exception
        using
          errcode = '23514',
          message =
            'Validate every external playback source before review.';
    end if;
  end if;

  return new;
end;
$function$;

create trigger playlist_review_registry_integrity_guard
before update of status
on public.wk_playlists
for each row
execute function editorial.guard_playlist_review_registry_integrity();

create or replace function public.add_playlist_validated_provider_track(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_registry_track_id uuid,
  p_validation_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial',
  'platform_private'
as $function$
declare
  v_validation platform_private.playlist_playback_validations%rowtype;
  v_added record;
  v_item public.wk_playlist_items%rowtype;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not public.current_user_can_edit_playlist_id(p_playlist_id) then
    raise exception
      using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  select validation.*
  into v_validation
  from platform_private.playlist_playback_validations validation
  where validation.id = p_validation_id
    and validation.requested_by = auth.uid()
    and validation.playlist_id = p_playlist_id
    and validation.playable
    and validation.validation_status = 'playable'
    and validation.expires_at > now();

  if not found then
    raise exception
      using
        errcode = '22023',
        message =
          'Playback validation is missing, expired, or not playable. Check the link again.';
  end if;

  if not exists (
    select 1
    from public.registry_tracks track
    where track.id = p_registry_track_id
      and track.status = 'active'
  ) then
    raise exception
      using
        errcode = '22023',
        message = 'Select an active Music Registry track.';
  end if;

  select *
  into v_added
  from public.add_playlist_item(
    p_playlist_id => p_playlist_id,
    p_expected_authority_revision => p_expected_authority_revision,
    p_idempotency_key => p_idempotency_key,
    p_registry_track_id => p_registry_track_id,
    p_provider_key => v_validation.provider_key,
    p_provider_track_id => v_validation.provider_object_id,
    p_provider_url => v_validation.canonical_url,
    p_title => null,
    p_artist_names => '{}'::text[],
    p_release_title => null,
    p_correlation_id => v_correlation_id
  );

  if v_added.playlist_item_id is not null then
    update public.wk_playlist_items item
    set
      normalization_payload =
        coalesce(item.normalization_payload, '{}'::jsonb)
        || jsonb_build_object(
          'playback',
          jsonb_build_object(
            'validation_id', v_validation.id,
            'validation_status', 'playable',
            'playback_kind', v_validation.playback_kind,
            'provider_key', v_validation.provider_key,
            'provider_object_id', v_validation.provider_object_id,
            'provider_url', v_validation.canonical_url,
            'embed_url', v_validation.embed_url,
            'preview_url', v_validation.preview_url,
            'validated_at', v_validation.checked_at,
            'validation_expires_at', v_validation.expires_at
          )
        ),
      artwork_url = coalesce(item.artwork_url, v_validation.artwork_url)
    where item.id = v_added.playlist_item_id
    returning item.*
    into v_item;

    if not exists (
      select 1
      from public.registry_provider_track_suggestions suggestion
      where suggestion.canonical_track_id = p_registry_track_id
        and suggestion.provider_key = v_validation.provider_key
        and suggestion.provider_object_id = v_validation.provider_object_id
        and suggestion.status = 'needs_review'
    ) then
      insert into public.registry_provider_track_suggestions (
        source_playlist_id,
        source_playlist_item_id,
        requested_by,
        canonical_track_id,
        artist_resolution_mode,
        provider_key,
        provider_object_id,
        provider_url,
        provider_title,
        provider_artist_names,
        provider_release_title,
        playback_kind,
        validation_snapshot,
        status
      )
      values (
        p_playlist_id,
        v_added.playlist_item_id,
        auth.uid(),
        p_registry_track_id,
        'existing_track',
        v_validation.provider_key,
        v_validation.provider_object_id,
        v_validation.canonical_url,
        v_validation.title_hint,
        v_validation.artist_names_hint,
        v_validation.release_title_hint,
        v_validation.playback_kind,
        jsonb_build_object(
          'validation_id', v_validation.id,
          'embed_url', v_validation.embed_url,
          'preview_url', v_validation.preview_url,
          'artwork_url', v_validation.artwork_url,
          'provider_metadata', v_validation.provider_metadata,
          'checked_at', v_validation.checked_at
        ),
        'needs_review'
      );
    end if;
  end if;

  return jsonb_build_object(
    'command_receipt_id', v_added.command_receipt_id,
    'receipt_status', v_added.receipt_status,
    'playlist_id', p_playlist_id,
    'playlist_item_id', v_added.playlist_item_id,
    'authority_revision', v_added.authority_revision,
    'duplicate_warning',
      coalesce(
        (v_added.result_payload ->> 'duplicate_warning')::boolean,
        false
      ),
    'duplicate_item_ids',
      coalesce(
        v_added.result_payload -> 'duplicate_item_ids',
        '[]'::jsonb
      ),
    'playback_kind', v_validation.playback_kind,
    'validation_id', v_validation.id
  );
end;
$function$;

revoke all
on function public.add_playlist_validated_provider_track(
  uuid, bigint, uuid, uuid, text, uuid
)
from public, anon, service_role;

grant execute
on function public.add_playlist_validated_provider_track(
  uuid, bigint, uuid, uuid, text, uuid
)
to authenticated;

create or replace function public.create_registry_track_intake_suggestion(
  p_playlist_id uuid,
  p_validation_id uuid,
  p_artist_resolution_mode text,
  p_registry_artist_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'platform_private'
as $function$
declare
  v_validation platform_private.playlist_playback_validations%rowtype;
  v_suggestion_id uuid := gen_random_uuid();
  v_mode text := lower(btrim(coalesce(p_artist_resolution_mode, '')));
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not public.current_user_can_edit_playlist_id(p_playlist_id) then
    raise exception
      using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  select validation.*
  into v_validation
  from platform_private.playlist_playback_validations validation
  where validation.id = p_validation_id
    and validation.requested_by = auth.uid()
    and validation.playlist_id = p_playlist_id
    and validation.playable
    and validation.validation_status = 'playable'
    and validation.expires_at > now();

  if not found then
    raise exception
      'Playback validation is missing or expired. Check the provider link again.';
  end if;

  if v_mode not in (
    'existing_artist',
    'alias_candidate',
    'new_artist',
    'unresolved'
  ) then
    raise exception
      'Artist resolution must use Registry identity, an alias candidate, a new-artist suggestion, or remain unresolved.';
  end if;

  if v_mode in ('existing_artist', 'alias_candidate') then
    if p_registry_artist_id is null
       or not exists (
         select 1
         from public.registry_artists artist
         where artist.id = p_registry_artist_id
           and artist.status in ('active', 'draft')
       )
    then
      raise exception
        'Select a Music Registry artist for this resolution.';
    end if;
  elsif p_registry_artist_id is not null then
    raise exception
      'New-artist and unresolved suggestions cannot claim an existing Registry artist.';
  end if;

  insert into public.registry_provider_track_suggestions (
    id,
    source_playlist_id,
    requested_by,
    canonical_track_id,
    registry_artist_id,
    artist_resolution_mode,
    provider_key,
    provider_object_id,
    provider_url,
    provider_title,
    provider_artist_names,
    provider_release_title,
    playback_kind,
    validation_snapshot,
    status
  )
  values (
    v_suggestion_id,
    p_playlist_id,
    auth.uid(),
    null,
    p_registry_artist_id,
    v_mode,
    v_validation.provider_key,
    v_validation.provider_object_id,
    v_validation.canonical_url,
    v_validation.title_hint,
    v_validation.artist_names_hint,
    v_validation.release_title_hint,
    v_validation.playback_kind,
    jsonb_build_object(
      'validation_id', v_validation.id,
      'embed_url', v_validation.embed_url,
      'preview_url', v_validation.preview_url,
      'artwork_url', v_validation.artwork_url,
      'provider_metadata', v_validation.provider_metadata,
      'checked_at', v_validation.checked_at
    ),
    'needs_review'
  );

  return jsonb_build_object(
    'suggestion_id', v_suggestion_id,
    'status', 'needs_review',
    'playlist_changed', false
  );
end;
$function$;

revoke all
on function public.create_registry_track_intake_suggestion(
  uuid, uuid, text, uuid
)
from public, anon, service_role;

grant execute
on function public.create_registry_track_intake_suggestion(
  uuid, uuid, text, uuid
)
to authenticated;

create or replace function public.get_playlist_cover_source(
  p_playlist_id uuid,
  p_asset_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'media'
as $function$
declare
  v_asset media.assets%rowtype;
  v_file media.file_objects%rowtype;
  v_compatibility public.registry_media_assets%rowtype;
begin
  if not public.current_user_can_edit_playlist_id(p_playlist_id) then
    raise exception
      using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  select asset.*
  into v_asset
  from media.assets asset
  where asset.id = p_asset_id
    and asset.lifecycle_state = 'active';

  if not found or v_asset.current_revision_id is null then
    raise exception 'Selected Media image is unavailable.';
  end if;

  select file_object.*
  into v_file
  from media.asset_revisions revision
  join media.file_objects file_object
    on file_object.id = revision.original_file_object_id
  where revision.id = v_asset.current_revision_id
    and revision.asset_id = p_asset_id
    and file_object.verification_state = 'verified'
    and lower(coalesce(file_object.mime_type, '')) like 'image/%';

  if not found or nullif(btrim(v_file.delivery_url), '') is null then
    raise exception 'Selected Media item does not have a reachable verified image.';
  end if;

  select compatibility.*
  into v_compatibility
  from public.registry_media_assets compatibility
  where compatibility.id = p_asset_id;

  return jsonb_build_object(
    'asset_id', p_asset_id,
    'asset_revision_id', v_asset.current_revision_id,
    'url', v_file.delivery_url,
    'mime_type', v_file.mime_type,
    'title', coalesce(v_compatibility.title, 'Playlist cover source')
  );
end;
$function$;

revoke all
on function public.get_playlist_cover_source(uuid, uuid)
from public, anon, service_role;

grant execute
on function public.get_playlist_cover_source(uuid, uuid)
to authenticated;

-- M212 cover command is retained, but prepared Playlist-cover variants can now
-- be attached to a mutable draft before publication governance is complete.

create or replace function public.set_playlist_cover(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_asset_id uuid,
  p_idempotency_key text,
  p_placement_data jsonb default '{}'::jsonb,
  p_alt_text_snapshot text default null,
  p_caption_snapshot text default null,
  p_credit_snapshot text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  cover_usage_link_id uuid,
  cover_asset_id uuid,
  cover_asset_revision_id uuid,
  cover_url text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial',
  'media',
  'platform_private'
as $function$
declare
  v_actor record;
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_begin record;
  v_read record;
  v_current_usage media.usage_links%rowtype;
  v_current_count bigint;
  v_asset media.assets%rowtype;
  v_governance media.asset_governance_versions%rowtype;
  v_file media.file_objects%rowtype;
  v_compatibility public.registry_media_assets%rowtype;
  v_is_prepared_variant boolean := false;
  v_correlation_id uuid :=
    coalesce(p_correlation_id, gen_random_uuid());
  v_token uuid := gen_random_uuid();
  v_usage_id uuid;
  v_cover_url text;
  v_request jsonb;
  v_result jsonb;
  v_same boolean := false;
begin
  if p_playlist_id is null then
    raise exception
      using errcode = '22023', message = 'playlist_id is required.';
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
  then
    raise exception
      using
        errcode = '22023',
        message = 'expected Playlist revision must be positive.';
  end if;

  if p_placement_data is null
     or jsonb_typeof(p_placement_data) <> 'object'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Playlist cover placement data must be a JSON object.';
  end if;

  if length(coalesce(p_alt_text_snapshot, '')) > 2000
     or length(coalesce(p_caption_snapshot, '')) > 4000
     or length(coalesce(p_credit_snapshot, '')) > 2000
  then
    raise exception
      using
        errcode = '22023',
        message = 'Playlist cover presentation text is too long.';
  end if;

  select *
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'Playlist was not found.';
  end if;

  select *
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      'Playlist Resource binding is missing';
  end if;

  if not coalesce(
    editorial.current_user_can_edit_playlist(
      v_binding.resource_id
    ),
    false
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'You do not have permission to edit this Playlist.';
  end if;

  select *
  into v_actor
  from platform_private.command_actor_context();

  if p_asset_id is not null then
    perform media.validate_usage_target(
      v_actor.actor_user_id,
      'editorial',
      'playlist',
      p_playlist_id,
      null,
      null,
      true,
      true
    );

    select asset.*
    into v_asset
    from media.assets asset
    where asset.id = p_asset_id;

    if not found then
      raise exception
        using
          errcode = 'P0002',
          message = 'Selected Media asset was not found.';
    end if;

    if v_asset.lifecycle_state <> 'active'
       or v_asset.current_revision_id is null
    then
      raise exception
        'Selected Media asset is not ready for Playlist cover use';
    end if;

    select file_object.*
    into v_file
    from media.asset_revisions revision
    join media.file_objects file_object
      on file_object.id = revision.original_file_object_id
    where revision.id = v_asset.current_revision_id
      and revision.asset_id = p_asset_id
      and file_object.verification_state = 'verified'
      and lower(coalesce(file_object.mime_type, '')) like 'image/%';

    if not found then
      raise exception
        'Playlist cover requires a verified image revision';
    end if;

    select compatibility.*
    into v_compatibility
    from public.registry_media_assets compatibility
    where compatibility.id = p_asset_id;

    if not found then
      raise exception
        'Playlist cover requires canonical Media compatibility identity';
    end if;

    v_is_prepared_variant :=
      v_compatibility.asset_purpose = 'playlist_cover'
      and v_compatibility.source_entity = 'playlist_cover_variant'
      and v_compatibility.source_record_id is not null;

    if not v_is_prepared_variant then
      if v_asset.current_governance_version_id is null then
        raise exception
          'Selected Media asset is not ready for Playlist cover use';
      end if;

      select governance.*
      into v_governance
      from media.asset_governance_versions governance
      where governance.id = v_asset.current_governance_version_id
        and governance.asset_id = p_asset_id;

      if not found then
        raise exception
          'Selected Media asset current governance is invalid';
      end if;

      if v_governance.public_safety_state not in (
           'approved_public',
           'approved_redacted'
         )
         or v_governance.rights_status not in (
           'owned',
           'licensed',
           'public_domain',
           'fair_use'
         )
         or v_governance.consent_status not in (
           'granted',
           'not_required'
         )
         or v_governance.source_protection_class not in (
           'public',
           'public_redacted'
         )
         or v_governance.retention_state not in (
           'retain',
           'review_required'
         )
         or v_governance.embargo_state = 'active'
         or (
           v_governance.embargo_state = 'scheduled'
           and v_governance.embargo_until is not null
           and v_governance.embargo_until > now()
         )
      then
        raise exception
          'Current Media governance does not permit Playlist cover use';
      end if;
    end if;

    v_cover_url := v_file.delivery_url;
  end if;

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'expected_authority_revision',
      p_expected_authority_revision,
    'asset_id', p_asset_id,
    'placement_data', p_placement_data,
    'alt_text_snapshot',
      nullif(btrim(p_alt_text_snapshot), ''),
    'caption_snapshot',
      nullif(btrim(p_caption_snapshot), ''),
    'credit_snapshot',
      nullif(btrim(p_credit_snapshot), ''),
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.cover.set',
    v_binding.resource_id,
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

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_binding.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload ->> 'authority_revision',
        ''
      )::bigint;
    cover_usage_link_id :=
      nullif(
        v_read.result_payload ->> 'cover_usage_link_id',
        ''
      )::uuid;
    cover_asset_id :=
      nullif(
        v_read.result_payload ->> 'cover_asset_id',
        ''
      )::uuid;
    cover_asset_revision_id :=
      nullif(
        v_read.result_payload
          ->> 'cover_asset_revision_id',
        ''
      )::uuid;
    cover_url :=
      v_read.result_payload ->> 'cover_url';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_playlist.authority_revision <>
       p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before its cover could be updated.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status', v_playlist.status
      )
    );

    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      false
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_binding.resource_id;
    authority_revision := v_playlist.authority_revision;
    cover_usage_link_id := null;
    cover_asset_id := null;
    cover_asset_revision_id := null;
    cover_url := v_playlist.cover_image_url;
    result_payload := v_read.result_payload;
    idempotent_replay := false;
    return next;
    return;
  end if;

  select count(*)
  into v_current_count
  from media.usage_links usage
  where usage.target_authority = 'editorial'
    and usage.target_kind = 'playlist'
    and usage.target_id = p_playlist_id
    and usage.target_version_id is null
    and usage.usage_role = 'playlist_cover'
    and usage.usage_state = 'active';

  if v_current_count > 1 then
    raise exception
      'Playlist has more than one active canonical cover';
  end if;

  if v_current_count = 1 then
    select usage.*
    into v_current_usage
    from media.usage_links usage
    where usage.target_authority = 'editorial'
      and usage.target_kind = 'playlist'
      and usage.target_id = p_playlist_id
      and usage.target_version_id is null
      and usage.usage_role = 'playlist_cover'
      and usage.usage_state = 'active'
    for update;

    v_same :=
      p_asset_id is not null
      and v_current_usage.asset_id = p_asset_id
      and v_current_usage.asset_revision_id =
            v_asset.current_revision_id
      and v_current_usage.resolution_mode =
            'exact_revision'
      and v_current_usage.placement_data =
            p_placement_data
      and coalesce(
            v_current_usage.alt_text_snapshot,
            ''
          ) =
          coalesce(
            nullif(btrim(p_alt_text_snapshot), ''),
            ''
          )
      and coalesce(
            v_current_usage.caption_snapshot,
            ''
          ) =
          coalesce(
            nullif(btrim(p_caption_snapshot), ''),
            ''
          )
      and coalesce(
            v_current_usage.credit_snapshot,
            ''
          ) =
          coalesce(
            nullif(btrim(p_credit_snapshot), ''),
            ''
          );

    v_usage_id := v_current_usage.id;
  else
    v_same := p_asset_id is null;
  end if;

  if not v_same then
    insert into
      platform_private.playlist_cover_mutation_authorizations (
        token,
        actor_id,
        playlist_id,
        command_receipt_id
      )
    values (
      v_token,
      v_actor.actor_user_id,
      p_playlist_id,
      v_begin.command_receipt_id
    );

    perform set_config(
      'wakilisha.playlist_cover_mutation_token',
      v_token::text,
      true
    );

    if v_current_count = 1 then
      update media.usage_links
      set
        usage_state = 'archived',
        usage_revision = usage_revision + 1,
        state_reason = 'Replaced by Playlist cover command',
        state_changed_by = v_actor.actor_user_id,
        state_changed_at = now(),
        updated_at = now()
      where id = v_current_usage.id;

      insert into media.events (
        asset_id,
        asset_revision_id,
        usage_link_id,
        event_type,
        actor_id,
        reason,
        prior_state,
        resulting_state,
        correlation_id
      )
      values (
        v_current_usage.asset_id,
        v_current_usage.asset_revision_id,
        v_current_usage.id,
        'usage_archived',
        v_actor.actor_user_id,
        'Playlist cover replaced or cleared',
        jsonb_build_object(
          'usage_state', 'active',
          'usage_revision',
            v_current_usage.usage_revision
        ),
        jsonb_build_object(
          'usage_state', 'archived',
          'usage_revision',
            v_current_usage.usage_revision + 1
        ),
        v_correlation_id
      );
    end if;

    if p_asset_id is not null then
      v_usage_id := gen_random_uuid();

      insert into media.usage_links (
        id,
        asset_id,
        asset_revision_id,
        resolution_mode,
        target_authority,
        target_kind,
        target_id,
        target_version_kind,
        target_version_id,
        usage_role,
        placement_data,
        display_order,
        alt_text_snapshot,
        caption_snapshot,
        credit_snapshot,
        usage_state,
        usage_revision,
        created_by
      )
      values (
        v_usage_id,
        p_asset_id,
        v_asset.current_revision_id,
        'exact_revision',
        'editorial',
        'playlist',
        p_playlist_id,
        null,
        null,
        'playlist_cover',
        p_placement_data,
        0,
        nullif(btrim(p_alt_text_snapshot), ''),
        nullif(btrim(p_caption_snapshot), ''),
        nullif(btrim(p_credit_snapshot), ''),
        'active',
        1,
        v_actor.actor_user_id
      );

      insert into media.events (
        asset_id,
        asset_revision_id,
        usage_link_id,
        event_type,
        actor_id,
        reason,
        resulting_state,
        correlation_id
      )
      values (
        p_asset_id,
        v_asset.current_revision_id,
        v_usage_id,
        'usage_attached',
        v_actor.actor_user_id,
        'Governed Playlist cover attached',
        jsonb_build_object(
          'usage_state', 'active',
          'usage_revision', 1,
          'target_authority', 'editorial',
          'target_kind', 'playlist',
          'target_id', p_playlist_id,
          'usage_role', 'playlist_cover'
        ),
        v_correlation_id
      );
    else
      v_usage_id := null;
      v_cover_url := null;
    end if;

    delete from
      platform_private.playlist_cover_mutation_authorizations
    where token = v_token;

    perform set_config(
      'wakilisha.playlist_cover_mutation_token',
      '',
      true
    );

    update public.wk_playlists playlist
    set
      authority_revision =
        playlist.authority_revision + 1,
      cover_image_url = v_cover_url
    where playlist.id = p_playlist_id
    returning playlist.*
    into v_playlist;
  end if;

  v_result := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'resource_id', v_binding.resource_id,
    'authority_revision',
      v_playlist.authority_revision,
    'lifecycle_status', v_playlist.status,
    'cover_usage_link_id', v_usage_id,
    'cover_asset_id', p_asset_id,
    'cover_asset_revision_id',
      case
        when p_asset_id is null
          then null
        else v_asset.current_revision_id
      end,
    'cover_url', v_cover_url,
    'cover_changed', not v_same,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_binding.resource_id;
  authority_revision := v_playlist.authority_revision;
  cover_usage_link_id := v_usage_id;
  cover_asset_id := p_asset_id;
  cover_asset_revision_id :=
    case
      when p_asset_id is null
        then null
      else v_asset.current_revision_id
    end;
  cover_url := v_cover_url;
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.set_playlist_cover(
  uuid, bigint, uuid, text, jsonb, text, text, text, uuid
)
from public, anon, service_role;

grant execute
on function public.set_playlist_cover(
  uuid, bigint, uuid, text, jsonb, text, text, text, uuid
)
to authenticated;

comment on function public.set_playlist_cover(
  uuid, bigint, uuid, text, jsonb, text, text, text, uuid
) is
  'Governed Playlist cover command. M213 accepts prepared playlist_cover variants during draft authoring while retaining strict governance for direct non-derived cover assets.';

commit;
