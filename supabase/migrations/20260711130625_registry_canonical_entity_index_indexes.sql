create unique index if not exists cultural_entities_canonical_source_uidx
  on public.cultural_entities (canonical_source_table, canonical_source_id)
  where canonical_source_table is not null and canonical_source_id is not null;

create unique index if not exists cultural_entities_type_slug_uidx
  on public.cultural_entities (entity_type, slug)
  where slug is not null and btrim(slug) <> '' and status <> 'merged';

create index if not exists cultural_entities_review_queue_idx
  on public.cultural_entities (review_status, public_safe, updated_at desc);;
