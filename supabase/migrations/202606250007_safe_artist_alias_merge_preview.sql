create or replace function public.admin_get_registry_artist_merge_preview(
  p_source_artist_id uuid,
  p_canonical_artist_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_source record;
  v_canonical record;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  if p_source_artist_id is null or p_canonical_artist_id is null then
    raise exception 'source_and_canonical_required';
  end if;

  if p_source_artist_id = p_canonical_artist_id then
    raise exception 'cannot_merge_artist_into_itself';
  end if;

  select id, slug, display_name, status, origin_iso2, public_image_url, metadata
  into v_source
  from public.registry_artists
  where id = p_source_artist_id
    and status in ('active', 'draft', 'needs_review', 'archived')
  limit 1;

  if v_source.id is null then
    raise exception 'source_artist_not_found';
  end if;

  select id, slug, display_name, status, origin_iso2, public_image_url, metadata
  into v_canonical
  from public.registry_artists
  where id = p_canonical_artist_id
    and status in ('active', 'draft', 'needs_review')
  limit 1;

  if v_canonical.id is null then
    raise exception 'canonical_artist_not_found';
  end if;

  return jsonb_build_object(
    'sourceArtist', jsonb_build_object(
      'artist_id', v_source.id,
      'artist_slug', v_source.slug,
      'display_name', v_source.display_name,
      'status', v_source.status,
      'origin_iso2', v_source.origin_iso2,
      'public_image_url', v_source.public_image_url
    ),
    'canonicalArtist', jsonb_build_object(
      'artist_id', v_canonical.id,
      'artist_slug', v_canonical.slug,
      'display_name', v_canonical.display_name,
      'status', v_canonical.status,
      'origin_iso2', v_canonical.origin_iso2,
      'public_image_url', v_canonical.public_image_url
    ),
    'trackCredits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'credit_id', rta.id,
          'track_id', rta.track_id,
          'track_slug', rt.slug,
          'track_title', rt.title,
          'release_title', rr.title,
          'role', rta.role,
          'is_primary', rta.is_primary,
          'is_featured', rta.is_featured,
          'credit_order', rta.credit_order,
          'display_credit', rta.display_credit,
          'status', rta.status,
          'will_archive_duplicate', exists (
            select 1
            from public.registry_track_artists good
            where good.track_id = rta.track_id
              and good.artist_id = v_canonical.id
              and coalesce(good.status, 'active') <> 'archived'
          )
        )
        order by rt.title asc, rta.credit_order asc, rta.id asc
      )
      from public.registry_track_artists rta
      left join public.registry_tracks rt on rt.id = rta.track_id
      left join public.registry_releases rr on rr.id = rt.release_id
      where (
          rta.artist_id = v_source.id
          or lower(coalesce(rta.artist_slug, '')) = lower(v_source.slug)
        )
        and coalesce(rta.status, 'active') <> 'archived'
    ), '[]'::jsonb),
    'releaseCredits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'credit_id', rra.id,
          'release_id', rra.release_id,
          'release_slug', rr.slug,
          'release_title', rr.title,
          'role', rra.role,
          'is_primary', rra.is_primary,
          'is_featured', rra.is_featured,
          'credit_order', rra.credit_order,
          'display_credit', rra.display_credit,
          'status', rra.status,
          'will_archive_duplicate', exists (
            select 1
            from public.registry_release_artists good
            where good.release_id = rra.release_id
              and good.artist_id = v_canonical.id
              and coalesce(good.status, 'active') <> 'archived'
          )
        )
        order by rr.title asc, rra.credit_order asc, rra.id asc
      )
      from public.registry_release_artists rra
      left join public.registry_releases rr on rr.id = rra.release_id
      where (
          rra.artist_id = v_source.id
          or lower(coalesce(rra.artist_slug, '')) = lower(v_source.slug)
        )
        and coalesce(rra.status, 'active') <> 'archived'
    ), '[]'::jsonb),
    'chartEntries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'entry_id', ce.id,
          'edition_id', ce.edition_id,
          'track_slug', ce.track_slug,
          'track_title', ce.track_title,
          'artist_name', ce.artist_name,
          'artist_slug', ce.artist_slug,
          'canonical_artist_id', ce.canonical_artist_id,
          'rank', ce.rank
        )
        order by ce.track_title asc, ce.rank asc, ce.id asc
      )
      from public.wk_chart_entries_v2 ce
      where ce.canonical_artist_id = v_source.id::text
         or public.wk_slugify_text(coalesce(ce.artist_slug, '')) = public.wk_slugify_text(v_source.slug)
         or public.wk_slugify_text(coalesce(ce.artist_name, '')) = public.wk_slugify_text(v_source.display_name)
    ), '[]'::jsonb),
    'aliases', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'alias_slug', a.alias_slug,
          'canonical_artist_id', a.canonical_artist_id,
          'alias_display_name', a.alias_display_name,
          'status', a.status,
          'source', a.source,
          'notes', a.notes
        )
        order by a.created_at desc, a.id asc
      )
      from public.registry_artist_aliases a
      where lower(a.alias_slug) = lower(v_source.slug)
         or a.canonical_artist_id = v_source.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_safe_merge_registry_artists(
  p_source_artist_id uuid,
  p_canonical_artist_id uuid,
  p_note text default null,
  p_archive_source boolean default true,
  p_merge_reason text default 'same_person'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source record;
  v_canonical record;
  v_preview jsonb;
  v_alias_rows integer := 0;
  v_existing_alias_rows integer := 0;
  v_chart_rows integer := 0;
  v_track_rows_moved integer := 0;
  v_track_rows_archived integer := 0;
  v_release_rows_moved integer := 0;
  v_release_rows_archived integer := 0;
  v_track_meta_rows integer := 0;
  v_source_archived boolean := false;
  v_merge_reason text;
  v_result jsonb;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  if p_source_artist_id is null or p_canonical_artist_id is null then
    raise exception 'source_and_canonical_required';
  end if;

  if p_source_artist_id = p_canonical_artist_id then
    raise exception 'cannot_merge_artist_into_itself';
  end if;

  v_merge_reason := coalesce(nullif(trim(p_merge_reason), ''), 'same_person');
  if v_merge_reason not in ('same_person', 'name_change', 'stage_name_change', 'duplicate_record', 'manual_correction') then
    raise exception 'invalid_merge_reason';
  end if;

  select id, slug, display_name, status, origin_iso2, public_image_url, metadata
  into v_source
  from public.registry_artists
  where id = p_source_artist_id
    and status in ('active', 'draft', 'needs_review', 'archived')
  limit 1;

  if v_source.id is null then
    raise exception 'source_artist_not_found';
  end if;

  select id, slug, display_name, status, origin_iso2, public_image_url, metadata
  into v_canonical
  from public.registry_artists
  where id = p_canonical_artist_id
    and status in ('active', 'draft', 'needs_review')
  limit 1;

  if v_canonical.id is null then
    raise exception 'canonical_artist_not_found';
  end if;

  v_preview := public.admin_get_registry_artist_merge_preview(p_source_artist_id, p_canonical_artist_id);

  update public.registry_artist_aliases
  set
    canonical_artist_id = v_canonical.id,
    alias_display_name = v_source.display_name,
    confidence = 100,
    source = 'manual_artist_merge',
    notes = coalesce(nullif(p_note, ''), 'Manual safe artist merge.'),
    status = 'active'
  where lower(alias_slug) = lower(v_source.slug);

  get diagnostics v_alias_rows = row_count;

  if v_alias_rows = 0 then
    insert into public.registry_artist_aliases (
      alias_slug,
      canonical_artist_id,
      alias_display_name,
      confidence,
      source,
      notes,
      status
    )
    values (
      v_source.slug,
      v_canonical.id,
      v_source.display_name,
      100,
      'manual_artist_merge',
      coalesce(nullif(p_note, ''), 'Manual safe artist merge.'),
      'active'
    );

    v_alias_rows := 1;
  end if;

  update public.registry_artist_aliases
  set
    canonical_artist_id = v_canonical.id,
    notes = coalesce(nullif(p_note, ''), notes, 'Retargeted during manual safe artist merge.'),
    updated_at = now()
  where canonical_artist_id = v_source.id;

  get diagnostics v_existing_alias_rows = row_count;

  update public.registry_track_artists bad
  set
    status = 'archived',
    metadata = coalesce(bad.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'archived_reason', 'safe_artist_merge_duplicate_track_credit',
        'merged_into_artist_id', v_canonical.id::text,
        'merged_into_artist_slug', v_canonical.slug,
        'merged_at', now(),
        'merge_reason', v_merge_reason,
        'merge_note', p_note
      ),
    updated_at = now()
  where (
      bad.artist_id = v_source.id
      or lower(coalesce(bad.artist_slug, '')) = lower(v_source.slug)
    )
    and coalesce(bad.status, 'active') <> 'archived'
    and exists (
      select 1
      from public.registry_track_artists good
      where good.track_id = bad.track_id
        and good.artist_id = v_canonical.id
        and coalesce(good.status, 'active') <> 'archived'
    );

  get diagnostics v_track_rows_archived = row_count;

  update public.registry_track_artists rta
  set
    artist_id = v_canonical.id,
    artist_slug = v_canonical.slug,
    artist_name_text = coalesce(nullif(rta.artist_name_text, ''), v_canonical.display_name),
    display_credit = coalesce(nullif(rta.display_credit, ''), v_canonical.display_name),
    metadata = coalesce(rta.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'merged_from_artist_id', v_source.id::text,
        'merged_from_artist_slug', v_source.slug,
        'merged_from_artist_name', v_source.display_name,
        'merged_at', now(),
        'merge_reason', v_merge_reason,
        'merge_note', p_note
      ),
    updated_at = now()
  where (
      rta.artist_id = v_source.id
      or lower(coalesce(rta.artist_slug, '')) = lower(v_source.slug)
    )
    and coalesce(rta.status, 'active') <> 'archived';

  get diagnostics v_track_rows_moved = row_count;

  update public.registry_release_artists bad
  set
    status = 'archived',
    metadata = coalesce(bad.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'archived_reason', 'safe_artist_merge_duplicate_release_credit',
        'merged_into_artist_id', v_canonical.id::text,
        'merged_into_artist_slug', v_canonical.slug,
        'merged_at', now(),
        'merge_reason', v_merge_reason,
        'merge_note', p_note
      ),
    updated_at = now()
  where (
      bad.artist_id = v_source.id
      or lower(coalesce(bad.artist_slug, '')) = lower(v_source.slug)
    )
    and coalesce(bad.status, 'active') <> 'archived'
    and exists (
      select 1
      from public.registry_release_artists good
      where good.release_id = bad.release_id
        and good.artist_id = v_canonical.id
        and coalesce(good.status, 'active') <> 'archived'
    );

  get diagnostics v_release_rows_archived = row_count;

  update public.registry_release_artists rra
  set
    artist_id = v_canonical.id,
    artist_slug = v_canonical.slug,
    artist_name_text = coalesce(nullif(rra.artist_name_text, ''), v_canonical.display_name),
    display_credit = coalesce(nullif(rra.display_credit, ''), v_canonical.display_name),
    metadata = coalesce(rra.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'merged_from_artist_id', v_source.id::text,
        'merged_from_artist_slug', v_source.slug,
        'merged_from_artist_name', v_source.display_name,
        'merged_at', now(),
        'merge_reason', v_merge_reason,
        'merge_note', p_note
      ),
    updated_at = now()
  where (
      rra.artist_id = v_source.id
      or lower(coalesce(rra.artist_slug, '')) = lower(v_source.slug)
    )
    and coalesce(rra.status, 'active') <> 'archived';

  get diagnostics v_release_rows_moved = row_count;

  update public.wk_chart_entries_v2 ce
  set
    canonical_artist_id = v_canonical.id::text,
    artist_slug = v_canonical.slug,
    artist_name = v_canonical.display_name,
    updated_at = now()
  where ce.canonical_artist_id = v_source.id::text
     or public.wk_slugify_text(coalesce(ce.artist_slug, '')) = public.wk_slugify_text(v_source.slug)
     or public.wk_slugify_text(coalesce(ce.artist_name, '')) = public.wk_slugify_text(v_source.display_name);

  get diagnostics v_chart_rows = row_count;

  update public.registry_tracks
  set
    metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'artist_merged_from_slug', v_source.slug,
          'artist_merged_from_name', v_source.display_name,
          'artist_merge_note', p_note,
          'artist_merged_at', now()
        ),
      '{primary_artist_slug}',
      to_jsonb(v_canonical.slug),
      true
    ),
    updated_at = now()
  where metadata->>'primary_artist_slug' = v_source.slug
     or metadata->>'artist_slug' = v_source.slug;

  get diagnostics v_track_meta_rows = row_count;

  update public.registry_artists
  set
    origin_iso2 = coalesce(origin_iso2, v_source.origin_iso2),
    public_image_url = coalesce(public_image_url, v_source.public_image_url),
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'safe_merge_source_artist_id', v_source.id::text,
        'safe_merge_source_artist_slug', v_source.slug,
        'safe_merge_source_artist_name', v_source.display_name,
        'safe_merge_reason', v_merge_reason,
        'safe_merge_note', p_note,
        'safe_merged_at', now()
      ),
    updated_at = now()
  where id = v_canonical.id;

  if p_archive_source then
    update public.registry_artists
    set
      status = 'archived',
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'archived_by_safe_artist_merge', true,
          'merged_into_artist_id', v_canonical.id::text,
          'merged_into_artist_slug', v_canonical.slug,
          'merged_into_artist_name', v_canonical.display_name,
          'merge_reason', v_merge_reason,
          'merge_note', p_note,
          'merged_at', now()
        ),
      updated_at = now()
    where id = v_source.id;

    v_source_archived := true;
  else
    update public.registry_artists
    set
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'safe_merge_without_archive', true,
          'merged_into_artist_id', v_canonical.id::text,
          'merged_into_artist_slug', v_canonical.slug,
          'merged_into_artist_name', v_canonical.display_name,
          'merge_reason', v_merge_reason,
          'merge_note', p_note,
          'merged_at', now()
        ),
      updated_at = now()
    where id = v_source.id;
  end if;

  v_result := jsonb_build_object(
    'sourceArtistId', v_source.id,
    'sourceSlug', v_source.slug,
    'sourceName', v_source.display_name,
    'canonicalArtistId', v_canonical.id,
    'canonicalSlug', v_canonical.slug,
    'canonicalName', v_canonical.display_name,
    'aliasRowsTouched', v_alias_rows,
    'existingAliasesRetargeted', v_existing_alias_rows,
    'trackArtistRowsMoved', v_track_rows_moved,
    'trackArtistRowsArchived', v_track_rows_archived,
    'releaseArtistRowsMoved', v_release_rows_moved,
    'releaseArtistRowsArchived', v_release_rows_archived,
    'chartEntriesUpdated', v_chart_rows,
    'trackMetadataRowsUpdated', v_track_meta_rows,
    'sourceArchived', v_source_archived,
    'mergeReason', v_merge_reason
  );

  insert into public.registry_artist_resolution_events (
    action,
    status,
    source_artist_id,
    source_artist_slug,
    source_artist_name,
    source_snapshot,
    replacement_artists,
    track_links,
    release_links,
    chart_entries,
    note,
    result
  )
  values (
    'artist_merge',
    'success',
    v_source.id,
    v_source.slug,
    v_source.display_name,
    v_preview -> 'sourceArtist',
    jsonb_build_array(v_preview -> 'canonicalArtist'),
    coalesce(v_preview -> 'trackCredits', '[]'::jsonb),
    coalesce(v_preview -> 'releaseCredits', '[]'::jsonb),
    coalesce(v_preview -> 'chartEntries', '[]'::jsonb),
    nullif(p_note, ''),
    v_result
  );

  return v_result;
end;
$$;

grant execute on function public.admin_get_registry_artist_merge_preview(uuid, uuid) to authenticated;
grant execute on function public.admin_safe_merge_registry_artists(uuid, uuid, text, boolean, text) to authenticated;
