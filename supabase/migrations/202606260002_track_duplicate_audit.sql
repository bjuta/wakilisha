create or replace function public.admin_get_registry_track_duplicate_audit(
  p_limit integer default 200,
  p_include_low_confidence boolean default false
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
with track_base as (
  select
    t.id,
    t.slug,
    t.title,
    t.status,
    t.isrc,
    t.release_id,
    t.artwork_url,
    t.preview_url,
    t.created_at,
    t.updated_at,
    coalesce(t.metadata, '{}'::jsonb) as metadata,
    nullif(t.metadata->>'apple_music_catalog_id', '') as apple_music_catalog_id,
    public.wk_slugify_text(coalesce(t.title, '')) as title_key
  from public.registry_tracks t
  where t.status in ('active', 'draft', 'needs_review')
),
primary_artists as (
  select
    rta.track_id,
    string_agg(rta.artist_slug, ', ' order by rta.credit_order, rta.artist_slug)
      filter (where coalesce(rta.is_primary, false) = true) as primary_artist_slugs,
    string_agg(coalesce(rta.artist_name_text, rta.artist_slug), ', ' order by rta.credit_order, rta.artist_slug)
      filter (where coalesce(rta.is_primary, false) = true) as primary_artist_names,
    string_agg(rta.artist_slug, ', ' order by rta.credit_order, rta.artist_slug) as all_artist_slugs
  from public.registry_track_artists rta
  where coalesce(rta.status, 'active') <> 'archived'
  group by rta.track_id
),
provider_summary as (
  select
    l.track_id,
    count(*) as provider_link_count,
    string_agg(
      l.provider_key || ':' || l.provider_track_id,
      ', ' order by l.provider_key, l.provider_track_id
    ) as providers
  from public.registry_track_provider_links l
  where l.provider_track_id is not null
  group by l.track_id
),
chart_refs as (
  select
    ce.canonical_track_id::text as track_id,
    count(*) as chart_ref_count
  from public.wk_chart_entries_v2 ce
  where ce.canonical_track_id is not null
  group by ce.canonical_track_id::text
),
track_enriched as (
  select
    tb.*,
    pa.primary_artist_slugs,
    pa.primary_artist_names,
    pa.all_artist_slugs,
    coalesce(ps.provider_link_count, 0) as provider_link_count,
    ps.providers,
    coalesce(cr.chart_ref_count, 0) as chart_ref_count
  from track_base tb
  left join primary_artists pa on pa.track_id = tb.id
  left join provider_summary ps on ps.track_id = tb.id
  left join chart_refs cr on cr.track_id = tb.id::text
),
provider_duplicate_keys as (
  select
    l.provider_key,
    l.provider_track_id
  from public.registry_track_provider_links l
  join track_base tb on tb.id = l.track_id
  where l.provider_track_id is not null
  group by l.provider_key, l.provider_track_id
  having count(distinct l.track_id) > 1
),
apple_duplicate_keys as (
  select
    apple_music_catalog_id
  from track_base
  where apple_music_catalog_id is not null
  group by apple_music_catalog_id
  having count(distinct id) > 1
),
isrc_duplicate_keys as (
  select
    isrc
  from track_base
  where nullif(isrc, '') is not null
  group by isrc
  having count(distinct id) > 1
),
title_artist_numeric_keys as (
  select
    title_key,
    coalesce(primary_artist_slugs, '') as primary_artist_slugs
  from track_enriched
  where title_key <> ''
    and coalesce(primary_artist_slugs, '') <> ''
  group by title_key, coalesce(primary_artist_slugs, '')
  having count(distinct id) > 1
     and bool_or(slug ~ '-[0-9]+$')
),
candidate_members as (
  select
    'provider_identity'::text as audit_type,
    p.provider_key || ':' || p.provider_track_id as audit_key,
    'high'::text as risk_bucket,
    0.99::numeric as confidence,
    'Same provider identity is attached to multiple registry tracks.'::text as reason,
    'Review canonical track and prepare safe provider/chart remap.'::text as recommended_action,
    l.track_id
  from provider_duplicate_keys p
  join public.registry_track_provider_links l
    on l.provider_key = p.provider_key
   and l.provider_track_id = p.provider_track_id

  union all

  select
    'apple_catalog_id'::text as audit_type,
    a.apple_music_catalog_id as audit_key,
    'high'::text as risk_bucket,
    0.97::numeric as confidence,
    'Same Apple Music catalog ID appears on multiple registry tracks.'::text as reason,
    'Review canonical track and prepare safe Apple Music duplicate repair.'::text as recommended_action,
    tb.id as track_id
  from apple_duplicate_keys a
  join track_base tb
    on tb.apple_music_catalog_id = a.apple_music_catalog_id

  union all

  select
    'isrc'::text as audit_type,
    i.isrc as audit_key,
    'high'::text as risk_bucket,
    0.95::numeric as confidence,
    'Same ISRC appears on multiple registry tracks.'::text as reason,
    'Review recording identity, then remap relationships if this is the same track.'::text as recommended_action,
    tb.id as track_id
  from isrc_duplicate_keys i
  join track_base tb
    on tb.isrc = i.isrc

  union all

  select
    'title_artist_numeric'::text as audit_type,
    t.title_key || ':' || t.primary_artist_slugs as audit_key,
    'medium'::text as risk_bucket,
    0.66::numeric as confidence,
    'Same normalized title and primary artist with at least one numeric-suffix slug.'::text as reason,
    'Manual review only. Numeric suffix alone is not enough evidence to merge.'::text as recommended_action,
    te.id as track_id
  from title_artist_numeric_keys t
  join track_enriched te
    on te.title_key = t.title_key
   and coalesce(te.primary_artist_slugs, '') = t.primary_artist_slugs
),
candidate_rollup as (
  select
    cm.audit_type,
    cm.audit_key,
    max(cm.risk_bucket) as risk_bucket,
    max(cm.confidence) as confidence,
    max(cm.reason) as reason,
    max(cm.recommended_action) as recommended_action,
    count(distinct cm.track_id) as track_count,
    sum(coalesce(te.chart_ref_count, 0)) as public_ref_count,
    jsonb_agg(
      jsonb_build_object(
        'id', te.id,
        'slug', te.slug,
        'title', te.title,
        'status', te.status,
        'isrc', te.isrc,
        'releaseId', te.release_id,
        'artworkUrl', te.artwork_url,
        'previewUrl', te.preview_url,
        'appleMusicCatalogId', te.apple_music_catalog_id,
        'primaryArtistSlugs', te.primary_artist_slugs,
        'primaryArtistNames', te.primary_artist_names,
        'allArtistSlugs', te.all_artist_slugs,
        'providerLinkCount', te.provider_link_count,
        'providers', te.providers,
        'chartRefCount', te.chart_ref_count,
        'createdAt', te.created_at,
        'updatedAt', te.updated_at
      )
      order by
        te.chart_ref_count desc,
        case te.status
          when 'active' then 1
          when 'needs_review' then 2
          when 'draft' then 3
          else 4
        end,
        te.updated_at desc nulls last,
        te.slug asc
    ) as tracks
  from candidate_members cm
  join track_enriched te on te.id = cm.track_id
  group by cm.audit_type, cm.audit_key
),
filtered as (
  select *
  from candidate_rollup
  where p_include_low_confidence
     or audit_type in ('provider_identity', 'apple_catalog_id', 'isrc')
     or public_ref_count > 0
  order by confidence desc, public_ref_count desc, track_count desc, audit_type asc, audit_key asc
  limit greatest(1, least(coalesce(p_limit, 200), 500))
)
select jsonb_build_object(
  'generatedAt', now(),
  'stats', jsonb_build_object(
    'totalCandidates', coalesce((select count(*) from filtered), 0),
    'highConfidence', coalesce((select count(*) from filtered where confidence >= 0.9), 0),
    'mediumConfidence', coalesce((select count(*) from filtered where confidence >= 0.6 and confidence < 0.9), 0),
    'publicRefs', coalesce((select sum(public_ref_count) from filtered), 0)
  ),
  'candidates', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'candidateId', md5(audit_type || ':' || audit_key),
        'entityKind', 'track',
        'auditType', audit_type,
        'auditKey', audit_key,
        'riskBucket', risk_bucket,
        'confidence', confidence,
        'reason', reason,
        'recommendedAction', recommended_action,
        'trackCount', track_count,
        'publicRefCount', public_ref_count,
        'tracks', tracks
      )
      order by confidence desc, public_ref_count desc, track_count desc, audit_type asc, audit_key asc
    )
    from filtered
  ), '[]'::jsonb)
)
where coalesce(public.current_user_has_capability('manage_registry'), false);
$$;

grant execute on function public.admin_get_registry_track_duplicate_audit(integer, boolean) to authenticated;
