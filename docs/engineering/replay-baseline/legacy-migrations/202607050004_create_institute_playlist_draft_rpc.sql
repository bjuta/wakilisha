create or replace function public.create_institute_playlist_draft(
  p_inquiry_id uuid,
  p_title text,
  p_description text default '',
  p_curator_label text default 'WAKILISHA',
  p_items jsonb default '[]'::jsonb
)
returns table (
  playlist_id uuid,
  playlist_slug text,
  work_product_link_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_base text;
  candidate_slug text;
  suffix integer := 2;
  new_playlist_id uuid;
  new_work_product_link_id uuid;
  item_count integer;
begin
  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('institute_write')
    or public.current_user_has_capability('institute_admin')
  ) then
    raise exception 'Permission denied: institute_write required';
  end if;

  if p_inquiry_id is null then
    raise exception 'Inquiry ID is required';
  end if;

  if not exists (select 1 from public.institute_inquiries where id = p_inquiry_id) then
    raise exception 'Inquiry not found';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Playlist title is required';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Playlist items must be a JSON array';
  end if;

  item_count := jsonb_array_length(coalesce(p_items, '[]'::jsonb));

  if item_count < 1 then
    raise exception 'At least one playlist item is required';
  end if;

  clean_base := lower(trim(coalesce(p_title, 'institute-playlist-draft')));
  clean_base := regexp_replace(clean_base, '[^a-z0-9\s-]', '', 'g');
  clean_base := regexp_replace(clean_base, '[\s_]+', '-', 'g');
  clean_base := regexp_replace(clean_base, '-+', '-', 'g');
  clean_base := regexp_replace(clean_base, '(^-|-$)', '', 'g');
  clean_base := left(nullif(clean_base, ''), 76);

  if clean_base is null then
    clean_base := 'institute-playlist-draft';
  end if;

  candidate_slug := clean_base;

  while exists (select 1 from public.wk_playlists where slug = candidate_slug) loop
    candidate_slug := clean_base || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  insert into public.wk_playlists (
    title,
    slug,
    description,
    curator_label,
    status,
    source_inquiry_id,
    metadata
  )
  values (
    trim(p_title),
    candidate_slug,
    coalesce(p_description, ''),
    coalesce(nullif(trim(p_curator_label), ''), 'WAKILISHA'),
    'draft',
    p_inquiry_id,
    jsonb_build_object(
      'source', 'institute',
      'created_from', 'institute_playlist_bridge',
      'item_count', item_count
    )
  )
  returning id into new_playlist_id;

  insert into public.wk_playlist_items (
    playlist_id,
    position,
    registry_track_id,
    registry_release_id,
    provider_key,
    provider_track_id,
    provider_url,
    title,
    artist_names,
    release_title,
    artwork_url,
    preview_url,
    duration_ms,
    isrc,
    match_status,
    match_confidence,
    normalization_payload,
    notes
  )
  select
    new_playlist_id,
    item_position::integer,
    nullif(trim(item->>'registry_track_id'), '')::uuid,
    nullif(trim(item->>'registry_release_id'), '')::uuid,
    lower(nullif(trim(item->>'provider_key'), '')),
    nullif(trim(item->>'provider_track_id'), ''),
    nullif(trim(item->>'provider_url'), ''),
    nullif(trim(item->>'title'), ''),
    coalesce(
      (
        select array_agg(trim(artist_name))
        from jsonb_array_elements_text(coalesce(item->'artist_names', '[]'::jsonb)) as artist_name
        where trim(artist_name) <> ''
      ),
      '{}'::text[]
    ),
    nullif(trim(item->>'release_title'), ''),
    nullif(trim(item->>'artwork_url'), ''),
    nullif(trim(item->>'preview_url'), ''),
    nullif(trim(item->>'duration_ms'), '')::integer,
    nullif(trim(item->>'isrc'), ''),
    case
      when nullif(trim(item->>'match_status'), '') in (
        'matched',
        'external_only',
        'missing_registry_track',
        'needs_review',
        'rejected',
        'pending'
      ) then trim(item->>'match_status')
      when nullif(trim(item->>'registry_track_id'), '') is not null then 'matched'
      when nullif(trim(item->>'provider_track_id'), '') is not null
        or nullif(trim(item->>'provider_url'), '') is not null then 'external_only'
      else 'pending'
    end,
    nullif(trim(item->>'match_confidence'), '')::numeric,
    coalesce(item->'normalization_payload', '{}'::jsonb),
    nullif(trim(item->>'notes'), '')
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as playlist_item(item, item_position);

  insert into public.institute_work_product_links (
    inquiry_id,
    product_type,
    format_label,
    product_id,
    product_slug,
    status,
    metadata
  )
  values (
    p_inquiry_id,
    'playlist',
    'Playlist',
    new_playlist_id,
    candidate_slug,
    'draft',
    jsonb_build_object(
      'source', 'institute',
      'created_from', 'institute_playlist_bridge',
      'item_count', item_count
    )
  )
  on conflict (inquiry_id, product_type, format_label)
  do update set
    product_id = excluded.product_id,
    product_slug = excluded.product_slug,
    status = excluded.status,
    metadata = public.institute_work_product_links.metadata || excluded.metadata,
    updated_at = now()
  returning id into new_work_product_link_id;

  update public.wk_playlists
  set source_work_product_link_id = new_work_product_link_id
  where id = new_playlist_id;

  playlist_id := new_playlist_id;
  playlist_slug := candidate_slug;
  work_product_link_id := new_work_product_link_id;
  return next;
end;
$$;

grant execute on function public.create_institute_playlist_draft(uuid, text, text, text, jsonb) to authenticated;
