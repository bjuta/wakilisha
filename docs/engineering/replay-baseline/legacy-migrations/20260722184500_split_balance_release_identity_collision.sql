do $migration$
declare
  v_savara_release_id uuid :=
    'd751a31a-b884-413b-81db-6b58dfab9d4b';

  v_savara_track_id uuid :=
    'f8aeedc3-4318-4f97-ac0c-636eaa5815a6';

  v_nyashinski_track_id uuid :=
    'b25018a7-2820-40f0-a959-02db0898f59d';

  v_savara_artist_id uuid :=
    '785bea25-730b-4b5a-af39-a8887438aab8';

  v_nyashinski_artist_id uuid :=
    'b46d899d-537b-4c6e-9f5a-f6a0e93dae46';

  v_savara_membership_id uuid :=
    '29023673-fea0-4be2-800a-f452f438a232';

  v_nyashinski_membership_id uuid :=
    'dd53905e-7849-4360-8d80-cda7627bd480';

  v_nyashinski_release_id uuid;
  v_count integer;
  v_nyashinski_artwork_url text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'wakilisha_balance_release_identity_split',
      0
    )
  );

  select count(*)
  into v_count
  from public.registry_releases
  where id = v_savara_release_id
    and metadata ->> 'apple_music_album_id' =
      '1594997038'
    and upc = '192641867316';

  if v_count <> 1 then
    raise exception
      'Savara Balance release preflight failed.';
  end if;

  select count(*)
  into v_count
  from public.registry_tracks
  where id = v_savara_track_id
    and isrc = 'USA2P2145578'
    and metadata ->> 'apple_music_track_id' =
      '1594997039';

  if v_count <> 1 then
    raise exception
      'Savara Balance track preflight failed.';
  end if;

  select count(*)
  into v_count
  from public.registry_tracks
  where id = v_nyashinski_track_id
    and isrc = 'ZA56E1901003'
    and metadata ->> 'apple_music_album_id' =
      '1832011670'
    and metadata ->> 'apple_music_track_id' =
      '1832012025';

  if v_count <> 1 then
    raise exception
      'Nyashinski Balance track preflight failed.';
  end if;

  select count(*)
  into v_count
  from public.registry_release_tracks
  where release_id = v_savara_release_id
    and status = 'active';

  if v_count <> 2 then
    raise exception
      'Expected two active memberships on collided release, found %.',
      v_count;
  end if;

  select count(*)
  into v_count
  from public.registry_release_tracks
  where id in (
    v_savara_membership_id,
    v_nyashinski_membership_id
  )
    and release_id = v_savara_release_id;

  if v_count <> 2 then
    raise exception
      'Expected collision membership rows were not found.';
  end if;

  select artwork_url
  into v_nyashinski_artwork_url
  from public.registry_tracks
  where id = v_nyashinski_track_id
  for update;

  select id
  into v_nyashinski_release_id
  from public.registry_releases
  where id <> v_savara_release_id
    and metadata ->> 'apple_music_album_id' =
      '1832011670'
  order by created_at asc
  limit 1
  for update;

  if v_nyashinski_release_id is null then
    v_nyashinski_release_id :=
      gen_random_uuid();

    insert into public.registry_releases (
      id,
      slug,
      title,
      normalized_title,
      release_type,
      release_date,
      artwork_url,
      description,
      status,
      metadata
    )
    values (
      v_nyashinski_release_id,
      'balance-single',
      'Balance - Single',
      'balance single',
      'single',
      date '2019-08-23',
      v_nyashinski_artwork_url,
      'Balance - Single is a single by Nyashinski, released on August 23, 2019 through Sony Music Entertainment East Africa Limited.',
      'active',
      jsonb_build_object(
        'source',
        'apple_music_ingest',

        'apple_music_album_id',
        '1832011670',

        'apple_music_url',
        'https://music.apple.com/ke/album/balance-single/1832011670',

        'genre_names',
        jsonb_build_array(
          'Afro-Pop',
          'Music'
        ),

        'record_label',
        'Sony Music Entertainment East Africa Limited',

        'repair_reason',
        'split_cross_artist_release_identity_collision',

        'repaired_from_release_id',
        v_savara_release_id,

        'repaired_at',
        now()
      )
    );
  else
    update public.registry_releases
    set
      slug = 'balance-single',
      title = 'Balance - Single',
      normalized_title = 'balance single',
      release_type = 'single',
      release_date = date '2019-08-23',
      artwork_url = v_nyashinski_artwork_url,
      description =
        'Balance - Single is a single by Nyashinski, released on August 23, 2019 through Sony Music Entertainment East Africa Limited.',
      status = 'active',
      metadata =
        coalesce(metadata, '{}'::jsonb)
        ||
        jsonb_build_object(
          'apple_music_album_id',
          '1832011670',

          'apple_music_url',
          'https://music.apple.com/ke/album/balance-single/1832011670',

          'repair_reason',
          'split_cross_artist_release_identity_collision',

          'repaired_from_release_id',
          v_savara_release_id,

          'repaired_at',
          now()
        ),
      updated_at = now()
    where id = v_nyashinski_release_id;
  end if;

  update public.registry_releases
  set
    description =
      'Balance - Single is a single by Savara, released on December 10, 2021 through Exodus Entertainment.',
    metadata =
      coalesce(metadata, '{}'::jsonb)
      ||
      jsonb_build_object(
        'apple_music_album_id',
        '1594997038',

        'apple_music_url',
        'https://music.apple.com/ke/album/balance-single/1594997038',

        'record_label',
        'Exodus Entertainment',

        'repair_reason',
        'split_cross_artist_release_identity_collision',

        'split_release_id',
        v_nyashinski_release_id,

        'repaired_at',
        now()
      ),
    updated_at = now()
  where id = v_savara_release_id;

  delete from public.registry_release_artists
  where release_id = v_savara_release_id;

  insert into public.registry_release_artists (
    release_id,
    artist_id,
    artist_slug,
    artist_name_text,
    role,
    is_primary,
    is_featured,
    credit_order,
    source,
    confidence,
    status,
    metadata
  )
  values (
    v_savara_release_id,
    v_savara_artist_id,
    'savara',
    'Savara',
    'primary_artist',
    true,
    false,
    1,
    'apple_music_ingest',
    100,
    'active',
    jsonb_build_object(
      'apple_music_album_id',
      '1594997038',

      'repair_reason',
      'split_cross_artist_release_identity_collision'
    )
  );

  delete from public.registry_release_artists
  where release_id = v_nyashinski_release_id;

  insert into public.registry_release_artists (
    release_id,
    artist_id,
    artist_slug,
    artist_name_text,
    role,
    is_primary,
    is_featured,
    credit_order,
    source,
    confidence,
    status,
    metadata
  )
  values (
    v_nyashinski_release_id,
    v_nyashinski_artist_id,
    'nyashinski',
    'Nyashinski',
    'primary_artist',
    true,
    false,
    1,
    'apple_music_ingest',
    100,
    'active',
    jsonb_build_object(
      'apple_music_album_id',
      '1832011670',

      'repair_reason',
      'split_cross_artist_release_identity_collision'
    )
  );

  if exists (
    select 1
    from public.registry_release_tracks
    where release_id =
      v_nyashinski_release_id
      and track_id =
        v_nyashinski_track_id
      and id <>
        v_nyashinski_membership_id
  ) then
    delete from public.registry_release_tracks
    where id =
      v_nyashinski_membership_id;
  else
    update public.registry_release_tracks
    set
      release_id =
        v_nyashinski_release_id,
      disc_number = 1,
      track_number = 1,
      metadata =
        coalesce(metadata, '{}'::jsonb)
        ||
        jsonb_build_object(
          'apple_music_album_id',
          '1832011670',

          'apple_music_track_id',
          '1832012025',

          'repair_reason',
          'split_cross_artist_release_identity_collision'
        ),
      updated_at = now()
    where id =
      v_nyashinski_membership_id;
  end if;

  update public.registry_release_tracks
  set
    disc_number = 1,
    track_number = 1,
    metadata =
      coalesce(metadata, '{}'::jsonb)
      ||
      jsonb_build_object(
        'apple_music_album_id',
        '1594997038',

        'apple_music_track_id',
        '1594997039',

        'repair_reason',
        'split_cross_artist_release_identity_collision'
      ),
    updated_at = now()
  where id = v_savara_membership_id
    and release_id =
      v_savara_release_id
    and track_id =
      v_savara_track_id;

  select count(*)
  into v_count
  from public.registry_release_tracks
  where release_id = v_savara_release_id
    and track_id = v_savara_track_id
    and status = 'active';

  if v_count <> 1 then
    raise exception
      'Savara release membership postcondition failed.';
  end if;

  select count(*)
  into v_count
  from public.registry_release_tracks
  where release_id =
      v_nyashinski_release_id
    and track_id =
      v_nyashinski_track_id
    and status = 'active';

  if v_count <> 1 then
    raise exception
      'Nyashinski release membership postcondition failed.';
  end if;

  select count(*)
  into v_count
  from public.registry_release_tracks
  where release_id =
      v_savara_release_id
    and track_id =
      v_nyashinski_track_id
    and status = 'active';

  if v_count <> 0 then
    raise exception
      'Nyashinski track remains attached to Savara release.';
  end if;

  select count(*)
  into v_count
  from public.registry_release_artists
  where release_id =
      v_savara_release_id
    and artist_slug = 'savara'
    and is_primary
    and status = 'active';

  if v_count <> 1 then
    raise exception
      'Savara release artist postcondition failed.';
  end if;

  select count(*)
  into v_count
  from public.registry_release_artists
  where release_id =
      v_nyashinski_release_id
    and artist_slug = 'nyashinski'
    and is_primary
    and status = 'active';

  if v_count <> 1 then
    raise exception
      'Nyashinski release artist postcondition failed.';
  end if;
end
$migration$;
