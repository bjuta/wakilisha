-- Backfill curated artist genres from current artist metadata.
-- This uses registry_genre_aliases as the resolver.
-- Unmapped genre labels are skipped and should be handled by editorial review.

with artist_genres as (
  select
    a.id as artist_id,
    a.slug as artist_slug,
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
mapped_artist_genres as (
  select
    ag.artist_id,
    ag.artist_slug,
    ag.raw_genre,
    ag.genre_ordinality,
    ag.normalized_key,
    ga.genre_id
  from artist_genres ag
  join public.registry_genre_aliases ga
    on ga.normalized_key = ag.normalized_key
   and ga.status = 'active'
  where ga.genre_id is not null
),
deduped_artist_genres as (
  select distinct on (artist_id, genre_id)
    artist_id,
    artist_slug,
    raw_genre,
    genre_ordinality,
    normalized_key,
    genre_id
  from mapped_artist_genres
  order by artist_id, genre_id, genre_ordinality
),
ranked_artist_genres as (
  select
    artist_id,
    artist_slug,
    raw_genre,
    genre_ordinality,
    normalized_key,
    genre_id,
    row_number() over (
      partition by artist_id
      order by genre_ordinality, normalized_key
    ) as mapped_rank
  from deduped_artist_genres
)
insert into public.registry_artist_genres (
  artist_id,
  genre_id,
  raw_genre_name,
  genre_role,
  sort_order,
  status,
  source,
  source_context,
  confidence,
  editorial_note,
  metadata
)
select
  rag.artist_id,
  rag.genre_id,
  rag.raw_genre,
  case when rag.mapped_rank = 1 then 'primary' else 'secondary' end,
  rag.genre_ordinality,
  'active',
  'editorial_seed',
  'registry_artists.metadata.genres',
  1.0,
  'Seeded from existing curated artist metadata genres.',
  jsonb_build_object(
    'migration', '202607040003_backfill_curated_artist_genres',
    'artist_slug', rag.artist_slug,
    'raw_normalized_key', rag.normalized_key,
    'raw_genre_ordinality', rag.genre_ordinality,
    'mapped_rank', rag.mapped_rank
  )
from ranked_artist_genres rag
on conflict (artist_id, genre_id)
where status = 'active'
do update set
  raw_genre_name = excluded.raw_genre_name,
  genre_role = excluded.genre_role,
  sort_order = excluded.sort_order,
  source = excluded.source,
  source_context = excluded.source_context,
  confidence = excluded.confidence,
  editorial_note = excluded.editorial_note,
  metadata = public.registry_artist_genres.metadata || excluded.metadata,
  updated_at = now();
