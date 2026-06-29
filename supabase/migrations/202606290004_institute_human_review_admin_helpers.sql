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
    else 'Relationship needs review'
  end as review_reason,
  case
    when entity_relationships.review_status = 'disputed' then 90
    when entity_relationships.review_status = 'pending_review' then 75
    when entity_relationships.review_status = 'suggested' then 65
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
    else 'Surface draft needs review'
  end as review_reason,
  case
    when surface_drafts.review_status = 'pending_review' then 80
    when surface_drafts.review_status = 'revised' then 70
    when surface_drafts.review_status = 'draft' then 50
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

create or replace view public.institute_admin_overview_counts
with (security_invoker = true) as
select
  'review_queue_items'::text as metric_key,
  count(*)::bigint as metric_value,
  now() as measured_at
from public.institute_review_queue_items

union all

select
  'active_inquiries'::text as metric_key,
  count(*)::bigint as metric_value,
  now() as measured_at
from public.inquiries
where status in ('open', 'active')

union all

select
  'retrieval_ready_evidence'::text as metric_key,
  count(*)::bigint as metric_value,
  now() as measured_at
from public.evidence_items
where review_status in ('reviewed', 'approved')
  and retrieval_status = 'default_retrieval'

union all

select
  'approved_relationships'::text as metric_key,
  count(*)::bigint as metric_value,
  now() as measured_at
from public.entity_relationships
where review_status = 'approved'

union all

select
  'pending_contributor_submissions'::text as metric_key,
  count(*)::bigint as metric_value,
  now() as measured_at
from public.contributor_submissions
where review_status in ('submitted', 'triaged', 'needs_source', 'needs_clarification');

create or replace view public.institute_admin_inquiry_evidence
with (security_invoker = true) as
select
  inquiries.id as inquiry_id,
  inquiries.inquiry_number,
  inquiries.title as inquiry_title,
  inquiries.slug as inquiry_slug,
  evidence_items.id as evidence_id,
  evidence_items.title as evidence_title,
  evidence_items.evidence_type,
  evidence_items.summary,
  evidence_items.review_status,
  evidence_items.retrieval_status,
  inquiry_evidence.use_note,
  inquiry_evidence.added_by,
  inquiry_evidence.added_at
from public.inquiry_evidence
join public.inquiries
  on inquiries.id = inquiry_evidence.inquiry_id
join public.evidence_items
  on evidence_items.id = inquiry_evidence.evidence_id;

create or replace view public.institute_admin_entity_relationships
with (security_invoker = true) as
select
  entity_relationships.id as relationship_id,
  entity_relationships.relationship_type,
  entity_relationships.reason,
  entity_relationships.confidence,
  entity_relationships.review_status,
  entity_relationships.public_safe,
  entity_relationships.source_entity_id,
  source_entity.entity_type as source_entity_type,
  source_entity.name as source_entity_name,
  source_entity.slug as source_entity_slug,
  entity_relationships.target_entity_id,
  target_entity.entity_type as target_entity_type,
  target_entity.name as target_entity_name,
  target_entity.slug as target_entity_slug,
  entity_relationships.created_by,
  entity_relationships.reviewed_by,
  entity_relationships.reviewed_at,
  entity_relationships.created_at,
  entity_relationships.updated_at
from public.entity_relationships
join public.cultural_entities as source_entity
  on source_entity.id = entity_relationships.source_entity_id
join public.cultural_entities as target_entity
  on target_entity.id = entity_relationships.target_entity_id;

grant select on public.institute_review_queue_items to authenticated;
grant select on public.institute_admin_overview_counts to authenticated;
grant select on public.institute_admin_inquiry_evidence to authenticated;
grant select on public.institute_admin_entity_relationships to authenticated;
