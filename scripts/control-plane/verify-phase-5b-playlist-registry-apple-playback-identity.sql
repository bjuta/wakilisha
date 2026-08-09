do $phase_5b_m219_verify$
declare
  v_definition text;
  v_siaka_apple_id text;
begin
  if to_regprocedure(
       'editorial.materialize_playlist_publication_snapshot(uuid,timestamp with time zone,uuid,uuid)'
     ) is null
  then
    raise exception
      'STOP: Playlist publication materializer is missing';
  end if;

  select pg_get_functiondef(
    'editorial.materialize_playlist_publication_snapshot(uuid,timestamp with time zone,uuid,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'apple_music_catalog_id'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: Public Playlist snapshot does not preserve Apple Music catalog identity';
  end if;

  if position(
       'registry_track_provider_links'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: Public Playlist snapshot does not consult canonical provider links';
  end if;

  if position(
       'apple_music_track_id'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: Public Playlist snapshot lacks legacy Registry metadata compatibility';
  end if;

  select coalesce(
    (
      select nullif(
        btrim(link.provider_track_id),
        ''
      )
      from public.registry_track_provider_links link
      where link.track_id =
            track.id
        and link.provider_key =
            'apple_music'
        and link.match_status =
            'matched'
      order by
        link.match_confidence desc,
        link.last_checked_at desc,
        link.created_at desc
      limit 1
    ),
    nullif(
      btrim(
        track.metadata
          ->> 'apple_music_track_id'
      ),
      ''
    )
  )
  into v_siaka_apple_id
  from public.registry_tracks track
  where track.id =
    '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid
    and track.status = 'active';

  if v_siaka_apple_id is null then
    raise exception
      'STOP: Siaka has no public Apple Music song identity';
  end if;

  if exists (
    select 1
    from editorial.playlist_publication_snapshots snapshot
    where snapshot.playlist_id =
      '8b7808f6-4c6d-4d0a-965c-ff6b08e2ed57'::uuid
  ) then
    raise exception
      'STOP: Real Phase 5B Playlist was unexpectedly published';
  end if;

  raise notice
    'PASS: Playlist snapshots preserve alternate Apple Music identity. Siaka catalog id=%',
    v_siaka_apple_id;
end;
$phase_5b_m219_verify$;
