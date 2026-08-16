-- WAKILISHA M8C.1 Personal Playlist duplicate confirmation.
--
-- Accidental duplicate Track adds remain rejected.
-- A duplicate is accepted only when the authenticated owner explicitly
-- retries with p_allow_duplicate = true after client guidance.

drop function if exists
public.add_personal_playlist_track(uuid,bigint,uuid,text,uuid);

create or replace function public.add_personal_playlist_track(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_registry_track_id uuid,
  p_idempotency_key text default null,
  p_correlation_id uuid default null,
  p_allow_duplicate boolean default false
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
    'allow_duplicate', coalesce(p_allow_duplicate, false),
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
  elsif not coalesce(p_allow_duplicate, false)
    and exists (
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
on function public.add_personal_playlist_track(uuid,bigint,uuid,text,uuid,boolean)
from public, anon;

grant execute
on function public.add_personal_playlist_track(uuid,bigint,uuid,text,uuid,boolean)
to authenticated, service_role;

delete from private.phase_0a_rpc_classification
where function_signature =
  'add_personal_playlist_track(uuid,bigint,uuid,text,uuid)';

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale,
  reviewed_at
)
values (
  'add_personal_playlist_track(uuid,bigint,uuid,text,uuid,boolean)',
  'authenticated_self_service',
  'Adds one active Registry Track to an owned Personal Playlist. Duplicate Tracks remain blocked unless the owner explicitly confirms p_allow_duplicate=true.',
  now()
)
on conflict (function_signature)
do update set
  access_class = excluded.access_class,
  rationale = excluded.rationale,
  reviewed_at = excluded.reviewed_at;
