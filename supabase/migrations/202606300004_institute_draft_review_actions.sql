create extension if not exists pgcrypto;

create or replace function public.institute_review_surface_draft(
  p_draft_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns table (
  id uuid,
  surface_type text,
  review_status text,
  public_safe boolean,
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.surface_drafts%rowtype;
  v_next_review_status text;
  v_next_public_safe boolean;
  v_review_decision text;
  v_review_note text;
begin
  if not public.institute_can_review() then
    raise exception 'Institute surface draft review permission denied'
      using errcode = '42501';
  end if;

  select *
  into v_draft
  from public.surface_drafts
  where surface_drafts.id = p_draft_id
  for update;

  if not found then
    raise exception 'Surface draft not found'
      using errcode = 'P0002';
  end if;

  v_next_review_status := v_draft.review_status;
  v_next_public_safe := v_draft.public_safe;
  v_review_decision := p_decision;
  v_review_note := nullif(trim(coalesce(p_decision_note, '')), '');

  case p_decision
    when 'pending_review' then
      v_next_review_status := 'pending_review';
      v_next_public_safe := false;
      v_review_decision := 'approved';
    when 'approved' then
      v_next_review_status := 'approved';
      v_review_decision := 'approved';
    when 'rejected' then
      v_next_review_status := 'rejected';
      v_next_public_safe := false;
      v_review_decision := 'rejected';
    when 'needs_rewrite' then
      v_next_review_status := 'revised';
      v_next_public_safe := false;
      v_review_decision := 'needs_rewrite';
    when 'too_vague' then
      v_next_review_status := 'revised';
      v_next_public_safe := false;
      v_review_decision := 'too_vague';
    when 'overclaims' then
      v_next_review_status := 'revised';
      v_next_public_safe := false;
      v_review_decision := 'overclaims';
    when 'public_safe_enabled' then
      if v_draft.review_status <> 'approved' then
        raise exception 'Public-safe draft publishing requires approved draft review'
          using errcode = '23514';
      end if;

      v_next_public_safe := true;
      v_review_decision := 'approved';
    when 'public_safe_disabled' then
      v_next_public_safe := false;
      v_review_decision := 'internal_only';
    else
      raise exception 'Unsupported surface draft review decision: %', p_decision
        using errcode = '22023';
  end case;

  update public.surface_drafts
  set
    review_status = v_next_review_status,
    public_safe = v_next_public_safe,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where surface_drafts.id = p_draft_id
  returning *
  into v_draft;

  insert into public.review_decisions (
    subject_type,
    subject_id,
    decision,
    reason,
    reviewer_id
  )
  values (
    'surface_draft',
    p_draft_id,
    v_review_decision,
    coalesce(v_review_note, concat('Surface draft marked ', replace(p_decision, '_', ' '))),
    auth.uid()
  );

  return query
  select
    v_draft.id,
    v_draft.surface_type,
    v_draft.review_status,
    v_draft.public_safe,
    v_draft.reviewed_by,
    v_draft.reviewed_at,
    v_draft.updated_at;
end;
$$;

revoke all on function public.institute_review_surface_draft(uuid, text, text) from public;
grant execute on function public.institute_review_surface_draft(uuid, text, text) to authenticated;

create or replace view public.institute_review_queue_items
with (security_invoker = true) as
select
  'evidence'::text as subject_type,
  evidence_items.id as subject_id,
  evidence_items.title,
  evidence_items.summary,
  evidence_items.review_status,
  case
    when evidence_items.review_status = 'unreviewed' then 'Needs first review'
    when evidence_items.review_status = 'disputed' then 'Disputed evidence needs review'
    when evidence_items.retrieval_status = 'review_only' then 'Review-only evidence needs retrieval decision'
    else 'Evidence needs review'
  end as review_reason,
  case
    when evidence_items.review_status = 'disputed' then 90
    when evidence_items.review_status = 'unreviewed' then 70
    when evidence_items.retrieval_status = 'review_only' then 60
    else 40
  end as priority_weight,
  null::uuid as inquiry_id,
  null::uuid as entity_id,
  evidence_items.created_by as submitted_by,
  evidence_items.created_at,
  evidence_items.updated_at,
  jsonb_build_object(
    'evidence_type', evidence_items.evidence_type,
    'retrieval_status', evidence_items.retrieval_status,
    'confidence', evidence_items.confidence,
    'reliability', evidence_items.reliability
  ) as metadata
from public.evidence_items
where evidence_items.review_status in ('unreviewed', 'disputed')
   or evidence_items.retrieval_status = 'review_only'

union all

select
  'relationship'::text as subject_type,
  entity_relationships.id as subject_id,
  concat(
    entity_relationships.relationship_type,
    ': ',
    coalesce(source_entity.name, 'Unknown source'),
    ' → ',
    coalesce(target_entity.name, 'Unknown target')
  ) as title,
  entity_relationships.reason as summary,
  entity_relationships.review_status,
  case
    when entity_relationships.review_status = 'suggested' then 'Suggested relationship needs review'
    when entity_relationships.review_status = 'pending_review' then 'Relationship is pending review'
    when entity_relationships.review_status = 'disputed' then 'Disputed relationship needs review'
    when entity_relationships.review_status = 'approved' and entity_relationships.public_safe = false then 'Approved relationship needs public-safe decision'
    else 'Relationship needs review'
  end as review_reason,
  case
    when entity_relationships.review_status = 'disputed' then 90
    when entity_relationships.review_status = 'pending_review' then 75
    when entity_relationships.review_status = 'suggested' then 65
    when entity_relationships.review_status = 'approved' and entity_relationships.public_safe = false then 55
    else 40
  end as priority_weight,
  null::uuid as inquiry_id,
  entity_relationships.source_entity_id as entity_id,
  entity_relationships.created_by as submitted_by,
  entity_relationships.created_at,
  entity_relationships.updated_at,
  jsonb_build_object(
    'relationship_type', entity_relationships.relationship_type,
    'confidence', entity_relationships.confidence,
    'public_safe', entity_relationships.public_safe,
    'source_entity_id', entity_relationships.source_entity_id,
    'target_entity_id', entity_relationships.target_entity_id
  ) as metadata
from public.entity_relationships
left join public.cultural_entities as source_entity
  on source_entity.id = entity_relationships.source_entity_id
left join public.cultural_entities as target_entity
  on target_entity.id = entity_relationships.target_entity_id
where entity_relationships.review_status in ('suggested', 'pending_review', 'disputed')
   or (entity_relationships.review_status = 'approved' and entity_relationships.public_safe = false)

union all

select
  'contributor_submission'::text as subject_type,
  contributor_submissions.id as subject_id,
  coalesce(contributor_submissions.title, concat('Contributor ', contributor_submissions.submission_type)) as title,
  contributor_submissions.body as summary,
  contributor_submissions.review_status,
  case
    when contributor_submissions.review_status = 'submitted' then 'New contributor submission'
    when contributor_submissions.review_status = 'triaged' then 'Triaged submission needs next step'
    when contributor_submissions.review_status = 'needs_source' then 'Submission needs source review'
    when contributor_submissions.review_status = 'needs_clarification' then 'Submission needs clarification'
    else 'Contributor submission needs review'
  end as review_reason,
  case
    when contributor_submissions.review_status = 'needs_clarification' then 85
    when contributor_submissions.review_status = 'needs_source' then 80
    when contributor_submissions.review_status = 'submitted' then 70
    when contributor_submissions.review_status = 'triaged' then 60
    else 40
  end as priority_weight,
  contributor_submissions.inquiry_id,
  contributor_submissions.entity_id,
  contributors.user_id as submitted_by,
  contributor_submissions.created_at,
  contributor_submissions.updated_at,
  jsonb_build_object(
    'submission_type', contributor_submissions.submission_type,
    'consent_status', contributor_submissions.consent_status,
    'contributor_id', contributor_submissions.contributor_id
  ) as metadata
from public.contributor_submissions
left join public.contributors
  on contributors.id = contributor_submissions.contributor_id
where contributor_submissions.review_status in (
  'submitted',
  'triaged',
  'needs_source',
  'needs_clarification'
)

union all

select
  'surface_draft'::text as subject_type,
  surface_drafts.id as subject_id,
  coalesce(surface_drafts.draft_title, concat('Surface draft: ', surface_drafts.surface_type)) as title,
  surface_drafts.draft_body as summary,
  surface_drafts.review_status,
  case
    when surface_drafts.review_status = 'pending_review' then 'Surface draft is pending review'
    when surface_drafts.review_status = 'draft' then 'Surface draft needs editorial review'
    when surface_drafts.review_status = 'revised' then 'Revised draft needs review'
    when surface_drafts.review_status = 'approved' and surface_drafts.public_safe = false then 'Approved draft needs public-safe decision'
    else 'Surface draft needs review'
  end as review_reason,
  case
    when surface_drafts.review_status = 'pending_review' then 80
    when surface_drafts.review_status = 'revised' then 70
    when surface_drafts.review_status = 'draft' then 50
    when surface_drafts.review_status = 'approved' and surface_drafts.public_safe = false then 55
    else 40
  end as priority_weight,
  surface_drafts.inquiry_id,
  surface_drafts.entity_id,
  surface_drafts.created_by as submitted_by,
  surface_drafts.created_at,
  surface_drafts.updated_at,
  jsonb_build_object(
    'surface_type', surface_drafts.surface_type,
    'public_safe', surface_drafts.public_safe,
    'ai_run_id', surface_drafts.ai_run_id
  ) as metadata
from public.surface_drafts
where surface_drafts.review_status in ('draft', 'pending_review', 'revised')
   or (surface_drafts.review_status = 'approved' and surface_drafts.public_safe = false)

union all

select
  'correction'::text as subject_type,
  corrections.id as subject_id,
  concat('Correction: ', corrections.subject_type) as title,
  corrections.correction_text as summary,
  corrections.correction_status as review_status,
  case
    when corrections.correction_status = 'submitted' then 'New correction needs review'
    when corrections.correction_status = 'unresolved' then 'Unresolved correction needs decision'
    else 'Correction needs review'
  end as review_reason,
  case
    when corrections.correction_status = 'unresolved' then 85
    when corrections.correction_status = 'submitted' then 75
    else 40
  end as priority_weight,
  null::uuid as inquiry_id,
  case
    when corrections.subject_type = 'entity' then corrections.subject_id
    else null::uuid
  end as entity_id,
  corrections.submitted_by,
  corrections.created_at,
  corrections.created_at as updated_at,
  jsonb_build_object(
    'correction_subject_type', corrections.subject_type,
    'correction_subject_id', corrections.subject_id
  ) as metadata
from public.corrections
where corrections.correction_status in ('submitted', 'unresolved');
