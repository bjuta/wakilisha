-- WAKILISHA Music Identity & Rights Foundation
-- Slice 3: read-only media reuse candidate report.
--
-- Exact URL equality is evidence for potential asset reuse. The report does
-- not create Media assets, change artwork bindings, or infer equivalence from
-- fuzzy URL/title similarity.

begin transaction read only;

with registry_artwork as (
  select
    'release'::text as entity_type,
    r.id as entity_id,
    r.artwork_image_id as current_typed_asset_id,
    nullif(btrim(r.artwork_url), '') as source_url
  from public.registry_releases r

  union all

  select
    'track',
    t.id,
    t.artwork_image_id,
    nullif(btrim(t.artwork_url), '')
  from public.registry_tracks t

  union all

  select
    'artist',
    a.id,
    a.public_image_id,
    nullif(btrim(a.public_image_url), '')
  from public.registry_artists a
),
nonblank as (
  select *
  from registry_artwork
  where source_url is not null
),
exact_assets as (
  select
    n.entity_type,
    n.entity_id,
    array_agg(m.id order by m.id) as matching_asset_ids
  from nonblank n
  join public.registry_media_assets m
    on m.url = n.source_url
   and m.status = 'active'
  group by n.entity_type, n.entity_id
)
select
  n.entity_type,
  n.entity_id,
  n.source_url,
  n.current_typed_asset_id,
  coalesce(cardinality(e.matching_asset_ids), 0) as exact_active_asset_match_count,
  coalesce(e.matching_asset_ids, '{}'::uuid[]) as exact_active_asset_ids,
  case
    when n.current_typed_asset_id is not null
      then 'already_typed'
    when coalesce(cardinality(e.matching_asset_ids), 0) = 1
      then 'exact_url_reuse_candidate'
    when coalesce(cardinality(e.matching_asset_ids), 0) = 0
      then 'review_only_no_existing_asset'
    else 'review_only_multiple_exact_assets'
  end as candidate_state
from nonblank n
left join exact_assets e
  on e.entity_type = n.entity_type
 and e.entity_id = n.entity_id
order by candidate_state, n.entity_type, n.entity_id;

rollback;
