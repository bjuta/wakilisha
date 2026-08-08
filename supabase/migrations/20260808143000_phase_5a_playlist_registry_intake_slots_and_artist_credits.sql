-- Phase 5A Migration 214: Playlist Registry intake slots and artist credits.
--
-- Forward repair after immutable M213.
--
-- Product invariants:
-- 1. Missing Registry music stays visible in the Playlist as a pending intake slot.
-- 2. A pending Registry intake reserves its Playlist position until resolved or removed.
-- 3. Later canonical tracks append after pending reserved slots.
-- 4. Reordering active tracks preserves pending Registry intake positions.
-- 5. Registry intake records every primary and featured artist credit explicitly.
-- 6. Artist credits reference Registry identity, alias candidates, or new-artist suggestions.
--    They never create canonical artist identity directly.
-- 7. Canonicalization fills the reserved Playlist slot instead of appending at the end.
-- 8. Review cannot proceed while an unresolved Registry intake slot remains.

begin;

do $phase_5a_m214_preflight$
begin
  if to_regclass('public.registry_provider_track_suggestions') is null
     or to_regclass('platform_private.playlist_playback_validations') is null
     or to_regclass('public.wk_playlists') is null
     or to_regclass('public.wk_playlist_items') is null
     or to_regclass('public.registry_track_artists') is null
  then
    raise exception
      'STOP: M213 Playlist/Registry playback authority is incomplete';
  end if;

  if to_regprocedure(
       'public.create_registry_track_intake_suggestion(uuid,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.add_playlist_item(uuid,bigint,text,uuid,text,text,text,text,text[],text,uuid)'
     ) is null
     or to_regprocedure(
       'public.add_playlist_validated_provider_track(uuid,bigint,uuid,uuid,text,uuid)'
     ) is null
  then
    raise exception
      'STOP: Required M209/M213 Playlist commands are missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'reserved_position'
  ) then
    raise exception
      'STOP: M214 reserved_position already exists';
  end if;

  if to_regclass(
       'public.registry_provider_track_suggestion_artists'
     ) is not null
     or to_regprocedure(
       'public.submit_playlist_registry_intake(uuid,bigint,uuid,jsonb,text,uuid)'
     ) is not null
  then
    raise exception
      'STOP: One or more M214 authorities already exist';
  end if;
end;
$phase_5a_m214_preflight$;

alter table public.registry_provider_track_suggestions
  add column reserved_position integer;

alter table public.registry_provider_track_suggestions
  add constraint registry_provider_track_suggestions_reserved_position_check
  check (
    reserved_position is null
    or reserved_position > 0
  );

with current_max as (
  select
    playlist.id as playlist_id,
    coalesce(max(item.position), 0)::integer as max_position
  from public.wk_playlists playlist
  left join public.wk_playlist_items item
    on item.playlist_id = playlist.id
    and item.lifecycle_state = 'active'
  group by playlist.id
),
pending as (
  select
    suggestion.id,
    suggestion.source_playlist_id,
    row_number() over (
      partition by suggestion.source_playlist_id
      order by suggestion.created_at, suggestion.id
    )::integer as pending_ordinal
  from public.registry_provider_track_suggestions suggestion
  where suggestion.status = 'needs_review'
    and suggestion.source_playlist_item_id is null
    and suggestion.canonical_track_id is null
)
update public.registry_provider_track_suggestions suggestion
set reserved_position =
  current_max.max_position + pending.pending_ordinal
from pending
join current_max
  on current_max.playlist_id = pending.source_playlist_id
where suggestion.id = pending.id;

alter table public.registry_provider_track_suggestions
  add constraint registry_provider_track_suggestions_pending_slot_check
  check (
    not (
      status = 'needs_review'
      and source_playlist_item_id is null
      and canonical_track_id is null
    )
    or reserved_position is not null
  );

create unique index registry_provider_track_suggestions_pending_slot_uq
  on public.registry_provider_track_suggestions (
    source_playlist_id,
    reserved_position
  )
  where
    status = 'needs_review'
    and source_playlist_item_id is null
    and canonical_track_id is null
    and reserved_position is not null;

create table public.registry_provider_track_suggestion_artists (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null,
  credit_order integer not null,
  credit_role text not null,
  resolution_mode text not null,
  registry_artist_id uuid,
  observed_name text not null,
  created_at timestamptz not null default now(),

  constraint registry_provider_track_suggestion_artists_suggestion_fkey
    foreign key (suggestion_id)
    references public.registry_provider_track_suggestions(id)
    on delete cascade,

  constraint registry_provider_track_suggestion_artists_artist_fkey
    foreign key (registry_artist_id)
    references public.registry_artists(id)
    on delete set null,

  constraint registry_provider_track_suggestion_artists_order_check
    check (credit_order > 0),

  constraint registry_provider_track_suggestion_artists_role_check
    check (credit_role in ('primary', 'featured')),

  constraint registry_provider_track_suggestion_artists_mode_check
    check (
      resolution_mode in (
        'existing_artist',
        'alias_candidate',
        'new_artist',
        'unresolved'
      )
    ),

  constraint registry_provider_track_suggestion_artists_name_check
    check (
      length(btrim(observed_name)) between 1 and 300
    ),

  constraint registry_provider_track_suggestion_artists_resolution_check
    check (
      (
        resolution_mode in ('existing_artist', 'alias_candidate')
        and registry_artist_id is not null
      )
      or (
        resolution_mode in ('new_artist', 'unresolved')
        and registry_artist_id is null
      )
    ),

  constraint registry_provider_track_suggestion_artists_order_uq
    unique (suggestion_id, credit_order)
);

comment on table public.registry_provider_track_suggestion_artists is
  'Registry-owned artist-credit evidence for missing tracks surfaced by Playlist intake. Primary and featured roles are explicit; these rows never create canonical artist identity directly.';

alter table public.registry_provider_track_suggestion_artists
  enable row level security;

revoke insert, update, delete, truncate, references, trigger
on public.registry_provider_track_suggestion_artists
from public, anon, authenticated;

grant select
on public.registry_provider_track_suggestion_artists
to authenticated;

grant all
on public.registry_provider_track_suggestion_artists
to service_role;

create policy registry_provider_track_suggestion_artists_read
on public.registry_provider_track_suggestion_artists
for select
to authenticated
using (
  exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    where suggestion.id =
      registry_provider_track_suggestion_artists.suggestion_id
      and (
        suggestion.requested_by = auth.uid()
        or public.current_user_is_administrator()
        or public.current_user_has_capability('manage_registry')
      )
  )
);

insert into public.registry_provider_track_suggestion_artists (
  suggestion_id,
  credit_order,
  credit_role,
  resolution_mode,
  registry_artist_id,
  observed_name
)
select
  suggestion.id,
  observed.ordinality::integer,
  case
    when observed.ordinality = 1 then 'primary'
    else 'featured'
  end,
  case
    when observed.ordinality = 1
      then suggestion.artist_resolution_mode
    else 'unresolved'
  end,
  case
    when observed.ordinality = 1
      and suggestion.artist_resolution_mode in (
        'existing_artist',
        'alias_candidate'
      )
      then suggestion.registry_artist_id
    else null
  end,
  btrim(observed.artist_name)
from public.registry_provider_track_suggestions suggestion
cross join lateral unnest(suggestion.provider_artist_names)
  with ordinality as observed(artist_name, ordinality)
where suggestion.source_playlist_item_id is null
  and suggestion.canonical_track_id is null
  and nullif(btrim(observed.artist_name), '') is not null;

insert into public.registry_provider_track_suggestion_artists (
  suggestion_id,
  credit_order,
  credit_role,
  resolution_mode,
  registry_artist_id,
  observed_name
)
select
  suggestion.id,
  1,
  'primary',
  suggestion.artist_resolution_mode,
  suggestion.registry_artist_id,
  artist.display_name
from public.registry_provider_track_suggestions suggestion
join public.registry_artists artist
  on artist.id = suggestion.registry_artist_id
where suggestion.source_playlist_item_id is null
  and suggestion.canonical_track_id is null
  and suggestion.registry_artist_id is not null
  and not exists (
    select 1
    from public.registry_provider_track_suggestion_artists credit
    where credit.suggestion_id = suggestion.id
  );

create or replace function editorial.next_playlist_position_with_registry_intake(
  p_playlist_id uuid,
  p_exclude_item_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select greatest(
    coalesce(
      (
        select max(item.position)
        from public.wk_playlist_items item
        where item.playlist_id = p_playlist_id
          and item.lifecycle_state = 'active'
          and (
            p_exclude_item_id is null
            or item.id <> p_exclude_item_id
          )
      ),
      0
    ),
    coalesce(
      (
        select max(suggestion.reserved_position)
        from public.registry_provider_track_suggestions suggestion
        where suggestion.source_playlist_id = p_playlist_id
          and suggestion.status = 'needs_review'
          and suggestion.source_playlist_item_id is null
          and suggestion.canonical_track_id is null
      ),
      0
    )
  ) + 1;
$function$;

revoke all
on function editorial.next_playlist_position_with_registry_intake(
  uuid, uuid
)
from public, anon, authenticated, service_role;

create or replace function editorial.resequence_playlist_with_registry_intake(
  p_playlist_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_offset integer;
  v_next integer := 0;
  v_entry record;
begin
  select greatest(
    coalesce(
      (
        select max(item.position)
        from public.wk_playlist_items item
        where item.playlist_id = p_playlist_id
          and item.lifecycle_state = 'active'
      ),
      0
    ),
    coalesce(
      (
        select max(suggestion.reserved_position)
        from public.registry_provider_track_suggestions suggestion
        where suggestion.source_playlist_id = p_playlist_id
          and suggestion.status = 'needs_review'
          and suggestion.source_playlist_item_id is null
          and suggestion.canonical_track_id is null
      ),
      0
    )
  )
  + (
      select count(*)::integer
      from public.wk_playlist_items item
      where item.playlist_id = p_playlist_id
        and item.lifecycle_state = 'active'
    )
  + (
      select count(*)::integer
      from public.registry_provider_track_suggestions suggestion
      where suggestion.source_playlist_id = p_playlist_id
        and suggestion.status = 'needs_review'
        and suggestion.source_playlist_item_id is null
        and suggestion.canonical_track_id is null
    )
  + 100
  into v_offset;

  update public.wk_playlist_items item
  set position = item.position + v_offset
  where item.playlist_id = p_playlist_id
    and item.lifecycle_state = 'active';

  update public.registry_provider_track_suggestions suggestion
  set reserved_position = suggestion.reserved_position + v_offset
  where suggestion.source_playlist_id = p_playlist_id
    and suggestion.status = 'needs_review'
    and suggestion.source_playlist_item_id is null
    and suggestion.canonical_track_id is null;

  for v_entry in
    select combined.entry_kind, combined.entry_id
    from (
      select
        'item'::text as entry_kind,
        item.id as entry_id,
        item.position as sort_position,
        item.created_at as created_at
      from public.wk_playlist_items item
      where item.playlist_id = p_playlist_id
        and item.lifecycle_state = 'active'

      union all

      select
        'registry_intake'::text,
        suggestion.id,
        suggestion.reserved_position,
        suggestion.created_at
      from public.registry_provider_track_suggestions suggestion
      where suggestion.source_playlist_id = p_playlist_id
        and suggestion.status = 'needs_review'
        and suggestion.source_playlist_item_id is null
        and suggestion.canonical_track_id is null
    ) combined
    order by
      combined.sort_position,
      combined.created_at,
      combined.entry_id
  loop
    v_next := v_next + 1;

    if v_entry.entry_kind = 'item' then
      update public.wk_playlist_items item
      set position = v_next
      where item.id = v_entry.entry_id;
    else
      update public.registry_provider_track_suggestions suggestion
      set reserved_position = v_next
      where suggestion.id = v_entry.entry_id;
    end if;
  end loop;
end;
$function$;

revoke all
on function editorial.resequence_playlist_with_registry_intake(uuid)
from public, anon, authenticated, service_role;

create or replace function public.get_playlist_pending_registry_intake(
  p_playlist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_resource_id uuid;
begin
  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'Playlist does not exist.';
  end if;

  if not editorial.current_user_can_view_playlist(v_resource_id) then
    raise exception
      using errcode = '42501', message = 'Playlist view permission is required.';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'suggestion_id', suggestion.id,
          'reserved_position', suggestion.reserved_position,
          'status', suggestion.status,
          'provider_key', suggestion.provider_key,
          'provider_url', suggestion.provider_url,
          'provider_title', suggestion.provider_title,
          'provider_release_title', suggestion.provider_release_title,
          'playback_kind', suggestion.playback_kind,
          'artwork_url',
            suggestion.validation_snapshot ->> 'artwork_url',
          'created_at', suggestion.created_at,
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
        )
        order by suggestion.reserved_position, suggestion.created_at
      )
      from public.registry_provider_track_suggestions suggestion
      where suggestion.source_playlist_id = p_playlist_id
        and suggestion.status = 'needs_review'
        and suggestion.source_playlist_item_id is null
        and suggestion.canonical_track_id is null
    ),
    '[]'::jsonb
  );
end;
$function$;

revoke all
on function public.get_playlist_pending_registry_intake(uuid)
from public, anon, service_role;

grant execute
on function public.get_playlist_pending_registry_intake(uuid)
to authenticated;

create or replace function public.submit_playlist_registry_intake(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_validation_id uuid,
  p_artist_credits jsonb,
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
  v_playlist public.wk_playlists%rowtype;
  v_resource_id uuid;
  v_validation platform_private.playlist_playback_validations%rowtype;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_suggestion_id uuid := gen_random_uuid();
  v_reserved_position integer;
  v_credit jsonb;
  v_credit_order integer := 0;
  v_credit_role text;
  v_resolution_mode text;
  v_registry_artist_id uuid;
  v_observed_name text;
  v_registry_display_name text;
  v_primary_count integer := 0;
  v_legacy_mode text;
  v_legacy_artist_id uuid;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_playlist_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or p_validation_id is null
  then
    raise exception
      'Playlist, expected revision, and playback validation are required.';
  end if;

  if p_artist_credits is null
     or jsonb_typeof(p_artist_credits) <> 'array'
     or jsonb_array_length(p_artist_credits) < 1
     or jsonb_array_length(p_artist_credits) > 20
  then
    raise exception
      'Add between 1 and 20 primary or featured artist credits before Registry intake.';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update of playlist;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'Playlist does not exist.';
  end if;

  if not editorial.current_user_can_edit_playlist(v_resource_id) then
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

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'expected_authority_revision', p_expected_authority_revision,
    'validation_id', p_validation_id,
    'artist_credits', p_artist_credits,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.item.add',
    v_resource_id,
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
    return v_read.result_payload;
  end if;

  if v_playlist.authority_revision <> p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before Registry intake could reserve its position.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_playlist.authority_revision
      )
    );

    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      false
    );

    return v_read.result_payload;
  end if;

  for v_credit in
    select value
    from jsonb_array_elements(p_artist_credits)
  loop
    v_credit_order := v_credit_order + 1;
    v_credit_role := lower(
      btrim(coalesce(v_credit ->> 'credit_role', ''))
    );
    v_resolution_mode := lower(
      btrim(coalesce(v_credit ->> 'resolution_mode', ''))
    );
    v_observed_name := nullif(
      btrim(v_credit ->> 'observed_name'),
      ''
    );

    if v_credit_role not in ('primary', 'featured') then
      raise exception
        'Every Registry intake artist credit must be Primary or Featured.';
    end if;

    if v_resolution_mode not in (
      'existing_artist',
      'alias_candidate',
      'new_artist'
    ) then
      raise exception
        'Each Registry intake artist must be a Registry artist, an alias candidate, or a new-artist suggestion.';
    end if;

    v_registry_artist_id := null;

    if v_resolution_mode in (
      'existing_artist',
      'alias_candidate'
    ) then
      if nullif(
           btrim(v_credit ->> 'registry_artist_id'),
           ''
         ) is null
      then
        raise exception
          'Select a Music Registry artist for an existing or alias artist credit.';
      end if;

      v_registry_artist_id :=
        (v_credit ->> 'registry_artist_id')::uuid;

      select artist.display_name
      into v_registry_display_name
      from public.registry_artists artist
      where artist.id = v_registry_artist_id
        and artist.status in ('active', 'draft');

      if not found then
        raise exception
          'One selected Music Registry artist is unavailable.';
      end if;

      if v_resolution_mode = 'alias_candidate'
         and v_observed_name is null
      then
        raise exception
          'An alias candidate needs the provider-observed artist name.';
      end if;

      v_observed_name := coalesce(
        v_observed_name,
        v_registry_display_name
      );
    else
      if nullif(
           btrim(v_credit ->> 'registry_artist_id'),
           ''
         ) is not null
      then
        raise exception
          'A new-artist suggestion cannot claim canonical Registry identity.';
      end if;

      if v_observed_name is null then
        raise exception
          'A new-artist suggestion needs the observed artist name.';
      end if;
    end if;

    if v_credit_role = 'primary' then
      v_primary_count := v_primary_count + 1;

      if v_legacy_mode is null then
        v_legacy_mode := v_resolution_mode;
        v_legacy_artist_id := v_registry_artist_id;
      end if;
    end if;
  end loop;

  if v_primary_count < 1 then
    raise exception
      'Registry intake needs at least one Primary artist credit.';
  end if;

  if exists (
    select 1
    from (
      select
        coalesce(
          nullif(btrim(value ->> 'registry_artist_id'), ''),
          lower(btrim(value ->> 'observed_name'))
        ) as artist_identity,
        count(*) as duplicate_count
      from jsonb_array_elements(p_artist_credits)
      group by 1
    ) duplicate
    where duplicate.artist_identity is not null
      and duplicate.duplicate_count > 1
  ) then
    raise exception
      'The same artist cannot be added to Registry intake more than once.';
  end if;

  v_reserved_position :=
    editorial.next_playlist_position_with_registry_intake(
      p_playlist_id,
      null
    );

  insert into public.registry_provider_track_suggestions (
    id,
    source_playlist_id,
    source_playlist_item_id,
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
    status,
    reserved_position
  )
  values (
    v_suggestion_id,
    p_playlist_id,
    null,
    auth.uid(),
    null,
    v_legacy_artist_id,
    coalesce(v_legacy_mode, 'unresolved'),
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
    'needs_review',
    v_reserved_position
  );

  v_credit_order := 0;

  for v_credit in
    select value
    from jsonb_array_elements(p_artist_credits)
  loop
    v_credit_order := v_credit_order + 1;
    v_credit_role := lower(
      btrim(v_credit ->> 'credit_role')
    );
    v_resolution_mode := lower(
      btrim(v_credit ->> 'resolution_mode')
    );
    v_observed_name := nullif(
      btrim(v_credit ->> 'observed_name'),
      ''
    );
    v_registry_artist_id := null;

    if v_resolution_mode in (
      'existing_artist',
      'alias_candidate'
    ) then
      v_registry_artist_id :=
        (v_credit ->> 'registry_artist_id')::uuid;

      select artist.display_name
      into v_registry_display_name
      from public.registry_artists artist
      where artist.id = v_registry_artist_id;

      v_observed_name := coalesce(
        v_observed_name,
        v_registry_display_name
      );
    end if;

    insert into public.registry_provider_track_suggestion_artists (
      suggestion_id,
      credit_order,
      credit_role,
      resolution_mode,
      registry_artist_id,
      observed_name
    )
    values (
      v_suggestion_id,
      v_credit_order,
      v_credit_role,
      v_resolution_mode,
      v_registry_artist_id,
      v_observed_name
    );
  end loop;

  update public.wk_playlists playlist
  set authority_revision = playlist.authority_revision + 1
  where playlist.id = p_playlist_id
  returning playlist.authority_revision
  into v_playlist.authority_revision;

  v_result := jsonb_build_object(
    'suggestion_id', v_suggestion_id,
    'status', 'needs_review',
    'reserved_position', v_reserved_position,
    'authority_revision', v_playlist.authority_revision,
    'artist_credit_count', jsonb_array_length(p_artist_credits),
    'playlist_changed', true,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return v_result;
end;
$function$;

revoke all
on function public.submit_playlist_registry_intake(
  uuid, bigint, uuid, jsonb, text, uuid
)
from public, anon, service_role;

grant execute
on function public.submit_playlist_registry_intake(
  uuid, bigint, uuid, jsonb, text, uuid
)
to authenticated;

create or replace function public.add_playlist_registry_track_with_intake_slots(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_registry_track_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
declare
  v_added record;
  v_item_id uuid;
  v_position integer;
  v_payload jsonb;
  v_marker text;
begin
  select *
  into v_added
  from public.add_playlist_item(
    p_playlist_id => p_playlist_id,
    p_expected_authority_revision =>
      p_expected_authority_revision,
    p_idempotency_key => p_idempotency_key,
    p_registry_track_id => p_registry_track_id,
    p_correlation_id => p_correlation_id
  );

  v_item_id := v_added.playlist_item_id;
  v_payload := coalesce(
    v_added.result_payload,
    '{}'::jsonb
  );

  if v_added.receipt_status = 'succeeded'
     and v_item_id is not null
  then
    select
      item.normalization_payload
        ->> 'playlist_position_authority'
    into v_marker
    from public.wk_playlist_items item
    where item.id = v_item_id;

    if coalesce(v_marker, '') <>
       'registry_intake_slots'
    then
      v_position :=
        editorial.next_playlist_position_with_registry_intake(
          p_playlist_id,
          v_item_id
        );

      update public.wk_playlist_items item
      set
        position = v_position,
        normalization_payload =
          coalesce(
            item.normalization_payload,
            '{}'::jsonb
          )
          || jsonb_build_object(
            'playlist_position_authority',
            'registry_intake_slots'
          )
      where item.id = v_item_id;
    else
      select item.position
      into v_position
      from public.wk_playlist_items item
      where item.id = v_item_id;
    end if;
  end if;

  return jsonb_build_object(
    'command_receipt_id', v_added.command_receipt_id,
    'receipt_status', v_added.receipt_status,
    'playlist_id', p_playlist_id,
    'playlist_item_id', v_item_id,
    'authority_revision', v_added.authority_revision,
    'result_payload',
      v_payload
      || jsonb_build_object(
        'position', v_position
      )
  );
end;
$function$;

revoke all
on function public.add_playlist_registry_track_with_intake_slots(
  uuid, bigint, uuid, text, uuid
)
from public, anon, service_role;

grant execute
on function public.add_playlist_registry_track_with_intake_slots(
  uuid, bigint, uuid, text, uuid
)
to authenticated;

create or replace function public.add_playlist_validated_provider_track_with_intake_slots(
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
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
declare
  v_result jsonb;
  v_item_id uuid;
  v_position integer;
  v_marker text;
begin
  v_result :=
    public.add_playlist_validated_provider_track(
      p_playlist_id,
      p_expected_authority_revision,
      p_registry_track_id,
      p_validation_id,
      p_idempotency_key,
      p_correlation_id
    );

  v_item_id :=
    nullif(v_result ->> 'playlist_item_id', '')::uuid;

  if v_item_id is not null then
    select
      item.normalization_payload
        ->> 'playlist_position_authority'
    into v_marker
    from public.wk_playlist_items item
    where item.id = v_item_id;

    if coalesce(v_marker, '') <>
       'registry_intake_slots'
    then
      v_position :=
        editorial.next_playlist_position_with_registry_intake(
          p_playlist_id,
          v_item_id
        );

      update public.wk_playlist_items item
      set
        position = v_position,
        normalization_payload =
          coalesce(
            item.normalization_payload,
            '{}'::jsonb
          )
          || jsonb_build_object(
            'playlist_position_authority',
            'registry_intake_slots'
          )
      where item.id = v_item_id;
    else
      select item.position
      into v_position
      from public.wk_playlist_items item
      where item.id = v_item_id;
    end if;
  end if;

  return
    coalesce(v_result, '{}'::jsonb)
    || jsonb_build_object(
      'position', v_position
    );
end;
$function$;

revoke all
on function public.add_playlist_validated_provider_track_with_intake_slots(
  uuid, bigint, uuid, uuid, text, uuid
)
from public, anon, service_role;

grant execute
on function public.add_playlist_validated_provider_track_with_intake_slots(
  uuid, bigint, uuid, uuid, text, uuid
)
to authenticated;

create or replace function public.remove_playlist_item_with_intake_slots(
  p_playlist_id uuid,
  p_playlist_item_id uuid,
  p_expected_authority_revision bigint,
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
  v_playlist public.wk_playlists%rowtype;
  v_resource_id uuid;
  v_item public.wk_playlist_items%rowtype;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  if p_playlist_id is null
     or p_playlist_item_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
  then
    raise exception
      'Playlist, item, and expected revision are required.';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update of playlist;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'Playlist does not exist.';
  end if;

  if not editorial.current_user_can_edit_playlist(v_resource_id) then
    raise exception
      using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'playlist_item_id', p_playlist_item_id,
    'expected_authority_revision',
      p_expected_authority_revision,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.item.remove',
    v_resource_id,
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
    return v_read.result_payload;
  end if;

  if v_playlist.authority_revision <>
     p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before this item could be removed.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_playlist.authority_revision
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
        'The Playlist item is missing or no longer active.',
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_playlist.authority_revision
        )
      );
    else
      update public.wk_playlist_items item
      set
        lifecycle_state = 'removed',
        position = null,
        removed_at = now(),
        removed_by = auth.uid()
      where item.id = p_playlist_item_id;

      perform editorial.resequence_playlist_with_registry_intake(
        p_playlist_id
      );

      update public.wk_playlists playlist
      set authority_revision =
        playlist.authority_revision + 1
      where playlist.id = p_playlist_id
      returning playlist.authority_revision
      into v_playlist.authority_revision;

      v_result := jsonb_build_object(
        'playlist_id', p_playlist_id,
        'playlist_item_id', p_playlist_item_id,
        'authority_revision', v_playlist.authority_revision,
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

  return v_read.result_payload;
end;
$function$;

revoke all
on function public.remove_playlist_item_with_intake_slots(
  uuid, uuid, bigint, text, uuid
)
from public, anon, service_role;

grant execute
on function public.remove_playlist_item_with_intake_slots(
  uuid, uuid, bigint, text, uuid
)
to authenticated;

create or replace function public.reorder_playlist_items_with_intake_slots(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_ordered_item_ids uuid[],
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'platform_private'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_resource_id uuid;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_current_order uuid[];
  v_available_positions integer[];
  v_active_count integer;
  v_distinct_count integer;
  v_offset integer;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  if p_playlist_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or p_ordered_item_ids is null
  then
    raise exception
      'Playlist, expected revision, and complete track order are required.';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update of playlist;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'Playlist does not exist.';
  end if;

  if not editorial.current_user_can_edit_playlist(v_resource_id) then
    raise exception
      using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  select
    count(*)::integer,
    coalesce(
      array_agg(item.id order by item.position),
      '{}'::uuid[]
    ),
    coalesce(
      array_agg(item.position order by item.position),
      '{}'::integer[]
    )
  into
    v_active_count,
    v_current_order,
    v_available_positions
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
     )
  then
    raise exception
      'Reorder must contain every active Playlist track exactly once.';
  end if;

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'expected_authority_revision',
      p_expected_authority_revision,
    'ordered_item_ids', to_jsonb(p_ordered_item_ids),
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.items.reorder',
    v_resource_id,
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
    return v_read.result_payload;
  end if;

  if v_playlist.authority_revision <>
     p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before this order could be applied.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_playlist.authority_revision
      )
    );
  elsif v_current_order = p_ordered_item_ids then
    v_result := jsonb_build_object(
      'playlist_id', p_playlist_id,
      'authority_revision', v_playlist.authority_revision,
      'changed', false,
      'correlation_id', v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  else
    select
      greatest(
        coalesce(max(item.position), 0),
        coalesce(
          (
            select max(suggestion.reserved_position)
            from public.registry_provider_track_suggestions suggestion
            where suggestion.source_playlist_id = p_playlist_id
              and suggestion.status = 'needs_review'
              and suggestion.source_playlist_item_id is null
              and suggestion.canonical_track_id is null
          ),
          0
        )
      )
      + v_active_count
      + 100
    into v_offset
    from public.wk_playlist_items item
    where item.playlist_id = p_playlist_id
      and item.lifecycle_state = 'active';

    update public.wk_playlist_items item
    set position = item.position + v_offset
    where item.playlist_id = p_playlist_id
      and item.lifecycle_state = 'active';

    with requested as (
      select
        requested.item_id,
        requested.ordinality::integer as ordinal
      from unnest(p_ordered_item_ids)
        with ordinality as requested(item_id, ordinality)
    )
    update public.wk_playlist_items item
    set position = v_available_positions[requested.ordinal]
    from requested
    where item.id = requested.item_id;

    update public.wk_playlists playlist
    set authority_revision =
      playlist.authority_revision + 1
    where playlist.id = p_playlist_id
    returning playlist.authority_revision
    into v_playlist.authority_revision;

    v_result := jsonb_build_object(
      'playlist_id', p_playlist_id,
      'authority_revision', v_playlist.authority_revision,
      'changed', true,
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

  return v_read.result_payload;
end;
$function$;

revoke all
on function public.reorder_playlist_items_with_intake_slots(
  uuid, bigint, uuid[], text, uuid
)
from public, anon, service_role;

grant execute
on function public.reorder_playlist_items_with_intake_slots(
  uuid, bigint, uuid[], text, uuid
)
to authenticated;

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
     or new.source_playlist_item_id is not null
     or new.reserved_position is null
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
      'playlist_position_authority',
        'registry_intake_slots',
      'playback',
        new.validation_snapshot
    ),
    null,
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
  set source_playlist_item_id = v_item_id
  where suggestion.id = new.id;

  update public.wk_playlists playlist
  set authority_revision =
    playlist.authority_revision + 1
  where playlist.id = new.source_playlist_id;

  return new;
end;
$function$;

drop trigger if exists
  registry_provider_track_suggestion_materialize_playlist_slot
on public.registry_provider_track_suggestions;

create trigger registry_provider_track_suggestion_materialize_playlist_slot
after update of status, canonicalized_track_id
on public.registry_provider_track_suggestions
for each row
execute function editorial.materialize_canonicalized_playlist_registry_intake();

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

    if exists (
      select 1
      from public.registry_provider_track_suggestions suggestion
      where suggestion.source_playlist_id = new.id
        and suggestion.status = 'needs_review'
        and suggestion.source_playlist_item_id is null
        and suggestion.canonical_track_id is null
        and suggestion.reserved_position is not null
    ) then
      raise exception
        using
          errcode = '23514',
          message =
            'Resolve every pending Music Registry intake slot before review.';
    end if;
  end if;

  return new;
end;
$function$;

revoke execute
on function public.create_registry_track_intake_suggestion(
  uuid, uuid, text, uuid
)
from authenticated;

revoke execute
on function public.add_playlist_item(
  uuid, bigint, text, uuid, text, text, text,
  text, text[], text, uuid
)
from authenticated;

revoke execute
on function public.add_playlist_validated_provider_track(
  uuid, bigint, uuid, uuid, text, uuid
)
from authenticated;

revoke execute
on function public.remove_playlist_item(
  uuid, uuid, bigint, text, uuid
)
from authenticated;

revoke execute
on function public.reorder_playlist_items(
  uuid, bigint, uuid[], text, uuid
)
from authenticated;

commit;
