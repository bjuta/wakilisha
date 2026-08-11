do $phase_5b_m233_verify$
declare
  v_helper_definition text;
  v_resolver_definition text;
  v_playlist_id uuid;
  v_version_id uuid;
  v_expected_item_count integer;
  v_payload jsonb;
begin
  if to_regprocedure(
       'editorial.playlist_version_public_presentation_json(uuid)'
     ) is null
  then
    raise exception
      'FAIL: M233 Playlist Preview presentation helper is missing';
  end if;

  if to_regprocedure(
       'public.resolve_playlist_preview_nonce(text)'
     ) is null
  then
    raise exception
      'FAIL: Playlist Preview resolver is missing';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.playlist_version_public_presentation_json(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.playlist_version_public_presentation_json(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Internal Playlist Preview presentation helper is directly executable by clients';
  end if;

  if not has_function_privilege(
       'anon',
       'public.resolve_playlist_preview_nonce(text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.resolve_playlist_preview_nonce(text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Version-bound Playlist Preview resolver is not publicly callable';
  end if;

  select pg_get_functiondef(
    'editorial.playlist_version_public_presentation_json(uuid)'::regprocedure
  )
  into v_helper_definition;

  if position('resolve_media_asset_delivery' in v_helper_definition) = 0
     or position('registry_track_artists' in v_helper_definition) = 0
     or position('apple_music_catalog_id' in v_helper_definition) = 0
     or position('''tracks''' in v_helper_definition) = 0
     or position('''playback''' in v_helper_definition) = 0
     or position('''provenance''' in v_helper_definition) = 0
     or position('''credits''' in v_helper_definition) = 0
     or position('''citations''' in v_helper_definition) = 0
     or position('''corrections''' in v_helper_definition) = 0
  then
    raise exception
      'FAIL: M233 Preview presentation does not match the public Playlist model contract';
  end if;

  select pg_get_functiondef(
    'public.resolve_playlist_preview_nonce(text)'::regprocedure
  )
  into v_resolver_definition;

  if position(
       'playlist_version_public_presentation_json'
       in v_resolver_definition
     ) = 0
     or position('''preview_nonce''' in v_resolver_definition) = 0
     or position('''preview_expires_at''' in v_resolver_definition) = 0
     or position(
       'playlist_version_snapshot_json'
       in v_resolver_definition
     ) > 0
  then
    raise exception
      'FAIL: Playlist Preview resolver is not bound to the M233 public presentation helper';
  end if;

  select
    playlist.id,
    binding.current_published_version_id
  into
    v_playlist_id,
    v_version_id
  from public.wk_playlists playlist
  join editorial.playlist_resources binding
    on binding.playlist_id = playlist.id
  where playlist.slug =
          'top-50-kenyan-songs-of-2025'
  limit 1;

  if v_playlist_id is not null
     and v_version_id is not null
  then
    select version.item_count
    into v_expected_item_count
    from editorial.playlist_versions version
    where version.id = v_version_id;

    v_payload :=
      editorial.playlist_version_public_presentation_json(
        v_version_id
      );

    if v_payload is null then
      raise exception
        'FAIL: M233 could not present the published Top 50 version';
    end if;

    if nullif(v_payload ->> 'playlist_id', '')::uuid
         is distinct from v_playlist_id
       or nullif(v_payload ->> 'version_id', '')::uuid
            is distinct from v_version_id
    then
      raise exception
        'FAIL: M233 presentation is not bound to the requested immutable version';
    end if;

    if jsonb_typeof(v_payload -> 'tracks') <> 'array'
       or jsonb_array_length(v_payload -> 'tracks')
            <> v_expected_item_count
    then
      raise exception
        'FAIL: M233 Playlist Preview track collection does not match the immutable version';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_payload -> 'tracks') track
      where jsonb_typeof(track -> 'artists') <> 'array'
         or jsonb_typeof(track -> 'playback') <> 'object'
         or not (track -> 'playback') ? 'engine'
    )
    then
      raise exception
        'FAIL: M233 Playlist Preview track presentation is incomplete';
    end if;

    if jsonb_typeof(v_payload -> 'provenance') <> 'object'
       or jsonb_typeof(v_payload -> 'credits') <> 'array'
       or jsonb_typeof(v_payload -> 'citations') <> 'array'
       or jsonb_typeof(v_payload -> 'corrections') <> 'array'
    then
      raise exception
        'FAIL: M233 Playlist Preview Trust or provenance presentation is incomplete';
    end if;

    if v_payload #>> '{provenance,published_at}'
         is not null
    then
      raise exception
        'FAIL: An unpublished Preview must not claim a publication timestamp';
    end if;
  end if;
end;
$phase_5b_m233_verify$;

select jsonb_build_object(
  'verification', 'PASS',
  'preview_helper',
    'editorial.playlist_version_public_presentation_json(uuid)',
  'preview_resolver',
    'public.resolve_playlist_preview_nonce(text)',
  'publication_snapshot_created', false
) as phase_5b_m233_playlist_preview_public_presentation;
