-- WAKILISHA Music Identity & Rights Foundation
-- Slice 3: read-only provider identifier candidate report.
--
-- This report does not promote external identifiers, mutate Registry identity,
-- or infer canonical equivalence. It classifies retained provider-ID evidence
-- by whether the same provider value is assigned to more than one WAKILISHA
-- UUID in current metadata.
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
value_cardinality as (
  select
    entity_type,
    scheme_key,
    source_value,
    count(distinct entity_id) as canonical_entity_count
  from nonblank
  group by entity_type, scheme_key, source_value
),
classified as (
  select
    n.entity_type,
    n.entity_id,
    n.scheme_key,
    n.source_key,
    n.source_value,
    v.canonical_entity_count,
    case
      when v.canonical_entity_count = 1 then 'deterministic_candidate'
      else 'review_only_duplicate_assignment'
    end as candidate_state
  from nonblank n
  join value_cardinality v
    on v.entity_type = n.entity_type
   and v.scheme_key = n.scheme_key
   and v.source_value = n.source_value
)
select
  entity_type,
  entity_id,
  scheme_key,
  source_key,
  source_value,
  canonical_entity_count,
  candidate_state
from classified
order by
  case candidate_state
    when 'review_only_duplicate_assignment' then 0
    else 1
  end,
  entity_type,
  scheme_key,
  source_value,
  entity_id;

rollback;
