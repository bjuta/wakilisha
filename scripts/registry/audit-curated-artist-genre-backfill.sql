-- Audit curated artist genre backfill.

with artist_genres as (
  select
    a.id as artist_id,
    a.slug as artist_slug,
    a.display_name,
    ag.raw_genre,
    ag.genre_ordinality::integer as genre_ordinality,
    lower(regexp_replace(trim(ag.raw_genre), '[^a-zA-Z0-9&]+', '', 'g')) as normalized_key
  from public.registry_artists a
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(a.metadata->'genres') = 'array' then a.metadata->'genres'
      else '[]'::jsonb
    end
  ) with ordinality as ag(raw_genre, genre_ordinality)
  where trim(ag.raw_genre) <> ''
),
mapped as (
  select
    ag.*,
    ga.genre_id,
    g.slug as canonical_slug,
    g.name as canonical_name
  from artist_genres ag
  join public.registry_genre_aliases ga
    on ga.normalized_key = ag.normalized_key
   and ga.status = 'active'
  join public.registry_genres g
    on g.id = ga.genre_id
),
unmapped as (
  select ag.*
  from artist_genres ag
  left join public.registry_genre_aliases ga
    on ga.normalized_key = ag.normalized_key
   and ga.status = 'active'
  where ga.id is null
)
select
  'mapped_artist_genre_rows' as audit_name,
  count(*)::text as audit_value
from mapped

union all

select
  'artists_with_mapped_genres',
  count(distinct artist_id)::text
from mapped

union all

select
  'unmapped_artist_genre_rows',
  count(*)::text
from unmapped

union all

select
  'artists_with_unmapped_genres',
  count(distinct artist_id)::text
from unmapped;

-- Top unmapped labels for editorial review.
with artist_genres as (
  select
    a.id as artist_id,
    ag.raw_genre,
    lower(regexp_replace(trim(ag.raw_genre), '[^a-zA-Z0-9&]+', '', 'g')) as normalized_key
  from public.registry_artists a
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(a.metadata->'genres') = 'array' then a.metadata->'genres'
      else '[]'::jsonb
    end
  ) with ordinality as ag(raw_genre, genre_ordinality)
  where trim(ag.raw_genre) <> ''
)
select
  ag.raw_genre,
  ag.normalized_key,
  count(distinct ag.artist_id) as artist_count
from artist_genres ag
left join public.registry_genre_aliases ga
  on ga.normalized_key = ag.normalized_key
 and ga.status = 'active'
where ga.id is null
group by ag.raw_genre, ag.normalized_key
order by artist_count desc, ag.raw_genre;

-- Backfilled rows by role.
select
  genre_role,
  count(*) as row_count
from public.registry_artist_genres
where source = 'editorial_seed'
group by genre_role
order by genre_role;

-- Backfilled rows by canonical genre.
select
  g.slug,
  g.name,
  count(*) as artist_count
from public.registry_artist_genres ag
join public.registry_genres g
  on g.id = ag.genre_id
where ag.source = 'editorial_seed'
  and ag.status = 'active'
group by g.slug, g.name
order by artist_count desc, g.name;
