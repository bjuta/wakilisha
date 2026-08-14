create or replace function public.wk_slugify_text(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      lower(coalesce(nullif(trim(p_value), ''), '')),
      '[^a-z0-9]+',
      '-',
      'g'
    ),
    '(^-|-$)',
    '',
    'g'
  );
$$;

create or replace function public.registry_resolve_artist_slug_for_public(p_slug text)
returns table (
  input_slug text,
  canonical_artist_id uuid,
  canonical_slug text,
  canonical_display_name text,
  resolved_via text
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select public.wk_slugify_text(p_slug) as slug
  ),
  alias_match as (
    select
      n.slug,
      ra.id,
      ra.slug,
      ra.display_name,
      'alias'::text
    from normalized n
    join public.registry_artist_aliases a
      on lower(a.alias_slug) = n.slug
     and coalesce(a.status, 'active') = 'active'
    join public.registry_artists ra
      on ra.id = a.canonical_artist_id
     and ra.status = 'active'
    limit 1
  ),
  direct_match as (
    select
      n.slug,
      ra.id,
      ra.slug,
      ra.display_name,
      'active_artist'::text
    from normalized n
    join public.registry_artists ra
      on lower(ra.slug) = n.slug
     and ra.status = 'active'
    where not exists (select 1 from alias_match)
    limit 1
  )
  select * from alias_match
  union all
  select * from direct_match;
$$;

create or replace function public.wk_chart_entries_apply_artist_alias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_slug text;
  v_resolved record;
begin
  v_source_slug := public.wk_slugify_text(
    coalesce(
      nullif(new.artist_slug, ''),
      split_part(coalesce(new.artist_name, ''), ',', 1)
    )
  );

  if v_source_slug = '' then
    return new;
  end if;

  new.artist_slug := v_source_slug;

  select *
  into v_resolved
  from public.registry_resolve_artist_slug_for_public(v_source_slug)
  limit 1;

  if v_resolved.canonical_slug is not null then
    new.artist_slug := v_resolved.canonical_slug;
  end if;

  return new;
end;
$$;

drop trigger if exists wk_chart_entries_artist_alias_biu on public.wk_chart_entries_v2;

create trigger wk_chart_entries_artist_alias_biu
before insert or update of artist_slug, artist_name
on public.wk_chart_entries_v2
for each row
execute function public.wk_chart_entries_apply_artist_alias();

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
    coalesce(public.current_user_has_capability('manage_registry'), false)
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

grant execute on function public.registry_resolve_artist_slug_for_public(text) to anon, authenticated;
grant execute on function public.admin_resolve_chart_artist_alias(text, uuid, text, boolean) to authenticated;
