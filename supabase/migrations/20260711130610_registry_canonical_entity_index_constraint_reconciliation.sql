alter table public.cultural_entities drop constraint cultural_entities_entity_type_check;

alter table public.cultural_entities
  add constraint cultural_entities_entity_type_check
  check (entity_type in (
    'artist','track','release','label','genre',
    'person','scene','place','event','institution','work','concept',
    'language','movement','publication','organization',
    'article','inquiry','memory','source'
  )) not valid;

alter table public.cultural_entities validate constraint cultural_entities_entity_type_check;

alter table public.cultural_entities
  add constraint cultural_entities_review_status_check
  check (review_status in ('unreviewed','pending_review','approved','rejected','disputed','superseded'));

alter table public.cultural_entities
  add constraint cultural_entities_canonical_pointer_check
  check ((canonical_source_table is null and canonical_source_id is null) or (canonical_source_table is not null and canonical_source_id is not null));

alter table public.cultural_entities
  add constraint cultural_entities_public_safe_check
  check (public_safe = false or (review_status = 'approved' and status = 'active' and reviewed_at is not null and nullif(btrim(description), '') is not null));;
