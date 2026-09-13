-- Phase 9A.2: one maintained public Registry search projection.
--
-- This intentionally does not create a stored duplicate search corpus.
-- public_search_documents_v1 is a live security-invoker projection over
-- canonical Registry authorities. Registry mutations are therefore visible
-- immediately and there is no trigger/reindex lifecycle that can drift.
--
-- The projection itself is not a public Data API surface. Anonymous and
-- authenticated callers receive only bounded rows through the versioned
-- search_public_registry_v1 function.

create index if not exists idx_registry_tracks_title_trgm
  on public.registry_tracks
  using gin (title gin_trgm_ops);

create index if not exists idx_registry_tracks_slug_trgm
  on public.registry_tracks
  using gin (slug gin_trgm_ops);

create index if not exists idx_registry_releases_title_trgm
  on public.registry_releases
  using gin (title gin_trgm_ops);

create index if not exists idx_registry_releases_slug_trgm
  on public.registry_releases
  using gin (slug gin_trgm_ops);

create index if not exists idx_registry_genres_name_trgm
  on public.registry_genres
  using gin (name gin_trgm_ops);

create index if not exists idx_registry_genres_slug_trgm
  on public.registry_genres
  using gin (slug gin_trgm_ops);

create index if not exists idx_registry_labels_name_trgm
  on public.registry_labels
  using gin (name gin_trgm_ops);

create index if not exists idx_registry_labels_slug_trgm
  on public.registry_labels
  using gin (slug gin_trgm_ops);

create or replace view public.public_search_documents_v1
with (security_invoker = true)
as
with
primary_track_artist as (
  select distinct on (ta.track_id)
    ta.track_id,
    ta.artist_id,
    ta.artist_slug,
    ta.artist_name_text
  from public.registry_track_artists ta
  where ta.status = 'active'
    and ta.is_primary
  order by
    ta.track_id,
    ta.credit_order asc,
    ta.id asc
),
primary_release_artist as (
  select distinct on (ra.release_id)
    ra.release_id,
    ra.artist_id,
    ra.artist_slug,
    ra.artist_name_text
  from public.registry_release_artists ra
  where ra.status = 'active'
    and ra.is_primary
  order by
    ra.release_id,
    ra.credit_order asc,
    ra.id asc
),
release_track_counts as (
  select
    rt.release_id,
    count(*)::integer as track_count
  from public.registry_release_tracks rt
  join public.registry_tracks t
    on t.id = rt.track_id
   and t.status = 'active'
  where rt.status = 'active'
  group by rt.release_id
),
first_release_track as (
  select distinct on (rt.release_id)
    rt.release_id,
    t.slug as track_slug,
    pta.artist_slug as track_artist_slug
  from public.registry_release_tracks rt
  join public.registry_tracks t
    on t.id = rt.track_id
   and t.status = 'active'
  left join primary_track_artist pta
    on pta.track_id = t.id
  where rt.status = 'active'
  order by
    rt.release_id,
    rt.disc_number asc,
    rt.track_number asc nulls last,
    rt.id asc
),
first_release_by_track as (
  select distinct on (rt.track_id)
    rt.track_id,
    rt.release_id
  from public.registry_release_tracks rt
  join public.registry_releases r
    on r.id = rt.release_id
   and r.status = 'active'
  where rt.status = 'active'
  order by
    rt.track_id,
    rt.disc_number asc,
    rt.track_number asc nulls last,
    rt.id asc
),
artist_genres as (
  select
    a.id as artist_id,
    a.display_name,
    lower(genre.value) as normalized_genre
  from public.registry_artists a
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(a.metadata -> 'genres') = 'array'
        then a.metadata -> 'genres'
      else '[]'::jsonb
    end
  ) as genre(value)
  where a.status = 'active'
),
genre_artist_rollup as (
  select
    normalized_genre,
    count(distinct artist_id)::integer as artist_count,
    (
      array_agg(
        distinct display_name
        order by display_name
      )
    )[1:3] as representative_artists
  from artist_genres
  group by normalized_genre
),
release_label_rollup as (
  select
    lower(r.metadata ->> 'record_label') as normalized_label,
    count(*)::integer as release_count
  from public.registry_releases r
  where r.status = 'active'
    and nullif(r.metadata ->> 'record_label', '') is not null
  group by lower(r.metadata ->> 'record_label')
)
select
  'artist'::text as entity_type,
  a.id as entity_id,
  a.slug,
  null::text as parent_slug,
  a.display_name as title,
  coalesce(
    nullif(a.metadata ->> 'country', ''),
    a.origin_iso2,
    ''
  ) as subtitle,
  a.public_image_url as image_url,
  jsonb_build_object(
    'name',
    a.display_name,
    'imageUrl',
    a.public_image_url,
    'genres',
    case
      when jsonb_typeof(a.metadata -> 'genres') = 'array'
        then a.metadata -> 'genres'
      else '[]'::jsonb
    end,
    'country',
    coalesce(
      nullif(a.metadata ->> 'country', ''),
      a.origin_iso2,
      ''
    )
  ) as payload,
  lower(
    concat_ws(
      ' ',
      a.display_name,
      a.slug,
      coalesce(a.metadata ->> 'country', ''),
      coalesce(a.origin_iso2, ''),
      coalesce(
        (
          select string_agg(value, ' ')
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(a.metadata -> 'genres') = 'array'
                then a.metadata -> 'genres'
              else '[]'::jsonb
            end
          )
        ),
        ''
      )
    )
  ) as search_text,
  a.updated_at as document_updated_at
from public.registry_artists a
where a.status = 'active'

union all

select
  'track'::text as entity_type,
  t.id as entity_id,
  t.slug,
  coalesce(pta.artist_slug, '') as parent_slug,
  t.title,
  coalesce(pta.artist_name_text, 'Unknown') as subtitle,
  t.artwork_url as image_url,
  jsonb_build_object(
    'artistSlug',
    coalesce(pta.artist_slug, ''),
    'artist',
    coalesce(pta.artist_name_text, 'Unknown'),
    'genre',
    coalesce(a.metadata -> 'genres' ->> 0, ''),
    'artworkUrl',
    coalesce(t.artwork_url, ''),
    'isPlayable',
    t.preview_url is not null,
    'source',
    'apple_music',
    'label',
    coalesce(r.metadata ->> 'record_label', ''),
    'previewUrl',
    t.preview_url
  ) as payload,
  lower(
    concat_ws(
      ' ',
      t.title,
      t.slug,
      coalesce(pta.artist_name_text, ''),
      coalesce(pta.artist_slug, ''),
      coalesce(a.metadata -> 'genres' ->> 0, ''),
      coalesce(r.metadata ->> 'record_label', '')
    )
  ) as search_text,
  greatest(
    t.updated_at,
    coalesce(a.updated_at, t.updated_at),
    coalesce(r.updated_at, t.updated_at)
  ) as document_updated_at
from public.registry_tracks t
left join primary_track_artist pta
  on pta.track_id = t.id
left join public.registry_artists a
  on a.id = pta.artist_id
 and a.status = 'active'
left join first_release_by_track fr
  on fr.track_id = t.id
left join public.registry_releases r
  on r.id = fr.release_id
 and r.status = 'active'
where t.status = 'active'

union all

select
  'release'::text as entity_type,
  r.id as entity_id,
  r.slug,
  coalesce(pra.artist_slug, '') as parent_slug,
  r.title,
  coalesce(pra.artist_name_text, 'Unknown') as subtitle,
  r.artwork_url as image_url,
  jsonb_build_object(
    'artistName',
    coalesce(pra.artist_name_text, 'Unknown'),
    'artistSlug',
    coalesce(pra.artist_slug, ''),
    'artworkUrl',
    coalesce(r.artwork_url, ''),
    'releaseDate',
    coalesce(r.release_date::text, ''),
    'trackCount',
    coalesce(rtc.track_count, 0),
    'releaseType',
    case
      when coalesce(rtc.track_count, 0) = 1
        then 'Single'
      when coalesce(rtc.track_count, 0) between 2 and 6
        then 'EP'
      when coalesce(rtc.track_count, 0) >= 7
        then 'Album'
      else null
    end,
    'labelName',
    coalesce(
      nullif(r.metadata ->> 'record_label', ''),
      'Independent'
    ),
    'singleTrackSlug',
    case
      when coalesce(rtc.track_count, 0) = 1
        then frt.track_slug
      else null
    end,
    'singleTrackArtistSlug',
    case
      when coalesce(rtc.track_count, 0) = 1
        then frt.track_artist_slug
      else null
    end
  ) as payload,
  lower(
    concat_ws(
      ' ',
      r.title,
      r.slug,
      coalesce(pra.artist_name_text, ''),
      coalesce(pra.artist_slug, ''),
      coalesce(r.metadata ->> 'record_label', ''),
      case
        when coalesce(rtc.track_count, 0) = 1
          then 'single'
        when coalesce(rtc.track_count, 0) between 2 and 6
          then 'ep'
        when coalesce(rtc.track_count, 0) >= 7
          then 'album'
        else ''
      end
    )
  ) as search_text,
  r.updated_at as document_updated_at
from public.registry_releases r
left join primary_release_artist pra
  on pra.release_id = r.id
left join release_track_counts rtc
  on rtc.release_id = r.id
left join first_release_track frt
  on frt.release_id = r.id
where r.status = 'active'
  and coalesce(rtc.track_count, 0) > 0

union all

select
  'genre'::text as entity_type,
  g.id as entity_id,
  g.slug,
  null::text as parent_slug,
  g.name as title,
  ''::text as subtitle,
  null::text as image_url,
  jsonb_build_object(
    'artistCount',
    coalesce(
      gar.artist_count,
      case
        when jsonb_typeof(g.metadata -> 'artist_count') = 'number'
          then (g.metadata ->> 'artist_count')::integer
        else 0
      end
    ),
    'trackCount',
    0,
    'representativeArtists',
    to_jsonb(
      coalesce(
        gar.representative_artists,
        array[]::text[]
      )
    )
  ) as payload,
  lower(
    concat_ws(
      ' ',
      g.name,
      g.slug,
      coalesce(g.description, ''),
      coalesce(
        array_to_string(
          gar.representative_artists,
          ' '
        ),
        ''
      )
    )
  ) as search_text,
  g.updated_at as document_updated_at
from public.registry_genres g
left join genre_artist_rollup gar
  on gar.normalized_genre = lower(g.name)
where g.status = 'active'
  and coalesce(g.metadata ->> 'status', '') <> 'merged'

union all

select
  'label'::text as entity_type,
  l.id as entity_id,
  l.slug,
  null::text as parent_slug,
  l.name as title,
  coalesce(l.country_code, '') as subtitle,
  null::text as image_url,
  jsonb_build_object(
    'country',
    coalesce(l.country_code, ''),
    'artistCount',
    0,
    'releaseCount',
    coalesce(rlr.release_count, 0)
  ) as payload,
  lower(
    concat_ws(
      ' ',
      l.name,
      l.slug,
      coalesce(l.country_code, ''),
      coalesce(l.description, '')
    )
  ) as search_text,
  l.updated_at as document_updated_at
from public.registry_labels l
left join release_label_rollup rlr
  on rlr.normalized_label = lower(l.name)
where l.status = 'active';

revoke all
on table public.public_search_documents_v1
from public, anon, authenticated;

comment on view public.public_search_documents_v1 is
'Phase 9A.2 live five-domain public Registry search projection. Not directly exposed; use search_public_registry_v1.';

create or replace function public.search_public_registry_v1(
  p_query text,
  p_types text[] default array[
    'artist',
    'track',
    'release',
    'genre',
    'label'
  ]::text[],
  p_limit integer default 20,
  p_after_score integer default null,
  p_after_type_rank integer default null,
  p_after_title text default null,
  p_after_id uuid default null
)
returns table (
  entity_type text,
  entity_id uuid,
  slug text,
  parent_slug text,
  title text,
  subtitle text,
  image_url text,
  payload jsonb,
  score integer,
  type_rank integer,
  overall_total bigint,
  type_total bigint,
  remaining_total bigint,
  has_more boolean,
  cursor_title text,
  document_updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with
  params as (
    select
      left(
        lower(
          trim(
            coalesce(
              p_query,
              ''
            )
          )
        ),
        128
      ) as q,
      case
        when p_types is null
          or cardinality(p_types) = 0
          then array[
            'artist',
            'track',
            'release',
            'genre',
            'label'
          ]::text[]
        else p_types
      end as allowed_types,
      greatest(
        1,
        least(
          coalesce(
            p_limit,
            20
          ),
          50
        )
      ) as safe_limit
  ),
  scored as (
    select
      d.entity_type,
      d.entity_id,
      d.slug,
      d.parent_slug,
      d.title,
      d.subtitle,
      d.image_url,
      d.payload,
      d.document_updated_at,
      case d.entity_type
        when 'artist' then 1
        when 'track' then 2
        when 'release' then 3
        when 'genre' then 4
        when 'label' then 5
        else 99
      end as type_rank,
      (
        case
          when lower(d.title) = p.q
            then 100000
          when lower(d.slug) = p.q
            then 95000
          when lower(d.title) like p.q || '%'
            then 90000
          when lower(d.title) like '%' || p.q || '%'
            then 80000
          when d.search_text like '%' || p.q || '%'
            then 60000
          else 0
        end
        + round(
            similarity(
              lower(d.title),
              p.q
            ) * 10000
          )::integer
        + round(
            similarity(
              d.search_text,
              p.q
            ) * 5000
          )::integer
      ) as score
    from public.public_search_documents_v1 d
    cross join params p
    where p.q <> ''
      and d.entity_type = any(p.allowed_types)
      and (
        lower(d.title) like '%' || p.q || '%'
        or d.search_text like '%' || p.q || '%'
        or similarity(
          lower(d.title),
          p.q
        ) >= 0.20
        or similarity(
          d.search_text,
          p.q
        ) >= 0.12
      )
  ),
  qualified as (
    select *
    from scored
    where score >= 5000
  ),
  with_totals as (
    select
      q.*,
      count(*) over() as overall_total,
      count(*) over(
        partition by q.entity_type
      ) as type_total
    from qualified q
  ),
  after_cursor as (
    select *
    from with_totals w
    where
      p_after_score is null
      or p_after_type_rank is null
      or p_after_title is null
      or p_after_id is null
      or w.score < p_after_score
      or (
        w.score = p_after_score
        and w.type_rank > p_after_type_rank
      )
      or (
        w.score = p_after_score
        and w.type_rank = p_after_type_rank
        and lower(w.title) > lower(p_after_title)
      )
      or (
        w.score = p_after_score
        and w.type_rank = p_after_type_rank
        and lower(w.title) = lower(p_after_title)
        and w.entity_id > p_after_id
      )
  ),
  with_remaining as (
    select
      a.*,
      count(*) over() as remaining_total
    from after_cursor a
  )
  select
    w.entity_type,
    w.entity_id,
    w.slug,
    w.parent_slug,
    w.title,
    w.subtitle,
    w.image_url,
    w.payload,
    w.score,
    w.type_rank,
    w.overall_total,
    w.type_total,
    w.remaining_total,
    w.remaining_total > p.safe_limit as has_more,
    lower(w.title) as cursor_title,
    w.document_updated_at
  from with_remaining w
  cross join params p
  order by
    w.score desc,
    w.type_rank asc,
    lower(w.title) asc,
    w.entity_id asc
  limit (
    select safe_limit
    from params
  );
$$;

revoke all
on function public.search_public_registry_v1(
  text,
  text[],
  integer,
  integer,
  integer,
  text,
  uuid
)
from public;

grant execute
on function public.search_public_registry_v1(
  text,
  text[],
  integer,
  integer,
  integer,
  text,
  uuid
)
to anon, authenticated;

comment on function public.search_public_registry_v1(
  text,
  text[],
  integer,
  integer,
  integer,
  text,
  uuid
) is
'Phase 9A.2 bounded deterministic public Registry search. Cursor order: score DESC, type rank ASC, lowercase title ASC, entity UUID ASC.';
