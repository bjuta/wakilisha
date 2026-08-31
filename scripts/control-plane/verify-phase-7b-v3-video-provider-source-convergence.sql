-- Phase 7B V3 permanent read-only verifier.
-- Verifies canonical provider identity coverage without mutating authority.

do $phase_7b_v3_verify$
declare
  v_article_ids bigint;
  v_artist_ids bigint;
  v_evidence_ids bigint;
  v_canonical_youtube_sources bigint;
  v_missing_ids bigint;
  v_bad_ids bigint;
  v_resolver_misses bigint;
begin
  with published_articles as (
    select coalesce(article_version.content_html, '') as content_html
    from editorial.resources resource
    join editorial.article_versions article_version
      on article_version.resource_id = resource.id
     and article_version.id = resource.current_published_version_id
    where resource.resource_kind = 'article'
      and resource.current_published_version_id is not null
  ),
  article_ids as (
    select distinct match_row[1] as provider_object_id
    from published_articles article
    cross join lateral regexp_matches(
      article.content_html,
      '(?:youtube\\.com/watch\\?[^"''<> ]*v=)([A-Za-z0-9_-]{11})',
      'gi'
    ) match_row

    union
    select distinct match_row[1]
    from published_articles article
    cross join lateral regexp_matches(
      article.content_html,
      '(?:youtube(?:-nocookie)?\\.com/embed/)([A-Za-z0-9_-]{11})',
      'gi'
    ) match_row

    union
    select distinct match_row[1]
    from published_articles article
    cross join lateral regexp_matches(
      article.content_html,
      '(?:youtube\\.com/shorts/)([A-Za-z0-9_-]{11})',
      'gi'
    ) match_row

    union
    select distinct match_row[1]
    from published_articles article
    cross join lateral regexp_matches(
      article.content_html,
      '(?:youtu\\.be/)([A-Za-z0-9_-]{11})',
      'gi'
    ) match_row
  ),
  artist_items as (
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
  artist_values as (
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
    from artist_items
  ),
  artist_ids as (
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
    from artist_values
    where raw_value <> ''
  ),
  evidence as (
    select provider_object_id from article_ids
    union
    select provider_object_id
    from artist_ids
    where provider_object_id is not null
  )
  select
    (select count(*) from article_ids),
    (select count(*) from artist_ids where provider_object_id is not null),
    (select count(*) from evidence),
    (
      select count(*)
      from video.sources source
      where source.source_kind = 'external_provider'
        and source.provider_key = 'youtube'
    ),
    (
      select count(*)
      from evidence
      left join video.sources source
        on source.source_kind = 'external_provider'
       and source.provider_key = 'youtube'
       and source.provider_object_id = evidence.provider_object_id
      where source.id is null
    )
  into
    v_article_ids,
    v_artist_ids,
    v_evidence_ids,
    v_canonical_youtube_sources,
    v_missing_ids;

  if v_missing_ids <> 0 then
    raise exception
      'Phase 7B V3 FAIL: % public YouTube evidence ids lack canonical Video source authority',
      v_missing_ids;
  end if;

  select count(*)
  into v_bad_ids
  from video.sources source
  where source.source_kind = 'external_provider'
    and source.provider_key = 'youtube'
    and (
      source.provider_object_id !~ '^[A-Za-z0-9_-]{11}$'
      or source.canonical_url is distinct from
        'https://www.youtube.com/watch?v=' || source.provider_object_id
      or source.media_asset_id is not null
      or source.media_asset_revision_id is not null
    );

  if v_bad_ids <> 0 then
    raise exception
      'Phase 7B V3 FAIL: malformed canonical YouTube Video source rows = %',
      v_bad_ids;
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
      'Phase 7B V3 FAIL: provider resolver privilege boundary drifted';
  end if;

  with evidence_sample as (
    select source.provider_object_id
    from video.sources source
    where source.source_kind = 'external_provider'
      and source.provider_key = 'youtube'
    order by source.provider_object_id
    limit 20
  ),
  resolved as (
    select resolver.provider_object_id
    from public.resolve_video_provider_sources_for_service(
      'youtube',
      coalesce(
        (select array_agg(provider_object_id) from evidence_sample),
        array[]::text[]
      )
    ) resolver
  )
  select count(*)
  into v_resolver_misses
  from evidence_sample sample
  left join resolved
    on resolved.provider_object_id = sample.provider_object_id
  where resolved.provider_object_id is null;

  if v_resolver_misses <> 0 then
    raise exception
      'Phase 7B V3 FAIL: service provider resolver missed canonical sources';
  end if;

  raise notice
    'Phase 7B V3 PASS: Article ids %, Artist ids %, union %, canonical YouTube sources %, missing %',
    v_article_ids,
    v_artist_ids,
    v_evidence_ids,
    v_canonical_youtube_sources,
    v_missing_ids;
end;
$phase_7b_v3_verify$;
