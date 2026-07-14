-- Consolidate duplicate Wanavokali "Tequila" tracks into one canonical record.
--
-- Survivor:
--   70bc4495-e1a5-4f91-901d-a9b13658824f
--   tequila-2 -> tequila
--
-- Redundant:
--   ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea
--   tequila-3 -> deleted after provenance is preserved
--
-- Reviewed live-schema audit SHA256:
--   43f8ba6a014682a2d309e8291f84f63e1f61eb7276e519d2092ec353c4d9316b
--
-- Final preflight SHA256:
--   ee956fdd7a2be5e31404884c24e3bd08259429cfa9e3acbde788c4304f1f3992

begin;

do $tequila_preconditions$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(
    hashtext(
      'wakilisha:consolidate-wanavokali-tequila'
    )
  );

  if to_regclass(
    'public.wk_slug_redirects_scoped_path_unique'
  ) is null then
    raise exception
      'Path-aware scoped redirect index is not active';
  end if;

  if to_regclass(
    'public.wk_slug_redirects_scoped_entity_unique'
  ) is not null then
    raise exception
      'Legacy slug-only scoped redirect index still exists';
  end if;

  select count(*)
  into v_count
  from public.registry_tracks
  where id in (
    '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
    'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
  );

  if v_count <> 2 then
    raise exception
      'Expected two exact Tequila candidate tracks, found %',
      v_count;
  end if;

  if not exists (
    select 1
    from public.registry_tracks
    where id =
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid
      and title = 'Tequila'
      and slug = 'tequila-2'
      and status = 'active'
      and isrc = 'QZTAY2215705'
      and duration_ms = 237647
      and track_number = 1
      and disc_number = 1
      and release_id is null
      and metadata ->> 'apple_music_album_id' =
        '1653924477'
      and metadata ->> 'apple_music_track_id' =
        '1653924479'
      and not (
        coalesce(metadata, '{}'::jsonb)
        ? 'duplicate_consolidation'
      )
  ) then
    raise exception
      'Reviewed Tequila survivor state changed';
  end if;

  if not exists (
    select 1
    from public.registry_tracks
    where id =
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
      and title = 'Tequila'
      and slug = 'tequila-3'
      and status = 'active'
      and isrc = 'QZTAY2213900'
      and duration_ms = 237647
      and track_number = 1
      and disc_number = 1
      and release_id is null
      and metadata ->> 'apple_music_album_id' =
        '1842097616'
      and metadata ->> 'apple_music_track_id' =
        '1842097617'
  ) then
    raise exception
      'Reviewed redundant Tequila record state changed';
  end if;

  select count(distinct t.id)
  into v_count
  from public.registry_tracks t
  join public.registry_track_artists ta
    on ta.track_id = t.id
   and ta.artist_slug = 'wanavokali'
   and ta.status in (
     'active',
     'needs_review',
     'draft'
   )
  where lower(btrim(t.title)) = 'tequila'
     or t.slug ~ '^tequila(-[0-9]+)?$';

  if v_count <> 2 then
    raise exception
      'Expected exactly two Wanavokali Tequila records, found %',
      v_count;
  end if;

  if exists (
    select 1
    from public.registry_tracks conflicting_track
    join public.registry_track_artists conflicting_artist
      on conflicting_artist.track_id =
        conflicting_track.id
     and conflicting_artist.artist_slug =
        'wanavokali'
     and conflicting_artist.status in (
       'active',
       'needs_review',
       'draft'
     )
     and coalesce(
       conflicting_artist.is_primary,
       false
     ) = true
    where conflicting_track.slug = 'tequila'
      and conflicting_track.id not in (
        '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
        'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
      )
  ) then
    raise exception
      'Canonical Wanavokali slug tequila is already occupied';
  end if;

  select count(*)
  into v_count
  from public.registry_track_artists
  where track_id in (
    '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
    'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
  );

  if v_count <> 2 then
    raise exception
      'Expected two exact Tequila artist rows, found %',
      v_count;
  end if;

  if exists (
    select 1
    from public.registry_track_artists
    where track_id in (
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
    )
      and (
        artist_id is distinct from
          '417a9fd9-7115-49f9-a528-6ba57b06b303'::uuid
        or artist_slug is distinct from 'wanavokali'
        or artist_name_text is distinct from 'Wanavokali'
        or coalesce(is_primary, false) is distinct from true
        or coalesce(is_featured, false) is distinct from false
        or status is distinct from 'active'
        or role is distinct from 'primary_artist'
      )
  ) then
    raise exception
      'Reviewed Wanavokali artist relationships changed';
  end if;

  select count(*)
  into v_count
  from public.registry_release_tracks
  where track_id in (
    '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
    'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
  );

  if v_count <> 4 then
    raise exception
      'Expected four orphan release memberships, found %',
      v_count;
  end if;

  if exists (
    select 1
    from public.registry_release_tracks rt
    join public.registry_releases r
      on r.id = rt.release_id
    where rt.track_id in (
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
    )
  ) then
    raise exception
      'A reviewed orphan release membership now points to a live release';
  end if;

  select count(*)
  into v_count
  from public.registry_entity_index
  where entity_type = 'track'
    and entity_id in (
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
    );

  if v_count <> 2 then
    raise exception
      'Expected two Tequila entity-index rows, found %',
      v_count;
  end if;

  if not exists (
    select 1
    from public.registry_entity_index
    where entity_type = 'track'
      and entity_id =
        '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid
      and slug = 'tequila-2'
      and status = 'active'
      and review_status = 'authoritative'
      and public_safe = true
  ) then
    raise exception
      'Reviewed survivor entity-index row changed';
  end if;

  if not exists (
    select 1
    from public.registry_entity_index
    where entity_type = 'track'
      and entity_id =
        'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
      and slug = 'tequila-3'
      and status = 'active'
      and review_status = 'authoritative'
      and public_safe = true
  ) then
    raise exception
      'Reviewed redundant entity-index row changed';
  end if;

  if exists (
    select 1
    from public.registry_track_genres
    where track_id in (
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
    )
  ) then
    raise exception
      'Unexpected Tequila genre relationships now exist';
  end if;

  if exists (
    select 1
    from public.registry_track_provider_links
    where track_id in (
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
    )
  ) then
    raise exception
      'Unexpected Tequila provider-link rows now exist';
  end if;

  if exists (
    select 1
    from public.wk_playlist_items
    where registry_track_id in (
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
    )
  ) then
    raise exception
      'Unexpected Tequila playlist references now exist';
  end if;

  if exists (
    select 1
    from public.registry_entity_relationships
    where (
      source_entity_type = 'track'
      and source_slug in (
        'tequila-2',
        'tequila-3'
      )
    )
    or (
      target_entity_type = 'track'
      and target_slug in (
        'tequila-2',
        'tequila-3'
      )
    )
  ) then
    raise exception
      'Unexpected Tequila entity relationships now exist';
  end if;

  if exists (
    select 1
    from public.wk_chart_entries_v2
    where track_slug in (
      'tequila-2',
      'tequila-3'
    )
  ) then
    raise exception
      'Unexpected Tequila chart slug references now exist';
  end if;

  if exists (
    select 1
    from public.wk_slug_redirects
    where entity_type = 'track'
      and (
        old_path in (
          '/tracks/wanavokali/tequila-2',
          '/tracks/wanavokali/tequila-3'
        )
        or new_path =
          '/tracks/wanavokali/tequila'
      )
  ) then
    raise exception
      'A Tequila consolidation redirect already exists';
  end if;
end
$tequila_preconditions$;

insert into public.wk_slug_redirects (
  old_slug,
  new_slug,
  entity_type,
  scope_slug,
  old_path,
  new_path,
  redirect_status,
  created_by,
  updated_at
)
values
  (
    'tequila-2',
    'tequila',
    'track',
    'wanavokali',
    '/tracks/wanavokali/tequila-2',
    '/tracks/wanavokali/tequila',
    308,
    'wanavokali-tequila-consolidation-20260714',
    now()
  ),
  (
    'tequila-3',
    'tequila',
    'track',
    'wanavokali',
    '/tracks/wanavokali/tequila-3',
    '/tracks/wanavokali/tequila',
    308,
    'wanavokali-tequila-consolidation-20260714',
    now()
  );

do $tequila_redirect_gate$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.wk_slug_redirects
  where entity_type = 'track'
    and scope_slug = 'wanavokali'
    and new_slug = 'tequila'
    and new_path = '/tracks/wanavokali/tequila'
    and redirect_status = 308
    and old_path in (
      '/tracks/wanavokali/tequila-2',
      '/tracks/wanavokali/tequila-3'
    );

  if v_count <> 2 then
    raise exception
      'Expected two exact Tequila redirects before consolidation, found %',
      v_count;
  end if;
end
$tequila_redirect_gate$;

do $tequila_mutation$
declare
  v_count integer;
begin
  with updated_track as (
    update public.registry_tracks survivor
    set
      slug = 'tequila',
      metadata =
        coalesce(
          survivor.metadata,
          '{}'::jsonb
        )
        || jsonb_build_object(
          'duplicate_consolidation',
          jsonb_build_object(
            'operation',
              'wanavokali_tequila_consolidation_20260714',
            'consolidated_at',
              now(),
            'survivor_track_id',
              survivor.id,
            'redundant_track_id',
              redundant.id,
            'legacy_slugs',
              jsonb_build_array(
                'tequila-2',
                'tequila-3'
              ),
            'historical_isrcs',
              jsonb_build_array(
                survivor.isrc,
                redundant.isrc
              ),
            'historical_apple_music_track_ids',
              jsonb_build_array(
                survivor.metadata
                  ->> 'apple_music_track_id',
                redundant.metadata
                  ->> 'apple_music_track_id'
              ),
            'historical_apple_music_album_ids',
              jsonb_build_array(
                survivor.metadata
                  ->> 'apple_music_album_id',
                redundant.metadata
                  ->> 'apple_music_album_id'
              ),
            'alternate_preview_url',
              redundant.preview_url,
            'alternate_artwork_url',
              redundant.artwork_url,
            'redundant_record_snapshot',
              jsonb_build_object(
                'id', redundant.id,
                'title', redundant.title,
                'slug', redundant.slug,
                'status', redundant.status,
                'isrc', redundant.isrc,
                'duration_ms', redundant.duration_ms,
                'track_number', redundant.track_number,
                'disc_number', redundant.disc_number,
                'preview_url', redundant.preview_url,
                'artwork_url', redundant.artwork_url,
                'metadata', redundant.metadata,
                'created_at', redundant.created_at,
                'updated_at', redundant.updated_at
              ),
            'orphan_release_memberships',
              (
                select coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'membership_id', rt.id,
                      'track_id', rt.track_id,
                      'release_id', rt.release_id,
                      'disc_number', rt.disc_number,
                      'track_number', rt.track_number,
                      'source', rt.source,
                      'confidence', rt.confidence,
                      'status', rt.status,
                      'metadata', rt.metadata
                    )
                    order by
                      rt.track_id,
                      rt.release_id,
                      rt.id
                  ),
                  '[]'::jsonb
                )
                from public.registry_release_tracks rt
                where rt.track_id in (
                  survivor.id,
                  redundant.id
                )
              )
          )
        ),
      updated_at = now()
    from public.registry_tracks redundant
    where survivor.id =
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid
      and redundant.id =
        'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
      and survivor.slug = 'tequila-2'
      and redundant.slug = 'tequila-3'
    returning survivor.id
  )
  select count(*)
  into v_count
  from updated_track;

  if v_count <> 1 then
    raise exception
      'Expected to update one Tequila survivor, updated %',
      v_count;
  end if;

  with deleted_release_links as (
    delete from public.registry_release_tracks
    where track_id in (
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
    )
    returning id
  )
  select count(*)
  into v_count
  from deleted_release_links;

  if v_count <> 4 then
    raise exception
      'Expected to delete four orphan release memberships, deleted %',
      v_count;
  end if;

  with deleted_artist as (
    delete from public.registry_track_artists
    where track_id =
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
    returning id
  )
  select count(*)
  into v_count
  from deleted_artist;

  if v_count <> 1 then
    raise exception
      'Expected to delete one redundant artist row, deleted %',
      v_count;
  end if;

  with deleted_track as (
    delete from public.registry_tracks
    where id =
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
      and slug = 'tequila-3'
    returning id
  )
  select count(*)
  into v_count
  from deleted_track;

  if v_count <> 1 then
    raise exception
      'Expected to delete one redundant Tequila track, deleted %',
      v_count;
  end if;
end
$tequila_mutation$;

do $tequila_postconditions$
declare
  v_count integer;
begin
  if not exists (
    select 1
    from public.registry_tracks
    where id =
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid
      and title = 'Tequila'
      and slug = 'tequila'
      and status = 'active'
      and isrc = 'QZTAY2215705'
      and duration_ms = 237647
      and metadata
        #> '{duplicate_consolidation,legacy_slugs}'
        = '["tequila-2", "tequila-3"]'::jsonb
      and metadata
        #> '{duplicate_consolidation,historical_isrcs}'
        = '["QZTAY2215705", "QZTAY2213900"]'::jsonb
      and metadata
        #> '{
          duplicate_consolidation,
          historical_apple_music_track_ids
        }'
        = '["1653924479", "1842097617"]'::jsonb
      and metadata
        #> '{
          duplicate_consolidation,
          historical_apple_music_album_ids
        }'
        = '["1653924477", "1842097616"]'::jsonb
      and metadata
        #>> '{
          duplicate_consolidation,
          redundant_record_snapshot,
          id
        }'
        = 'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'
  ) then
    raise exception
      'Canonical Tequila survivor postcondition failed';
  end if;

  if exists (
    select 1
    from public.registry_tracks
    where id =
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
  ) then
    raise exception
      'Redundant Tequila track still exists';
  end if;

  select count(distinct t.id)
  into v_count
  from public.registry_tracks t
  join public.registry_track_artists ta
    on ta.track_id = t.id
   and ta.artist_slug = 'wanavokali'
   and ta.status in (
     'active',
     'needs_review',
     'draft'
   )
  where lower(btrim(t.title)) = 'tequila'
     or t.slug ~ '^tequila(-[0-9]+)?$';

  if v_count <> 1 then
    raise exception
      'Expected one Wanavokali Tequila record after consolidation, found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from public.registry_track_artists
  where track_id =
    '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid
    and artist_slug = 'wanavokali'
    and status = 'active'
    and coalesce(is_primary, false) = true;

  if v_count <> 1 then
    raise exception
      'Canonical Tequila artist relationship postcondition failed';
  end if;

  if exists (
    select 1
    from public.registry_track_artists
    where track_id =
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
  ) then
    raise exception
      'Redundant Tequila artist relationship still exists';
  end if;

  if exists (
    select 1
    from public.registry_release_tracks
    where track_id in (
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid,
      'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
    )
  ) then
    raise exception
      'Orphan Tequila release memberships still exist';
  end if;

  select count(*)
  into v_count
  from public.registry_entity_index
  where entity_type = 'track'
    and entity_id =
      '70bc4495-e1a5-4f91-901d-a9b13658824f'::uuid
    and slug = 'tequila'
    and name = 'Tequila'
    and status = 'active'
    and review_status = 'authoritative'
    and public_safe = true;

  if v_count <> 1 then
    raise exception
      'Canonical Tequila entity-index postcondition failed';
  end if;

  if exists (
    select 1
    from public.registry_entity_index
    where entity_type = 'track'
      and entity_id =
        'ad8c7656-f4a6-4d4f-85a8-1d0a4b667dea'::uuid
  ) then
    raise exception
      'Redundant Tequila entity-index row still exists';
  end if;

  select count(*)
  into v_count
  from public.wk_slug_redirects
  where entity_type = 'track'
    and scope_slug = 'wanavokali'
    and new_slug = 'tequila'
    and new_path = '/tracks/wanavokali/tequila'
    and redirect_status = 308
    and old_path in (
      '/tracks/wanavokali/tequila-2',
      '/tracks/wanavokali/tequila-3'
    );

  if v_count <> 2 then
    raise exception
      'Expected two canonical Tequila redirects, found %',
      v_count;
  end if;
end
$tequila_postconditions$;

commit;
