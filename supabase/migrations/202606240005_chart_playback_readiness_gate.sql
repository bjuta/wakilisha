-- Chart playback readiness gate.
-- Lets admin publish flow check whether a dry-run's eligible rows already have matched Apple Music provider links.

create or replace function public.chart_get_run_playback_readiness(
  p_run_id uuid,
  p_provider_key text default 'apple_music'
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with eligible as (
    select
      c.id,
      row_number() over (order by c.created_at asc, c.id asc) as rank,
      c.title,
      c.artist_display,
      c.normalized_key,
      split_part(c.normalized_key, '::', 1) as candidate_track_slug
    from public.chart_ingest_candidates c
    where c.run_id = p_run_id
      and c.status = 'eligible'
  ),
  resolved as (
    select
      e.*,
      rt.id as track_id,
      rt.slug as registry_track_slug,
      l.provider_track_id,
      l.match_method,
      l.match_confidence,
      l.match_status
    from eligible e
    left join public.registry_tracks rt
      on rt.slug = e.candidate_track_slug
    left join lateral (
      select
        link.provider_track_id,
        link.match_method,
        link.match_confidence,
        link.match_status
      from public.registry_track_provider_links link
      where link.track_id = rt.id
        and link.provider_key = lower(coalesce(nullif(trim(p_provider_key), ''), 'apple_music'))
        and link.match_status = 'matched'
      order by link.match_confidence desc, link.last_checked_at desc
      limit 1
    ) l on true
  ),
  summary as (
    select
      count(*)::integer as total_entries,
      count(*) filter (where rank <= 10)::integer as top10_entries,
      count(*) filter (where provider_track_id is not null)::integer as playable_entries,
      count(*) filter (where rank <= 10 and provider_track_id is not null)::integer as top10_playable,
      count(*) filter (where track_id is null)::integer as missing_registry_tracks,
      count(*) filter (where track_id is not null and provider_track_id is null)::integer as missing_provider_links
    from resolved
  ),
  missing as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'rank', rank,
        'title', title,
        'artist', artist_display,
        'trackSlug', candidate_track_slug,
        'registryTrackId', track_id,
        'reason',
          case
            when track_id is null then 'missing_registry_track'
            when provider_track_id is null then 'missing_apple_music_provider_link'
            else 'ready'
          end
      )
      order by rank
    ), '[]'::jsonb) as rows
    from resolved
    where provider_track_id is null
    limit 25
  )
  select jsonb_build_object(
    'runId', p_run_id,
    'providerKey', lower(coalesce(nullif(trim(p_provider_key), ''), 'apple_music')),
    'totalEntries', coalesce(summary.total_entries, 0),
    'top10Entries', coalesce(summary.top10_entries, 0),
    'playableEntries', coalesce(summary.playable_entries, 0),
    'top10Playable', coalesce(summary.top10_playable, 0),
    'missingRegistryTracks', coalesce(summary.missing_registry_tracks, 0),
    'missingProviderLinks', coalesce(summary.missing_provider_links, 0),
    'playbackRate',
      case
        when coalesce(summary.total_entries, 0) = 0 then 0
        else round((summary.playable_entries::numeric / summary.total_entries::numeric) * 100, 2)
      end,
    'top10PlaybackRate',
      case
        when coalesce(summary.top10_entries, 0) = 0 then 0
        else round((summary.top10_playable::numeric / summary.top10_entries::numeric) * 100, 2)
      end,
    'canPublish',
      coalesce(summary.top10_entries, 0) > 0
      and coalesce(summary.top10_playable, 0) = coalesce(summary.top10_entries, 0),
    'missingRows', missing.rows
  )
  from summary, missing;
$$;

grant execute on function public.chart_get_run_playback_readiness(uuid, text)
  to authenticated;
