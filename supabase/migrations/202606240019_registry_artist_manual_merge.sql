create or replace function public.admin_search_registry_artists(
  p_query text,
  p_limit integer default 20
)
returns table (
  artist_id uuid,
  artist_slug text,
  display_name text,
  status text,
  origin_iso2 text,
  public_image_url text,
  track_credit_count integer,
  release_credit_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text;
  v_like text;
  v_limit integer;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  v_query := nullif(trim(p_query), '');
  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  if v_query is null then
    return;
  end if;

  v_like := '%' || lower(v_query) || '%';

  return query
  select
    a.id,
    a.slug,
    a.display_name,
    a.status,
    a.origin_iso2,
    a.public_image_url,
    coalesce(t.track_credit_count, 0)::integer as track_credit_count,
    coalesce(r.release_credit_count, 0)::integer as release_credit_count
  from public.registry_artists a
  left join lateral (
    select count(*)::integer as track_credit_count
    from public.registry_track_artists ta
    where ta.artist_id = a.id
       or lower(ta.artist_slug) = lower(a.slug)
  ) t on true
  left join lateral (
    select count(*)::integer as release_credit_count
    from public.registry_release_artists ra
    where ra.artist_id = a.id
       or lower(ra.artist_slug) = lower(a.slug)
  ) r on true
  where a.status in ('active', 'draft', 'needs_review', 'archived')
    and (
      lower(a.slug) = lower(v_query)
      or lower(a.display_name) = lower(v_query)
      or lower(a.slug) like v_like
      or lower(a.display_name) like v_like
      or lower(coalesce(a.normalized_name, '')) like v_like
    )
  order by
    case
      when lower(a.slug) = lower(v_query) then 1
      when lower(a.display_name) = lower(v_query) then 2
      when lower(a.slug) like lower(v_query) || '%' then 3
      when lower(a.display_name) like lower(v_query) || '%' then 4
      else 5
    end,
    a.status = 'active' desc,
    a.display_name asc
  limit v_limit;
end;
$$;

create or replace function public.admin_merge_registry_artists(
  p_source_artist_id uuid,
  p_canonical_artist_id uuid,
  p_note text default null,
  p_archive_source boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source record;
  v_canonical record;
  v_alias_rows integer := 0;
  v_chart_rows integer := 0;
  v_track_rows integer := 0;
  v_release_rows integer := 0;
  v_track_meta_rows integer := 0;
  v_existing_alias_rows integer := 0;
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

  update public.registry_artist_aliases
  set
    canonical_artist_id = v_canonical.id,
    alias_display_name = v_source.display_name,
    confidence = 100,
    source = 'similarity_match',
    notes = coalesce(nullif(p_note, ''), 'Manual registry artist merge.'),
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
      'similarity_match',
      coalesce(nullif(p_note, ''), 'Manual registry artist merge.'),
      'active'
    );
    v_alias_rows := 1;
  end if;

  update public.registry_artist_aliases
  set
    canonical_artist_id = v_canonical.id,
    notes = coalesce(nullif(p_note, ''), notes, 'Manual registry artist merge.')
  where canonical_artist_id = v_source.id;

  get diagnostics v_existing_alias_rows = row_count;

  delete from public.registry_track_artists source_link
  using public.registry_track_artists canonical_link
  where source_link.artist_id = v_source.id
    and canonical_link.artist_id = v_canonical.id
    and canonical_link.track_id = source_link.track_id;

  update public.registry_track_artists
  set
    artist_id = v_canonical.id,
    artist_slug = v_canonical.slug,
    artist_name_text = coalesce(nullif(artist_name_text, ''), v_canonical.display_name),
    display_credit = coalesce(nullif(display_credit, ''), v_canonical.display_name),
    updated_at = now()
  where artist_id = v_source.id
     or lower(artist_slug) = lower(v_source.slug);

  get diagnostics v_track_rows = row_count;

  delete from public.registry_release_artists source_link
  using public.registry_release_artists canonical_link
  where source_link.artist_id = v_source.id
    and canonical_link.artist_id = v_canonical.id
    and canonical_link.release_id = source_link.release_id;

  update public.registry_release_artists
  set
    artist_id = v_canonical.id,
    artist_slug = v_canonical.slug,
    artist_name_text = coalesce(nullif(artist_name_text, ''), v_canonical.display_name),
    display_credit = coalesce(nullif(display_credit, ''), v_canonical.display_name),
    updated_at = now()
  where artist_id = v_source.id
     or lower(artist_slug) = lower(v_source.slug);

  get diagnostics v_release_rows = row_count;

  update public.wk_chart_entries_v2
  set
    artist_slug = v_canonical.slug,
    updated_at = now()
  where lower(artist_slug) = lower(v_source.slug);

  get diagnostics v_chart_rows = row_count;

  update public.registry_tracks
  set
    metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb),
      '{primary_artist_slug}',
      to_jsonb(v_canonical.slug),
      true
    ),
    updated_at = now()
  where metadata->>'primary_artist_slug' = v_source.slug;

  get diagnostics v_track_meta_rows = row_count;

  update public.registry_artists
  set
    origin_iso2 = coalesce(origin_iso2, v_source.origin_iso2),
    public_image_url = coalesce(public_image_url, v_source.public_image_url),
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'merged_source_artist_id', v_source.id::text,
        'merged_source_artist_slug', v_source.slug,
        'merged_source_artist_name', v_source.display_name,
        'merged_at', now()
      ),
    updated_at = now()
  where id = v_canonical.id;

  if p_archive_source then
    update public.registry_artists
    set
      status = 'archived',
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'merged_into_artist_id', v_canonical.id::text,
          'merged_into_artist_slug', v_canonical.slug,
          'merged_into_artist_name', v_canonical.display_name,
          'merged_at', now(),
          'merge_note', p_note
        ),
      updated_at = now()
    where id = v_source.id;
  else
    update public.registry_artists
    set
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'merged_into_artist_id', v_canonical.id::text,
          'merged_into_artist_slug', v_canonical.slug,
          'merged_into_artist_name', v_canonical.display_name,
          'merged_at', now(),
          'merge_note', p_note
        ),
      updated_at = now()
    where id = v_source.id;
  end if;

  return jsonb_build_object(
    'sourceArtistId', v_source.id,
    'sourceSlug', v_source.slug,
    'sourceName', v_source.display_name,
    'canonicalArtistId', v_canonical.id,
    'canonicalSlug', v_canonical.slug,
    'canonicalName', v_canonical.display_name,
    'aliasRowsTouched', v_alias_rows,
    'existingAliasesRetargeted', v_existing_alias_rows,
    'trackArtistRowsUpdated', v_track_rows,
    'releaseArtistRowsUpdated', v_release_rows,
    'chartEntriesUpdated', v_chart_rows,
    'trackMetadataRowsUpdated', v_track_meta_rows,
    'sourceArchived', p_archive_source
  );
end;
$$;

grant execute on function public.admin_search_registry_artists(text, integer) to authenticated;
grant execute on function public.admin_merge_registry_artists(uuid, uuid, text, boolean) to authenticated;
