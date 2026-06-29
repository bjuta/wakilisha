create extension if not exists pgcrypto;

create or replace function public.institute_review_evidence_item(
  p_evidence_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns table (
  id uuid,
  title text,
  review_status text,
  retrieval_status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evidence public.evidence_items%rowtype;
  v_previous_review_status text;
  v_previous_retrieval_status text;
  v_next_review_status text;
  v_next_retrieval_status text;
  v_review_decision text;
begin
  if not public.institute_can_review() then
    raise exception 'Institute review permission denied'
      using errcode = '42501';
  end if;

  select *
  into v_evidence
  from public.evidence_items
  where evidence_items.id = p_evidence_id
  for update;

  if not found then
    raise exception 'Evidence item not found'
      using errcode = 'P0002';
  end if;

  v_previous_review_status := v_evidence.review_status;
  v_previous_retrieval_status := v_evidence.retrieval_status;
  v_next_review_status := v_evidence.review_status;
  v_next_retrieval_status := v_evidence.retrieval_status;
  v_review_decision := p_decision;

  case p_decision
    when 'reviewed' then
      v_next_review_status := 'reviewed';
      v_review_decision := 'approved';
    when 'approved' then
      v_next_review_status := 'approved';
      v_review_decision := 'approved';
    when 'rejected' then
      v_next_review_status := 'rejected';
      v_next_retrieval_status := 'excluded';
      v_review_decision := 'rejected';
    when 'disputed' then
      v_next_review_status := 'disputed';
      v_next_retrieval_status := 'review_only';
      v_review_decision := 'needs_more_evidence';
    when 'needs_more_evidence' then
      v_next_review_status := 'unreviewed';
      v_next_retrieval_status := 'review_only';
      v_review_decision := 'needs_more_evidence';
    when 'retrieval_enabled' then
      if v_evidence.review_status not in ('reviewed', 'approved') then
        raise exception 'Default retrieval requires reviewed or approved evidence'
          using errcode = '23514';
      end if;

      v_next_retrieval_status := 'default_retrieval';
      v_review_decision := 'approved';
    when 'retrieval_disabled' then
      v_next_retrieval_status := 'excluded';
      v_review_decision := 'internal_only';
    else
      raise exception 'Unsupported evidence review decision: %', p_decision
        using errcode = '22023';
  end case;

  update public.evidence_items
  set
    review_status = v_next_review_status,
    retrieval_status = v_next_retrieval_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where evidence_items.id = p_evidence_id
  returning *
  into v_evidence;

  insert into public.evidence_review_events (
    evidence_id,
    decision,
    previous_review_status,
    next_review_status,
    previous_retrieval_status,
    next_retrieval_status,
    decision_note,
    decided_by
  )
  values (
    p_evidence_id,
    p_decision,
    v_previous_review_status,
    v_next_review_status,
    v_previous_retrieval_status,
    v_next_retrieval_status,
    p_decision_note,
    auth.uid()
  );

  insert into public.review_decisions (
    subject_type,
    subject_id,
    decision,
    reason,
    reviewer_id
  )
  values (
    'evidence',
    p_evidence_id,
    v_review_decision,
    coalesce(nullif(trim(p_decision_note), ''), concat('Evidence marked ', replace(p_decision, '_', ' '))),
    auth.uid()
  );

  return query
  select
    v_evidence.id,
    v_evidence.title,
    v_evidence.review_status,
    v_evidence.retrieval_status,
    v_evidence.reviewed_by,
    v_evidence.reviewed_at,
    v_evidence.updated_at;
end;
$$;

revoke all on function public.institute_review_evidence_item(uuid, text, text) from public;
grant execute on function public.institute_review_evidence_item(uuid, text, text) to authenticated;
