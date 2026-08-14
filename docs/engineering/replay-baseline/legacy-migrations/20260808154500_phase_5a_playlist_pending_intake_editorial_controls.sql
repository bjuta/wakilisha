-- Phase 5A Migration 215: pending Registry-intake editorial controls.
--
-- Forward repair after immutable M214.
--
-- A track does not stop being part of the editor's Playlist merely because its
-- canonical Music Registry identity is awaiting review. Pending Registry intake
-- therefore retains two mutable Playlist-level editorial properties:
-- - its reserved position in the ordered Playlist;
-- - its curator note.
--
-- Registry remains the only authority that can canonicalize track or artist
-- identity. This migration changes only Playlist editorial state.

begin;

do $phase_5a_m215_preflight$
begin
  if to_regclass('public.registry_provider_track_suggestions') is null
     or to_regclass('public.wk_playlists') is null
     or to_regclass('public.wk_playlist_items') is null
     or to_regclass('editorial.playlist_resources') is null
  then
    raise exception
      'STOP: M214 Playlist Registry-intake authority is incomplete';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'reserved_position'
  ) then
    raise exception
      'STOP: M214 reserved Playlist-position authority is missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'playlist_note'
  ) then
    raise exception
      'STOP: M215 playlist_note already exists';
  end if;

  if to_regprocedure(
       'public.save_playlist_pending_registry_note(uuid,uuid,bigint,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.move_playlist_pending_registry_intake(uuid,uuid,bigint,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.get_playlist_pending_registry_intake_editorial(uuid)'
     ) is not null
  then
    raise exception
      'STOP: One or more M215 RPCs already exist';
  end if;

  if to_regprocedure(
       'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.reject_resource_command(uuid,text,text,jsonb)'
     ) is null
  then
    raise exception
      'STOP: Shared Playlist command authority is incomplete';
  end if;
end;
$phase_5a_m215_preflight$;

alter table public.registry_provider_track_suggestions
  add column playlist_note text;

alter table public.registry_provider_track_suggestions
  add constraint registry_provider_track_suggestions_playlist_note_check
  check (
    playlist_note is null
    or length(playlist_note) <= 10000
  );

comment on column
  public.registry_provider_track_suggestions.playlist_note
is
  'Mutable Playlist curator note retained while Registry identity is pending. It is carried into the canonical Playlist item when Registry resolves the track.';

create or replace function public.get_playlist_pending_registry_intake_editorial(
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
          'notes', suggestion.playlist_note,
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
on function public.get_playlist_pending_registry_intake_editorial(uuid)
from public, anon, service_role;

grant execute
on function public.get_playlist_pending_registry_intake_editorial(uuid)
to authenticated;

create or replace function public.save_playlist_pending_registry_note(
  p_playlist_id uuid,
  p_suggestion_id uuid,
  p_expected_authority_revision bigint,
  p_note text,
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
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_note text := nullif(btrim(p_note), '');
  v_changed boolean := false;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  if p_playlist_id is null
     or p_suggestion_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
  then
    raise exception
      'Playlist, Registry intake suggestion, and expected revision are required.';
  end if;

  if length(coalesce(v_note, '')) > 10000 then
    raise exception
      'Playlist track notes cannot exceed 10,000 characters.';
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
    'suggestion_id', p_suggestion_id,
    'expected_authority_revision', p_expected_authority_revision,
    'note', v_note,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.item.note.save',
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
      'The Playlist changed before this pending track note could be saved.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_playlist.authority_revision
      )
    );
  else
    select suggestion.*
    into v_suggestion
    from public.registry_provider_track_suggestions suggestion
    where suggestion.id = p_suggestion_id
      and suggestion.source_playlist_id = p_playlist_id
      and suggestion.status = 'needs_review'
      and suggestion.source_playlist_item_id is null
      and suggestion.canonical_track_id is null
    for update;

    if not found then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'playlist_pending_registry_intake_missing',
        'That pending Registry track is no longer editable in this Playlist.',
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_playlist.authority_revision
        )
      );
    else
      v_changed :=
        v_suggestion.playlist_note is distinct from v_note;

      if v_changed then
        update public.registry_provider_track_suggestions suggestion
        set playlist_note = v_note
        where suggestion.id = p_suggestion_id;

        update public.wk_playlists playlist
        set authority_revision = playlist.authority_revision + 1
        where playlist.id = p_playlist_id
        returning playlist.authority_revision
        into v_playlist.authority_revision;
      end if;

      v_result := jsonb_build_object(
        'playlist_id', p_playlist_id,
        'suggestion_id', p_suggestion_id,
        'authority_revision', v_playlist.authority_revision,
        'changed', v_changed,
        'notes', v_note,
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
on function public.save_playlist_pending_registry_note(
  uuid, uuid, bigint, text, text, uuid
)
from public, anon, service_role;

grant execute
on function public.save_playlist_pending_registry_note(
  uuid, uuid, bigint, text, text, uuid
)
to authenticated;

create or replace function public.move_playlist_pending_registry_intake(
  p_playlist_id uuid,
  p_suggestion_id uuid,
  p_expected_authority_revision bigint,
  p_direction text,
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
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_target_item_id uuid;
  v_target_suggestion_id uuid;
  v_target_position integer;
  v_temp_position integer;
  v_direction text := lower(btrim(coalesce(p_direction, '')));
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_changed boolean := false;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  if p_playlist_id is null
     or p_suggestion_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_direction not in ('up', 'down')
  then
    raise exception
      'Playlist, pending Registry track, expected revision, and move direction are required.';
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
    'suggestion_id', p_suggestion_id,
    'expected_authority_revision', p_expected_authority_revision,
    'direction', v_direction,
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

  if v_playlist.authority_revision <> p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before this pending track could be moved.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_playlist.authority_revision
      )
    );
  else
    select suggestion.*
    into v_suggestion
    from public.registry_provider_track_suggestions suggestion
    where suggestion.id = p_suggestion_id
      and suggestion.source_playlist_id = p_playlist_id
      and suggestion.status = 'needs_review'
      and suggestion.source_playlist_item_id is null
      and suggestion.canonical_track_id is null
    for update;

    if not found then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'playlist_pending_registry_intake_missing',
        'That pending Registry track is no longer reorderable in this Playlist.',
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_playlist.authority_revision
        )
      );
    else
      v_target_position :=
        v_suggestion.reserved_position
        + case when v_direction = 'up' then -1 else 1 end;

      if v_target_position > 0 then
        select item.id
        into v_target_item_id
        from public.wk_playlist_items item
        where item.playlist_id = p_playlist_id
          and item.lifecycle_state = 'active'
          and item.position = v_target_position
        for update;

        select suggestion.id
        into v_target_suggestion_id
        from public.registry_provider_track_suggestions suggestion
        where suggestion.source_playlist_id = p_playlist_id
          and suggestion.id <> p_suggestion_id
          and suggestion.status = 'needs_review'
          and suggestion.source_playlist_item_id is null
          and suggestion.canonical_track_id is null
          and suggestion.reserved_position = v_target_position
        for update;

        if v_target_item_id is not null
           and v_target_suggestion_id is not null
        then
          raise exception
            'Playlist position authority is corrupt: two entries occupy the target position.';
        end if;

        if v_target_item_id is not null
           or v_target_suggestion_id is not null
        then
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
          ) + 100
          into v_temp_position;

          update public.registry_provider_track_suggestions suggestion
          set reserved_position = v_temp_position
          where suggestion.id = p_suggestion_id;

          if v_target_item_id is not null then
            update public.wk_playlist_items item
            set position = v_suggestion.reserved_position
            where item.id = v_target_item_id;
          else
            update public.registry_provider_track_suggestions suggestion
            set reserved_position = v_suggestion.reserved_position
            where suggestion.id = v_target_suggestion_id;
          end if;

          update public.registry_provider_track_suggestions suggestion
          set reserved_position = v_target_position
          where suggestion.id = p_suggestion_id;

          update public.wk_playlists playlist
          set authority_revision = playlist.authority_revision + 1
          where playlist.id = p_playlist_id
          returning playlist.authority_revision
          into v_playlist.authority_revision;

          v_changed := true;
        end if;
      end if;

      v_result := jsonb_build_object(
        'playlist_id', p_playlist_id,
        'suggestion_id', p_suggestion_id,
        'authority_revision', v_playlist.authority_revision,
        'changed', v_changed,
        'reserved_position',
          case
            when v_changed then v_target_position
            else v_suggestion.reserved_position
          end,
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
on function public.move_playlist_pending_registry_intake(
  uuid, uuid, bigint, text, text, uuid
)
from public, anon, service_role;

grant execute
on function public.move_playlist_pending_registry_intake(
  uuid, uuid, bigint, text, text, uuid
)
to authenticated;

create or replace function editorial.carry_playlist_registry_intake_note_to_item()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.source_playlist_item_id is not null
     and (
       new.source_playlist_item_id is distinct from old.source_playlist_item_id
       or new.playlist_note is distinct from old.playlist_note
     )
  then
    update public.wk_playlist_items item
    set notes = new.playlist_note
    where item.id = new.source_playlist_item_id
      and item.playlist_id = new.source_playlist_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists
  registry_provider_track_suggestion_carry_playlist_note
on public.registry_provider_track_suggestions;

create trigger registry_provider_track_suggestion_carry_playlist_note
after update of source_playlist_item_id, playlist_note
on public.registry_provider_track_suggestions
for each row
execute function editorial.carry_playlist_registry_intake_note_to_item();

commit;
