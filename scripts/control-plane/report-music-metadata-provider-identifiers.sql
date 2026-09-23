-- WAKILISHA Music Identity & Rights Foundation
-- Slice 3: read-only provider identifier candidate report.
--
-- This report does not promote external identifiers, mutate Registry identity,
-- or infer canonical equivalence. It classifies retained provider-ID evidence
-- by whether the same provider value is assigned to more than one WAKILISHA
-- UUID in current metadata.
--
-- Multiple legacy metadata keys carrying the same value on the same canonical
-- entity are collapsed into one evidence row.
--
-- WAKILISHA UUID remains canonical identity.

begin transaction read only;

with retained_provider_ids as (
  select
    'track'::text as entity_type,
    t.id as entity_id,
    'apple_music'::text as scheme_key,
    'apple_music_track_id'::text as source_key,
    nullif(btrim(t.metadata->>'apple_music_track_id'), '') as source_value
  from public.registry_tracks t

  union all

  select
    'artist',
    a.id,
    'apple_music',
    'apple_music_id',
    nullif(btrim(a.metadata->>'apple_music_id'), '')
  from public.registry_artists a

  union all

  select
    'artist',
    a.id,
    'spotify',
    'spotify_artist_id',
    nullif(btrim(a.metadata->>'spotify_artist_id'), '')
  from public.registry_artists a

  union all

  select
    'artist',
    a.id,
    'spotify',
    'spotify_id',
    nullif(btrim(a.metadata->>'spotify_id'), '')
  from public.registry_artists a

  union all

  select
    'release',
    r.id,
    'apple_music',
    'apple_music_album_id',
    nullif(btrim(r.metadata->>'apple_music_album_id'), '')
  from public.registry_releases r
),
nonblank as (
  select *
  from retained_provider_ids
  where source_value is not null
),
deduplicated as (
  select
    entity_type,
    entity_id,
    scheme_key,
    source_value,
    array_agg(distinct source_key order by source_key) as source_keys
  from nonblank
  group by entity_type, entity_id, scheme_key, source_value
),
value_cardinality as (
  select
    entity_type,
    scheme_key,
    source_value,
    count(*) as canonical_entity_count
  from deduplicated
  group by entity_type, scheme_key, source_value
)
select
  d.entity_type,
  d.entity_id,
  d.scheme_key,
  d.source_keys,
  d.source_value,
  v.canonical_entity_count,
  case
    when v.canonical_entity_count = 1 then 'deterministic_candidate'
    else 'review_only_duplicate_assignment'
  end as candidate_state
from deduplicated d
join value_cardinality v
  on v.entity_type = d.entity_type
 and v.scheme_key = d.scheme_key
 and v.source_value = d.source_value
order by
  case
    when v.canonical_entity_count > 1 then 0
    else 1
  end,
  d.entity_type,
  d.scheme_key,
  d.source_value,
  d.entity_id;

rollback;
