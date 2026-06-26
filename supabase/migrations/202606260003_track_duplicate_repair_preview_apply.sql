create table if not exists public.registry_track_resolution_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  status text not null default 'success',
  canonical_track_id uuid,
  canonical_track_slug text,
  duplicate_track_ids uuid[] not null default '{}'::uuid[],
  duplicate_track_slugs text[] not null default '{}'::text[],
  confidence_bucket text,
  preview jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.admin_preview_registry_track_duplicate_repair(
  p_canonical_track_id uuid,
  p_duplicate_track_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_duplicate_ids uuid[];
  v_canonical record;
  v_duplicate_count integer := 0;
  v_high_signal_count integer := 0;
  v_medium_signal_count integer := 0;
  v_chart_rows integer := 0;
  v_provider_rows integer := 0;
  v_release_rows integer := 0;
  v_release_rows_to_archive integer := 0;
  v_track_artist_rows integer := 0;
  v_track_artist_rows_to_archive integer := 0;
  v_confidence_bucket text := 'blocked';
  v_blockers text[] := '{}'::text[];
  v_preview jsonb;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  if p_canonical_track_id is null then
    raise exception 'canonical_track_required';
  end if;

  v_duplicate_ids := array(
    select distinct x
    from unnest(coalesce(p_duplicate_track_ids, '{}'::uuid[])) as x
    where x is not null
      and x <> p_canonical_track_id
  );

  if coalesce(array_length(v_duplicate_ids, 1), 0) = 0 then
    raise exception 'duplicate_tracks_required';
  end if;

  select
    t.id,
    t.slug,
    t.title,
    t.status,
    t.isrc,
    t.release_id,
    t.artwork_url,
    t.preview_url,
    t.metadata,
    nullif(t.metadata->>'apple_music_catalog_id', '') as apple_music_catalog_id,
    public.wk_slugify_text(coalesce(t.title, '')) as title_key,
    (
      select string_agg(rta.artist_slug, ', ' order by rta.credit_order, rta.artist_slug)
      from public.registry_track_artists rta
      where rta.track_id = t.id
        and coalesce(rta.status, 'active') <> 'archived'
        and coalesce(rta.is_primary, false) = true
    ) as primary_artist_slugs
  into v_canonical
  from public.registry_tracks t
  where t.id = p_canonical_track_id
    and t.status in ('active', 'draft', 'needs_review')
  limit 1;

  if v_canonical.id is null then
    raise exception 'canonical_track_not_found_or_not_repairable';
  end if;

  select count(*)
  into v_duplicate_count
  from public.registry_tracks t
  where t.id = any(v_duplicate_ids)
    and t.status in ('active', 'draft', 'needs_review');

  if v_duplicate_count <> coalesce(array_length(v_duplicate_ids, 1), 0) then
    v_blockers := array_append(v_blockers, 'one_or_more_duplicate_tracks_not_found_or_not_repairable');
  end if;

  with duplicate_tracks as (
    select
      t.id,
      t.slug,
      t.title,
      t.status,
      t.isrc,
      t.metadata,
      nullif(t.metadata->>'apple_music_catalog_id', '') as apple_music_catalog_id,
      public.wk_slugify_text(coalesce(t.title, '')) as title_key,
      (
        select string_agg(rta.artist_slug, ', ' order by rta.credit_order, rta.artist_slug)
        from public.registry_track_artists rta
        where rta.track_id = t.id
          and coalesce(rta.status, 'active') <> 'archived'
          and coalesce(rta.is_primary, false) = true
      ) as primary_artist_slugs
    from public.registry_tracks t
    where t.id = any(v_duplicate_ids)
  )
  select
    count(*) filter (
      where (
        nullif(v_canonical.isrc, '') is not null
        and nullif(duplicate_tracks.isrc, '') is not null
        and v_canonical.isrc = duplicate_tracks.isrc
      )
      or (
        v_canonical.apple_music_catalog_id is not null
        and duplicate_tracks.apple_music_catalog_id is not null
        and v_canonical.apple_music_catalog_id = duplicate_tracks.apple_music_catalog_id
      )
      or exists (
        select 1
        from public.registry_track_provider_links cpl
        join public.registry_track_provider_links dpl
          on dpl.provider_key = cpl.provider_key
         and dpl.provider_track_id = cpl.provider_track_id
        where cpl.track_id = v_canonical.id
          and dpl.track_id = duplicate_tracks.id
      )
    ),
    count(*) filter (
      where public.wk_slugify_text(coalesce(v_canonical.title, '')) = duplicate_tracks.title_key
        and coalesce(v_canonical.primary_artist_slugs, '') = coalesce(duplicate_tracks.primary_artist_slugs, '')
        and (
          duplicate_tracks.slug ~ '-[0-9]+$'
          or v_canonical.slug ~ '-[0-9]+$'
        )
    )
  into v_high_signal_count, v_medium_signal_count
  from duplicate_tracks;

  if v_high_signal_count >= v_duplicate_count and v_duplicate_count > 0 then
    v_confidence_bucket := 'high';
  elsif (v_high_signal_count + v_medium_signal_count) >= v_duplicate_count and v_duplicate_count > 0 then
    v_confidence_bucket := 'medium';
  else
    v_confidence_bucket := 'blocked';
    v_blockers := array_append(v_blockers, 'not_enough_identity_evidence');
  end if;

  select count(*)
  into v_chart_rows
  from public.wk_chart_entries_v2 ce
  join public.registry_tracks d
    on d.id = any(v_duplicate_ids)
  where ce.canonical_track_id::text = d.id::text
     or ce.track_slug = d.slug;

  select count(*)
  into v_provider_rows
  from public.registry_track_provider_links l
  where l.track_id = any(v_duplicate_ids);

  select count(*)
  into v_release_rows
  from public.registry_release_tracks rrt
  where rrt.track_id = any(v_duplicate_ids)
    and coalesce(rrt.status, 'active') <> 'archived';

  select count(*)
  into v_release_rows_to_archive
  from public.registry_release_tracks bad
  where bad.track_id = any(v_duplicate_ids)
    and coalesce(bad.status, 'active') <> 'archived'
    and exists (
      select 1
      from public.registry_release_tracks good
      where good.release_id = bad.release_id
        and good.track_id = v_canonical.id
        and good.disc_number = bad.disc_number
        and coalesce(good.track_number, -1) = coalesce(bad.track_number, -1)
        and coalesce(good.status, 'active') <> 'archived'
    );

  select count(*)
  into v_track_artist_rows
  from public.registry_track_artists rta
  where rta.track_id = any(v_duplicate_ids)
    and coalesce(rta.status, 'active') <> 'archived';

  with ranked_bad as (
    select
      bad.id,
      row_number() over (
        partition by coalesce(lower(nullif(bad.artist_slug, '')), 'artist:' || coalesce(bad.artist_id::text, bad.id::text))
        order by
          coalesce(bad.is_primary, false) desc,
          coalesce(bad.is_featured, false) asc,
          bad.credit_order asc,
          bad.updated_at desc nulls last,
          bad.id asc
      ) as duplicate_rank,
      exists (
        select 1
        from public.registry_track_artists good
        where good.track_id = v_canonical.id
          and coalesce(good.status, 'active') <> 'archived'
          and (
            (
              nullif(bad.artist_slug, '') is not null
              and lower(coalesce(good.artist_slug, '')) = lower(bad.artist_slug)
            )
            or (
              nullif(bad.artist_slug, '') is null
              and bad.artist_id is not null
              and good.artist_id = bad.artist_id
            )
          )
      ) as canonical_already_has_credit
    from public.registry_track_artists bad
    where bad.track_id = any(v_duplicate_ids)
      and coalesce(bad.status, 'active') <> 'archived'
  )
  select count(*)
  into v_track_artist_rows_to_archive
  from ranked_bad
  where canonical_already_has_credit
     or duplicate_rank > 1;

  with duplicate_tracks as (
    select
      t.id,
      t.slug,
      t.title,
      t.status,
      t.isrc,
      t.release_id,
      t.artwork_url,
      t.preview_url,
      nullif(t.metadata->>'apple_music_catalog_id', '') as apple_music_catalog_id,
      (
        select string_agg(rta.artist_slug, ', ' order by rta.credit_order, rta.artist_slug)
        from public.registry_track_artists rta
        where rta.track_id = t.id
          and coalesce(rta.status, 'active') <> 'archived'
          and coalesce(rta.is_primary, false) = true
      ) as primary_artist_slugs
    from public.registry_tracks t
    where t.id = any(v_duplicate_ids)
  ),
  chart_rows as (
    select
      ce.id,
      ce.edition_id,
      ce.rank,
      ce.track_slug,
      ce.track_title,
      ce.artist_slug,
      ce.artist_name,
      ce.canonical_track_id
    from public.wk_chart_entries_v2 ce
    join duplicate_tracks d
      on ce.canonical_track_id::text = d.id::text
      or ce.track_slug = d.slug
    order by ce.edition_id, ce.rank nulls last, ce.id
    limit 50
  ),
  provider_rows as (
    select
      l.id,
      l.track_id,
      d.slug as duplicate_slug,
      l.provider_key,
      l.provider_track_id,
      l.provider_release_id,
      l.isrc,
      l.match_status,
      l.match_confidence
    from public.registry_track_provider_links l
    join duplicate_tracks d on d.id = l.track_id
    order by l.provider_key, l.provider_track_id
    limit 50
  ),
  release_rows as (
    select
      rrt.id,
      rrt.release_id,
      rr.slug as release_slug,
      rr.title as release_title,
      rrt.track_id,
      d.slug as duplicate_slug,
      rrt.disc_number,
      rrt.track_number,
      rrt.status,
      exists (
        select 1
        from public.registry_release_tracks good
        where good.release_id = rrt.release_id
          and good.track_id = v_canonical.id
          and good.disc_number = rrt.disc_number
          and coalesce(good.track_number, -1) = coalesce(rrt.track_number, -1)
          and coalesce(good.status, 'active') <> 'archived'
      ) as will_archive_instead_of_move
    from public.registry_release_tracks rrt
    join duplicate_tracks d on d.id = rrt.track_id
    left join public.registry_releases rr on rr.id = rrt.release_id
    where coalesce(rrt.status, 'active') <> 'archived'
    order by rr.title, rrt.disc_number, rrt.track_number
    limit 50
  )
  select jsonb_build_object(
    'canonicalTrack', jsonb_build_object(
      'id', v_canonical.id,
      'slug', v_canonical.slug,
      'title', v_canonical.title,
      'status', v_canonical.status,
      'isrc', v_canonical.isrc,
      'releaseId', v_canonical.release_id,
      'artworkUrl', v_canonical.artwork_url,
      'previewUrl', v_canonical.preview_url,
      'appleMusicCatalogId', v_canonical.apple_music_catalog_id,
      'primaryArtistSlugs', v_canonical.primary_artist_slugs
    ),
    'duplicateTracks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'slug', slug,
          'title', title,
          'status', status,
          'isrc', isrc,
          'releaseId', release_id,
          'artworkUrl', artwork_url,
          'previewUrl', preview_url,
          'appleMusicCatalogId', apple_music_catalog_id,
          'primaryArtistSlugs', primary_artist_slugs
        )
        order by slug
      )
      from duplicate_tracks
    ), '[]'::jsonb),
    'confidenceBucket', v_confidence_bucket,
    'blockers', to_jsonb(v_blockers),
    'counts', jsonb_build_object(
      'duplicateTracks', v_duplicate_count,
      'highIdentityMatches', v_high_signal_count,
      'mediumIdentityMatches', v_medium_signal_count,
      'chartRowsToMove', v_chart_rows,
      'providerLinksToMove', v_provider_rows,
      'releaseTrackRowsTouched', v_release_rows,
      'releaseTrackRowsToArchive', v_release_rows_to_archive,
      'trackArtistCreditsToMove', greatest(v_track_artist_rows - v_track_artist_rows_to_archive, 0),
      'trackArtistCreditsToArchive', v_track_artist_rows_to_archive
    ),
    'chartRows', coalesce((select jsonb_agg(to_jsonb(chart_rows)) from chart_rows), '[]'::jsonb),
    'providerLinks', coalesce((select jsonb_agg(to_jsonb(provider_rows)) from provider_rows), '[]'::jsonb),
    'releaseTrackRows', coalesce((select jsonb_agg(to_jsonb(release_rows)) from release_rows), '[]'::jsonb)
  )
  into v_preview;

  return v_preview;
end;
$$;

create or replace function public.admin_apply_registry_track_duplicate_repair(
  p_canonical_track_id uuid,
  p_duplicate_track_ids uuid[],
  p_note text default null,
  p_allow_medium_confidence boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duplicate_ids uuid[];
  v_canonical record;
  v_preview jsonb;
  v_confidence_bucket text;
  v_blocker_count integer := 0;
  v_chart_rows integer := 0;
  v_provider_rows integer := 0;
  v_release_rows_archived integer := 0;
  v_release_rows_moved integer := 0;
  v_track_artist_rows_archived integer := 0;
  v_track_artist_rows_moved integer := 0;
  v_tracks_archived integer := 0;
  v_event_id uuid;
  v_result jsonb;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  v_duplicate_ids := array(
    select distinct x
    from unnest(coalesce(p_duplicate_track_ids, '{}'::uuid[])) as x
    where x is not null
      and x <> p_canonical_track_id
  );

  select id, slug, title, status
  into v_canonical
  from public.registry_tracks
  where id = p_canonical_track_id
    and status in ('active', 'draft', 'needs_review')
  limit 1;

  if v_canonical.id is null then
    raise exception 'canonical_track_not_found_or_not_repairable';
  end if;

  v_preview := public.admin_preview_registry_track_duplicate_repair(
    p_canonical_track_id,
    v_duplicate_ids
  );

  v_confidence_bucket := coalesce(v_preview->>'confidenceBucket', 'blocked');

  select jsonb_array_length(coalesce(v_preview->'blockers', '[]'::jsonb))
  into v_blocker_count;

  if v_blocker_count > 0 or v_confidence_bucket = 'blocked' then
    raise exception 'repair_blocked: %', coalesce(v_preview->'blockers', '[]'::jsonb)::text;
  end if;

  if v_confidence_bucket = 'medium' and not coalesce(p_allow_medium_confidence, false) then
    raise exception 'medium_confidence_requires_explicit_allow';
  end if;

  update public.wk_chart_entries_v2 ce
  set
    canonical_track_id = v_canonical.id::text,
    track_slug = v_canonical.slug,
    updated_at = now()
  from public.registry_tracks d
  where d.id = any(v_duplicate_ids)
    and (
      ce.canonical_track_id::text = d.id::text
      or ce.track_slug = d.slug
    );

  get diagnostics v_chart_rows = row_count;

  update public.registry_track_provider_links l
  set
    track_id = v_canonical.id,
    raw_payload = coalesce(l.raw_payload, '{}'::jsonb) || jsonb_build_object(
      'moved_from_track_id', l.track_id::text,
      'moved_from_track_slug', d.slug,
      'moved_to_track_id', v_canonical.id::text,
      'moved_to_track_slug', v_canonical.slug,
      'track_duplicate_repair_at', now()
    ),
    updated_at = now()
  from public.registry_tracks d
  where l.track_id = d.id
    and d.id = any(v_duplicate_ids);

  get diagnostics v_provider_rows = row_count;

  with ranked_bad as (
    select
      bad.id,
      row_number() over (
        partition by coalesce(lower(nullif(bad.artist_slug, '')), 'artist:' || coalesce(bad.artist_id::text, bad.id::text))
        order by
          coalesce(bad.is_primary, false) desc,
          coalesce(bad.is_featured, false) asc,
          bad.credit_order asc,
          bad.updated_at desc nulls last,
          bad.id asc
      ) as duplicate_rank,
      exists (
        select 1
        from public.registry_track_artists good
        where good.track_id = v_canonical.id
          and coalesce(good.status, 'active') <> 'archived'
          and (
            (
              nullif(bad.artist_slug, '') is not null
              and lower(coalesce(good.artist_slug, '')) = lower(bad.artist_slug)
            )
            or (
              nullif(bad.artist_slug, '') is null
              and bad.artist_id is not null
              and good.artist_id = bad.artist_id
            )
          )
      ) as canonical_already_has_credit
    from public.registry_track_artists bad
    where bad.track_id = any(v_duplicate_ids)
      and coalesce(bad.status, 'active') <> 'archived'
  ),
  to_archive as (
    select id
    from ranked_bad
    where canonical_already_has_credit
       or duplicate_rank > 1
  )
  update public.registry_track_artists bad
  set
    status = 'archived',
    metadata = coalesce(bad.metadata, '{}'::jsonb) || jsonb_build_object(
      'archived_reason', 'track_duplicate_repair_duplicate_track_credit',
      'merged_into_track_id', v_canonical.id::text,
      'merged_into_track_slug', v_canonical.slug,
      'archived_at', now(),
      'repair_note', p_note
    ),
    updated_at = now()
  where bad.id in (select id from to_archive);

  get diagnostics v_track_artist_rows_archived = row_count;

  update public.registry_track_artists rta
  set
    track_id = v_canonical.id,
    metadata = coalesce(rta.metadata, '{}'::jsonb) || jsonb_build_object(
      'moved_from_track_id', rta.track_id::text,
      'moved_to_track_id', v_canonical.id::text,
      'moved_to_track_slug', v_canonical.slug,
      'track_duplicate_repair_at', now(),
      'repair_note', p_note
    ),
    updated_at = now()
  where rta.track_id = any(v_duplicate_ids)
    and coalesce(rta.status, 'active') <> 'archived';

  get diagnostics v_track_artist_rows_moved = row_count;

  update public.registry_release_tracks bad
  set
    status = 'archived',
    metadata = coalesce(bad.metadata, '{}'::jsonb) || jsonb_build_object(
      'archived_reason', 'track_duplicate_repair_duplicate_release_track',
      'merged_into_track_id', v_canonical.id::text,
      'merged_into_track_slug', v_canonical.slug,
      'archived_at', now(),
      'repair_note', p_note
    ),
    updated_at = now()
  where bad.track_id = any(v_duplicate_ids)
    and coalesce(bad.status, 'active') <> 'archived'
    and exists (
      select 1
      from public.registry_release_tracks good
      where good.release_id = bad.release_id
        and good.track_id = v_canonical.id
        and good.disc_number = bad.disc_number
        and coalesce(good.track_number, -1) = coalesce(bad.track_number, -1)
        and coalesce(good.status, 'active') <> 'archived'
    );

  get diagnostics v_release_rows_archived = row_count;

  update public.registry_release_tracks rrt
  set
    track_id = v_canonical.id,
    metadata = coalesce(rrt.metadata, '{}'::jsonb) || jsonb_build_object(
      'moved_from_track_id', rrt.track_id::text,
      'moved_to_track_id', v_canonical.id::text,
      'moved_to_track_slug', v_canonical.slug,
      'track_duplicate_repair_at', now(),
      'repair_note', p_note
    ),
    updated_at = now()
  where rrt.track_id = any(v_duplicate_ids)
    and coalesce(rrt.status, 'active') <> 'archived';

  get diagnostics v_release_rows_moved = row_count;

  update public.registry_tracks c
  set
    isrc = coalesce(c.isrc, (
      select nullif(d.isrc, '')
      from public.registry_tracks d
      where d.id = any(v_duplicate_ids)
        and nullif(d.isrc, '') is not null
      order by d.updated_at desc nulls last
      limit 1
    )),
    artwork_url = coalesce(c.artwork_url, (
      select nullif(d.artwork_url, '')
      from public.registry_tracks d
      where d.id = any(v_duplicate_ids)
        and nullif(d.artwork_url, '') is not null
      order by d.updated_at desc nulls last
      limit 1
    )),
    preview_url = coalesce(c.preview_url, (
      select nullif(d.preview_url, '')
      from public.registry_tracks d
      where d.id = any(v_duplicate_ids)
        and nullif(d.preview_url, '') is not null
      order by d.updated_at desc nulls last
      limit 1
    )),
    metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'track_duplicate_repair_last_applied_at', now(),
      'track_duplicate_repair_absorbed_ids', (
        select jsonb_agg(d.id::text order by d.slug)
        from public.registry_tracks d
        where d.id = any(v_duplicate_ids)
      ),
      'track_duplicate_repair_absorbed_slugs', (
        select jsonb_agg(d.slug order by d.slug)
        from public.registry_tracks d
        where d.id = any(v_duplicate_ids)
      )
    ),
    updated_at = now()
  where c.id = v_canonical.id;

  update public.registry_tracks d
  set
    status = 'archived',
    metadata = coalesce(d.metadata, '{}'::jsonb) || jsonb_build_object(
      'superseded_by_track_id', v_canonical.id::text,
      'superseded_by_slug', v_canonical.slug,
      'dedupe_note', coalesce(nullif(p_note, ''), 'Track duplicate repair applied.'),
      'deduped_at', now(),
      'dedupe_confidence_bucket', v_confidence_bucket
    ),
    updated_at = now()
  where d.id = any(v_duplicate_ids)
    and d.status in ('active', 'draft', 'needs_review');

  get diagnostics v_tracks_archived = row_count;

  v_result := jsonb_build_object(
    'canonicalTrackId', v_canonical.id,
    'canonicalTrackSlug', v_canonical.slug,
    'duplicateTrackIds', to_jsonb(v_duplicate_ids),
    'confidenceBucket', v_confidence_bucket,
    'chartRowsMoved', v_chart_rows,
    'providerLinksMoved', v_provider_rows,
    'releaseTrackRowsMoved', v_release_rows_moved,
    'releaseTrackRowsArchived', v_release_rows_archived,
    'trackArtistCreditsMoved', v_track_artist_rows_moved,
    'trackArtistCreditsArchived', v_track_artist_rows_archived,
    'duplicateTracksArchived', v_tracks_archived
  );

  insert into public.registry_track_resolution_events (
    action,
    status,
    canonical_track_id,
    canonical_track_slug,
    duplicate_track_ids,
    duplicate_track_slugs,
    confidence_bucket,
    preview,
    result,
    note
  )
  select
    'track_duplicate_repair',
    'success',
    v_canonical.id,
    v_canonical.slug,
    v_duplicate_ids,
    coalesce(array_agg(d.slug order by d.slug), '{}'::text[]),
    v_confidence_bucket,
    v_preview,
    v_result,
    nullif(p_note, '')
  from public.registry_tracks d
  where d.id = any(v_duplicate_ids)
  returning id into v_event_id;

  return v_result || jsonb_build_object('eventId', v_event_id);
end;
$$;

grant execute on function public.admin_preview_registry_track_duplicate_repair(uuid, uuid[]) to authenticated;
grant execute on function public.admin_apply_registry_track_duplicate_repair(uuid, uuid[], text, boolean) to authenticated;
