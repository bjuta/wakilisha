-- PR6 production verification.

select
  count(*) as cultural_entity_count,
  count(*) filter (where canonical_source_table is not null and canonical_source_id is not null) as canonical_pointer_count,
  count(*) filter (where public_safe) as public_safe_count,
  count(*) filter (
    where public_safe
      and not (
        review_status = 'approved'
        and status = 'active'
        and reviewed_at is not null
        and nullif(btrim(description), '') is not null
      )
  ) as invalid_public_safe_count
from public.cultural_entities;

select entity_type, count(*) as row_count
from public.registry_entity_index
group by entity_type
order by entity_type;

select
  count(*) filter (where canonical_source_table = 'registry_artists') as artist_rows,
  count(*) filter (where canonical_source_table = 'registry_tracks') as track_rows,
  count(*) filter (where canonical_source_table = 'registry_releases') as release_rows,
  count(*) filter (where canonical_source_table = 'registry_labels') as label_rows,
  count(*) filter (where canonical_source_table = 'registry_genres') as genre_rows
from public.registry_entity_index;

select
  to_regclass('public.cultural_entities_canonical_source_uidx') is not null as canonical_unique_index_exists,
  to_regclass('public.cultural_entities_type_slug_uidx') is not null as type_slug_unique_index_exists,
  to_regclass('public.cultural_entities_review_queue_idx') is not null as review_queue_index_exists,
  to_regclass('public.registry_entity_index') is not null as registry_entity_index_exists;
