begin;

create temporary table wk_benga_blues_cleanup_tracks (
  track_id uuid primary key
) on commit drop;

insert into wk_benga_blues_cleanup_tracks (track_id)
select distinct rt.track_id
from public.registry_release_tracks rt
where rt.release_id = '8e46ee21-48ed-4ba6-b133-fa0fa077c9f2'
  and rt.status = 'active';

do $$
declare
  target_release_id constant uuid :=
    '8e46ee21-48ed-4ba6-b133-fa0fa077c9f2';

  ghost_release_ids constant uuid[] := array[
    '05fcbd0f-1555-43a2-a6f8-8e44d7a965c5'::uuid,
    'e5589dc9-f76a-410f-b6ce-0aadfbf1fb2d'::uuid
  ];

  cleanup_release_ids constant uuid[] := array[
    '8e46ee21-48ed-4ba6-b133-fa0fa077c9f2'::uuid,
    '05fcbd0f-1555-43a2-a6f8-8e44d7a965c5'::uuid,
    'e5589dc9-f76a-410f-b6ce-0aadfbf1fb2d'::uuid
  ];

  found_count integer;
begin
  select count(*)
  into found_count
  from public.registry_releases r
  join public.registry_release_artists ra
    on ra.release_id = r.id
   and ra.status = 'active'
   and ra.is_primary = true
  where r.id = target_release_id
    and r.slug = 'benga-blues'
    and r.title = 'Benga Blues'
    and ra.artist_slug = 'winyo';

  if found_count <> 1 then
    raise exception
      'STOP: Benga Blues identity check failed. Found % rows.',
      found_count;
  end if;

  select count(*)
  into found_count
  from wk_benga_blues_cleanup_tracks;

  if found_count <> 26 then
    raise exception
      'STOP: Expected 26 cleanup tracks. Found %.',
      found_count;
  end if;

  select count(*)
  into found_count
  from public.registry_tracks t
  join wk_benga_blues_cleanup_tracks c
    on c.track_id = t.id
  where t.status = 'active';

  if found_count <> 26 then
    raise exception
      'STOP: Expected 26 active track records. Found %.',
      found_count;
  end if;

  select count(*)
  into found_count
  from public.registry_releases
  where id = any(ghost_release_ids);

  if found_count <> 0 then
    raise exception
      'STOP: One or more ghost release IDs now has a real release row.';
  end if;

  select count(*)
  into found_count
  from public.registry_release_tracks rt
  join wk_benga_blues_cleanup_tracks c
    on c.track_id = rt.track_id
  where rt.release_id = target_release_id
    and rt.status = 'active';

  if found_count <> 26 then
    raise exception
      'STOP: Expected 26 active Benga Blues links. Found %.',
      found_count;
  end if;

  select count(*)
  into found_count
  from public.registry_release_tracks rt
  join wk_benga_blues_cleanup_tracks c
    on c.track_id = rt.track_id
  where rt.release_id = any(ghost_release_ids)
    and rt.status = 'active';

  if found_count <> 26 then
    raise exception
      'STOP: Expected 26 active ghost-shell links. Found %.',
      found_count;
  end if;

  if exists (
    select 1
    from public.registry_release_tracks rt
    join wk_benga_blues_cleanup_tracks c
      on c.track_id = rt.track_id
    where not (rt.release_id = any(cleanup_release_ids))
      and rt.status = 'active'
  ) then
    raise exception
      'STOP: A cleanup track is linked to another real release.';
  end if;

  if exists (
    select 1
    from public.registry_tracks t
    join wk_benga_blues_cleanup_tracks c
      on c.track_id = t.id
    where t.release_id is not null
  ) then
    raise exception
      'STOP: A cleanup track has a legacy release_id.';
  end if;

  if exists (
    select 1
    from public.wk_chart_entries_v2 e
    where e.canonical_release_id = target_release_id::text
       or e.canonical_track_id in (
         select track_id::text
         from wk_benga_blues_cleanup_tracks
       )
  ) then
    raise exception
      'STOP: Chart dependencies appeared after review.';
  end if;

  if exists (
    select 1
    from public.wk_playlist_items p
    where p.registry_release_id = target_release_id
       or p.registry_track_id in (
         select track_id
         from wk_benga_blues_cleanup_tracks
       )
  ) then
    raise exception
      'STOP: Playlist dependencies appeared after review.';
  end if;

  if exists (
    select 1
    from public.chart_playback_provider_exceptions p
    where p.registry_track_id in (
      select track_id
      from wk_benga_blues_cleanup_tracks
    )
  ) then
    raise exception
      'STOP: Playback exception dependencies appeared.';
  end if;

  if exists (
    select 1
    from public.wk_chart_playback_enrichment_items p
    where p.registry_track_id in (
      select track_id
      from wk_benga_blues_cleanup_tracks
    )
  ) then
    raise exception
      'STOP: Playback enrichment dependencies appeared.';
  end if;
end
$$;

delete from public.seo_sitemap_url_items
where source_id in (
  '8e46ee21-48ed-4ba6-b133-fa0fa077c9f2',
  '05fcbd0f-1555-43a2-a6f8-8e44d7a965c5',
  'e5589dc9-f76a-410f-b6ce-0aadfbf1fb2d'
)
or source_id in (
  select track_id::text
  from wk_benga_blues_cleanup_tracks
);

delete from public.registry_release_tracks
where release_id in (
  '8e46ee21-48ed-4ba6-b133-fa0fa077c9f2',
  '05fcbd0f-1555-43a2-a6f8-8e44d7a965c5',
  'e5589dc9-f76a-410f-b6ce-0aadfbf1fb2d'
)
and track_id in (
  select track_id
  from wk_benga_blues_cleanup_tracks
);

delete from public.registry_track_provider_links
where track_id in (
  select track_id
  from wk_benga_blues_cleanup_tracks
);

delete from public.registry_track_genres
where track_id in (
  select track_id
  from wk_benga_blues_cleanup_tracks
);

delete from public.registry_track_artists
where track_id in (
  select track_id
  from wk_benga_blues_cleanup_tracks
);

delete from public.registry_release_genres
where release_id = '8e46ee21-48ed-4ba6-b133-fa0fa077c9f2';

delete from public.registry_release_artists
where release_id in (
  '8e46ee21-48ed-4ba6-b133-fa0fa077c9f2',
  '05fcbd0f-1555-43a2-a6f8-8e44d7a965c5',
  'e5589dc9-f76a-410f-b6ce-0aadfbf1fb2d'
);

delete from public.registry_tracks
where id in (
  select track_id
  from wk_benga_blues_cleanup_tracks
);

delete from public.registry_releases
where id = '8e46ee21-48ed-4ba6-b133-fa0fa077c9f2';

do $$
declare
  remaining integer;
begin
  select count(*)
  into remaining
  from public.registry_releases
  where id = '8e46ee21-48ed-4ba6-b133-fa0fa077c9f2';

  if remaining <> 0 then
    raise exception
      'STOP: Benga Blues release still exists after cleanup.';
  end if;

  select count(*)
  into remaining
  from public.registry_tracks
  where id in (
    select track_id
    from wk_benga_blues_cleanup_tracks
  );

  if remaining <> 0 then
    raise exception
      'STOP: % cleanup track records remain.',
      remaining;
  end if;

  select count(*)
  into remaining
  from public.registry_release_tracks
  where release_id in (
    '8e46ee21-48ed-4ba6-b133-fa0fa077c9f2',
    '05fcbd0f-1555-43a2-a6f8-8e44d7a965c5',
    'e5589dc9-f76a-410f-b6ce-0aadfbf1fb2d'
  );

  if remaining <> 0 then
    raise exception
      'STOP: % cleanup release-track links remain.',
      remaining;
  end if;
end
$$;

commit;
