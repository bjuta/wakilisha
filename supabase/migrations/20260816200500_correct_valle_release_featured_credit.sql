do $$
declare
  v_release_id uuid;
  v_release_count integer;
  v_active_relationship_count integer;
  v_primary_count integer;
  v_matata_count integer;
  v_djames_bad_count integer;
  v_updated integer;
  v_djames_fixed_count integer;
begin
  select count(*)
    into v_release_count
  from public.registry_releases release
  where release.slug = 'valle-single'
    and release.title = 'Valle - Single'
    and release.status = 'active'
    and release.metadata ->> 'source' = 'apple_music_ingest'
    and release.metadata ->> 'apple_music_album_id' = '6786722212';

  if v_release_count <> 1 then
    raise exception
      'STOP: Valle release authority changed. Expected one active Apple Music Release, found %.',
      v_release_count;
  end if;

  select release.id
    into v_release_id
  from public.registry_releases release
  where release.slug = 'valle-single'
    and release.title = 'Valle - Single'
    and release.status = 'active'
    and release.metadata ->> 'source' = 'apple_music_ingest'
    and release.metadata ->> 'apple_music_album_id' = '6786722212';

  select count(*)
    into v_active_relationship_count
  from public.registry_release_artists relationship
  where relationship.release_id = v_release_id
    and relationship.status = 'active';

  if v_active_relationship_count <> 2 then
    raise exception
      'STOP: Valle active Release Artist relationship count changed. Expected 2, found %.',
      v_active_relationship_count;
  end if;

  select count(*)
    into v_primary_count
  from public.registry_release_artists relationship
  where relationship.release_id = v_release_id
    and relationship.status = 'active'
    and relationship.role = 'primary_artist'
    and relationship.is_primary is true
    and relationship.is_featured is false;

  if v_primary_count <> 2 then
    raise exception
      'STOP: Valle precondition changed. Expected exactly 2 active primary relationships, found %.',
      v_primary_count;
  end if;

  select count(*)
    into v_matata_count
  from public.registry_release_artists relationship
  join public.registry_artists artist
    on artist.id = relationship.artist_id
   and artist.status = 'active'
  where relationship.release_id = v_release_id
    and artist.slug = 'matata'
    and relationship.artist_slug = 'matata'
    and relationship.artist_name_text = 'Matata'
    and relationship.role = 'primary_artist'
    and relationship.is_primary is true
    and relationship.is_featured is false
    and relationship.credit_order = 1
    and relationship.source = 'apple_music_ingest'
    and relationship.confidence = 90
    and relationship.status = 'active'
    and relationship.metadata ->> 'apple_music_album_id' = '6786722212';

  if v_matata_count <> 1 then
    raise exception
      'STOP: Matata primary authority changed. Expected one canonical Matata primary relationship.';
  end if;

  select count(*)
    into v_djames_bad_count
  from public.registry_release_artists relationship
  where relationship.release_id = v_release_id
    and relationship.artist_id is null
    and relationship.artist_slug = 'djames'
    and relationship.artist_name_text = 'DJames'
    and relationship.role = 'primary_artist'
    and relationship.is_primary is true
    and relationship.is_featured is false
    and relationship.credit_order = 2
    and relationship.source = 'apple_music_ingest'
    and relationship.confidence = 50
    and relationship.status = 'active'
    and relationship.metadata ->> 'apple_music_album_id' = '6786722212'
    and relationship.metadata ->> 'resolved_by' = 'text_only';

  if v_djames_bad_count <> 1 then
    raise exception
      'STOP: DJames bad Valle relationship changed. Expected one text-only primary relationship.';
  end if;

  update public.registry_release_artists relationship
  set
    role = 'featured_artist',
    is_primary = false,
    is_featured = true
  where relationship.release_id = v_release_id
    and relationship.artist_id is null
    and relationship.artist_slug = 'djames'
    and relationship.artist_name_text = 'DJames'
    and relationship.role = 'primary_artist'
    and relationship.is_primary is true
    and relationship.is_featured is false
    and relationship.credit_order = 2
    and relationship.source = 'apple_music_ingest'
    and relationship.confidence = 50
    and relationship.status = 'active'
    and relationship.metadata ->> 'apple_music_album_id' = '6786722212'
    and relationship.metadata ->> 'resolved_by' = 'text_only';

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception
      'STOP: Valle correction updated % rows instead of exactly 1.',
      v_updated;
  end if;

  select count(*)
    into v_primary_count
  from public.registry_release_artists relationship
  where relationship.release_id = v_release_id
    and relationship.status = 'active'
    and relationship.role = 'primary_artist'
    and relationship.is_primary is true
    and relationship.is_featured is false;

  if v_primary_count <> 1 then
    raise exception
      'STOP: Valle postcondition failed. Expected exactly 1 active primary relationship, found %.',
      v_primary_count;
  end if;

  select count(*)
    into v_matata_count
  from public.registry_release_artists relationship
  join public.registry_artists artist
    on artist.id = relationship.artist_id
   and artist.status = 'active'
  where relationship.release_id = v_release_id
    and artist.slug = 'matata'
    and relationship.artist_slug = 'matata'
    and relationship.artist_name_text = 'Matata'
    and relationship.role = 'primary_artist'
    and relationship.is_primary is true
    and relationship.is_featured is false
    and relationship.credit_order = 1
    and relationship.source = 'apple_music_ingest'
    and relationship.confidence = 90
    and relationship.status = 'active'
    and relationship.metadata ->> 'apple_music_album_id' = '6786722212';

  if v_matata_count <> 1 then
    raise exception
      'STOP: Matata is not the sole preserved Valle primary after correction.';
  end if;

  select count(*)
    into v_djames_fixed_count
  from public.registry_release_artists relationship
  where relationship.release_id = v_release_id
    and relationship.artist_id is null
    and relationship.artist_slug = 'djames'
    and relationship.artist_name_text = 'DJames'
    and relationship.role = 'featured_artist'
    and relationship.is_primary is false
    and relationship.is_featured is true
    and relationship.credit_order = 2
    and relationship.source = 'apple_music_ingest'
    and relationship.confidence = 50
    and relationship.status = 'active'
    and relationship.metadata ->> 'apple_music_album_id' = '6786722212'
    and relationship.metadata ->> 'resolved_by' = 'text_only';

  if v_djames_fixed_count <> 1 then
    raise exception
      'STOP: DJames featured-credit postcondition failed.';
  end if;
end
$$;
