-- Phase 7B V3: canonical provider source convergence.
--
-- Backfill the currently published YouTube provider identities already evidenced
-- by immutable Article publication versions and active Registry Artist metadata.
-- Legacy Article HTML and Registry metadata remain untouched. Presentation
-- adapters resolve those references through video.sources after this migration.

do $phase_7b_v3_preflight$
begin
  if to_regclass('video.sources') is null then
    raise exception 'STOP: video.sources authority is missing';
  end if;

  if not exists (
    select 1
    from video.source_providers provider
    where provider.provider_key = 'youtube'
      and provider.enabled
  ) then
    raise exception 'STOP: enabled YouTube Video provider authority is missing';
  end if;

  if to_regclass('editorial.resources') is null
     or to_regclass('editorial.article_versions') is null
     or to_regclass('public.registry_artists') is null
  then
    raise exception 'STOP: provider migration evidence authority is incomplete';
  end if;
end;
$phase_7b_v3_preflight$;

with published_articles as (
  select coalesce(article_version.content_html, '') as content_html
  from editorial.resources resource
  join editorial.article_versions article_version
    on article_version.resource_id = resource.id
   and article_version.id = resource.current_published_version_id
  where resource.resource_kind = 'article'
    and resource.current_published_version_id is not null
),
article_provider_ids as (
  select distinct match_row[1] as provider_object_id
  from published_articles article
  cross join lateral regexp_matches(
    article.content_html,
    '(?:youtube\\.com/watch\\?[^"''<> ]*v=)([A-Za-z0-9_-]{11})',
    'gi'
  ) match_row

  union

  select distinct match_row[1] as provider_object_id
  from published_articles article
  cross join lateral regexp_matches(
    article.content_html,
    '(?:youtube(?:-nocookie)?\\.com/embed/)([A-Za-z0-9_-]{11})',
    'gi'
  ) match_row

  union

  select distinct match_row[1] as provider_object_id
  from published_articles article
  cross join lateral regexp_matches(
    article.content_html,
    '(?:youtube\\.com/shorts/)([A-Za-z0-9_-]{11})',
    'gi'
  ) match_row

  union

  select distinct match_row[1] as provider_object_id
  from published_articles article
  cross join lateral regexp_matches(
    article.content_html,
    '(?:youtu\\.be/)([A-Za-z0-9_-]{11})',
    'gi'
  ) match_row
),
artist_video_items as (
  select item
  from public.registry_artists artist
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(artist.metadata -> 'youtube_videos') = 'array'
        then artist.metadata -> 'youtube_videos'
      else '[]'::jsonb
    end
  ) item
  where artist.status = 'active'
),
artist_video_values as (
  select
    case
      when jsonb_typeof(item) = 'string'
        then trim(both '"' from item::text)
      when jsonb_typeof(item) = 'object'
        then coalesce(
          item ->> 'youtubeId',
          item ->> 'youtube_id',
          item ->> 'url',
          ''
        )
      else ''
    end as raw_value
  from artist_video_items
),
artist_provider_ids as (
  select distinct
    coalesce(
      (regexp_match(
        raw_value,
        '(?:youtube\\.com/watch\\?[^ ]*v=)([A-Za-z0-9_-]{11})',
        'i'
      ))[1],
      (regexp_match(
        raw_value,
        '(?:youtube(?:-nocookie)?\\.com/embed/)([A-Za-z0-9_-]{11})',
        'i'
      ))[1],
      (regexp_match(
        raw_value,
        '(?:youtube\\.com/shorts/)([A-Za-z0-9_-]{11})',
        'i'
      ))[1],
      (regexp_match(
        raw_value,
        '(?:youtu\\.be/)([A-Za-z0-9_-]{11})',
        'i'
      ))[1],
      case
        when raw_value ~ '^[A-Za-z0-9_-]{11}$'
          then raw_value
        else null
      end
    ) as provider_object_id
  from artist_video_values
  where raw_value <> ''
),
evidence as (
  select provider_object_id, 'article'::text as evidence_kind
  from article_provider_ids
  where provider_object_id is not null

  union all

  select provider_object_id, 'artist'::text as evidence_kind
  from artist_provider_ids
  where provider_object_id is not null
),
provider_sources as (
  select
    provider_object_id,
    bool_or(evidence_kind = 'article') as article_reference,
    bool_or(evidence_kind = 'artist') as artist_catalog
  from evidence
  group by provider_object_id
)
insert into video.sources (
  source_kind,
  provider_key,
  provider_object_id,
  canonical_url,
  source_metadata,
  created_by
)
select
  'external_provider',
  'youtube',
  source.provider_object_id,
  'https://www.youtube.com/watch?v=' || source.provider_object_id,
  jsonb_build_object(
    'migration',
    'phase_7b_v3_video_provider_source_convergence',
    'legacy_article_reference',
    source.article_reference,
    'legacy_artist_catalog',
    source.artist_catalog
  ),
  null
from provider_sources source
on conflict (provider_key, provider_object_id)
  where source_kind = 'external_provider'
do nothing;

create or replace function public.resolve_video_provider_sources_for_service(
  p_provider_key text,
  p_provider_object_ids text[]
)
returns table (
  source_id uuid,
  provider_key text,
  provider_object_id text,
  canonical_url text
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'video'
as $function$
declare
  v_provider_key text := lower(btrim(coalesce(p_provider_key, '')));
  v_requested_count integer := coalesce(
    array_length(p_provider_object_ids, 1),
    0
  );
begin
  if v_provider_key = '' then
    raise exception 'Video provider key is required.';
  end if;

  if v_requested_count > 500 then
    raise exception 'Video provider source resolution is limited to 500 ids.';
  end if;

  if not exists (
    select 1
    from video.source_providers provider
    where provider.provider_key = v_provider_key
      and provider.enabled
  ) then
    raise exception 'Video provider is disabled or unknown.';
  end if;

  return query
  select
    source.id,
    source.provider_key,
    source.provider_object_id,
    source.canonical_url
  from video.sources source
  where source.source_kind = 'external_provider'
    and source.provider_key = v_provider_key
    and source.provider_object_id = any(
      coalesce(p_provider_object_ids, array[]::text[])
    )
  order by source.provider_object_id;
end;
$function$;

revoke all
  on function public.resolve_video_provider_sources_for_service(text, text[])
  from public, anon, authenticated;

grant execute
  on function public.resolve_video_provider_sources_for_service(text, text[])
  to service_role;

do $phase_7b_v3_proof$
declare
  v_bad_count bigint;
begin
  select count(*)
  into v_bad_count
  from video.sources source
  where source.source_kind = 'external_provider'
    and source.provider_key = 'youtube'
    and (
      source.provider_object_id !~ '^[A-Za-z0-9_-]{11}$'
      or source.canonical_url is distinct from
        'https://www.youtube.com/watch?v=' || source.provider_object_id
    );

  if v_bad_count <> 0 then
    raise exception
      'STOP: malformed canonical YouTube Video provider source rows detected';
  end if;

  if has_function_privilege(
       'anon',
       'public.resolve_video_provider_sources_for_service(text,text[])',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.resolve_video_provider_sources_for_service(text,text[])',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.resolve_video_provider_sources_for_service(text,text[])',
       'execute'
     )
  then
    raise exception
      'STOP: Video provider source resolver privilege boundary is incorrect';
  end if;
end;
$phase_7b_v3_proof$;
