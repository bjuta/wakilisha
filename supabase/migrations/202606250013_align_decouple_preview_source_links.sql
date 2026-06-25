-- Align source-first decouple preview counts with source search counts.
-- Preview should show archived/historical source links for audit, but apply still mutates only actionable links.

create or replace function public.admin_get_artist_decouple_preview(
  p_source_artist_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_source record;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  if p_source_artist_id is null then
    raise exception 'source_artist_required';
  end if;

  select
    a.id as artist_id,
    a.slug as artist_slug,
    a.display_name,
    a.status,
    a.origin_iso2,
    a.public_image_url,
    a.metadata,
    coalesce((
      select count(*)
      from public.registry_track_artists rta
      where (
          rta.artist_id = a.id
          or lower(coalesce(rta.artist_slug, '')) = lower(a.slug)
        )
    ), 0) as track_credit_count,
    coalesce((
      select count(*)
      from public.registry_release_artists rra
      where (
          rra.artist_id = a.id
          or lower(coalesce(rra.artist_slug, '')) = lower(a.slug)
        )
    ), 0) as release_credit_count,
    coalesce((
      select count(*)
      from public.registry_track_artists rta
      where (
          rta.artist_id = a.id
          or lower(coalesce(rta.artist_slug, '')) = lower(a.slug)
        )
        and coalesce(rta.status, 'shadow') in ('shadow', 'active', 'needs_review')
    ), 0) as actionable_track_credit_count,
    coalesce((
      select count(*)
      from public.registry_release_artists rra
      where (
          rra.artist_id = a.id
          or lower(coalesce(rra.artist_slug, '')) = lower(a.slug)
        )
        and coalesce(rra.status, 'shadow') in ('shadow', 'active', 'needs_review')
    ), 0) as actionable_release_credit_count
  into v_source
  from public.registry_artists a
  where a.id = p_source_artist_id
    and a.status in ('active', 'draft', 'needs_review', 'archived')
  limit 1;

  if v_source.artist_id is null then
    raise exception 'source_artist_not_found';
  end if;

  return jsonb_build_object(
    'sourceArtist', jsonb_build_object(
      'artist_id', v_source.artist_id,
      'artist_slug', v_source.artist_slug,
      'display_name', v_source.display_name,
      'status', v_source.status,
      'origin_iso2', v_source.origin_iso2,
      'public_image_url', v_source.public_image_url,
      'track_credit_count', v_source.track_credit_count,
      'release_credit_count', v_source.release_credit_count,
      'actionable_track_credit_count', v_source.actionable_track_credit_count,
      'actionable_release_credit_count', v_source.actionable_release_credit_count
    ),
    'trackCredits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'credit_id', rta.id,
          'track_id', rta.track_id,
          'track_slug', rt.slug,
          'track_title', rt.title,
          'release_id', rt.release_id,
          'release_title', rr.title,
          'role', rta.role,
          'is_primary', rta.is_primary,
          'is_featured', rta.is_featured,
          'credit_order', rta.credit_order,
          'display_credit', rta.display_credit,
          'status', coalesce(rta.status, 'shadow'),
          'is_actionable', coalesce(rta.status, 'shadow') in ('shadow', 'active', 'needs_review')
        )
        order by
          case when coalesce(rta.status, 'shadow') in ('shadow', 'active', 'needs_review') then 0 else 1 end,
          rt.title asc,
          rta.credit_order asc,
          rta.id asc
      )
      from public.registry_track_artists rta
      left join public.registry_tracks rt on rt.id = rta.track_id
      left join public.registry_releases rr on rr.id = rt.release_id
      where (
          rta.artist_id = v_source.artist_id
          or lower(coalesce(rta.artist_slug, '')) = lower(v_source.artist_slug)
        )
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
          'status', coalesce(rra.status, 'shadow'),
          'is_actionable', coalesce(rra.status, 'shadow') in ('shadow', 'active', 'needs_review')
        )
        order by
          case when coalesce(rra.status, 'shadow') in ('shadow', 'active', 'needs_review') then 0 else 1 end,
          rr.title asc,
          rra.credit_order asc,
          rra.id asc
      )
      from public.registry_release_artists rra
      left join public.registry_releases rr on rr.id = rra.release_id
      where (
          rra.artist_id = v_source.artist_id
          or lower(coalesce(rra.artist_slug, '')) = lower(v_source.artist_slug)
        )
    ), '[]'::jsonb),
    'chartEntries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'entry_id', ce.id,
          'track_id', ce.track_id,
          'track_slug', ce.track_slug,
          'track_title', ce.track_title,
          'artist_name', ce.artist_name,
          'artist_slug', ce.artist_slug,
          'rank', ce.rank,
          'canonical_artist_id', ce.canonical_artist_id
        )
        order by ce.track_title asc, ce.rank asc, ce.id asc
      )
      from public.wk_chart_entries_v2 ce
      where ce.canonical_artist_id = v_source.artist_id::text
         or public.wk_slugify_text(coalesce(ce.artist_slug, '')) = public.wk_slugify_text(v_source.artist_slug)
         or public.wk_slugify_text(coalesce(ce.artist_name, '')) = public.wk_slugify_text(v_source.display_name)
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.admin_get_artist_decouple_preview(uuid) to authenticated;
