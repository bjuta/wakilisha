create or replace function public.chart_create_artist_origin_shell(
  p_artist_name text,
  p_origin_iso2 text,
  p_run_id text default null,
  p_candidate_id text default null,
  p_actor_user_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_slug text;
  v_origin text;
  v_artist record;
  v_previous_origin text;
  v_previous_status text;
begin
  v_name := nullif(trim(p_artist_name), '');
  v_origin := upper(nullif(trim(p_origin_iso2), ''));

  if v_name is null then
    raise exception 'artist_name_required';
  end if;

  if v_origin is null or length(v_origin) <> 2 then
    raise exception 'invalid_origin_iso2';
  end if;

  v_slug := public.wk_slugify_text(v_name);

  select id, slug, display_name, origin_iso2, status
  into v_artist
  from public.registry_artists
  where lower(slug) = v_slug
  limit 1;

  if v_artist.id is null then
    insert into public.registry_artists (
      slug,
      display_name,
      normalized_name,
      sort_name,
      artist_type,
      origin_iso2,
      origin_confidence,
      status,
      metadata
    )
    values (
      v_slug,
      v_name,
      lower(v_name),
      v_name,
      'unknown',
      v_origin,
      1,
      'active',
      jsonb_build_object(
        'created_from', 'chart_origin_queue',
        'origin_resolution_run_id', p_run_id,
        'origin_resolution_at', now()
      )
    )
    returning id, slug, display_name, origin_iso2, status
    into v_artist;

    v_previous_origin := null;
    v_previous_status := null;
  else
    v_previous_origin := v_artist.origin_iso2;
    v_previous_status := v_artist.status;

    update public.registry_artists
    set
      origin_iso2 = v_origin,
      origin_confidence = 1,
      status = 'active',
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'origin_resolution_source', 'chart_origin_queue',
          'origin_resolution_run_id', p_run_id,
          'origin_resolution_previous_status', v_previous_status,
          'origin_resolution_at', now()
        ),
      updated_at = now()
    where id = v_artist.id
    returning id, slug, display_name, origin_iso2, status
    into v_artist;
  end if;

  insert into public.chart_origin_resolution_audit (
    run_id,
    candidate_id,
    artist_id,
    source_slug,
    previous_origin_iso2,
    new_origin_iso2,
    action,
    note,
    actor_user_id
  )
  values (
    p_run_id,
    p_candidate_id,
    v_artist.id,
    v_artist.slug,
    v_previous_origin,
    v_origin,
    'create_artist_shell',
    'Created, updated, or activated from chart origin queue.',
    p_actor_user_id
  );

  return jsonb_build_object(
    'artistId', v_artist.id,
    'artistSlug', v_artist.slug,
    'artistName', v_artist.display_name,
    'originIso2', v_artist.origin_iso2,
    'previousOriginIso2', v_previous_origin,
    'previousStatus', v_previous_status,
    'status', v_artist.status
  );
end;
$$;

grant execute on function public.chart_create_artist_origin_shell(text, text, text, text, text) to service_role;
