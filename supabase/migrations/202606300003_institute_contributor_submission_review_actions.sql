create extension if not exists pgcrypto;

create or replace function public.institute_review_contributor_submission(
  p_submission_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns table (
  id uuid,
  submission_type text,
  review_status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.contributor_submissions%rowtype;
  v_next_review_status text;
  v_review_decision text;
  v_review_note text;
begin
  if not public.institute_can_review() then
    raise exception 'Institute contributor submission review permission denied'
      using errcode = '42501';
  end if;

  select *
  into v_submission
  from public.contributor_submissions
  where contributor_submissions.id = p_submission_id
  for update;

  if not found then
    raise exception 'Contributor submission not found'
      using errcode = 'P0002';
  end if;

  v_next_review_status := v_submission.review_status;
  v_review_decision := p_decision;
  v_review_note := nullif(trim(coalesce(p_decision_note, '')), '');

  case p_decision
    when 'triaged' then
      v_next_review_status := 'triaged';
      v_review_decision := 'approved';
    when 'needs_source' then
      v_next_review_status := 'needs_source';
      v_review_decision := 'needs_more_evidence';
    when 'needs_clarification' then
      v_next_review_status := 'needs_clarification';
      v_review_decision := 'needs_more_evidence';
    when 'accepted_as_memory' then
      v_next_review_status := 'accepted_as_memory';
      v_review_decision := 'accepted_as_memory';
    when 'accepted_as_evidence' then
      v_next_review_status := 'accepted_as_evidence';
      v_review_decision := 'accepted_as_evidence';
    when 'rejected' then
      v_next_review_status := 'rejected';
      v_review_decision := 'rejected';
    when 'archived' then
      v_next_review_status := 'archived';
      v_review_decision := 'internal_only';
    else
      raise exception 'Unsupported contributor submission review decision: %', p_decision
        using errcode = '22023';
  end case;

  update public.contributor_submissions
  set
    review_status = v_next_review_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = coalesce(v_review_note, concat('Submission marked ', replace(p_decision, '_', ' '))),
    updated_at = now()
  where contributor_submissions.id = p_submission_id
  returning *
  into v_submission;

  insert into public.review_decisions (
    subject_type,
    subject_id,
    decision,
    reason,
    reviewer_id
  )
  values (
    'contributor_submission',
    p_submission_id,
    v_review_decision,
    coalesce(v_review_note, concat('Submission marked ', replace(p_decision, '_', ' '))),
    auth.uid()
  );

  return query
  select
    v_submission.id,
    v_submission.submission_type,
    v_submission.review_status,
    v_submission.reviewed_by,
    v_submission.reviewed_at,
    v_submission.review_note,
    v_submission.updated_at;
end;
$$;

revoke all on function public.institute_review_contributor_submission(uuid, text, text) from public;
grant execute on function public.institute_review_contributor_submission(uuid, text, text) to authenticated;
