alter table public.evidence_items
  add constraint evidence_reviewed_states_require_reviewer
  check (
    review_status = 'unreviewed'
    or (reviewed_by is not null and reviewed_at is not null)
  ) not valid;

alter table public.evidence_items
  validate constraint evidence_reviewed_states_require_reviewer;

create index if not exists evidence_items_review_queue_idx
  on public.evidence_items (review_status, retrieval_status, updated_at desc);;
