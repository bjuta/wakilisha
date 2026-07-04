-- Audit current genre sources before backfilling curated relationships.

with artist_genres as (
  select
    a.id as artist_id,
    a.slug as artist_slug,
    a.display_name,
    jsonb_array_elements_text(a.metadata->'genres') as raw_genre
  from public.registry_artists a
  where a.metadata ? 'genres'
    and jsonb_typeof(a.metadata->'genres') = 'array'
),
artist_normalized as (
  select
    artist_id,
    artist_slug,
    display_name,
    raw_genre,
    lower(regexp_replace(trim(raw_genre), '[^a-zA-Z0-9&]+', '', 'g')) as normalized_key
  from artist_genres
  where trim(raw_genre) <> ''
),
canonical_genres as (
  select
    g.id,
    g.slug,
    g.name,
    lower(regexp_replace(trim(coalesce(g.slug, g.name)), '[^a-zA-Z0-9&]+', '', 'g')) as normalized_key
  from public.registry_genres g
  where g.status = 'active'
)
select
  an.raw_genre,
  an.normalized_key,
  count(*) as artist_count,
  cg.slug as matched_genre_slug,
  cg.name as matched_genre_name
from artist_normalized an
left join canonical_genres cg
  on cg.normalized_key = an.normalized_key
group by an.raw_genre, an.normalized_key, cg.slug, cg.name
order by artist_count desc, an.raw_genre;
