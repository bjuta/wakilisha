-- PR4: Evidence review and promotion rules.
-- Adds an atomic review path without rewriting existing evidence rows.

alter table public.evidence_items
  add constraint evidence_reviewed_states_require_reviewer
  check (
    review_status = 'unreviewed'
    or (reviewed_by is not null and reviewed_at is not null)
  ) not valid;

alter table public.evidence_items
  validate constraint evidence_reviewed_states_require_reviewer;

create index if not exists evidence_items_review_queue_idx
  on public.evidence_items (review_status, retrieval_status, updated_at desc);

create or replace function public.review_evidence_item(
  p_evidence_id uuid,
  p_decision text,
  p_next_review_status text,
  p_next_retrieval_status text,
  p_decision_note text default null
)
returns public.evidence_items
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current public.evidence_items;
  v_updated public.evidence_items;
begin
  if not public.institute_can_review() then
    raise exception 'You do not have permission to review evidence.';
  end if;

  if p_decision not in (
    'reviewed',
    'approved',
    'rejected',
    'disputed',
    'needs_more_evidence',
    'retrieval_enabled',
    'retrieval_disabled'
  ) then
    raise exception 'Unsupported evidence review decision.';
  end if;

  if p_next_review_status not in (
    'unreviewed',
    'reviewed',
    'approved',
    'disputed',
    'rejected'
  ) then
    raise exception 'Unsupported next review status.';
  end if;

  if p_next_retrieval_status not in (
    'excluded',
    'review_only',
    'default_retrieval'
  ) then
    raise exception 'Unsupported next retrieval status.';
  end if;

  if p_next_retrieval_status = 'default_retrieval'
     and p_next_review_status not in ('reviewed', 'approved') then
    raise exception 'Default retrieval requires reviewed or approved evidence.';
  end if;

  if p_next_review_status in ('rejected', 'disputed')
     and p_next_retrieval_status = 'default_retrieval' then
    raise exception 'Rejected or disputed evidence cannot be enabled for default retrieval.';
  end if;

  select *
  into v_current
  from public.evidence_items
  where id = p_evidence_id
  for update;

  if not found then
    raise exception 'Evidence item not found.';
  end if;

  insert into public.evidence_review_events (
    evidence_id,
    decision,
    previous_review_status,
    next_review_status,
    previous_retrieval_status,
    next_retrieval_status,
    decision_note,
    decided_by
  ) values (
    p_evidence_id,
    p_decision,
    v_current.review_status,
    p_next_review_status,
    v_current.retrieval_status,
    p_next_retrieval_status,
    nullif(btrim(p_decision_note), ''),
    auth.uid()
  );

  update public.evidence_items
  set review_status = p_next_review_status,
      retrieval_status = p_next_retrieval_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_evidence_id
  returning * into v_updated;

  return v_updated;
end;
$$;

revoke all on function public.review_evidence_item(uuid, text, text, text, text) from public;
revoke all on function public.review_evidence_item(uuid, text, text, text, text) from anon;
grant execute on function public.review_evidence_item(uuid, text, text, text, text) to authenticated;

comment on function public.review_evidence_item(uuid, text, text, text, text) is
  'Atomically records an evidence review event and applies the approved review and retrieval state transition.';