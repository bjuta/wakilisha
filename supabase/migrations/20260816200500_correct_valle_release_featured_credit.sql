do $$
declare
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
  from public.registry_releases r
  where r.id = '03099a3e-866f-4f32-b355-62df6b8e0e10'::uuid
    and r.slug = 'valle-single'
    and r.title = 'Valle - Single';

  if v_release_count <> 1 then
    raise exception
      'STOP: Valle release identity changed. Expected one exact release, found %.',
      v_release_count;
  end if;

  select count(*)
    into v_active_relationship_count
  from public.registry_release_artists ra
  where ra.release_id = '03099a3e-866f-4f32-b355-62df6b8e0e10'::uuid
    and ra.status = 'active';

  if v_active_relationship_count <> 2 then
    raise exception
      'STOP: Valle active Release Artist relationship count changed. Expected 2, found %.',
      v_active_relationship_count;
  end if;

  select count(*)
    into v_primary_count
  from public.registry_release_artists ra
  where ra.release_id = '03099a3e-866f-4f32-b355-62df6b8e0e10'::uuid
    and ra.status = 'active'
    and ra.role = 'primary_artist'
    and ra.is_primary is true
    and ra.is_featured is false;

  if v_primary_count <> 2 then
    raise exception
      'STOP: Valle precondition changed. Expected exactly 2 active primary relationships, found %.',
      v_primary_count;
  end if;

  select count(*)
    into v_matata_count
  from public.registry_release_artists ra
  where ra.id = '016f4cd5-0faf-42e9-bad9-fadadf581f64'::uuid
    and ra.release_id = '03099a3e-866f-4f32-b355-62df6b8e0e10'::uuid
    and ra.artist_id = '0d121663-dc75-43be-ac18-8e37eb52e36a'::uuid
    and ra.artist_slug = 'matata'
    and ra.artist_name_text = 'Matata'
    and ra.role = 'primary_artist'
    and ra.is_primary is true
    and ra.is_featured is false
    and ra.credit_order = 1
    and ra.source = 'apple_music_ingest'
    and ra.confidence = 90
    and ra.status = 'active'
    and ra.metadata ->> 'apple_music_album_id' = '6786722212';

  if v_matata_count <> 1 then
    raise exception
      'STOP: Matata primary authority changed. Expected exact relationship 016f4cd5-0faf-42e9-bad9-fadadf581f64.';
  end if;

  select count(*)
    into v_djames_bad_count
  from public.registry_release_artists ra
  where ra.id = 'f2e5cf04-5a55-4c6d-94ef-fbe1b3d03660'::uuid
    and ra.release_id = '03099a3e-866f-4f32-b355-62df6b8e0e10'::uuid
    and ra.artist_id is null
    and ra.artist_slug = 'djames'
    and ra.artist_name_text = 'DJames'
    and ra.role = 'primary_artist'
    and ra.is_primary is true
    and ra.is_featured is false
    and ra.credit_order = 2
    and ra.source = 'apple_music_ingest'
    and ra.confidence = 50
    and ra.status = 'active'
    and ra.metadata ->> 'apple_music_album_id' = '6786722212'
    and ra.metadata ->> 'resolved_by' = 'text_only';

  if v_djames_bad_count <> 1 then
    raise exception
      'STOP: DJames bad Valle relationship changed. Expected exact relationship f2e5cf04-5a55-4c6d-94ef-fbe1b3d03660.';
  end if;

  update public.registry_release_artists
  set
    role = 'featured_artist',
    is_primary = false,
    is_featured = true
  where id = 'f2e5cf04-5a55-4c6d-94ef-fbe1b3d03660'::uuid
    and release_id = '03099a3e-866f-4f32-b355-62df6b8e0e10'::uuid
    and artist_id is null
    and artist_slug = 'djames'
    and artist_name_text = 'DJames'
    and role = 'primary_artist'
    and is_primary is true
    and is_featured is false
    and credit_order = 2
    and source = 'apple_music_ingest'
    and confidence = 50
    and status = 'active'
    and metadata ->> 'apple_music_album_id' = '6786722212'
    and metadata ->> 'resolved_by' = 'text_only';

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception
      'STOP: Valle correction updated % rows instead of exactly 1.',
      v_updated;
  end if;

  select count(*)
    into v_primary_count
  from public.registry_release_artists ra
  where ra.release_id = '03099a3e-866f-4f32-b355-62df6b8e0e10'::uuid
    and ra.status = 'active'
    and ra.role = 'primary_artist'
    and ra.is_primary is true
    and ra.is_featured is false;

  if v_primary_count <> 1 then
    raise exception
      'STOP: Valle postcondition failed. Expected exactly 1 active primary relationship, found %.',
      v_primary_count;
  end if;

  select count(*)
    into v_matata_count
  from public.registry_release_artists ra
  where ra.id = '016f4cd5-0faf-42e9-bad9-fadadf581f64'::uuid
    and ra.release_id = '03099a3e-866f-4f32-b355-62df6b8e0e10'::uuid
    and ra.artist_id = '0d121663-dc75-43be-ac18-8e37eb52e36a'::uuid
    and ra.artist_slug = 'matata'
    and ra.role = 'primary_artist'
    and ra.is_primary is true
    and ra.is_featured is false
    and ra.credit_order = 1
    and ra.status = 'active';

  if v_matata_count <> 1 then
    raise exception
      'STOP: Matata is not the sole preserved Valle primary after correction.';
  end if;

  select count(*)
    into v_djames_fixed_count
  from public.registry_release_artists ra
  where ra.id = 'f2e5cf04-5a55-4c6d-94ef-fbe1b3d03660'::uuid
    and ra.release_id = '03099a3e-866f-4f32-b355-62df6b8e0e10'::uuid
    and ra.artist_id is null
    and ra.artist_slug = 'djames'
    and ra.artist_name_text = 'DJames'
    and ra.role = 'featured_artist'
    and ra.is_primary is false
    and ra.is_featured is true
    and ra.credit_order = 2
    and ra.source = 'apple_music_ingest'
    and ra.confidence = 50
    and ra.status = 'active'
    and ra.metadata ->> 'apple_music_album_id' = '6786722212'
    and ra.metadata ->> 'resolved_by' = 'text_only';

  if v_djames_fixed_count <> 1 then
    raise exception
      'STOP: DJames featured-credit postcondition failed.';
  end if;
end
$$;
