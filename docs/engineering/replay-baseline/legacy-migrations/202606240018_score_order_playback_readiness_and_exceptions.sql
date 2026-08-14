create table if not exists public.chart_playback_provider_exceptions (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  candidate_id text not null,
  registry_track_id uuid,
  provider_key text not null default 'apple_music',
  exception_type text not null check (
    exception_type in (
      'provider_unavailable',
      'manual_publish_override'
    )
  ),
  note text not null,
  source_url text,
  approved_by text,
  created_at timestamptz not null default now(),
  unique (run_id, candidate_id, provider_key)
);

create or replace function public.chart_get_run_playback_readiness(
  p_run_id text,
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
      row_number() over (
        order by
          coalesce(cs.final_score, 0) desc,
          c.normalized_key asc,
          c.id asc
      ) as rank,
      coalesce(cs.final_score, 0) as final_score,
      c.title,
      c.artist_display,
      c.normalized_key,
      regexp_replace(
        regexp_replace(
          lower(coalesce(nullif(split_part(c.normalized_key, '::', 1), ''), c.title, 'untitled')),
          '[^a-z0-9]+',
          '-',
          'g'
        ),
        '(^-|-$)',
        '',
        'g'
      ) as candidate_track_slug,
      regexp_replace(
        regexp_replace(
          lower(coalesce(nullif(split_part(c.normalized_key, '::', 2), ''), split_part(c.artist_display, ',', 1), 'unknown-artist')),
          '[^a-z0-9]+',
          '-',
          'g'
        ),
        '(^-|-$)',
        '',
        'g'
      ) as candidate_artist_slug
    from public.chart_ingest_candidates c
    left join public.chart_ingest_candidate_scores cs
      on cs.run_id::text = c.run_id::text
     and cs.candidate_id::text = c.id::text
    where c.run_id::text = p_run_id
      and c.status = 'eligible'
  ),
  resolved as (
    select
      e.*,
      scoped_track.track_id,
      scoped_track.registry_track_slug,
      scoped_track.registry_artist_slug,
      l.provider_track_id,
      l.match_method,
      l.match_confidence,
      l.match_status,
      ex.id as exception_id,
      ex.exception_type,
      ex.note as exception_note
    from eligible e
    left join lateral (
      select
        rt.id as track_id,
        rt.slug as registry_track_slug,
        coalesce(rta.artist_slug, rt.metadata->>'primary_artist_slug') as registry_artist_slug
      from public.registry_tracks rt
      left join public.registry_track_artists rta
        on rta.track_id = rt.id
      where rt.metadata->>'chart_entry_id' = e.id::text
         or (
          rt.slug = e.candidate_track_slug
          and (
            rta.artist_slug = e.candidate_artist_slug
            or rt.metadata->>'primary_artist_slug' = e.candidate_artist_slug
          )
        )
      order by
        case
          when rt.metadata->>'chart_entry_id' = e.id::text then 1
          when rta.artist_slug = e.candidate_artist_slug then 2
          when rt.metadata->>'primary_artist_slug' = e.candidate_artist_slug then 3
          else 4
        end,
        rt.updated_at desc nulls last,
        rt.created_at desc
      limit 1
    ) scoped_track on true
    left join lateral (
      select
        link.provider_track_id,
        link.match_method,
        link.match_confidence,
        link.match_status
      from public.registry_track_provider_links link
      where link.track_id = scoped_track.track_id
        and link.provider_key = lower(coalesce(nullif(trim(p_provider_key), ''), 'apple_music'))
        and link.match_status = 'matched'
      order by link.match_confidence desc, link.last_checked_at desc
      limit 1
    ) l on true
    left join lateral (
      select
        exception.id,
        exception.exception_type,
        exception.note
      from public.chart_playback_provider_exceptions exception
      where exception.run_id::text = p_run_id
        and exception.candidate_id::text = e.id::text
        and exception.provider_key = lower(coalesce(nullif(trim(p_provider_key), ''), 'apple_music'))
      order by exception.created_at desc
      limit 1
    ) ex on true
  ),
  summary as (
    select
      count(*)::integer as total_entries,
      count(*) filter (where rank <= 10)::integer as top10_entries,
      count(*) filter (where provider_track_id is not null or exception_id is not null)::integer as playable_entries,
      count(*) filter (where rank <= 10 and (provider_track_id is not null or exception_id is not null))::integer as top10_playable,
      count(*) filter (where exception_id is not null)::integer as exception_entries,
      count(*) filter (where rank <= 10 and exception_id is not null)::integer as top10_exception_entries,
      count(*) filter (where track_id is null)::integer as missing_registry_tracks,
      count(*) filter (where track_id is not null and provider_track_id is null and exception_id is null)::integer as missing_provider_links
    from resolved
  ),
  missing as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'rank', rank,
        'finalScore', final_score,
        'title', title,
        'artist', artist_display,
        'artistSlug', candidate_artist_slug,
        'trackSlug', candidate_track_slug,
        'registryTrackId', track_id,
        'reason',
          case
            when track_id is null then 'missing_scoped_registry_track'
            when provider_track_id is null then 'missing_apple_music_provider_link'
            else 'ready'
          end
      )
      order by rank
    ), '[]'::jsonb) as rows
    from resolved
    where provider_track_id is null
      and exception_id is null
    limit 25
  )
  select jsonb_build_object(
    'runId', p_run_id,
    'providerKey', lower(coalesce(nullif(trim(p_provider_key), ''), 'apple_music')),
    'totalEntries', coalesce(summary.total_entries, 0),
    'top10Entries', coalesce(summary.top10_entries, 0),
    'playableEntries', coalesce(summary.playable_entries, 0),
    'top10Playable', coalesce(summary.top10_playable, 0),
    'exceptionEntries', coalesce(summary.exception_entries, 0),
    'top10ExceptionEntries', coalesce(summary.top10_exception_entries, 0),
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

grant select, insert, update on public.chart_playback_provider_exceptions to service_role;
grant execute on function public.chart_get_run_playback_readiness(text, text) to authenticated;
grant execute on function public.chart_get_run_playback_readiness(text, text) to service_role;
