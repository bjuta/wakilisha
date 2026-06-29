create or replace function public.institute_accept_submission_as_evidence(
  p_submission_id uuid,
  p_evidence_title text default null,
  p_review_note text default null
)
returns public.contributor_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.contributor_submissions;
  v_evidence public.evidence_items;
  v_title text;
begin
  if not public.institute_can_review() then
    raise exception 'Not allowed to convert contributor submissions.';
  end if;

  select *
  into v_submission
  from public.contributor_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Contributor submission not found.';
  end if;

  v_title := coalesce(nullif(trim(p_evidence_title), ''), nullif(trim(v_submission.title), ''), 'Contributor submission evidence');

  insert into public.evidence_items (
    title,
    evidence_type,
    source_url,
    source_note,
    summary,
    main_claim,
    why_it_matters,
    reliability,
    confidence,
    review_status,
    retrieval_status,
    created_by,
    reviewed_by,
    reviewed_at
  )
  values (
    v_title,
    'contributor_memory',
    v_submission.source_url,
    v_submission.source_note,
    v_submission.body,
    v_submission.title,
    'Converted from a reviewed contributor submission in the Contributor Desk.',
    'medium',
    'medium',
    'reviewed',
    'review_only',
    auth.uid(),
    auth.uid(),
    now()
  )
  returning *
  into v_evidence;

  if v_submission.inquiry_id is not null then
    insert into public.inquiry_evidence (
      inquiry_id,
      evidence_id,
      use_note
    )
    values (
      v_submission.inquiry_id,
      v_evidence.id,
      'Converted from contributor submission.'
    )
    on conflict do nothing;
  end if;

  update public.contributor_submissions
  set
    review_status = 'accepted_as_evidence',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = coalesce(p_review_note, 'Converted to evidence in Contributor Desk.'),
    accepted_evidence_id = v_evidence.id,
    updated_at = now()
  where id = p_submission_id
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
    'accepted_as_evidence',
    coalesce(p_review_note, 'Converted to evidence in Contributor Desk.'),
    auth.uid()
  );

  return v_submission;
end;
$$;

create or replace function public.institute_accept_submission_as_memory(
  p_submission_id uuid,
  p_review_note text default null
)
returns public.contributor_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.contributor_submissions;
  v_note public.inquiry_notes;
begin
  if not public.institute_can_review() then
    raise exception 'Not allowed to convert contributor submissions.';
  end if;

  select *
  into v_submission
  from public.contributor_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Contributor submission not found.';
  end if;

  if v_submission.inquiry_id is not null then
    insert into public.inquiry_notes (
      inquiry_id,
      note_type,
      title,
      body,
      confidence,
      created_by
    )
    values (
      v_submission.inquiry_id,
      'memory',
      v_submission.title,
      v_submission.body,
      'medium',
      auth.uid()
    )
    returning *
    into v_note;
  end if;

  update public.contributor_submissions
  set
    review_status = 'accepted_as_memory',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = coalesce(p_review_note, 'Converted to memory in Contributor Desk.'),
    updated_at = now()
  where id = p_submission_id
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
    'accepted_as_memory',
    coalesce(p_review_note, 'Converted to memory in Contributor Desk.'),
    auth.uid()
  );

  return v_submission;
end;
$$;

revoke all on function public.institute_accept_submission_as_evidence(uuid, text, text) from public;
revoke all on function public.institute_accept_submission_as_memory(uuid, text) from public;

grant execute on function public.institute_accept_submission_as_evidence(uuid, text, text) to authenticated;
grant execute on function public.institute_accept_submission_as_memory(uuid, text) to authenticated;
