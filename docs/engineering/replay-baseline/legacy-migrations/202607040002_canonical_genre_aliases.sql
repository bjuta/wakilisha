-- Canonical genre aliases for curated artist genre backfill.
-- This does not backfill registry_artist_genres yet.

with canonical_genres(slug, name) as (
  values
    ('3-step', '3-Step'),
    ('african-gospel', 'African Gospel'),
    ('afro-adura', 'Afro Adura'),
    ('afrobeats', 'Afrobeats'),
    ('afro-fusion', 'Afro-fusion'),
    ('afro-house', 'Afro-house'),
    ('afro-pop', 'Afro-pop'),
    ('afro-rnb', 'Afro R&B'),
    ('afro-soul', 'Afro-soul'),
    ('afro-urban', 'Afro-urban'),
    ('afropiano', 'Afropiano'),
    ('alte', 'Alté'),
    ('amapiano', 'Amapiano'),
    ('arbantone', 'Arbantone'),
    ('azonto', 'Azonto'),
    ('bacardi', 'Bacardi'),
    ('bongo-flava', 'Bongo Flava'),
    ('christian', 'Christian'),
    ('dancehall', 'Dancehall'),
    ('drill', 'Drill'),
    ('genge', 'Genge'),
    ('gengetone', 'Gengetone'),
    ('gospel', 'Gospel'),
    ('gqom', 'Gqom'),
    ('hip-hop', 'Hip-hop'),
    ('hiplife', 'Hiplife'),
    ('kizomba', 'Kizomba'),
    ('private-school-piano', 'Private School Piano'),
    ('rnb', 'R&B'),
    ('rumba-congolaise', 'Rumba Congolaise'),
    ('singeli', 'Singeli'),
    ('tribal-house', 'Tribal House')
)
insert into public.registry_genres (slug, name, status, metadata)
select
  cg.slug,
  cg.name,
  'active',
  jsonb_build_object(
    'source', 'editorial_canonical_genre_map',
    'normalized_key', lower(regexp_replace(cg.slug, '[^a-zA-Z0-9&]+', '', 'g'))
  )
from canonical_genres cg
where not exists (
  select 1 from public.registry_genres g where g.slug = cg.slug
);

with canonical_genres(slug, name) as (
  values
    ('3-step', '3-Step'),
    ('african-gospel', 'African Gospel'),
    ('afro-adura', 'Afro Adura'),
    ('afrobeats', 'Afrobeats'),
    ('afro-fusion', 'Afro-fusion'),
    ('afro-house', 'Afro-house'),
    ('afro-pop', 'Afro-pop'),
    ('afro-rnb', 'Afro R&B'),
    ('afro-soul', 'Afro-soul'),
    ('afro-urban', 'Afro-urban'),
    ('afropiano', 'Afropiano'),
    ('alte', 'Alté'),
    ('amapiano', 'Amapiano'),
    ('arbantone', 'Arbantone'),
    ('azonto', 'Azonto'),
    ('bacardi', 'Bacardi'),
    ('bongo-flava', 'Bongo Flava'),
    ('christian', 'Christian'),
    ('dancehall', 'Dancehall'),
    ('drill', 'Drill'),
    ('genge', 'Genge'),
    ('gengetone', 'Gengetone'),
    ('gospel', 'Gospel'),
    ('gqom', 'Gqom'),
    ('hip-hop', 'Hip-hop'),
    ('hiplife', 'Hiplife'),
    ('kizomba', 'Kizomba'),
    ('private-school-piano', 'Private School Piano'),
    ('rnb', 'R&B'),
    ('rumba-congolaise', 'Rumba Congolaise'),
    ('singeli', 'Singeli'),
    ('tribal-house', 'Tribal House')
)
update public.registry_genres g
set
  name = cg.name,
  metadata = coalesce(g.metadata, '{}'::jsonb) || jsonb_build_object(
    'canonical_display_name', cg.name,
    'source', 'editorial_canonical_genre_map',
    'normalized_key', lower(regexp_replace(cg.slug, '[^a-zA-Z0-9&]+', '', 'g'))
  ),
  updated_at = now()
from canonical_genres cg
where g.slug = cg.slug
  and (
    g.name is distinct from cg.name
    or g.metadata->>'canonical_display_name' is distinct from cg.name
  );

with alias_map(raw_label, canonical_slug, source) as (
  values
    ('3 step', '3-step', 'editorial'),
    ('3-step', '3-step', 'editorial'),

    ('african gospel', 'african-gospel', 'editorial'),

    ('afro adura', 'afro-adura', 'editorial'),

    ('afrobeat', 'afrobeats', 'editorial'),
    ('afrobeats', 'afrobeats', 'editorial'),
    ('Afrobeats', 'afrobeats', 'editorial'),

    ('afro fusion', 'afro-fusion', 'editorial'),
    ('afrofusion', 'afro-fusion', 'editorial'),
    ('Afro-fusion', 'afro-fusion', 'editorial'),
    ('Afro-Fusion', 'afro-fusion', 'editorial'),

    ('afro house', 'afro-house', 'editorial'),
    ('afrohouse', 'afro-house', 'editorial'),
    ('Afro-house', 'afro-house', 'editorial'),

    ('afro pop', 'afro-pop', 'editorial'),
    ('afropop', 'afro-pop', 'editorial'),
    ('Afro-pop', 'afro-pop', 'editorial'),

    ('afro r&b', 'afro-rnb', 'editorial'),
    ('afro rnb', 'afro-rnb', 'editorial'),
    ('afrornb', 'afro-rnb', 'editorial'),
    ('Afrornb', 'afro-rnb', 'editorial'),
    ('Afro R&B', 'afro-rnb', 'editorial'),

    ('afro soul', 'afro-soul', 'editorial'),
    ('afrosoul', 'afro-soul', 'editorial'),
    ('Afrosoul', 'afro-soul', 'editorial'),
    ('Afro-soul', 'afro-soul', 'editorial'),

    ('afro urban', 'afro-urban', 'editorial'),
    ('Afro-urban', 'afro-urban', 'editorial'),

    ('afropiano', 'afropiano', 'editorial'),

    ('alte', 'alte', 'editorial'),
    ('alté', 'alte', 'editorial'),
    ('Alté', 'alte', 'editorial'),

    ('amapiano', 'amapiano', 'editorial'),
    ('Amapiano', 'amapiano', 'editorial'),

    ('arbantone', 'arbantone', 'editorial'),
    ('Arbantone', 'arbantone', 'editorial'),

    ('azonto', 'azonto', 'editorial'),
    ('bacardi', 'bacardi', 'editorial'),

    ('bongo flava', 'bongo-flava', 'editorial'),
    ('Bongo Flava', 'bongo-flava', 'editorial'),
    ('Bongo-flava', 'bongo-flava', 'editorial'),
    ('Bongo-Flava', 'bongo-flava', 'editorial'),

    ('christian', 'christian', 'editorial'),
    ('Christian', 'christian', 'editorial'),

    ('dancehall', 'dancehall', 'editorial'),
    ('Dancehall', 'dancehall', 'editorial'),

    ('drill', 'drill', 'editorial'),
    ('Drill', 'drill', 'editorial'),

    ('genge', 'genge', 'editorial'),
    ('Genge', 'genge', 'editorial'),

    ('gengetone', 'gengetone', 'editorial'),
    ('Gengetone', 'gengetone', 'editorial'),

    ('gospel', 'gospel', 'editorial'),
    ('Gospel', 'gospel', 'editorial'),

    ('gqom', 'gqom', 'editorial'),

    ('hip hop', 'hip-hop', 'editorial'),
    ('hip-hop', 'hip-hop', 'editorial'),
    ('Hip-hop', 'hip-hop', 'editorial'),
    ('Hip-Hop', 'hip-hop', 'editorial'),
    ('hiphop', 'hip-hop', 'editorial'),

    ('hiplife', 'hiplife', 'editorial'),

    ('kizomba', 'kizomba', 'editorial'),

    ('private school piano', 'private-school-piano', 'editorial'),

    ('r&b', 'rnb', 'editorial'),
    ('R&b', 'rnb', 'editorial'),
    ('R&B', 'rnb', 'editorial'),
    ('rnb', 'rnb', 'editorial'),

    ('rumba congolaise', 'rumba-congolaise', 'editorial'),

    ('singeli', 'singeli', 'editorial'),

    ('tribal house', 'tribal-house', 'editorial')
),
prepared_raw as (
  select
    am.raw_label,
    lower(regexp_replace(trim(am.raw_label), '[^a-zA-Z0-9&]+', '', 'g')) as normalized_key,
    g.id as genre_id,
    am.source,
    g.name as canonical_name
  from alias_map am
  join public.registry_genres g
    on g.slug = am.canonical_slug
),
prepared as (
  select distinct on (normalized_key)
    raw_label,
    normalized_key,
    genre_id,
    source
  from prepared_raw
  where normalized_key <> ''
  order by
    normalized_key,
    case when raw_label = canonical_name then 0 else 1 end,
    length(raw_label),
    raw_label
)
insert into public.registry_genre_aliases (
  raw_label,
  normalized_key,
  genre_id,
  status,
  source,
  notes,
  metadata
)
select
  p.raw_label,
  p.normalized_key,
  p.genre_id,
  'active',
  p.source,
  'Editorial canonical alias for curated artist genre backfill.',
  jsonb_build_object('migration', '202607040002_canonical_genre_aliases')
from prepared p
on conflict (normalized_key)
where status = 'active'
do update set
  raw_label = excluded.raw_label,
  genre_id = excluded.genre_id,
  source = excluded.source,
  notes = excluded.notes,
  metadata = public.registry_genre_aliases.metadata || excluded.metadata,
  updated_at = now();
