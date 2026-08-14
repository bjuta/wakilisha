create or replace function public.admin_resolve_chart_artist_alias(
  p_alias_slug text,
  p_canonical_artist_id uuid,
  p_alias_display_name text default null,
  p_apply_to_existing boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alias_slug text;
  v_canonical record;
  v_alias_rows integer := 0;
  v_chart_rows integer := 0;
  v_track_artist_rows integer := 0;
  v_duplicate_artist_rows integer := 0;
begin
  if not (
    coalesce(auth.role(), '') = 'service_role'
    or coalesce(public.current_user_has_capability('manage_registry'), false)
    or coalesce(public.current_user_has_capability('publish_charts'), false)
  ) then
    raise exception 'insufficient_privilege';
  end if;

  v_alias_slug := public.wk_slugify_text(p_alias_slug);

  if v_alias_slug = '' then
    raise exception 'alias_slug_required';
  end if;

  select id, slug, display_name
  into v_canonical
  from public.registry_artists
  where id = p_canonical_artist_id
    and status = 'active'
  limit 1;

  if v_canonical.id is null then
    raise exception 'canonical_active_artist_not_found';
  end if;

  update public.registry_artist_aliases a
  set
    canonical_artist_id = v_canonical.id,
    alias_display_name = coalesce(nullif(p_alias_display_name, ''), p_alias_slug),
    confidence = 100,
    source = 'similarity_match',
    notes = 'Chart registry reconciliation: alias resolves to canonical active artist.',
    status = 'active'
  where lower(a.alias_slug) = v_alias_slug;

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
      v_alias_slug,
      v_canonical.id,
      coalesce(nullif(p_alias_display_name, ''), p_alias_slug),
      100,
      'similarity_match',
      'Chart registry reconciliation: alias resolves to canonical active artist.',
      'active'
    );
    v_alias_rows := 1;
  end if;

  if p_apply_to_existing then
    update public.wk_chart_entries_v2
    set artist_slug = v_canonical.slug
    where public.wk_slugify_text(artist_slug) = v_alias_slug;

    get diagnostics v_chart_rows = row_count;

    update public.registry_track_artists
    set
      artist_id = v_canonical.id,
      artist_slug = v_canonical.slug,
      artist_name_text = coalesce(nullif(artist_name_text, ''), v_canonical.display_name),
      display_credit = coalesce(nullif(display_credit, ''), v_canonical.display_name)
    where public.wk_slugify_text(artist_slug) = v_alias_slug;

    get diagnostics v_track_artist_rows = row_count;
  end if;

  update public.registry_artists
  set metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'duplicate_of_artist_id', v_canonical.id::text,
      'duplicate_of_artist_slug', v_canonical.slug,
      'resolved_alias_slug', v_alias_slug,
      'resolved_alias_at', now()
    )
  where lower(slug) = v_alias_slug
    and id <> v_canonical.id
    and status <> 'active';

  get diagnostics v_duplicate_artist_rows = row_count;

  return jsonb_build_object(
    'aliasSlug', v_alias_slug,
    'canonicalArtistId', v_canonical.id,
    'canonicalSlug', v_canonical.slug,
    'canonicalDisplayName', v_canonical.display_name,
    'aliasRowsTouched', v_alias_rows,
    'chartEntriesUpdated', v_chart_rows,
    'trackArtistRowsUpdated', v_track_artist_rows,
    'duplicateDraftArtistsMarked', v_duplicate_artist_rows
  );
end;
$$;


grant execute on function public.admin_resolve_chart_artist_alias(text, uuid, text, boolean) to authenticated;
