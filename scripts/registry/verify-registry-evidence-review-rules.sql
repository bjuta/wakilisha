-- PR4 verification: Registry evidence review and promotion rules.

select count(*) as evidence_items_rows
from public.evidence_items;

select count(*) as evidence_review_events_rows
from public.evidence_review_events;

select count(*) as invalid_review_metadata_rows
from public.evidence_items
where review_status <> 'unreviewed'
  and (reviewed_by is null or reviewed_at is null);

select count(*) as invalid_default_retrieval_rows
from public.evidence_items
where retrieval_status = 'default_retrieval'
  and review_status not in ('reviewed', 'approved');

select
  has_function_privilege('anon', 'public.review_evidence_item(uuid,text,text,text,text)', 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', 'public.review_evidence_item(uuid,text,text,text,text)', 'EXECUTE') as authenticated_can_execute;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.evidence_items'::regclass
  and conname = 'evidence_reviewed_states_require_reviewer';

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'evidence_items'
  and indexname = 'evidence_items_review_queue_idx';